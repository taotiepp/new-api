package model

import (
	"bytes"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompressLogPayloadRoundTrip(t *testing.T) {
	raw := bytes.Repeat([]byte("request-body "), 80)
	encoded, truncated := compressLogPayload(raw)
	require.NotEmpty(t, encoded)
	assert.False(t, truncated)
	decoded, err := decompressLogPayload(encoded)
	require.NoError(t, err)
	assert.Equal(t, raw, decoded)

	huge := bytes.Repeat([]byte("x"), maxErrorRequestBodyBytes+32)
	encoded, truncated = compressLogPayload(huge)
	assert.True(t, truncated)
	decoded, err = decompressLogPayload(encoded)
	require.NoError(t, err)
	assert.Equal(t, huge[:maxErrorRequestBodyBytes], decoded)
}

// TestFormatUserLogsOmitsStoredOther verifies list rows do not carry other.
// Detail reads still project it, including stripping admin-only quota saturation.
func TestFormatUserLogsOmitsStoredOther(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"model_price": 0.004,
		"admin_info": map[string]any{
			"quota_saturation": map[string]any{
				"op":      "QuotaFromDecimal",
				"kind":    "overflow",
				"clamped": common.MaxQuota,
			},
		},
	})
	logs := []*Log{{Other: other, Quota: 120, CostQuota: 80}}

	formatUserLogs(logs, 0)

	assert.Empty(t, logs[0].Other)
	assert.Equal(t, 0, logs[0].CostQuota)
	assert.Equal(t, 120, logs[0].Quota)

	detail := formatLogOtherJSON(other, logOtherVisibilityUser)
	parsed, err := common.StrToMap(detail)
	require.NoError(t, err)
	_, hasAdminInfo := parsed["admin_info"]
	require.False(t, hasAdminInfo, "admin_info (and nested quota_saturation) must be stripped for non-admin detail")
	require.Contains(t, parsed, "model_price")
}

func TestFormatUserLogsKeepsCacheColumnsAndOmitsOther(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"status_code":              500,
		"cache_tokens":             128,
		"cache_creation_tokens":    64,
		"cache_creation_tokens_5m": 40,
		"cache_creation_tokens_1h": 24,
		"admin_info": map[string]any{
			"request_body":           "H4sIAAAA",
			"request_body_truncated": true,
			"upstream_body":          "secret-upstream",
		},
	})
	logs := []*Log{{Other: other, CacheReadTokens: 128, CacheWriteTokens: 64}}

	formatUserLogs(logs, 0)

	assert.Equal(t, 128, logs[0].CacheReadTokens)
	assert.Equal(t, 64, logs[0].CacheWriteTokens)
	assert.Empty(t, logs[0].Other)

	detail := formatLogOtherJSON(other, logOtherVisibilityUser)
	detailParsed, err := common.StrToMap(detail)
	require.NoError(t, err)
	assert.Equal(t, "H4sIAAAA", detailParsed["request_body"])
	assert.Equal(t, true, detailParsed["request_body_truncated"])
	assert.EqualValues(t, 128, detailParsed["cache_tokens"])
	assert.NotContains(t, detailParsed, "admin_info")
}

func TestFormatUserLogsZerosCostQuota(t *testing.T) {
	logs := []*Log{{Quota: 120, CostQuota: 80, Other: `{"user_discount":0.8}`}}

	formatUserLogs(logs, 0)

	assert.Equal(t, 0, logs[0].CostQuota)
	assert.Equal(t, 120, logs[0].Quota)
	assert.Empty(t, logs[0].Other)
}

func TestTaskPluginLogVisibilityIsRoleSeparated(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"model_price": 1.25,
		"admin_info": map[string]any{
			"task_plugin": map[string]any{
				"key":     "document-parser",
				"name":    "Document Parser",
				"version": "1.2.3",
			},
		},
		"root_info": map[string]any{
			"upstream_task_id": "upstream-private",
			"task_plugin": map[string]any{
				"generation": 42,
			},
		},
	})

	t.Run("user", func(t *testing.T) {
		logs := []*Log{{Other: other}}
		formatUserLogs(logs, 0)
		assert.Empty(t, logs[0].Other)

		parsed, err := common.StrToMap(formatLogOtherJSON(other, logOtherVisibilityUser))
		require.NoError(t, err)
		assert.NotContains(t, parsed, "admin_info")
		assert.NotContains(t, parsed, "root_info")
		assert.Equal(t, 1.25, parsed["model_price"])
	})

	t.Run("admin", func(t *testing.T) {
		logs := []*Log{{Other: other}}
		FormatAdminLogs(logs)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Contains(t, parsed, "admin_info")
		assert.NotContains(t, parsed, "root_info")
	})

	t.Run("root", func(t *testing.T) {
		logs := []*Log{{Other: other}}
		FormatRootLogs(logs)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Contains(t, parsed, "admin_info")
		assert.Contains(t, parsed, "root_info")
	})
}

func TestLegacyLogOtherVisibilityIsRoleSeparated(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"request_path":  "/v1/chat/completions",
		"channel_id":    202,
		"channel_name":  "legacy-secret-channel",
		"channel_type":  1,
		"reject_reason": "legacy-policy-rejection",
		"admin_info": map[string]any{
			"existing_admin_field": "preserved",
		},
		"root_info": map[string]any{
			"upstream_request_id": "upstream-private",
		},
		"audit_info": map[string]any{
			"method": "POST",
		},
	})

	t.Run("user", func(t *testing.T) {
		logs := []*Log{{
			Id:          99,
			ChannelId:   77,
			ChannelName: "resolved-secret-channel",
			Other:       other,
		}}

		formatUserLogs(logs, 10)

		assert.Equal(t, 11, logs[0].Id)
		assert.Equal(t, 77, logs[0].ChannelId)
		assert.Empty(t, logs[0].ChannelName)
		assert.Empty(t, logs[0].Other)

		parsed, err := common.StrToMap(formatLogOtherJSON(other, logOtherVisibilityUser))
		require.NoError(t, err)
		assert.Equal(t, "/v1/chat/completions", parsed["request_path"])
		for _, key := range []string{
			"channel_id",
			"channel_name",
			"channel_type",
			"reject_reason",
			"admin_info",
			"root_info",
			"audit_info",
		} {
			assert.NotContains(t, parsed, key)
		}
	})

	t.Run("admin", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		FormatAdminLogs(logs)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Equal(t, "legacy-secret-channel", parsed["channel_name"])
		assert.NotContains(t, parsed, "reject_reason")
		assert.NotContains(t, parsed, "root_info")
		assert.Contains(t, parsed, "audit_info")
		adminInfo, ok := parsed["admin_info"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "preserved", adminInfo["existing_admin_field"])
		assert.Equal(t, "legacy-policy-rejection", adminInfo["reject_reason"])
	})

	t.Run("root", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		FormatRootLogs(logs)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Equal(t, "legacy-secret-channel", parsed["channel_name"])
		assert.NotContains(t, parsed, "reject_reason")
		assert.Contains(t, parsed, "root_info")
		assert.Contains(t, parsed, "audit_info")
		adminInfo, ok := parsed["admin_info"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "preserved", adminInfo["existing_admin_field"])
		assert.Equal(t, "legacy-policy-rejection", adminInfo["reject_reason"])
	})
}

func TestLegacyRejectReasonDoesNotOverrideScopedValue(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"reject_reason": "legacy-value",
		"admin_info": map[string]any{
			"reject_reason": "scoped-value",
		},
	})
	logs := []*Log{{Other: other}}

	FormatRootLogs(logs)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	assert.NotContains(t, parsed, "reject_reason")
	adminInfo, ok := parsed["admin_info"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "scoped-value", adminInfo["reject_reason"])
}

func TestLegacyRejectReasonHandlesNullAdminInfo(t *testing.T) {
	logs := []*Log{{Other: `{"reject_reason":"legacy-value","admin_info":null}`}}

	FormatAdminLogs(logs)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	assert.NotContains(t, parsed, "reject_reason")
	adminInfo, ok := parsed["admin_info"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "legacy-value", adminInfo["reject_reason"])
}

func TestLogFormattingPreservesLargeIntegerLexemes(t *testing.T) {
	const other = `{"public_id":9007199254740993,"admin_info":{"admin_id":9007199254740995},"root_info":{"generation":18446744073709551615}}`

	t.Run("user", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		formatUserLogs(logs, 0)

		assert.Empty(t, logs[0].Other)
		detail := formatLogOtherJSON(other, logOtherVisibilityUser)
		assert.Contains(t, detail, `"public_id":9007199254740993`)
		assert.NotContains(t, detail, "admin_id")
		assert.NotContains(t, detail, "generation")
	})

	t.Run("admin", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		FormatAdminLogs(logs)

		assert.Contains(t, logs[0].Other, `"public_id":9007199254740993`)
		assert.Contains(t, logs[0].Other, `"admin_id":9007199254740995`)
		assert.NotContains(t, logs[0].Other, "generation")
	})

	t.Run("root", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		FormatRootLogs(logs)

		assert.Equal(t, other, logs[0].Other)
	})

	t.Run("unprivileged", func(t *testing.T) {
		const unprivileged = `{"public_id":9007199254740993,"model_price":0.004}`

		userLogs := []*Log{{Other: unprivileged}}
		formatUserLogs(userLogs, 0)
		assert.Empty(t, userLogs[0].Other)
		assert.Equal(t, unprivileged, formatLogOtherJSON(unprivileged, logOtherVisibilityUser))

		adminLogs := []*Log{{Other: unprivileged}}
		FormatAdminLogs(adminLogs)
		assert.Equal(t, unprivileged, adminLogs[0].Other)
	})
}

func TestGetLogsKeepsResponsesSlowerThanThreshold(t *testing.T) {
	require.NoError(t, LOG_DB.AutoMigrate(&Log{}))
	const username = "slow-response-filter"
	const userID = 88001
	require.NoError(t, LOG_DB.Where("username = ?", username).Delete(&Log{}).Error)
	t.Cleanup(func() {
		LOG_DB.Where("username = ?", username).Delete(&Log{})
	})
	require.NoError(t, LOG_DB.Create([]Log{
		{UserId: userID, Username: username, Type: LogTypeConsume, ModelName: "m", UseTime: 0, Quota: 1},
		{UserId: userID, Username: username, Type: LogTypeConsume, ModelName: "m", UseTime: 10, Quota: 10},
		{UserId: userID, Username: username, Type: LogTypeConsume, ModelName: "m", UseTime: 480, Quota: 20},
		{UserId: userID, Username: username, Type: LogTypeConsume, ModelName: "m", UseTime: 481, Quota: 30},
	}).Error)

	logs, total, err := GetAllLogs(LogTypeConsume, 0, 0, "", username, "", 0, 20, 0, "", "", "", 480)
	require.NoError(t, err)
	assert.EqualValues(t, 1, total)
	require.Len(t, logs, 1)
	assert.Equal(t, 481, logs[0].UseTime)

	positive, positiveTotal, err := GetAllLogs(LogTypeConsume, 0, 0, "", username, "", 0, 20, 0, "", "", "", 0)
	require.NoError(t, err)
	assert.EqualValues(t, 3, positiveTotal)
	assert.Len(t, positive, 3)

	unfiltered, unfilteredTotal, err := GetAllLogs(LogTypeConsume, 0, 0, "", username, "", 0, 20, 0, "", "", "", -1)
	require.NoError(t, err)
	assert.EqualValues(t, 4, unfilteredTotal)
	assert.Len(t, unfiltered, 4)

	userLogs, userTotal, err := GetUserLogs(userID, LogTypeConsume, 0, 0, "", "", 0, 20, "", "", "", 480)
	require.NoError(t, err)
	assert.EqualValues(t, 1, userTotal)
	require.Len(t, userLogs, 1)
	assert.Equal(t, 481, userLogs[0].UseTime)

	stat, err := SumUsedQuota(LogTypeConsume, 0, 0, "", username, "", 0, "", 480)
	require.NoError(t, err)
	assert.Equal(t, 30, stat.Quota)
}

func TestGetUserLogsReturnsCacheTokensWithoutRequestBody(t *testing.T) {
	require.NoError(t, LOG_DB.AutoMigrate(&Log{}))
	const userID = 88002
	require.NoError(t, LOG_DB.Where("user_id = ?", userID).Delete(&Log{}).Error)
	t.Cleanup(func() {
		LOG_DB.Where("user_id = ?", userID).Delete(&Log{})
	})
	require.NoError(t, LOG_DB.Create(&Log{
		UserId:           userID,
		Username:         "cache-log-owner",
		Type:             LogTypeConsume,
		ModelName:        "claude",
		PromptTokens:     200,
		CompletionTokens: 10,
		CacheReadTokens:  128,
		CacheWriteTokens: 64,
		RequestId:        "req-cache",
		Other:            `{"cache_tokens":999,"model_ratio":1,"admin_info":{"request_body":"H4sIAAAA","request_body_truncated":true,"upstream_body":"secret"}}`,
	}).Error)

	logs, total, err := GetUserLogs(userID, LogTypeConsume, 0, 0, "", "", 0, 20, "", "", "", -1)
	require.NoError(t, err)
	assert.EqualValues(t, 1, total)
	require.Len(t, logs, 1)
	assert.Equal(t, 128, logs[0].CacheReadTokens)
	assert.Equal(t, 64, logs[0].CacheWriteTokens)
	assert.Empty(t, logs[0].Other)

	detail, err := GetLogOther(userID, *logs[0], false)
	require.NoError(t, err)
	assert.Contains(t, detail, `"cache_tokens":999`)
	assert.Contains(t, detail, `"request_body":"H4sIAAAA"`)
	assert.NotContains(t, detail, "secret")
}

func TestLogOtherListColumns(t *testing.T) {
	other := NewLogOther()
	other.SetPublic("cache_tokens", 11)
	other.SetPublic("cache_creation_tokens_5m", 2)
	other.SetPublic("cache_creation_tokens_1h", 5)
	other.SetAdmin(LogOtherAdminRetriedKey, true)
	assert.Equal(t, 11, other.CacheReadTokens())
	assert.Equal(t, 7, other.CacheWriteTokens())
	assert.True(t, other.Retried())

	other.SetPublic("cache_write_tokens", 9)
	assert.Equal(t, 9, other.CacheWriteTokens())

	creationOnly := NewLogOther()
	creationOnly.SetPublic("cache_creation_tokens", 6)
	assert.Equal(t, 6, creationOnly.CacheWriteTokens())
	assert.False(t, creationOnly.Retried())
}

func TestGetUserLogsFiltersRetriedColumnWithoutReadingOther(t *testing.T) {
	require.NoError(t, LOG_DB.AutoMigrate(&Log{}))
	const userID = 88003
	require.NoError(t, LOG_DB.Where("user_id = ?", userID).Delete(&Log{}).Error)
	t.Cleanup(func() {
		LOG_DB.Where("user_id = ?", userID).Delete(&Log{})
	})
	require.NoError(t, LOG_DB.Create([]Log{
		{
			UserId:    userID,
			Type:      LogTypeError,
			Content:   "hidden",
			Retried:   true,
			RequestId: "req-hidden",
			Other:     `{"admin_info":{"retried":false}}`,
		},
		{
			UserId:           userID,
			Type:             LogTypeError,
			Content:          "shown",
			Retried:          false,
			CacheReadTokens:  3,
			CacheWriteTokens: 4,
			RequestId:        "req-shown",
			Other:            `{"cache_tokens":9,"admin_info":{"retried":true,"request_body":"secret"}}`,
		},
	}).Error)

	logs, total, err := GetUserLogs(userID, LogTypeError, 0, 0, "", "", 0, 20, "", "", "", -1)
	require.NoError(t, err)
	assert.EqualValues(t, 1, total)
	require.Len(t, logs, 1)
	assert.Equal(t, "shown", logs[0].Content)
	assert.Equal(t, 3, logs[0].CacheReadTokens)
	assert.Equal(t, 4, logs[0].CacheWriteTokens)
	assert.Empty(t, logs[0].Other)

	detail, err := GetLogOther(userID, *logs[0], false)
	require.NoError(t, err)
	assert.Contains(t, detail, "secret")
	assert.NotContains(t, detail, "retried")

	adminDetail, err := GetLogOther(0, *logs[0], false)
	require.NoError(t, err)
	assert.Contains(t, adminDetail, `"retried":true`)
}
