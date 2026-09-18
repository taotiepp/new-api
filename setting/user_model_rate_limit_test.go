package setting

import (
	"math"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setUserModelRateLimitConfig installs cfg (via its JSON form) as the active
// settings block and restores the previous one after the test.
func setUserModelRateLimitConfig(t *testing.T, jsonStr string) {
	t.Helper()
	require.NoError(t, UpdateUserModelRateLimitConfigByJSONString(jsonStr))
	t.Cleanup(func() {
		// Restore a known-good default so later tests are unaffected.
		_ = UpdateUserModelRateLimitConfigByJSONString(`{"enabled":false,"duration_minutes":1}`)
	})
}

func TestResolveSettingsModelLimitHierarchy(t *testing.T) {
	setUserModelRateLimitConfig(t, `{
		"enabled": true,
		"duration_minutes": 2,
		"default": {"rpm": 10, "tpm": 1000, "token_mode": "total"},
		"models": {
			"gpt-4o": {"rpm": 20, "token_mode": "input"}
		},
		"groups": {
			"vip": {
				"default": {"tpm": 5000},
				"models": {"gpt-4o": {"rpm": 100}}
			}
		}
	}`)

	// global default applies to an unknown model / group.
	got := ResolveSettingsModelLimit("", "unknown-model")
	assert.Equal(t, ModelRateLimit{RPM: 10, TPM: 1000, TokenMode: UserModelTokenModeTotal}, got)

	// global model override: rpm replaced, token_mode replaced, tpm inherited.
	got = ResolveSettingsModelLimit("", "gpt-4o")
	assert.Equal(t, ModelRateLimit{RPM: 20, TPM: 1000, TokenMode: UserModelTokenModeInput}, got)

	// group default overrides global tpm; other fields inherited from global default.
	got = ResolveSettingsModelLimit("vip", "unknown-model")
	assert.Equal(t, ModelRateLimit{RPM: 10, TPM: 5000, TokenMode: UserModelTokenModeTotal}, got)

	// group model is highest priority: rpm=100 from group model, tpm=5000 from
	// group default, token_mode inherited from global model level (input).
	got = ResolveSettingsModelLimit("vip", "gpt-4o")
	assert.Equal(t, ModelRateLimit{RPM: 100, TPM: 5000, TokenMode: UserModelTokenModeInput}, got)
}

func TestResolveSettingsModelLimitDefaultsTokenModeToTotal(t *testing.T) {
	setUserModelRateLimitConfig(t, `{"enabled":true,"duration_minutes":1,"default":{"rpm":5}}`)
	got := ResolveSettingsModelLimit("", "any")
	assert.Equal(t, UserModelTokenModeTotal, got.TokenMode, "empty token_mode must resolve to total")
}

func TestResolveSettingsModelLimitExplicitUnlimitedStops(t *testing.T) {
	// -1 means explicit unlimited; it is a set value so it overlays (and is not
	// treated as inherit). A >0 limit at a higher level still wins.
	setUserModelRateLimitConfig(t, `{
		"enabled": true,
		"default": {"rpm": -1, "tpm": -1},
		"models": {"m": {"rpm": 30}}
	}`)
	got := ResolveSettingsModelLimit("", "m")
	assert.Equal(t, -1, got.TPM)
	assert.Equal(t, 30, got.RPM)
}

func TestMergeUserModelRateLimitOverlay(t *testing.T) {
	base := ModelRateLimit{RPM: 10, TPM: 1000, TokenMode: UserModelTokenModeTotal}

	// Only non-zero / non-empty src fields overlay.
	MergeUserModelRateLimit(&base, ModelRateLimit{RPM: 50})
	assert.Equal(t, ModelRateLimit{RPM: 50, TPM: 1000, TokenMode: UserModelTokenModeTotal}, base)

	MergeUserModelRateLimit(&base, ModelRateLimit{TokenMode: UserModelTokenModeInput})
	assert.Equal(t, UserModelTokenModeInput, base.TokenMode)

	// Explicit unlimited (-1) overlays too.
	MergeUserModelRateLimit(&base, ModelRateLimit{TPM: UserModelLimitUnlimited})
	assert.Equal(t, -1, base.TPM)
}

func TestUserModelRateLimitWindowSeconds(t *testing.T) {
	setUserModelRateLimitConfig(t, `{"enabled":true,"duration_minutes":3}`)
	assert.Equal(t, 180, UserModelRateLimitWindowSeconds())
	assert.True(t, UserModelRateLimitEnabled())

	// duration_minutes<=0 is normalized to 1 minute.
	setUserModelRateLimitConfig(t, `{"enabled":false,"duration_minutes":0}`)
	assert.Equal(t, 60, UserModelRateLimitWindowSeconds())
	assert.False(t, UserModelRateLimitEnabled())
}

func TestValidateUserModelRateLimitConfig(t *testing.T) {
	tests := []struct {
		name    string
		json    string
		wantErr bool
	}{
		{name: "valid", json: `{"enabled":true,"duration_minutes":1,"default":{"rpm":10,"tpm":100,"token_mode":"total"}}`, wantErr: false},
		{name: "empty token_mode ok", json: `{"default":{"rpm":1,"token_mode":""}}`, wantErr: false},
		{name: "input token_mode ok", json: `{"default":{"token_mode":"input"}}`, wantErr: false},
		{name: "bad token_mode", json: `{"default":{"token_mode":"bogus"}}`, wantErr: true},
		{name: "negative below -1", json: `{"default":{"rpm":-5}}`, wantErr: true},
		{name: "duration negative", json: `{"duration_minutes":-1}`, wantErr: true},
		{name: "duration too large", json: `{"duration_minutes":999999}`, wantErr: true},
		{name: "value overflow guard", json: `{"default":{"tpm":` + strconv.FormatInt(math.MaxInt64/2, 10) + `}}`, wantErr: true},
		{name: "invalid json", json: `{not json`, wantErr: true},
		{name: "group model bad token_mode", json: `{"groups":{"g":{"models":{"m":{"token_mode":"x"}}}}}`, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateUserModelRateLimitConfig(tt.json)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestUserModelRateLimitConfigJSONRoundTrip(t *testing.T) {
	original := `{
		"enabled": true,
		"duration_minutes": 5,
		"default": {"rpm": 10, "tpm": 1000, "token_mode": "total"},
		"models": {"gpt-4o": {"rpm": 20, "tpm": 0, "token_mode": "input"}},
		"groups": {"vip": {"default": {"tpm": 5000}, "models": {"claude": {"rpm": 3, "token_mode": "input"}}}}
	}`
	require.NoError(t, UpdateUserModelRateLimitConfigByJSONString(original))

	out := UserModelRateLimitConfig2JSONString()

	// Re-parsing the serialized form must yield identical resolution.
	require.NoError(t, UpdateUserModelRateLimitConfigByJSONString(out))
	assert.Equal(t, ModelRateLimit{RPM: 10, TPM: 1000, TokenMode: UserModelTokenModeTotal},
		ResolveSettingsModelLimit("", "unknown"))
	assert.Equal(t, ModelRateLimit{RPM: 20, TPM: 1000, TokenMode: UserModelTokenModeInput},
		ResolveSettingsModelLimit("", "gpt-4o"))
	assert.Equal(t, ModelRateLimit{RPM: 3, TPM: 5000, TokenMode: UserModelTokenModeInput},
		ResolveSettingsModelLimit("vip", "claude"))
}
