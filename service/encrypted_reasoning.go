package service

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/cachex"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/samber/hot"
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
// 400. The bilingual session-block 403 is handled by RotateBlockedSession.
func AllowEncryptedReasoningRetry(enabled bool, alreadyRetried bool, err *types.NewAPIError) bool {
	if !enabled || alreadyRetried || err == nil || err.StatusCode != http.StatusBadRequest {
		return false
	}
	message := err.Error()
	return strings.Contains(message, encryptedContentVerifyFragment) &&
		strings.Contains(message, encryptedContentDecryptFragment)
}

// SessionPolicyBlocked reports the bilingual 403 that asks the client to start
// a new session. The block sticks to the whole session identity, not one header.
func SessionPolicyBlocked(err *types.NewAPIError) bool {
	if err == nil || err.StatusCode != http.StatusForbidden {
		return false
	}
	message := err.Error()
	return strings.Contains(message, sessionBlockedZhFragment) &&
		strings.Contains(message, sessionBlockedEnFragment)
}

// BlockedSessionError is returned when a replacement session was blocked again.
// Another id rotation will not clear a block that is stuck to the conversation.
func BlockedSessionError() *types.NewAPIError {
	return types.NewOpenAIError(
		errors.New(sessionBlockedZhFragment+" / "+sessionBlockedEnFragment),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusForbidden,
		types.ErrOptionWithSkipRetry(),
	)
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

const (
	blockedSessionTTL            = 10 * time.Minute
	blockedSessionExhaustedValue = "!"
	blockedSessionCacheNamespace = "new-api:blocked_session:v1"
)

var (
	blockedSessionCacheOnce sync.Once
	blockedSessionCacheInst *cachex.HybridCache[string]
)

func blockedSessionCache() *cachex.HybridCache[string] {
	blockedSessionCacheOnce.Do(func() {
		blockedSessionCacheInst = cachex.NewHybridCache[string](cachex.HybridCacheConfig[string]{
			Namespace: cachex.Namespace(blockedSessionCacheNamespace),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.StringCodec{},
			Memory: func() *hot.HotCache[string, string] {
				return hot.NewHotCache[string, string](hot.LRU, 100_000).
					WithTTL(blockedSessionTTL).
					WithJanitor().
					Build()
			},
		})
	})
	return blockedSessionCacheInst
}

// PrepareBlockedSessionRetry rewrites a request that still carries a session
// id blocked on an earlier attempt. The replacement id stays stable so later
// turns keep the session that already cleared the policy check. An id whose
// replacement was blocked again is marked exhausted and left unchanged.
func PrepareBlockedSessionRetry(c *gin.Context, info *relaycommon.RelayInfo) {
	if info == nil {
		return
	}
	ids := currentSessionIDs(c, info)
	if len(ids) == 0 {
		return
	}
	info.BlockedSessionKeys = ids
	replacement, exhausted := lookupBlockedSession(blockedSessionUserID(c), ids)
	if exhausted {
		info.BlockedSessionExhausted = true
		return
	}
	if replacement == "" {
		return
	}
	applyBlockedSessionID(c, info, replacement)
	info.BlockedSessionRewritten = true
	info.RetryWithoutEncryptedContent = true
}

// RotateBlockedSession replaces every session id on this request and remembers
// the old ones. The retry sends one new identity: all session headers, the
// prompt cache key, and no previous_response_id.
func RotateBlockedSession(c *gin.Context, info *relaycommon.RelayInfo) {
	if info == nil || info.BlockedSessionExhausted || info.BlockedSessionRewritten {
		return
	}
	ids := currentSessionIDs(c, info)
	newID := common.GetUUID()
	applyBlockedSessionID(c, info, newID)
	if len(ids) > 0 {
		storeBlockedSession(blockedSessionUserID(c), ids, newID)
	}
	info.BlockedSessionKeys = ids
	info.BlockedSessionRewritten = true
	info.RetryWithoutEncryptedContent = true
}

// NoteBlockedSession records a block that cannot be retried on this response.
// A request that already used a replacement id is marked exhausted instead.
func NoteBlockedSession(c *gin.Context, info *relaycommon.RelayInfo) {
	if info == nil || info.BlockedSessionExhausted {
		return
	}
	if info.BlockedSessionRewritten {
		ids := info.BlockedSessionKeys
		if len(ids) == 0 {
			ids = currentSessionIDs(c, info)
		}
		storeBlockedSession(blockedSessionUserID(c), ids, blockedSessionExhaustedValue)
		info.BlockedSessionExhausted = true
		return
	}
	ids := currentSessionIDs(c, info)
	if len(ids) == 0 {
		return
	}
	storeBlockedSession(blockedSessionUserID(c), ids, common.GetUUID())
	info.BlockedSessionKeys = ids
}

func lookupBlockedSession(userID int, ids []string) (replacement string, exhausted bool) {
	cache := blockedSessionCache()
	for _, id := range ids {
		value, found, err := cache.Get(blockedSessionCacheKey(userID, id))
		if err != nil || !found {
			continue
		}
		if value == blockedSessionExhaustedValue {
			return "", true
		}
		if replacement == "" {
			replacement = value
		}
	}
	return replacement, false
}

func storeBlockedSession(userID int, ids []string, value string) {
	cache := blockedSessionCache()
	for _, id := range ids {
		if strings.TrimSpace(id) == "" || value == "" {
			continue
		}
		if err := cache.SetWithTTL(blockedSessionCacheKey(userID, id), value, blockedSessionTTL); err != nil {
			common.SysError("blocked session cache set failed: " + err.Error())
		}
	}
}

func blockedSessionCacheKey(userID int, sessionID string) string {
	return strconv.Itoa(userID) + "\x00" + sessionID
}

func blockedSessionUserID(c *gin.Context) int {
	if c == nil {
		return 0
	}
	return c.GetInt("id")
}

func applyBlockedSessionID(c *gin.Context, info *relaycommon.RelayInfo, newID string) {
	for _, group := range effectiveSessionHeaderGroups {
		for _, name := range group {
			if sessionHeaderPresent(c, info, name) {
				writeSessionHeader(c, info, name, newID)
			}
		}
	}
	clearPreviousResponseID(info.Request)
	setPromptCacheKeyIfPresent(info.Request, newID)
	rewriteSessionBody(c, newID, true)
}

func currentSessionIDs(c *gin.Context, info *relaycommon.RelayInfo) []string {
	seen := make(map[string]struct{})
	var ids []string
	collect := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, ok := seen[value]; ok {
			return
		}
		seen[value] = struct{}{}
		ids = append(ids, value)
	}
	for _, group := range effectiveSessionHeaderGroups {
		for _, name := range group {
			collect(sessionHeaderValue(c, info, name))
		}
	}
	collect(promptCacheKeyFromRequest(info))
	collect(promptCacheKeyFromBody(c))
	return ids
}

func sessionHeaderValue(c *gin.Context, info *relaycommon.RelayInfo, name string) string {
	if c != nil && c.Request != nil {
		if value := strings.TrimSpace(c.Request.Header.Get(name)); value != "" {
			return value
		}
	}
	if info == nil {
		return ""
	}
	for key, value := range info.RequestHeaders {
		if strings.EqualFold(key, name) && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	if !info.UseRuntimeHeadersOverride || info.RuntimeHeadersOverride == nil {
		return ""
	}
	for key, raw := range info.RuntimeHeadersOverride {
		text, ok := raw.(string)
		if ok && strings.EqualFold(key, name) && strings.TrimSpace(text) != "" {
			return strings.TrimSpace(text)
		}
	}
	return ""
}

func promptCacheKeyFromRequest(info *relaycommon.RelayInfo) string {
	if info == nil {
		return ""
	}
	switch req := info.Request.(type) {
	case *dto.OpenAIResponsesRequest:
		return rawJSONString(req.PromptCacheKey)
	case *dto.OpenAIResponsesCompactionRequest:
		return rawJSONString(req.PromptCacheKey)
	case *dto.GeneralOpenAIRequest:
		return strings.TrimSpace(req.PromptCacheKey)
	default:
		return ""
	}
}

func rawJSONString(raw []byte) string {
	if !rawJSONValuePresent(raw) {
		return ""
	}
	value := gjson.ParseBytes(bytes.TrimSpace(raw))
	if value.Type == gjson.String {
		return strings.TrimSpace(value.String())
	}
	return strings.TrimSpace(value.Raw)
}

func promptCacheKeyFromBody(c *gin.Context) string {
	if c == nil {
		return ""
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return ""
	}
	raw, err := storage.Bytes()
	if err != nil || !gjson.ValidBytes(raw) {
		return ""
	}
	value := gjson.GetBytes(raw, "prompt_cache_key")
	if !value.Exists() || value.Type == gjson.Null {
		return ""
	}
	if value.Type == gjson.String {
		return strings.TrimSpace(value.String())
	}
	return strings.TrimSpace(value.Raw)
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
