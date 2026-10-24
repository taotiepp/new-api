package service

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestAllowEncryptedReasoningRetry(t *testing.T) {
	err := types.NewErrorWithStatusCode(
		assert.AnError,
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadRequest,
	)
	err.SetMessage("The encrypted content for item rs_123 could not be verified. Reason: Encrypted content could not be decrypted or parsed.")

	assert.True(t, AllowEncryptedReasoningRetry(true, false, err))
	assert.False(t, AllowEncryptedReasoningRetry(false, false, err))
	assert.False(t, AllowEncryptedReasoningRetry(true, true, err))

	other := types.NewErrorWithStatusCode(
		assert.AnError,
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadRequest,
	)
	other.SetMessage("invalid request")
	assert.False(t, AllowEncryptedReasoningRetry(true, false, other))

	blocked := types.NewErrorWithStatusCode(
		assert.AnError,
		types.ErrorCodeBadResponseStatusCode,
		http.StatusForbidden,
	)
	blocked.SetMessage("该会话已被网络安全策略屏蔽，请开启新会话 / This session is blocked by cyber-security policy, please start a new session")
	assert.False(t, AllowEncryptedReasoningRetry(true, false, blocked))
	assert.True(t, SessionPolicyBlocked(blocked))
	assert.False(t, SessionPolicyBlocked(err))

	forbidden := types.NewErrorWithStatusCode(
		assert.AnError,
		types.ErrorCodeBadResponseStatusCode,
		http.StatusForbidden,
	)
	forbidden.SetMessage("forbidden")
	assert.False(t, SessionPolicyBlocked(forbidden))

	chineseOnly := types.NewErrorWithStatusCode(
		assert.AnError,
		types.ErrorCodeBadResponseStatusCode,
		http.StatusForbidden,
	)
	chineseOnly.SetMessage("该会话已被网络安全策略屏蔽，请开启新会话")
	assert.False(t, SessionPolicyBlocked(chineseOnly))
}

func TestStripEncryptedReasoningInput(t *testing.T) {
	input := []byte(`[
		{"type":"message","role":"user","content":"hi"},
		{"type":"reasoning","id":"rs_old","encrypted_content":"cipher","summary":[]},
		{"type":"reasoning","id":"rs_keep","encrypted_content":"cipher","summary":[{"type":"summary_text","text":"visible"}]},
		{"type":"function_call","call_id":"call_1","name":"shell","arguments":"{}"}
	]`)

	stripped := StripEncryptedReasoningInput(input)
	parsed := gjson.ParseBytes(stripped)
	require.Equal(t, 3, len(parsed.Array()))
	assert.Equal(t, "message", parsed.Get("0.type").String())
	assert.Equal(t, "reasoning", parsed.Get("1.type").String())
	assert.False(t, parsed.Get("1.encrypted_content").Exists())
	assert.Equal(t, "visible", parsed.Get("1.summary.0.text").String())
	assert.Equal(t, "function_call", parsed.Get("2.type").String())
	assert.Equal(t, `"hi"`, string(StripEncryptedReasoningInput([]byte(`"hi"`))))
}

func TestStripEncryptedReasoningBody(t *testing.T) {
	body := []byte(`{"model":"gpt-5","input":[{"type":"reasoning","encrypted_content":"cipher","summary":[]},{"type":"message","role":"user","content":"hi"}]}`)
	stripped := StripEncryptedReasoningBody(body)
	parsed := gjson.ParseBytes(stripped)
	assert.Equal(t, "gpt-5", parsed.Get("model").String())
	require.Equal(t, 1, len(parsed.Get("input").Array()))
	assert.Equal(t, "message", parsed.Get("input.0.type").String())
}

func TestReplaceEffectiveSession(t *testing.T) {
	const body = `{"model":"gpt-5","previous_response_id":"resp_old","prompt_cache_key":"cache-old","input":"hi"}`

	t.Run("session header wins and previous response id is removed", func(t *testing.T) {
		ctx, info := newSessionRetry(t, body, map[string]string{
			"session_id":        "sess-old",
			"session-id":        "sess-old-hyphen",
			"conversation_id":   "conv-old",
			"X-Session-Id":      "affinity-old",
			"X-Conversation-ID": "xconv-old",
		})
		ReplaceEffectiveSession(ctx, info)

		sessionID := ctx.Request.Header.Get("session_id")
		sessionHyphen := ctx.Request.Header.Get("session-id")
		require.NotEmpty(t, sessionID)
		assert.NotEqual(t, "sess-old", sessionID)
		assert.Equal(t, sessionID, sessionHyphen)
		assert.Equal(t, sessionID, info.RequestHeaders["Session_id"])
		assert.Equal(t, "conv-old", ctx.Request.Header.Get("conversation_id"))
		assert.Equal(t, "affinity-old", ctx.Request.Header.Get("X-Session-Id"))
		assert.Equal(t, "xconv-old", ctx.Request.Header.Get("X-Conversation-ID"))

		stored := storedSessionBody(t, ctx)
		assert.False(t, stored.Get("previous_response_id").Exists())
		assert.Equal(t, "cache-old", stored.Get("prompt_cache_key").String())
		assert.Equal(t, "hi", stored.Get("input").String())
		assert.Empty(t, info.Request.(*dto.OpenAIResponsesRequest).PreviousResponseID)
		assert.Equal(t, "cache-old", gjson.ParseBytes(info.Request.(*dto.OpenAIResponsesRequest).PromptCacheKey).String())
	})

	t.Run("conversation header is next", func(t *testing.T) {
		ctx, info := newSessionRetry(t, body, map[string]string{
			"conversation_id":    "conv-old",
			"X-Session-Affinity": "affinity-old",
		})
		ReplaceEffectiveSession(ctx, info)

		next := ctx.Request.Header.Get("conversation_id")
		assert.NotEqual(t, "conv-old", next)
		assert.Equal(t, next, info.RequestHeaders["Conversation_id"])
		assert.Equal(t, "affinity-old", ctx.Request.Header.Get("X-Session-Affinity"))
		assert.Equal(t, "cache-old", storedSessionBody(t, ctx).Get("prompt_cache_key").String())
	})

	t.Run("affinity headers change together", func(t *testing.T) {
		ctx, info := newSessionRetry(t, body, map[string]string{
			"X-Session-Affinity": "affinity-old",
			"X-OpenCode-Session": "opencode-old",
			"X-Conversation-ID":  "xconv-old",
		})
		ReplaceEffectiveSession(ctx, info)

		affinity := ctx.Request.Header.Get("X-Session-Affinity")
		openCode := ctx.Request.Header.Get("X-OpenCode-Session")
		require.NotEmpty(t, affinity)
		assert.NotEqual(t, "affinity-old", affinity)
		assert.Equal(t, affinity, openCode)
		assert.Equal(t, "xconv-old", ctx.Request.Header.Get("X-Conversation-ID"))
		assert.Equal(t, "cache-old", storedSessionBody(t, ctx).Get("prompt_cache_key").String())
		assert.Equal(t, affinity, info.RequestHeaders["X-Session-Affinity"])
		assert.Equal(t, affinity, info.RequestHeaders["X-Opencode-Session"])
	})

	t.Run("x conversation id is used when no earlier header exists", func(t *testing.T) {
		ctx, info := newSessionRetry(t, body, map[string]string{
			"X-Conversation-ID": "xconv-old",
		})
		ReplaceEffectiveSession(ctx, info)

		next := ctx.Request.Header.Get("X-Conversation-ID")
		assert.NotEqual(t, "xconv-old", next)
		assert.Equal(t, "cache-old", storedSessionBody(t, ctx).Get("prompt_cache_key").String())
		assert.Equal(t, next, info.RequestHeaders["X-Conversation-Id"])
	})

	t.Run("prompt cache key changes only when no session header exists", func(t *testing.T) {
		ctx, info := newSessionRetry(t, body, nil)
		ReplaceEffectiveSession(ctx, info)

		stored := storedSessionBody(t, ctx)
		next := stored.Get("prompt_cache_key").String()
		assert.NotEqual(t, "cache-old", next)
		assert.False(t, stored.Get("previous_response_id").Exists())
		assert.Equal(t, next, gjson.ParseBytes(info.Request.(*dto.OpenAIResponsesRequest).PromptCacheKey).String())
		assert.Empty(t, info.Request.(*dto.OpenAIResponsesRequest).PreviousResponseID)
	})

	t.Run("runtime header override is the field in effect", func(t *testing.T) {
		ctx, info := newSessionRetry(t, body, map[string]string{
			"X-Conversation-ID": "xconv-old",
		})
		info.UseRuntimeHeadersOverride = true
		info.RuntimeHeadersOverride = map[string]any{
			"session_id": "override-old",
		}
		ReplaceEffectiveSession(ctx, info)

		next, ok := info.RuntimeHeadersOverride["session_id"].(string)
		require.True(t, ok)
		assert.NotEqual(t, "override-old", next)
		assert.Equal(t, "xconv-old", ctx.Request.Header.Get("X-Conversation-ID"))
		assert.Equal(t, "cache-old", storedSessionBody(t, ctx).Get("prompt_cache_key").String())
		assert.False(t, storedSessionBody(t, ctx).Get("previous_response_id").Exists())
	})

	t.Run("compaction request drops previous response id with the cache key", func(t *testing.T) {
		ctx, info := newSessionRetry(t, body, nil)
		info.Request = &dto.OpenAIResponsesCompactionRequest{
			PreviousResponseID: "resp_old",
			PromptCacheKey:     json.RawMessage(`"cache-old"`),
		}
		ReplaceEffectiveSession(ctx, info)

		req := info.Request.(*dto.OpenAIResponsesCompactionRequest)
		assert.Empty(t, req.PreviousResponseID)
		assert.Equal(t, storedSessionBody(t, ctx).Get("prompt_cache_key").String(), gjson.ParseBytes(req.PromptCacheKey).String())
		assert.NotEqual(t, "cache-old", gjson.ParseBytes(req.PromptCacheKey).String())
	})
}

func TestRotateBlockedSession(t *testing.T) {
	require.NoError(t, blockedSessionCache().Purge())
	t.Cleanup(func() {
		require.NoError(t, blockedSessionCache().Purge())
	})

	const userID = 42
	headers := map[string]string{
		"session_id":         "sess-old",
		"conversation_id":    "conv-old",
		"X-Session-Affinity": "affinity-old",
		"X-Conversation-ID":  "xconv-old",
	}
	ctx, info := newSessionRetry(t, `{"model":"gpt-5","previous_response_id":"resp_old","prompt_cache_key":"cache-old","input":"hi"}`, headers)
	ctx.Set("id", userID)
	RotateBlockedSession(ctx, info)

	replacement := ctx.Request.Header.Get("session_id")
	require.NotEmpty(t, replacement)
	assert.NotEqual(t, "sess-old", replacement)
	assert.Equal(t, replacement, ctx.Request.Header.Get("conversation_id"))
	assert.Equal(t, replacement, ctx.Request.Header.Get("X-Session-Affinity"))
	assert.Equal(t, replacement, ctx.Request.Header.Get("X-Conversation-ID"))
	assert.Equal(t, replacement, info.RequestHeaders["Session_id"])
	assert.Equal(t, replacement, info.RequestHeaders["Conversation_id"])
	stored := storedSessionBody(t, ctx)
	assert.False(t, stored.Get("previous_response_id").Exists())
	assert.Equal(t, replacement, stored.Get("prompt_cache_key").String())
	assert.Equal(t, replacement, gjson.ParseBytes(info.Request.(*dto.OpenAIResponsesRequest).PromptCacheKey).String())
	assert.Empty(t, info.Request.(*dto.OpenAIResponsesRequest).PreviousResponseID)
	assert.True(t, info.BlockedSessionRewritten)
	assert.True(t, info.RetryWithoutEncryptedContent)

	nextCtx, nextInfo := newSessionRetry(t, `{"model":"gpt-5","previous_response_id":"resp_old","prompt_cache_key":"cache-old","input":"hi"}`, headers)
	nextCtx.Set("id", userID)
	PrepareBlockedSessionRetry(nextCtx, nextInfo)
	assert.Equal(t, replacement, nextCtx.Request.Header.Get("session_id"))
	assert.Equal(t, replacement, nextCtx.Request.Header.Get("conversation_id"))
	assert.Equal(t, replacement, nextCtx.Request.Header.Get("X-Session-Affinity"))
	assert.Equal(t, replacement, storedSessionBody(t, nextCtx).Get("prompt_cache_key").String())
	assert.False(t, storedSessionBody(t, nextCtx).Get("previous_response_id").Exists())
	assert.True(t, nextInfo.BlockedSessionRewritten)
	assert.False(t, nextInfo.BlockedSessionExhausted)

	NoteBlockedSession(nextCtx, nextInfo)
	assert.True(t, nextInfo.BlockedSessionExhausted)

	againCtx, againInfo := newSessionRetry(t, `{"model":"gpt-5","previous_response_id":"resp_old","prompt_cache_key":"cache-old","input":"hi"}`, headers)
	againCtx.Set("id", userID)
	PrepareBlockedSessionRetry(againCtx, againInfo)
	assert.Equal(t, "sess-old", againCtx.Request.Header.Get("session_id"))
	assert.Equal(t, "cache-old", storedSessionBody(t, againCtx).Get("prompt_cache_key").String())
	assert.True(t, againInfo.BlockedSessionExhausted)
	assert.False(t, againInfo.BlockedSessionRewritten)

	otherCtx, otherInfo := newSessionRetry(t, `{"model":"gpt-5","previous_response_id":"resp_old","prompt_cache_key":"cache-old","input":"hi"}`, headers)
	otherCtx.Set("id", userID+1)
	PrepareBlockedSessionRetry(otherCtx, otherInfo)
	assert.False(t, otherInfo.BlockedSessionExhausted)
	assert.False(t, otherInfo.BlockedSessionRewritten)
	assert.Equal(t, "sess-old", otherCtx.Request.Header.Get("session_id"))

	notedCtx, notedInfo := newSessionRetry(t, `{"model":"gpt-5","previous_response_id":"resp_old","prompt_cache_key":"cache-noted","input":"hi"}`, map[string]string{
		"session_id": "sess-noted",
	})
	notedInfo.Request.(*dto.OpenAIResponsesRequest).PromptCacheKey = json.RawMessage(`"cache-noted"`)
	notedCtx.Set("id", userID+2)
	NoteBlockedSession(notedCtx, notedInfo)
	assert.Equal(t, "sess-noted", notedCtx.Request.Header.Get("session_id"))
	followCtx, followInfo := newSessionRetry(t, `{"model":"gpt-5","previous_response_id":"resp_old","prompt_cache_key":"cache-noted","input":"hi"}`, map[string]string{
		"session_id": "sess-noted",
	})
	followInfo.Request.(*dto.OpenAIResponsesRequest).PromptCacheKey = json.RawMessage(`"cache-noted"`)
	followCtx.Set("id", userID+2)
	PrepareBlockedSessionRetry(followCtx, followInfo)
	notedReplacement := followCtx.Request.Header.Get("session_id")
	require.NotEmpty(t, notedReplacement)
	assert.NotEqual(t, "sess-noted", notedReplacement)
	assert.Equal(t, notedReplacement, storedSessionBody(t, followCtx).Get("prompt_cache_key").String())
	assert.True(t, followInfo.BlockedSessionRewritten)
}

func newSessionRetry(t *testing.T, body string, headers map[string]string) (*gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(body))
	for key, value := range headers {
		ctx.Request.Header.Set(key, value)
	}
	storage, err := common.CreateBodyStorage([]byte(body))
	require.NoError(t, err)
	ctx.Set(common.KeyBodyStorage, storage)
	cloned := make(map[string]string, len(ctx.Request.Header))
	for key := range ctx.Request.Header {
		cloned[key] = ctx.Request.Header.Get(key)
	}
	return ctx, &relaycommon.RelayInfo{
		RequestHeaders: cloned,
		Request: &dto.OpenAIResponsesRequest{
			PreviousResponseID: "resp_old",
			PromptCacheKey:     json.RawMessage(`"cache-old"`),
		},
	}
}

func storedSessionBody(t *testing.T, ctx *gin.Context) gjson.Result {
	t.Helper()
	storage, err := common.GetBodyStorage(ctx)
	require.NoError(t, err)
	raw, err := storage.Bytes()
	require.NoError(t, err)
	return gjson.ParseBytes(raw)
}
