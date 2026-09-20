package setting

import (
	"fmt"
	"math"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// Per-user/per-model TPM & RPM rate limiting configuration.
//
// Limit value semantics (RPM and TPM independently):
//   0  -> inherit / unset (fall through to the next, less specific level)
//   -1 -> explicit unlimited (stops inheritance, no limit applied)
//   >0 -> the concrete limit for the window
//
// TokenMode semantics (TPM accounting basis):
//   ""      -> inherit
//   "total" -> prompt + completion tokens (default for most models)
//   "input" -> prompt tokens only (e.g. Claude-style billing)

const (
	UserModelTokenModeTotal = "total"
	UserModelTokenModeInput = "input"

	UserModelLimitUnlimited = -1

	userModelRateLimitOptionKey = "UserModelRateLimitConfig"
)

// maxUserModelRateLimitWindowSeconds bounds the token-bucket capacity product
// (limit * windowSeconds) inside int64. TPM buckets use capacity = tpm*window.
const maxUserModelRateLimitWindowSeconds = 24 * 60 * 60

// maxUserModelRateLimitValue is the largest RPM/TPM that cannot overflow
// int64(value)*window for a window of at most 24h.
const maxUserModelRateLimitValue int64 = math.MaxInt64 / maxUserModelRateLimitWindowSeconds

// ModelRateLimit is one RPM/TPM/token_mode triple.
type ModelRateLimit struct {
	RPM       int    `json:"rpm"`
	TPM       int    `json:"tpm"`
	TokenMode string `json:"token_mode"`
}

// GroupModelRateLimit holds a group-level default plus per-model overrides.
type GroupModelRateLimit struct {
	Default ModelRateLimit            `json:"default"`
	Models  map[string]ModelRateLimit `json:"models"`
}

// UserModelRateLimitConfig is the whole admin-configurable settings block,
// persisted as a single JSON option (key: UserModelRateLimitConfig).
type UserModelRateLimitConfig struct {
	Enabled         bool                           `json:"enabled"`
	DurationMinutes int                            `json:"duration_minutes"`
	Default         ModelRateLimit                 `json:"default"`
	Models          map[string]ModelRateLimit      `json:"models"`
	Groups          map[string]GroupModelRateLimit `json:"groups"`
}

var (
	userModelRateLimit      = UserModelRateLimitConfig{DurationMinutes: 1, Default: ModelRateLimit{TokenMode: UserModelTokenModeTotal}}
	userModelRateLimitMutex sync.RWMutex
)

// UserModelRateLimitOptionKey exposes the option key for model/option.go wiring.
func UserModelRateLimitOptionKey() string { return userModelRateLimitOptionKey }

func UserModelRateLimitConfig2JSONString() string {
	userModelRateLimitMutex.RLock()
	defer userModelRateLimitMutex.RUnlock()
	b, err := common.Marshal(userModelRateLimit)
	if err != nil {
		common.SysLog("error marshalling user model rate limit config: " + err.Error())
	}
	return string(b)
}

func UpdateUserModelRateLimitConfigByJSONString(jsonStr string) error {
	var cfg UserModelRateLimitConfig
	if err := common.Unmarshal([]byte(jsonStr), &cfg); err != nil {
		return err
	}
	if err := validateUserModelRateLimitConfig(&cfg); err != nil {
		return err
	}
	normalizeUserModelRateLimitConfig(&cfg)

	userModelRateLimitMutex.Lock()
	defer userModelRateLimitMutex.Unlock()
	userModelRateLimit = cfg
	return nil
}

func ValidateUserModelRateLimitConfig(jsonStr string) error {
	var cfg UserModelRateLimitConfig
	if err := common.Unmarshal([]byte(jsonStr), &cfg); err != nil {
		return err
	}
	return validateUserModelRateLimitConfig(&cfg)
}

func validateUserModelRateLimitConfig(cfg *UserModelRateLimitConfig) error {
	if cfg.DurationMinutes < 0 || int64(cfg.DurationMinutes) > maxUserModelRateLimitWindowSeconds/60 {
		return fmt.Errorf("duration_minutes %d out of range", cfg.DurationMinutes)
	}
	if err := validateModelRateLimit("default", cfg.Default); err != nil {
		return err
	}
	for name, l := range cfg.Models {
		if err := validateModelRateLimit("model "+name, l); err != nil {
			return err
		}
	}
	for g, gl := range cfg.Groups {
		if err := validateModelRateLimit("group "+g+" default", gl.Default); err != nil {
			return err
		}
		for name, l := range gl.Models {
			if err := validateModelRateLimit(fmt.Sprintf("group %s model %s", g, name), l); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateModelRateLimit(label string, l ModelRateLimit) error {
	for _, v := range []int{l.RPM, l.TPM} {
		if v < UserModelLimitUnlimited {
			return fmt.Errorf("%s has negative rate limit value %d", label, v)
		}
		if int64(v) > maxUserModelRateLimitValue {
			return fmt.Errorf("%s value %d exceeds max %d", label, v, maxUserModelRateLimitValue)
		}
	}
	switch l.TokenMode {
	case "", UserModelTokenModeTotal, UserModelTokenModeInput:
	default:
		return fmt.Errorf("%s has invalid token_mode %q", label, l.TokenMode)
	}
	return nil
}

func normalizeUserModelRateLimitConfig(cfg *UserModelRateLimitConfig) {
	if cfg.DurationMinutes <= 0 {
		cfg.DurationMinutes = 1
	}
	if cfg.Default.TokenMode == "" {
		cfg.Default.TokenMode = UserModelTokenModeTotal
	}
	if cfg.Models == nil {
		cfg.Models = map[string]ModelRateLimit{}
	}
	if cfg.Groups == nil {
		cfg.Groups = map[string]GroupModelRateLimit{}
	}
}

// UserModelRateLimitEnabled reports whether the feature is turned on.
func UserModelRateLimitEnabled() bool {
	userModelRateLimitMutex.RLock()
	defer userModelRateLimitMutex.RUnlock()
	return userModelRateLimit.Enabled
}

// UserModelRateLimitWindowSeconds returns the limit window in seconds (>=1).
func UserModelRateLimitWindowSeconds() int {
	userModelRateLimitMutex.RLock()
	defer userModelRateLimitMutex.RUnlock()
	minutes := userModelRateLimit.DurationMinutes
	if minutes <= 0 {
		minutes = 1
	}
	return minutes * 60
}

// ResolveSettingsModelLimit merges the settings-level hierarchy (lowest to
// highest priority): global default -> global model -> group default ->
// group model. Per-user table overrides are applied by the caller on top.
// The returned TokenMode is never empty (defaults to total).
func ResolveSettingsModelLimit(group, model string) ModelRateLimit {
	userModelRateLimitMutex.RLock()
	defer userModelRateLimitMutex.RUnlock()

	return userModelRateLimit.ResolveModelLimit(group, model)
}

// ResolveModelLimit resolves one model against an immutable configuration snapshot.
func (cfg UserModelRateLimitConfig) ResolveModelLimit(group, model string) ModelRateLimit {
	merged := ModelRateLimit{}
	mergeModelRateLimit(&merged, cfg.Default)
	if m, ok := cfg.Models[model]; ok {
		mergeModelRateLimit(&merged, m)
	}
	if group != "" {
		if gl, ok := cfg.Groups[group]; ok {
			mergeModelRateLimit(&merged, gl.Default)
			if m, ok := gl.Models[model]; ok {
				mergeModelRateLimit(&merged, m)
			}
		}
	}
	if merged.TokenMode == "" {
		merged.TokenMode = UserModelTokenModeTotal
	}
	return merged
}

// mergeModelRateLimit overlays only the fields that src explicitly sets,
// so unset (0 / "") fields inherit from lower-priority levels.
func mergeModelRateLimit(dst *ModelRateLimit, src ModelRateLimit) {
	if src.RPM != 0 {
		dst.RPM = src.RPM
	}
	if src.TPM != 0 {
		dst.TPM = src.TPM
	}
	if src.TokenMode != "" {
		dst.TokenMode = src.TokenMode
	}
}

// MergeUserModelRateLimit overlays a higher-priority limit onto a resolved one,
// used to apply per-user table overrides above the settings resolution.
func MergeUserModelRateLimit(dst *ModelRateLimit, src ModelRateLimit) {
	mergeModelRateLimit(dst, src)
}

// UserModelRateLimitSnapshot exposes a read-only view of one configuration.
// Updates replace the configuration and its maps instead of mutating them.
type UserModelRateLimitSnapshot struct {
	Enabled       bool
	WindowSeconds int
	config        UserModelRateLimitConfig
}

func (s UserModelRateLimitSnapshot) ResolveModelLimit(group, model string) ModelRateLimit {
	return s.config.ResolveModelLimit(group, model)
}

// SnapshotUserModelRateLimits captures the switch, window and hierarchy under
// one lock without copying every model for each request.
func SnapshotUserModelRateLimits() UserModelRateLimitSnapshot {
	userModelRateLimitMutex.RLock()
	defer userModelRateLimitMutex.RUnlock()
	return UserModelRateLimitSnapshot{
		Enabled:       userModelRateLimit.Enabled,
		WindowSeconds: max(1, userModelRateLimit.DurationMinutes) * 60,
		config:        userModelRateLimit,
	}
}
