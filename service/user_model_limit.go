package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/common/limiter"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

// Per-user, per-model TPM/RPM rate limiting.
//
// RPM uses a token bucket scaled so that one request consumes `window` tokens
// and the bucket refills at `rpm` tokens/second with capacity `rpm*window`,
// i.e. `rpm` requests per window (failures included, deducted at admission).
//
// TPM reserves the estimate atomically at admission, then adjusts by
// actual-reserved at settlement. Unsettled reservations are released when the
// request ends. Buckets are scaled by the window so all arithmetic stays
// integer: capacity = tpm*window, rate = tpm, and N tokens cost N*window.

const errorCodeUserModelRateLimit = types.ErrorCode("rate_limit_exceeded")

// AdmitUserModelRateLimit performs RPM + TPM admission before the upstream call.
// It returns a 429 *types.NewAPIError when the request must be rejected, else nil.
func AdmitUserModelRateLimit(c *gin.Context, relayInfo *relaycommon.RelayInfo, estimateTokens int, maxTokens int) *types.NewAPIError {
	if !setting.UserModelRateLimitEnabled() || relayInfo == nil || relayInfo.UserId <= 0 {
		return nil
	}
	limit, hasLimit := resolveUserModelLimit(relayInfo)
	if !hasLimit {
		return nil
	}
	userId := relayInfo.UserId
	modelName := relayInfo.OriginModelName
	window := int64(setting.UserModelRateLimitWindowSeconds())
	ctx := c.Request.Context()

	if limit.RPM > 0 {
		if !rpmAllow(ctx, umrlRPMKey(userId, modelName), limit.RPM, window) {
			c.Header("Retry-After", strconv.FormatInt(window, 10))
			return newRateLimitError(fmt.Sprintf(
				"requests-per-minute limit reached for model %s (%d per %ds)", modelName, limit.RPM, window))
		}
	}

	if limit.TPM > 0 {
		est := estimateTokens
		if maxTokens > 0 {
			est += maxTokens
		}
		// est<=0 means no usable estimate (e.g. deferred token counting for trusted
		// wallets). Skip admission and rely on the post-response deduction instead.
		if est > 0 {
			capacity, rate := tpmBucketParams(limit.TPM, window)
			reserved, allowed := tpmReserve(ctx, umrlTPMKey(userId, modelName), capacity, rate, int64(est)*window)
			if !allowed {
				c.Header("Retry-After", strconv.FormatInt(window, 10))
				return newRateLimitError(fmt.Sprintf(
					"tokens-per-minute limit reached for model %s (%d per %ds)", modelName, limit.TPM, window))
			}
			relayInfo.UserModelTPMReserved = reserved
			relayInfo.UserModelTPMCapacity = capacity
			relayInfo.UserModelTPMRate = rate
		}
	}
	return nil
}

// RecordUserModelTokenUsage applies actual usage against the reserved TPM budget
// after settlement (token_mode selects total vs input-only).
func RecordUserModelTokenUsage(c *gin.Context, relayInfo *relaycommon.RelayInfo, promptTokens int, completionTokens int) {
	if relayInfo == nil || relayInfo.UserModelTPMSettled {
		return
	}

	var actual int
	tpm := 0
	if setting.UserModelRateLimitEnabled() {
		limit, hasLimit := resolveUserModelLimit(relayInfo)
		if hasLimit && limit.TPM > 0 {
			tpm = limit.TPM
			if limit.TokenMode == setting.UserModelTokenModeInput {
				actual = promptTokens
			} else {
				actual = promptTokens + completionTokens
			}
		}
	}
	if actual < 0 {
		actual = 0
	}

	window := int64(setting.UserModelRateLimitWindowSeconds())
	capacity := relayInfo.UserModelTPMCapacity
	rate := relayInfo.UserModelTPMRate
	if capacity <= 0 || rate <= 0 {
		if tpm <= 0 {
			return
		}
		capacity, rate = tpmBucketParams(tpm, window)
	}

	reserved := relayInfo.UserModelTPMReserved
	if reserved == 0 && actual <= 0 {
		return
	}
	delta := int64(actual)*window - reserved
	tpmAdjust(c.Request.Context(), umrlTPMKey(relayInfo.UserId, relayInfo.OriginModelName), capacity, rate, delta)
	relayInfo.UserModelTPMSettled = true
}

// ReleaseUnsettledUserModelTPM refunds an unused TPM reservation when the request
// ends without settlement (upstream failure, or a success path that never billed).
func ReleaseUnsettledUserModelTPM(c *gin.Context, relayInfo *relaycommon.RelayInfo) {
	if relayInfo == nil || relayInfo.UserModelTPMSettled || relayInfo.UserModelTPMReserved == 0 {
		return
	}
	capacity := relayInfo.UserModelTPMCapacity
	rate := relayInfo.UserModelTPMRate
	if capacity <= 0 || rate <= 0 {
		relayInfo.UserModelTPMReserved = 0
		return
	}
	ctx := context.Background()
	if c != nil && c.Request != nil {
		ctx = c.Request.Context()
	}
	tpmAdjust(ctx, umrlTPMKey(relayInfo.UserId, relayInfo.OriginModelName),
		capacity, rate, -relayInfo.UserModelTPMReserved)
	relayInfo.UserModelTPMSettled = true
	relayInfo.UserModelTPMReserved = 0
}

func tpmBucketParams(tpm int, window int64) (capacity, rate int64) {
	return int64(tpm) * window, int64(tpm)
}

// resolveUserModelLimit merges the settings hierarchy with per-user table
// overrides (user default, then user+model — highest priority). The second
// return value reports whether any positive limit is configured.
func resolveUserModelLimit(relayInfo *relaycommon.RelayInfo) (setting.ModelRateLimit, bool) {
	group := relayInfo.TokenGroup
	if group == "" {
		group = relayInfo.UserGroup
	}
	if group == "" {
		group = relayInfo.UsingGroup
	}
	resolved := setting.ResolveSettingsModelLimit(group, relayInfo.OriginModelName)

	for _, r := range model.GetUserModelRateLimitsCached(relayInfo.UserId) {
		if !r.Enabled || r.ModelName != "" {
			continue
		}
		setting.MergeUserModelRateLimit(&resolved, setting.ModelRateLimit{RPM: r.RPM, TPM: r.TPM, TokenMode: r.TokenMode})
	}
	for _, r := range model.GetUserModelRateLimitsCached(relayInfo.UserId) {
		if !r.Enabled || r.ModelName != relayInfo.OriginModelName {
			continue
		}
		setting.MergeUserModelRateLimit(&resolved, setting.ModelRateLimit{RPM: r.RPM, TPM: r.TPM, TokenMode: r.TokenMode})
	}
	return resolved, resolved.RPM > 0 || resolved.TPM > 0
}

func newRateLimitError(msg string) *types.NewAPIError {
	return types.NewErrorWithStatusCode(errors.New(msg), errorCodeUserModelRateLimit,
		http.StatusTooManyRequests, types.ErrOptionWithSkipRetry())
}

func umrlRPMKey(userId int, model string) string {
	return "rateLimit:umrpm:" + strconv.Itoa(userId) + ":" + model
}

func umrlTPMKey(userId int, model string) string {
	return "rateLimit:umtpm:" + strconv.Itoa(userId) + ":" + model
}

// ------------------------------------------------------------------- backends

func rpmAllow(ctx context.Context, key string, rpm int, window int64) bool {
	if common.RedisEnabled {
		tb := limiter.New(ctx, common.RDB)
		allowed, err := tb.Allow(ctx, key,
			limiter.WithCapacity(int64(rpm)*window),
			limiter.WithRate(int64(rpm)),
			limiter.WithRequested(window))
		if err != nil {
			common.SysError("user-model RPM check failed (allowing): " + err.Error())
			return true // fail-open
		}
		return allowed
	}
	memRPMInit()
	return memRPMLimiter.Request(key, rpm, window)
}

func tpmReserve(ctx context.Context, key string, capacity, rate, requested int64) (reserved int64, allowed bool) {
	if common.RedisEnabled {
		tb := limiter.New(ctx, common.RDB)
		reserved, allowed, err := tb.Reserve(ctx, key,
			limiter.WithCapacity(capacity),
			limiter.WithRate(rate),
			limiter.WithRequested(requested))
		if err != nil {
			common.SysError("user-model TPM reserve failed (allowing): " + err.Error())
			return 0, true // fail-open
		}
		return reserved, allowed
	}
	return memTPMReserve(key, capacity, rate, requested)
}

func tpmAdjust(ctx context.Context, key string, capacity, rate, delta int64) {
	if delta == 0 {
		return
	}
	if common.RedisEnabled {
		tb := limiter.New(ctx, common.RDB)
		if _, err := tb.Adjust(ctx, key, delta, limiter.WithCapacity(capacity), limiter.WithRate(rate)); err != nil {
			common.SysError("user-model TPM adjust failed: " + err.Error())
		}
		return
	}
	memTPMAdjust(key, capacity, rate, delta)
}

// ------------------------------------------------- in-memory fallback (single node)

var (
	memRPMLimiter   common.InMemoryRateLimiter
	memRPMInitOnce  sync.Once
	memTPMMutex     sync.Mutex
	memTPMBuckets   = map[string]*memTokenBucket{}
	memTPMJanitorOn sync.Once
)

type memTokenBucket struct {
	tokens float64
	last   time.Time
}

func memRPMInit() {
	memRPMInitOnce.Do(func() {
		memRPMLimiter.Init(5 * time.Minute)
	})
}

func memTPMRefill(key string, capacity, rate int64, now time.Time) *memTokenBucket {
	b, ok := memTPMBuckets[key]
	if !ok {
		b = &memTokenBucket{tokens: float64(capacity), last: now}
		memTPMBuckets[key] = b
		return b
	}
	elapsed := now.Sub(b.last).Seconds()
	if elapsed > 0 {
		b.tokens = math.Min(float64(capacity), b.tokens+elapsed*float64(rate))
		b.last = now
	}
	return b
}

func memTPMReserve(key string, capacity, rate, requested int64) (reserved int64, allowed bool) {
	memTPMMutex.Lock()
	defer memTPMMutex.Unlock()
	memTPMStartJanitor()
	b := memTPMRefill(key, capacity, rate, time.Now())
	if requested > capacity {
		if b.tokens <= 0 {
			return 0, false
		}
		before := b.tokens
		b.tokens -= float64(requested)
		if b.tokens < -float64(capacity) {
			b.tokens = -float64(capacity)
		}
		return int64(before - b.tokens), true
	}
	if b.tokens >= float64(requested) {
		b.tokens -= float64(requested)
		return requested, true
	}
	return 0, false
}

func memTPMAdjust(key string, capacity, rate, delta int64) {
	memTPMMutex.Lock()
	defer memTPMMutex.Unlock()
	memTPMStartJanitor()
	b := memTPMRefill(key, capacity, rate, time.Now())
	b.tokens -= float64(delta)
	if b.tokens < -float64(capacity) {
		b.tokens = -float64(capacity)
	} else if b.tokens > float64(capacity) {
		b.tokens = float64(capacity)
	}
}

// memTPMStartJanitor evicts fully-refilled, idle buckets to bound key growth.
// Caller must hold memTPMMutex.
func memTPMStartJanitor() {
	memTPMJanitorOn.Do(func() {
		go func() {
			for {
				time.Sleep(10 * time.Minute)
				now := time.Now()
				memTPMMutex.Lock()
				for k, b := range memTPMBuckets {
					if now.Sub(b.last) > 30*time.Minute {
						delete(memTPMBuckets, k)
					}
				}
				memTPMMutex.Unlock()
			}
		}()
	})
}
