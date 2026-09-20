package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMemTPMBucketReserveAdjustOverdraft(t *testing.T) {
	const key = "test:memtpm:basic"
	memTPMMutex.Lock()
	delete(memTPMBuckets, key)
	memTPMMutex.Unlock()

	reserved, allowed := memTPMReserve(key, 1000, 100, 300)
	require.True(t, allowed)
	assert.EqualValues(t, 300, reserved)

	reserved, allowed = memTPMReserve(key, 1000, 100, 300)
	require.True(t, allowed)
	assert.EqualValues(t, 300, reserved)

	_, allowed = memTPMReserve(key, 1000, 100, 500)
	assert.False(t, allowed, "reserve must deduct, so 500 no longer fits")

	// A request larger than capacity is admitted while any budget remains,
	// so a single oversized request can never deadlock the bucket.
	reserved, allowed = memTPMReserve(key, 1000, 100, 5000)
	require.True(t, allowed)
	assert.EqualValues(t, 1400, reserved)

	memTPMMutex.Lock()
	tokens := memTPMBuckets[key].tokens
	memTPMMutex.Unlock()
	assert.InDelta(t, -1000, tokens, 0.001)

	memTPMAdjust(key, 1000, 100, -5000)
	memTPMMutex.Lock()
	tokens = memTPMBuckets[key].tokens
	memTPMMutex.Unlock()
	assert.InDelta(t, 1000, tokens, 0.001, "refund must not exceed capacity")
}

func TestRPMAllowInMemoryEnforcesWindowLimit(t *testing.T) {
	const key = "test:memrpm:basic"
	// window=60s, rpm=2 -> two requests admitted, third blocked within the window.
	assert.True(t, rpmAllow(t.Context(), key, 2, 60))
	assert.True(t, rpmAllow(t.Context(), key, 2, 60))
	assert.False(t, rpmAllow(t.Context(), key, 2, 60))
}

func newTestGinContext(t *testing.T) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c, w
}

func TestAdmitUserModelRateLimitDisabledIsNoop(t *testing.T) {
	require.NoError(t, setting.UpdateUserModelRateLimitConfigByJSONString(
		`{"enabled":false,"duration_minutes":1,"default":{"rpm":1}}`))
	c, _ := newTestGinContext(t)
	relayInfo := &relaycommon.RelayInfo{UserId: 1, OriginModelName: "gpt-4o", UserGroup: "default"}
	assert.Nil(t, AdmitUserModelRateLimit(c, relayInfo, 10, 100),
		"disabled feature must never reject")
}

func TestAdmitUserModelRateLimitRPM(t *testing.T) {
	require.NoError(t, model.DB.AutoMigrate(&model.UserModelRateLimit{}))
	require.NoError(t, setting.UpdateUserModelRateLimitConfigByJSONString(
		`{"enabled":true,"duration_minutes":1,"default":{"rpm":2}}`))
	t.Cleanup(func() { model.DB.Exec("DELETE FROM user_model_rate_limits") })

	relayInfo := &relaycommon.RelayInfo{UserId: 4242, OriginModelName: "rpm-model", UserGroup: "default"}

	// First two requests admitted.
	for range 2 {
		c, _ := newTestGinContext(t)
		assert.Nil(t, AdmitUserModelRateLimit(c, relayInfo, 10, 100))
	}

	// Third request rejected with 429 + Retry-After.
	c, w := newTestGinContext(t)
	apiErr := AdmitUserModelRateLimit(c, relayInfo, 10, 100)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusTooManyRequests, apiErr.StatusCode)
	assert.Equal(t, "60", w.Header().Get("Retry-After"))
}

func TestRecordUserModelTokenUsageTokenModes(t *testing.T) {
	require.NoError(t, model.DB.AutoMigrate(&model.UserModelRateLimit{}))
	require.NoError(t, setting.UpdateUserModelRateLimitConfigByJSONString(
		`{"enabled":true,"duration_minutes":1,"default":{"tpm":100000}}`))
	t.Cleanup(func() { model.DB.Exec("DELETE FROM user_model_rate_limits") })

	readTokens := func(key string) float64 {
		memTPMMutex.Lock()
		defer memTPMMutex.Unlock()
		b, ok := memTPMBuckets[key]
		if !ok {
			return 0
		}
		return b.tokens
	}

	// token_mode=total deducts prompt+completion.
	totalModel := "record-total"
	totalInfo := &relaycommon.RelayInfo{UserId: 5150, OriginModelName: totalModel, UserGroup: "default"}
	require.NoError(t, setting.UpdateUserModelRateLimitConfigByJSONString(
		`{"enabled":true,"duration_minutes":1,"models":{"record-total":{"tpm":100000,"token_mode":"total"},"record-input":{"tpm":100000,"token_mode":"input"}}}`))
	totalKey := umrlTPMKey(5150, totalModel)
	memTPMMutex.Lock()
	delete(memTPMBuckets, totalKey)
	memTPMMutex.Unlock()

	c, _ := newTestGinContext(t)
	RecordUserModelTokenUsage(c, totalInfo, 300, 200)
	// capacity=100000*60, consumed=(300+200)*60
	assert.InDelta(t, float64(100000*60-500*60), readTokens(totalKey), 1.0)

	// token_mode=input deducts prompt only.
	inputModel := "record-input"
	inputInfo := &relaycommon.RelayInfo{UserId: 5151, OriginModelName: inputModel, UserGroup: "default"}
	inputKey := umrlTPMKey(5151, inputModel)
	memTPMMutex.Lock()
	delete(memTPMBuckets, inputKey)
	memTPMMutex.Unlock()

	c2, _ := newTestGinContext(t)
	RecordUserModelTokenUsage(c2, inputInfo, 300, 200)
	assert.InDelta(t, float64(100000*60-300*60), readTokens(inputKey), 1.0)
}

func TestRecordUserModelTokenUsageSettlesAgainstReservation(t *testing.T) {
	require.NoError(t, setting.UpdateUserModelRateLimitConfigByJSONString(
		`{"enabled":true,"duration_minutes":1,"default":{"tpm":100000,"token_mode":"total"}}`))
	t.Cleanup(func() {
		_ = setting.UpdateUserModelRateLimitConfigByJSONString(`{"enabled":false,"duration_minutes":1}`)
	})

	readTokens := func(key string) float64 {
		memTPMMutex.Lock()
		defer memTPMMutex.Unlock()
		if b, ok := memTPMBuckets[key]; ok {
			return b.tokens
		}
		return 0
	}

	info := &relaycommon.RelayInfo{UserId: 7171, OriginModelName: "settle-delta", UserGroup: "default"}
	key := umrlTPMKey(7171, "settle-delta")
	memTPMMutex.Lock()
	delete(memTPMBuckets, key)
	memTPMMutex.Unlock()

	c, _ := newTestGinContext(t)
	require.Nil(t, AdmitUserModelRateLimit(c, info, 10, 0))
	assert.EqualValues(t, 10*60, info.UserModelTPMReserved)
	assert.InDelta(t, float64(100000*60-10*60), readTokens(key), 1.0)

	RecordUserModelTokenUsage(c, info, 4, 0)
	assert.True(t, info.UserModelTPMSettled)
	assert.InDelta(t, float64(100000*60-4*60), readTokens(key), 1.0)

	RecordUserModelTokenUsage(c, info, 4, 0)
	assert.InDelta(t, float64(100000*60-4*60), readTokens(key), 1.0, "second settle must be a no-op")
}

func TestReleaseUnsettledUserModelTPMRefundsReservation(t *testing.T) {
	require.NoError(t, setting.UpdateUserModelRateLimitConfigByJSONString(
		`{"enabled":true,"duration_minutes":1,"default":{"tpm":100000}}`))
	t.Cleanup(func() {
		_ = setting.UpdateUserModelRateLimitConfigByJSONString(`{"enabled":false,"duration_minutes":1}`)
	})

	info := &relaycommon.RelayInfo{UserId: 8181, OriginModelName: "release-tpm", UserGroup: "default"}
	key := umrlTPMKey(8181, "release-tpm")
	memTPMMutex.Lock()
	delete(memTPMBuckets, key)
	memTPMMutex.Unlock()

	c, _ := newTestGinContext(t)
	require.Nil(t, AdmitUserModelRateLimit(c, info, 20, 0))

	ReleaseUnsettledUserModelTPM(c, info)
	assert.True(t, info.UserModelTPMSettled)
	assert.Zero(t, info.UserModelTPMReserved)

	memTPMMutex.Lock()
	tokens := memTPMBuckets[key].tokens
	memTPMMutex.Unlock()
	assert.InDelta(t, float64(100000*60), tokens, 1.0)

	ReleaseUnsettledUserModelTPM(c, info)
}

func TestResolveUserModelLimitPerUserOverride(t *testing.T) {
	require.NoError(t, model.DB.AutoMigrate(&model.UserModelRateLimit{}))
	require.NoError(t, setting.UpdateUserModelRateLimitConfigByJSONString(
		`{"enabled":true,"duration_minutes":1,"default":{"rpm":10,"tpm":1000,"token_mode":"total"}}`))
	t.Cleanup(func() { model.DB.Exec("DELETE FROM user_model_rate_limits") })

	const userId = 6161
	// Per-user default row overrides rpm.
	require.NoError(t, (&model.UserModelRateLimit{UserId: userId, ModelName: "", RPM: 99, Enabled: true}).Insert())
	// Per-user model row overrides tpm + token_mode for one model.
	require.NoError(t, (&model.UserModelRateLimit{UserId: userId, ModelName: "special", TPM: 555, TokenMode: "input", Enabled: true}).Insert())

	model.InvalidateUserModelRateLimitCache(userId)

	// Generic model: rpm from user default (99), tpm from settings (1000), total.
	got, has := resolveUserModelLimit(&relaycommon.RelayInfo{UserId: userId, OriginModelName: "other", UserGroup: "default"})
	require.True(t, has)
	assert.EqualValues(t, 99, got.Requests)
	assert.EqualValues(t, 1000, got.Tokens)
	assert.Equal(t, setting.UserModelTokenModeTotal, got.TokenMode)

	// Special model: rpm 99 (user default), tpm 555 (user model), token_mode input.
	got, has = resolveUserModelLimit(&relaycommon.RelayInfo{UserId: userId, OriginModelName: "special", UserGroup: "default"})
	require.True(t, has)
	assert.EqualValues(t, 99, got.Requests)
	assert.EqualValues(t, 555, got.Tokens)
	assert.Equal(t, setting.UserModelTokenModeInput, got.TokenMode)

	// A disabled row is ignored.
	require.NoError(t, (&model.UserModelRateLimit{UserId: 6162, ModelName: "", RPM: 1, Enabled: false}).Insert())
	model.InvalidateUserModelRateLimitCache(6162)
	got, has = resolveUserModelLimit(&relaycommon.RelayInfo{UserId: 6162, OriginModelName: "x", UserGroup: "default"})
	require.True(t, has, "settings default still applies")
	assert.EqualValues(t, 10, got.Requests)
}

func TestUserModelLimitResolverKeepsSettingsSnapshot(t *testing.T) {
	require.NoError(t, model.DB.AutoMigrate(&model.UserModelRateLimit{}))
	previous := setting.UserModelRateLimitConfig2JSONString()
	t.Cleanup(func() { require.NoError(t, setting.UpdateUserModelRateLimitConfigByJSONString(previous)) })
	require.NoError(t, setting.UpdateUserModelRateLimitConfigByJSONString(`{"enabled":true,"duration_minutes":5,"default":{"rpm":10},"models":{"m":{"tpm":500}}}`))
	resolver := NewUserModelLimitResolver(99921, "default")
	require.NoError(t, setting.UpdateUserModelRateLimitConfigByJSONString(`{"enabled":false,"duration_minutes":1,"default":{"rpm":99}}`))
	got := resolver.Resolve("m")
	assert.True(t, got.Enabled)
	assert.Equal(t, 10, got.Requests)
	assert.Equal(t, 500, got.Tokens)
	assert.Equal(t, 300, got.WindowSeconds)
	disabled := NewUserModelLimitResolver(99921, "default").Resolve("m")
	assert.False(t, disabled.Enabled)
	assert.Zero(t, disabled.Requests)
	assert.Zero(t, disabled.Tokens)
}
