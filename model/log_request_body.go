package model

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"io"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	// LogOtherAdminRequestBodyKey stores the failed request body for administrators.
	// The value is gzip compressed and base64 encoded.
	LogOtherAdminRequestBodyKey = "request_body"
	// LogOtherAdminRequestBodyTruncatedKey is true when the stored request was cut
	// to maxErrorRequestBodyBytes before compression.
	LogOtherAdminRequestBodyTruncatedKey = "request_body_truncated"

	maxErrorRequestBodyBytes = 1 << 20
)

// AttachErrorRequestBody copies the caller request into admin-only log metadata
// when that user has enabled storage. The default is off. User-facing log queries
// drop admin_info, so this payload is not returned to them.
func AttachErrorRequestBody(c *gin.Context, userID int, other *LogOther) {
	if !userRecordsFailedRequestBody(userID) || c == nil || c.Request == nil || c.Request.Body == nil || other == nil {
		return
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil || storage == nil {
		return
	}
	raw, err := storage.Bytes()
	if err != nil || len(raw) == 0 {
		return
	}
	encoded, truncated := compressLogPayload(raw)
	if encoded == "" {
		return
	}
	other.SetAdmin(LogOtherAdminRequestBodyKey, encoded)
	if truncated {
		other.SetAdmin(LogOtherAdminRequestBodyTruncatedKey, true)
	}
}

func userRecordsFailedRequestBody(userID int) bool {
	if userID <= 0 {
		return false
	}
	setting, err := GetUserSetting(userID, false)
	if err != nil {
		return false
	}
	return setting.RecordErrorRequestBody
}

func compressLogPayload(raw []byte) (string, bool) {
	truncated := false
	if len(raw) > maxErrorRequestBodyBytes {
		raw = raw[:maxErrorRequestBodyBytes]
		truncated = true
	}
	var buf bytes.Buffer
	writer := gzip.NewWriter(&buf)
	if _, err := writer.Write(raw); err != nil {
		_ = writer.Close()
		return "", truncated
	}
	if err := writer.Close(); err != nil {
		return "", truncated
	}
	return base64.StdEncoding.EncodeToString(buf.Bytes()), truncated
}

func decompressLogPayload(encoded string) ([]byte, error) {
	compressed, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}
	reader, err := gzip.NewReader(bytes.NewReader(compressed))
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

func logListColumns() []string {
	groupCol := "`group`"
	if common.UsingLogDatabase(common.DatabaseTypePostgreSQL) {
		groupCol = `"group"`
	}
	return []string{
		"logs.id",
		"logs.user_id",
		"logs.created_at",
		"logs.type",
		"logs.content",
		"logs.username",
		"logs.token_name",
		"logs.model_name",
		"logs.quota",
		"logs.cost_quota",
		"logs.prompt_tokens",
		"logs.completion_tokens",
		"logs.use_time",
		"logs.is_stream",
		"logs.channel_id",
		"logs.token_id",
		"logs." + groupCol,
		"logs.ip",
		"logs.request_id",
		"logs.upstream_request_id",
	}
}

// GetLogOther loads one log's other JSON for the detail view.
// A positive scopeUserID restricts the row to that user and strips admin-only fields.
func GetLogOther(scopeUserID int, probe Log, asRoot bool) (string, error) {
	tx := LOG_DB.Model(&Log{}).Select("id", "content", "other")
	if scopeUserID > 0 {
		tx = tx.Where("user_id = ?", scopeUserID)
	}
	switch {
	case probe.RequestId != "":
		tx = tx.Where(
			"request_id = ? AND created_at = ? AND type = ? AND channel_id = ? AND token_id = ? AND use_time = ? AND model_name = ?",
			probe.RequestId, probe.CreatedAt, probe.Type, probe.ChannelId, probe.TokenId, probe.UseTime, probe.ModelName,
		)
		if probe.Content != "" {
			tx = tx.Where("content = ?", probe.Content)
		}
	case !common.UsingLogDatabase(common.DatabaseTypeClickHouse) && probe.Id > 0:
		tx = tx.Where("id = ?", probe.Id)
	default:
		return "", gorm.ErrRecordNotFound
	}

	var rows []Log
	if err := tx.Limit(2).Find(&rows).Error; err != nil {
		return "", err
	}
	if len(rows) != 1 {
		return "", gorm.ErrRecordNotFound
	}
	if scopeUserID > 0 {
		return formatLogOtherJSON(rows[0].Other, logOtherVisibilityUser), nil
	}
	if asRoot {
		return formatLogOtherJSON(rows[0].Other, logOtherVisibilityRoot), nil
	}
	return formatLogOtherJSON(rows[0].Other, logOtherVisibilityAdmin), nil
}
