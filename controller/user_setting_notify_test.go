package controller

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserNotificationSendsWebhookWithoutSavingOrUsingQuotaLimit(t *testing.T) {
	setupModelListControllerTestDB(t)
	require.NoError(t, i18n.Init())

	originalLimit := constant.NotifyLimitCount
	constant.NotifyLimitCount = 0
	t.Cleanup(func() { constant.NotifyLimitCount = originalLimit })

	originalFetch := *system_setting.GetFetchSetting()
	t.Cleanup(func() { *system_setting.GetFetchSetting() = originalFetch })

	var got []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		got = body
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)
	parsed, err := url.Parse(server.URL)
	require.NoError(t, err)
	fetch := system_setting.GetFetchSetting()
	fetch.EnableSSRFProtection = true
	fetch.AllowPrivateIp = true
	fetch.AllowedPorts = []string{parsed.Port()}
	service.InitHttpClient()

	saved := `{"notify_type":"email","quota_warning_threshold":10}`
	user := &model.User{
		Username: "alice",
		Password: "placeholder",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  "notify-test-alice",
		Email:    "alice@example.com",
		Setting:  saved,
	}
	require.NoError(t, model.DB.Create(user).Error)

	payload := requestTestNotification(t, user.Id, map[string]any{
		"notify_type":             "webhook",
		"quota_warning_threshold": 1200,
		"webhook_url":             server.URL,
		"webhook_secret":          "sek",
	})
	require.True(t, payload.Success, payload.Message)
	assert.Equal(t, "Test notification sent", payload.Message)

	var stored model.User
	require.NoError(t, model.DB.First(&stored, user.Id).Error)
	assert.Equal(t, saved, stored.Setting)

	var sent struct {
		Type    string `json:"type"`
		Title   string `json:"title"`
		Content string `json:"content"`
	}
	require.NoError(t, common.Unmarshal(got, &sent))
	assert.Equal(t, "notify_test", sent.Type)
	assert.Equal(t, "Test notification", sent.Title)
	assert.Contains(t, sent.Content, "Username: alice")
	assert.Contains(t, sent.Content, fmt.Sprintf("user ID: %d", user.Id))
	assert.NotContains(t, sent.Content, "充值链接")
	assert.NotContains(t, sent.Content, "http")
}

func TestUserNotificationRejectsIncompleteSettingsWithoutSaving(t *testing.T) {
	setupModelListControllerTestDB(t)
	require.NoError(t, i18n.Init())

	saved := `{"notify_type":"email","quota_warning_threshold":10}`
	user := &model.User{
		Username: "bob",
		Password: "placeholder",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  "notify-test-bob",
		Setting:  saved,
	}
	require.NoError(t, model.DB.Create(user).Error)

	missingWebhook := requestTestNotification(t, user.Id, map[string]any{
		"notify_type":             "webhook",
		"quota_warning_threshold": 1200,
	})
	assert.False(t, missingWebhook.Success)
	assert.Equal(t, "Webhook URL cannot be empty", missingWebhook.Message)

	missingEmail := requestTestNotification(t, user.Id, map[string]any{
		"notify_type":             "email",
		"quota_warning_threshold": 1200,
	})
	assert.False(t, missingEmail.Success)
	assert.Equal(t, "No email address is available for this notification", missingEmail.Message)

	var stored model.User
	require.NoError(t, model.DB.First(&stored, user.Id).Error)
	assert.Equal(t, saved, stored.Setting)
}

type testNotificationResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func requestTestNotification(t *testing.T, userId int, body map[string]any) testNotificationResponse {
	t.Helper()
	encoded, err := common.Marshal(body)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", userId)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/setting/test", bytes.NewReader(encoded))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("Accept-Language", "en")
	TestUserNotification(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	var payload testNotificationResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	return payload
}
