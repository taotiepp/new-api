package service

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/tidwall/gjson"
)

const (
	encryptedContentVerifyFragment  = "could not be verified"
	encryptedContentDecryptFragment = "Encrypted content could not be decrypted or parsed"
)

// AllowEncryptedReasoningRetry reports whether this 400 is the one encrypted
// reasoning verification failure that may be retried once with the ciphertext removed.
func AllowEncryptedReasoningRetry(enabled bool, alreadyRetried bool, err *types.NewAPIError) bool {
	if !enabled || alreadyRetried || err == nil || err.StatusCode != http.StatusBadRequest {
		return false
	}
	message := err.Error()
	return strings.Contains(message, encryptedContentVerifyFragment) &&
		strings.Contains(message, encryptedContentDecryptFragment)
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
