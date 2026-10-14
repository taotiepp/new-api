package service

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQuotaWarningContentNamesTheUserAndOmitsTopUpLink(t *testing.T) {
	cases := []struct {
		notifyType string
		want       string
	}{
		{
			notifyType: dto.NotifyTypeEmail,
			want:       "您的额度即将用尽，用户名：alice，用户ID：7，当前剩余额度为 $1.00，为了不影响您的使用，请及时充值。",
		},
		{
			notifyType: "",
			want:       "您的额度即将用尽，用户名：alice，用户ID：7，当前剩余额度为 $1.00，为了不影响您的使用，请及时充值。",
		},
		{
			notifyType: dto.NotifyTypeWebhook,
			want:       "您的额度即将用尽，用户名：alice，用户ID：7，当前剩余额度为 $1.00，为了不影响您的使用，请及时充值。",
		},
		{
			notifyType: dto.NotifyTypeBark,
			want:       "您的额度即将用尽，用户名：alice，用户ID：7，剩余额度：$1.00，请及时充值",
		},
		{
			notifyType: dto.NotifyTypeGotify,
			want:       "您的额度即将用尽，用户名：alice，用户ID：7，当前剩余额度为 $1.00，请及时充值。",
		},
		{
			notifyType: dto.NotifyTypeFeishu,
			want:       "用户名：alice，用户ID：7，当前剩余额度为 $1.00，请及时充值。",
		},
	}
	for _, tc := range cases {
		content, values := quotaWarningContent(tc.notifyType, "您的额度即将用尽", "alice", 7, "$1.00")
		rendered := content
		for _, value := range values {
			rendered = strings.Replace(rendered, dto.ContentValueParam, fmt.Sprintf("%v", value), 1)
		}
		assert.Equal(t, tc.want, rendered)
		assert.NotContains(t, rendered, "充值链接")
		assert.NotContains(t, rendered, "http")
	}
}

func TestFeishuBotSignMatchesCustomBotAlgorithm(t *testing.T) {
	assert.Equal(t, "3/MaVZ8JLIy4TUG+7KSFJqvUkTKd+HWY8g+56DZWq8s=", feishuBotSign("1599360473", "demo-secret"))
}

func TestSendFeishuNotifyPostsSignedTextMessage(t *testing.T) {
	server, body, contentType := feishuNotifyServer(t, `{"code":0,"msg":"success"}`)

	err := sendFeishuNotify(server.URL, "demo-secret", dto.NewNotify(
		dto.NotifyTypeQuotaExceed,
		"您的额度即将用尽",
		"当前剩余额度为 {{value}}，请及时充值。\n充值链接：{{value}}",
		[]any{"$1.00", "https://example.com/wallet"},
	))
	require.NoError(t, err)
	assert.Equal(t, "application/json; charset=utf-8", *contentType)

	var payload struct {
		Timestamp string `json:"timestamp"`
		Sign      string `json:"sign"`
		MsgType   string `json:"msg_type"`
		Content   struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	require.NoError(t, common.Unmarshal(*body, &payload))
	assert.Equal(t, "text", payload.MsgType)
	assert.NotEmpty(t, payload.Timestamp)
	assert.Equal(t, feishuBotSign(payload.Timestamp, "demo-secret"), payload.Sign)
	assert.Equal(t, "您的额度即将用尽\n当前剩余额度为 $1.00，请及时充值。\n充值链接：https://example.com/wallet", payload.Content.Text)
}

func TestSendFeishuNotifyOmitsSignatureWithoutSecret(t *testing.T) {
	server, body, _ := feishuNotifyServer(t, `{"code":0,"msg":"success"}`)

	err := sendFeishuNotify(server.URL, "", dto.NewNotify(dto.NotifyTypeQuotaExceed, "余额不足", "请充值", nil))
	require.NoError(t, err)
	assert.NotContains(t, string(*body), `"sign"`)
	assert.NotContains(t, string(*body), `"timestamp"`)

	var payload struct {
		MsgType string `json:"msg_type"`
		Content struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	require.NoError(t, common.Unmarshal(*body, &payload))
	assert.Equal(t, "text", payload.MsgType)
	assert.Equal(t, "余额不足\n请充值", payload.Content.Text)
}

func TestSendFeishuNotifyRejectsNonZeroCode(t *testing.T) {
	server, _, _ := feishuNotifyServer(t, `{"code":19021,"msg":"sign match fail"}`)

	err := sendFeishuNotify(server.URL, "", dto.NewNotify(dto.NotifyTypeQuotaExceed, "余额不足", "", nil))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "sign match fail")
}

func TestSendFeishuNotifyRejectsPrivateWebhook(t *testing.T) {
	configureSSRFTestFetchSetting(t)

	err := sendFeishuNotify("http://127.0.0.1/hook", "", dto.NewNotify(dto.NotifyTypeQuotaExceed, "余额不足", "", nil))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "request reject")
}

func feishuNotifyServer(t *testing.T, response string) (*httptest.Server, *[]byte, *string) {
	t.Helper()
	fetchSetting := system_setting.GetFetchSetting()
	original := *fetchSetting
	t.Cleanup(func() {
		*fetchSetting = original
	})
	fetchSetting.EnableSSRFProtection = false
	InitHttpClient()

	var body []byte
	var contentType string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		contentType = r.Header.Get("Content-Type")
		payload, readErr := io.ReadAll(r.Body)
		if readErr != nil {
			http.Error(w, readErr.Error(), http.StatusInternalServerError)
			return
		}
		body = payload
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(response))
	}))
	t.Cleanup(server.Close)
	return server, &body, &contentType
}
