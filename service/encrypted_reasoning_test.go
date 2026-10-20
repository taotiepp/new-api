package service

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"

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
	assert.True(t, AllowEncryptedReasoningRetry(true, false, blocked))
	assert.False(t, AllowEncryptedReasoningRetry(true, true, blocked))

	forbidden := types.NewErrorWithStatusCode(
		assert.AnError,
		types.ErrorCodeBadResponseStatusCode,
		http.StatusForbidden,
	)
	forbidden.SetMessage("forbidden")
	assert.False(t, AllowEncryptedReasoningRetry(true, false, forbidden))

	chineseOnly := types.NewErrorWithStatusCode(
		assert.AnError,
		types.ErrorCodeBadResponseStatusCode,
		http.StatusForbidden,
	)
	chineseOnly.SetMessage("该会话已被网络安全策略屏蔽，请开启新会话")
	assert.False(t, AllowEncryptedReasoningRetry(true, false, chineseOnly))
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
