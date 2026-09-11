package controller

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type observedTokenRequest struct {
	dto.GeneralOpenAIRequest
	metaCalls int
}

func (r *observedTokenRequest) GetTokenCountMeta() *types.TokenCountMeta {
	r.metaCalls++
	return r.GeneralOpenAIRequest.GetTokenCountMeta()
}

func TestTrustedPromptCountingUsesUpstreamUsageOrCountsOnce(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	for _, tc := range []struct {
		name                  string
		upstreamUsage, stream bool
	}{
		{"upstream usage", true, false},
		{"missing usage", false, false},
		{"stream upstream usage", true, true},
		{"stream missing usage", false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			common.SetContextKey(ctx, constant.ContextKeyOriginalModel, "gemini-test")
			request := &observedTokenRequest{}
			require.NoError(t, common.Unmarshal([]byte(`{"model":"gemini-test","messages":[{"role":"user","content":"Please count this original input."}]}`), &request.GeneralOpenAIRequest))
			info := &relaycommon.RelayInfo{
				OriginModelName: "gemini-test", RelayMode: relayconstant.RelayModeChatCompletions,
				RelayFormat: types.RelayFormatOpenAI,
				ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gemini-test"},
			}
			expected, err := service.CountRequestToken(ctx, request.GeneralOpenAIRequest.GetTokenCountMeta(), info)
			require.NoError(t, err)
			require.Positive(t, expected)
			deferRequestTokenEstimation(ctx, request, info)
			assert.Zero(t, info.GetEstimatePromptTokens(), "provisional stream usage must not count the prompt")
			assert.Zero(t, request.metaCalls)
			body := `{"choices":[{"message":{"role":"assistant","content":"answer"},"finish_reason":"stop"}]}`
			if tc.upstreamUsage {
				body = `{"choices":[{"message":{"role":"assistant","content":"answer"},"finish_reason":"stop"}],"usage":{"prompt_tokens":123,"completion_tokens":5,"total_tokens":128}}`
			}
			handler := openai.OpenaiHandler
			if tc.stream {
				info.IsStream = true
				body = "data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"answer\"},\"finish_reason\":null}]}\n\n"
				body += "data: {\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n"
				if tc.upstreamUsage {
					body += "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":123,\"completion_tokens\":5,\"total_tokens\":128}}\n\n"
				}
				body += "data: [DONE]\n\n"
				handler = openai.OaiStreamHandler
			}
			usage, apiErr := handler(ctx, info, &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))})
			require.Nil(t, apiErr)
			if tc.upstreamUsage {
				assert.Equal(t, 123, usage.PromptTokens)
				assert.Zero(t, request.metaCalls)
			} else {
				assert.Equal(t, expected, usage.PromptTokens)
				assert.Equal(t, expected, info.GetPromptTokensForUsage())
				assert.Equal(t, 1, request.metaCalls)
			}
		})
	}
}

func BenchmarkTrustedPromptEstimation(b *testing.B) {
	service.InitTokenEncoders()
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	common.SetContextKey(ctx, constant.ContextKeyOriginalModel, "gpt-4o")
	request := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{Role: "user", Content: strings.Repeat("A long prompt containing source code, English text and 中文内容.\n", 2048)}},
	}
	for _, trusted := range []bool{false, true} {
		b.Run(map[bool]string{false: "full_count", true: "trusted_upstream_usage"}[trusted], func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				info := &relaycommon.RelayInfo{OriginModelName: "gpt-4o", RelayFormat: types.RelayFormatOpenAI}
				if trusted {
					deferRequestTokenEstimation(ctx, request, info)
					_ = fastTokenCountMetaForPricing(request)
				} else {
					_, err := service.CountRequestToken(ctx, request.GetTokenCountMeta(), info)
					if err != nil {
						b.Fatal(err)
					}
				}
			}
		})
	}
}

func TestUntrustedBillingRestoresFullPromptPrice(t *testing.T) {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	common.SetContextKey(ctx, constant.ContextKeyOriginalModel, "local-estimation-test")
	request := &observedTokenRequest{}
	request.Messages = []dto.Message{{Role: "user", Content: strings.Repeat("long prompt accounting ", 1000)}}
	info := &relaycommon.RelayInfo{OriginModelName: "local-estimation-test", RelayFormat: types.RelayFormatOpenAI, UsingGroup: "default", UserGroup: "default"}
	info.UserSetting.AcceptUnsetRatioModel = true
	expectedTokens, err := service.CountRequestToken(ctx, request.GeneralOpenAIRequest.GetTokenCountMeta(), info)
	require.NoError(t, err)
	expectedPrice, err := helper.ModelPriceHelper(ctx, info, expectedTokens, fastTokenCountMetaForPricing(request))
	require.NoError(t, err)
	require.Positive(t, expectedPrice.QuotaToPreConsume)
	deferRequestTokenEstimation(ctx, request, info)
	quota, apiErr := info.PrepareUntrustedBilling()
	require.Nil(t, apiErr)
	assert.Equal(t, expectedPrice.QuotaToPreConsume, quota)
	assert.Equal(t, expectedTokens, info.GetEstimatePromptTokens())
	assert.Equal(t, expectedTokens, info.GetPromptTokensForUsage())
	assert.Equal(t, 1, request.metaCalls)
}

func TestTrustedWalletTokenThreshold(t *testing.T) {
	threshold := common.GetTrustQuota()
	for _, tc := range []struct {
		name                      string
		wallet, token             int
		unlimited, force, trusted bool
	}{
		{"above threshold", threshold + 1, threshold + 1, false, false, true},
		{"wallet at threshold", threshold, threshold + 1, false, false, false},
		{"token at threshold", threshold + 1, threshold, false, false, false},
		{"unlimited token", threshold + 1, 0, true, false, true},
		{"forced reserve", threshold + 1, threshold + 1, true, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Set("token_quota", tc.token)
			info := &relaycommon.RelayInfo{UserQuota: tc.wallet, TokenUnlimited: tc.unlimited, ForcePreConsume: tc.force}
			assert.Equal(t, tc.trusted, service.HasTrustedWalletQuota(ctx, info))
		})
	}
}

func TestSubscriptionRestoresEstimationBeforeReserving(t *testing.T) {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{UserQuota: common.GetTrustQuota() + 1, TokenUnlimited: true}
	info.UserSetting.BillingPreference = "subscription_only"
	want := types.NewError(errors.New("prompt estimation failed"), types.ErrorCodeCountTokenFailed)
	called := false
	info.PrepareUntrustedBilling = func() (int, *types.NewAPIError) {
		called = true
		return 0, want
	}
	session, apiErr := service.NewBillingSession(ctx, info, 0)
	assert.True(t, called)
	assert.Nil(t, session)
	assert.Same(t, want, apiErr)
}

func TestCountClaudeTokensReturnsInputTokensWhenRelayCountingDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalCountToken := constant.CountToken
	constant.CountToken = false
	t.Cleanup(func() {
		constant.CountToken = originalCountToken
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/messages/count_tokens?beta=true",
		strings.NewReader(`{
			"model":"gemini-3.6-flash",
			"messages":[{"role":"user","content":"count this prompt"}],
			"tools":[{"name":"lookup","description":"Look up a value","input_schema":{"type":"object","properties":{"query":{"type":"string"}}}}]
		}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(ctx, constant.ContextKeyOriginalModel, "gemini-3.6-flash")

	CountClaudeTokens(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		InputTokens int `json:"input_tokens"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Positive(t, response.InputTokens)
}

func TestCountClaudeTokensRejectsMissingMessages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/messages/count_tokens",
		strings.NewReader(`{"model":"gemini-3.6-flash"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	CountClaudeTokens(ctx)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	var response struct {
		Type  string `json:"type"`
		Error struct {
			Type    string `json:"type"`
			Message string `json:"message"`
		} `json:"error"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, "error", response.Type)
	assert.Equal(t, "invalid_request_error", response.Error.Type)
	assert.Contains(t, response.Error.Message, "messages")
}
