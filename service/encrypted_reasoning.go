package service

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// Downstream account routers bind a request to an account with the first
// populated session field. Earlier fields win, so a later one is left alone.
var effectiveSessionHeaderGroups = [][]string{
	{"session-id", "session_id"},
	{"conversation_id"},
	{"X-Session-Affinity", "X-Session-Id", "X-OpenCode-Session"},
	{"X-Conversation-ID"},
}

const (
	encryptedContentVerifyFragment  = "could not be verified"
	encryptedContentDecryptFragment = "Encrypted content could not be decrypted or parsed"
	sessionBlockedZhFragment        = "该会话已被网络安全策略屏蔽，请开启新会话"
	sessionBlockedEnFragment        = "This session is blocked by cyber-security policy, please start a new session"
)

// AllowEncryptedReasoningRetry reports whether this failure may be retried once
// with encrypted reasoning removed. It matches only the ciphertext verification
// 400 and the bilingual session-block 403.
func AllowEncryptedReasoningRetry(enabled bool, alreadyRetried bool, err *types.NewAPIError) bool {
	if !enabled || alreadyRetried || err == nil {
		return false
	}
	message := err.Error()
	switch err.StatusCode {
	case http.StatusBadRequest:
		return strings.Contains(message, encryptedContentVerifyFragment) &&
			strings.Contains(message, encryptedContentDecryptFragment)
	case http.StatusForbidden:
		return strings.Contains(message, sessionBlockedZhFragment) &&
			strings.Contains(message, sessionBlockedEnFragment)
	default:
		return false
	}
}

// StripEncryptedReasoningInput removes encrypted reasoning ciphertext from a
// Responses input value. Reasoning items that have no remaining visible text
// are dropped. A non-array input is returned unchanged.
func StripEncryptedReasoningInput(input []byte) []byte {
	trimmed := strings.TrimSpace(string(input))
	if trimmed == "" || !gjson.Valid(trimmed) || !gjson.Parse(trimmed).IsArray() {
		return input
	}
	var items []any
	if err := common.Unmarshal(input, &items); err != nil {
		return input
	}
	kept := make([]any, 0, len(items))
	for _, item := range items {
		next, ok := stripEncryptedReasoningItem(item)
		if ok {
			kept = append(kept, next)
		}
	}
	out, err := common.Marshal(kept)
	if err != nil {
		return input
	}
	return out
}

// StripEncryptedReasoningBody removes encrypted reasoning from the input field
// of a Responses request body.
func StripEncryptedReasoningBody(body []byte) []byte {
	if !gjson.ValidBytes(body) {
		return body
	}
	parsed := gjson.ParseBytes(body)
	input := parsed.Get("input")
	if !input.Exists() || !input.IsArray() {
		return body
	}
	var root map[string]any
	if err := common.Unmarshal(body, &root); err != nil {
		return body
	}
	rawInput, err := common.Marshal(root["input"])
	if err != nil {
		return body
	}
	stripped := StripEncryptedReasoningInput(rawInput)
	var inputValue any
	if err := common.Unmarshal(stripped, &inputValue); err != nil {
		return body
	}
	root["input"] = inputValue
	out, err := common.Marshal(root)
	if err != nil {
		return body
	}
	return out
}

func stripEncryptedReasoningItem(item any) (any, bool) {
	obj, ok := item.(map[string]any)
	if !ok {
		return item, true
	}
	delete(obj, "encrypted_content")
	for key, child := range obj {
		if nested, ok := child.([]any); ok {
			kept := make([]any, 0, len(nested))
			for _, part := range nested {
				next, keep := stripEncryptedReasoningItem(part)
				if keep {
					kept = append(kept, next)
				}
			}
			obj[key] = kept
		}
	}
	if obj["type"] == "reasoning" && !reasoningItemHasVisibleText(obj) {
		return nil, false
	}
	return obj, true
}

func reasoningItemHasVisibleText(item map[string]any) bool {
	if textFromParts(item["summary"]) {
		return true
	}
	if textFromParts(item["content"]) {
		return true
	}
	return false
}

func textFromParts(value any) bool {
	parts, ok := value.([]any)
	if !ok {
		return false
	}
	for _, part := range parts {
		obj, ok := part.(map[string]any)
		if !ok {
			continue
		}
		text, ok := obj["text"].(string)
		if ok && strings.TrimSpace(text) != "" {
			return true
		}
	}
	return false
}

// ReplaceEffectiveSession runs with the encrypted-reasoning retry. It replaces
// the session field a downstream account router actually uses, then removes
// previous_response_id. That response id outranks the session id and would
// pin the new session back to the account that owns the old response.
func ReplaceEffectiveSession(c *gin.Context, info *relaycommon.RelayInfo) {
	if info == nil {
		return
	}
	newID := common.GetUUID()
	replacedHeader := replaceFirstSessionHeader(c, info, newID)
	clearPreviousResponseID(info.Request)
	if !replacedHeader {
		setPromptCacheKeyIfPresent(info.Request, newID)
	}
	rewriteSessionBody(c, newID, !replacedHeader)
}

func replaceFirstSessionHeader(c *gin.Context, info *relaycommon.RelayInfo, newID string) bool {
	for _, group := range effectiveSessionHeaderGroups {
		var present []string
		for _, name := range group {
			if sessionHeaderPresent(c, info, name) {
				present = append(present, name)
			}
		}
		if len(present) == 0 {
			continue
		}
		for _, name := range present {
			writeSessionHeader(c, info, name, newID)
		}
		return true
	}
	return false
}

func sessionHeaderPresent(c *gin.Context, info *relaycommon.RelayInfo, name string) bool {
	if c != nil && c.Request != nil && strings.TrimSpace(c.Request.Header.Get(name)) != "" {
		return true
	}
	if info == nil {
		return false
	}
	if headerMapHas(info.RequestHeaders, name) {
		return true
	}
	return info.UseRuntimeHeadersOverride && headerAnyMapHas(info.RuntimeHeadersOverride, name)
}

func writeSessionHeader(c *gin.Context, info *relaycommon.RelayInfo, name, value string) {
	live := c != nil && c.Request != nil && strings.TrimSpace(c.Request.Header.Get(name)) != ""
	if live {
		c.Request.Header.Set(name, value)
	}
	if info == nil {
		return
	}
	foundSnapshot := false
	if info.RequestHeaders != nil {
		for key, current := range info.RequestHeaders {
			if !strings.EqualFold(key, name) || strings.TrimSpace(current) == "" {
				continue
			}
			info.RequestHeaders[key] = value
			foundSnapshot = true
		}
	}
	if live && !foundSnapshot && c != nil && c.Request != nil {
		if info.RequestHeaders == nil {
			info.RequestHeaders = map[string]string{}
		}
		for key := range c.Request.Header {
			if strings.EqualFold(key, name) {
				info.RequestHeaders[key] = value
			}
		}
	}
	if !info.UseRuntimeHeadersOverride || info.RuntimeHeadersOverride == nil {
		return
	}
	for key, raw := range info.RuntimeHeadersOverride {
		text, ok := raw.(string)
		if !ok || !strings.EqualFold(key, name) || strings.TrimSpace(text) == "" {
			continue
		}
		info.RuntimeHeadersOverride[key] = value
	}
}

func headerMapHas(headers map[string]string, name string) bool {
	for key, value := range headers {
		if strings.EqualFold(key, name) && strings.TrimSpace(value) != "" {
			return true
		}
	}
	return false
}

func headerAnyMapHas(headers map[string]any, name string) bool {
	for key, raw := range headers {
		text, ok := raw.(string)
		if ok && strings.EqualFold(key, name) && strings.TrimSpace(text) != "" {
			return true
		}
	}
	return false
}

func clearPreviousResponseID(request dto.Request) {
	switch req := request.(type) {
	case *dto.OpenAIResponsesRequest:
		req.PreviousResponseID = ""
	case *dto.OpenAIResponsesCompactionRequest:
		req.PreviousResponseID = ""
	}
}

func setPromptCacheKeyIfPresent(request dto.Request, newID string) {
	encoded, err := common.Marshal(newID)
	if err != nil {
		return
	}
	switch req := request.(type) {
	case *dto.OpenAIResponsesRequest:
		if rawJSONValuePresent(req.PromptCacheKey) {
			req.PromptCacheKey = encoded
		}
	case *dto.OpenAIResponsesCompactionRequest:
		if rawJSONValuePresent(req.PromptCacheKey) {
			req.PromptCacheKey = encoded
		}
	case *dto.GeneralOpenAIRequest:
		if strings.TrimSpace(req.PromptCacheKey) != "" {
			req.PromptCacheKey = newID
		}
	}
}

func rawJSONValuePresent(raw []byte) bool {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return false
	}
	value := gjson.ParseBytes(trimmed)
	if !value.Exists() || value.Type == gjson.Null {
		return false
	}
	if value.Type == gjson.String {
		return strings.TrimSpace(value.String()) != ""
	}
	return strings.TrimSpace(value.Raw) != ""
}

func rewriteSessionBody(c *gin.Context, newID string, replaceCacheKey bool) {
	if c == nil {
		return
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return
	}
	raw, err := storage.Bytes()
	if err != nil || !gjson.ValidBytes(raw) {
		return
	}
	patched := raw
	if gjson.GetBytes(patched, "previous_response_id").Exists() {
		next, deleteErr := sjson.DeleteBytes(patched, "previous_response_id")
		if deleteErr != nil {
			return
		}
		patched = next
	}
	if replaceCacheKey && promptCacheKeyPresent(patched) {
		next, setErr := sjson.SetBytes(patched, "prompt_cache_key", newID)
		if setErr != nil {
			return
		}
		patched = next
	}
	if bytes.Equal(patched, raw) {
		return
	}
	nextStorage, err := common.CreateBodyStorage(patched)
	if err != nil {
		return
	}
	_ = storage.Close()
	c.Set(common.KeyBodyStorage, nextStorage)
	c.Set(common.KeyRequestBody, nil)
	if c.Request != nil {
		c.Request.Body = io.NopCloser(nextStorage)
		c.Request.ContentLength = int64(len(patched))
	}
}

func promptCacheKeyPresent(body []byte) bool {
	value := gjson.GetBytes(body, "prompt_cache_key")
	if !value.Exists() || value.Type == gjson.Null {
		return false
	}
	if value.Type == gjson.String {
		return strings.TrimSpace(value.String()) != ""
	}
	return strings.TrimSpace(value.Raw) != ""
}
