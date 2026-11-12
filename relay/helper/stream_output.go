package helper

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/tidwall/gjson"
)

// StreamEventShowsWork reports whether an SSE payload is evidence the model is
// working. Keepalive and session bookkeeping are ignored. Text, reasoning, and
// tool events count only when they carry real content. Any other event type,
// including ones added later, counts.
func StreamEventShowsWork(data string) bool {
	if strings.TrimSpace(data) == "" || !gjson.Valid(data) {
		return false
	}
	if streamEventHasRealOutput(data) {
		return true
	}
	switch gjson.Get(data, "type").String() {
	case "", "ping", "keepalive",
		"response.created", "response.queued", "response.in_progress",
		"message_start", "content_block_start", "content_block_stop", "message_stop",
		"response.output_text.delta",
		"response.reasoning_text.delta",
		"response.reasoning_summary_text.delta",
		"response.function_call_arguments.delta",
		"response.content_part.added",
		"response.content_part.delta",
		"content_block_delta":
		return false
	default:
		return true
	}
}

// streamEventHasRealOutput reports whether an SSE payload contains generated
// text, reasoning, tool-call arguments, or a Claude thinking progress delta.
// Keepalives, stream bookkeeping, and whitespace-only placeholders do not
// count, so they cannot extend the idle timeout.
func streamEventHasRealOutput(data string) bool {
	if strings.TrimSpace(data) == "" || !gjson.Valid(data) {
		return false
	}
	if realOutputString(gjson.Get(data, "delta")) ||
		hasRealOutputRune(gjson.Get(data, "text").String()) ||
		hasRealOutputRune(gjson.Get(data, "answer").String()) ||
		hasRealOutputRune(gjson.Get(data, "result").String()) {
		return true
	}
	for _, choice := range gjson.Get(data, "choices").Array() {
		if hasRealOutputRune(choice.Get("text").String()) ||
			realOutputString(choice.Get("delta.content")) ||
			hasRealOutputRune(choice.Get("delta.reasoning_content").String()) ||
			hasRealOutputRune(choice.Get("delta.reasoning").String()) {
			return true
		}
		for _, call := range choice.Get("delta.tool_calls").Array() {
			if hasRealOutputRune(call.Get("function.name").String()) ||
				hasRealOutputRune(call.Get("function.arguments").String()) {
				return true
			}
		}
	}
	for _, candidate := range gjson.Get(data, "candidates").Array() {
		for _, part := range candidate.Get("content.parts").Array() {
			if hasRealOutputRune(part.Get("text").String()) ||
				hasRealOutputRune(part.Get("functionCall.name").String()) ||
				jsonValueHasRealOutput(part.Get("functionCall.args")) ||
				hasRealOutputRune(part.Get("inlineData.data").String()) {
				return true
			}
		}
	}
	return false
}

func realOutputString(value gjson.Result) bool {
	if !value.Exists() || value.Type == gjson.Null {
		return false
	}
	if value.Type == gjson.String {
		return hasRealOutputRune(value.String())
	}
	if value.Type != gjson.JSON {
		return false
	}
	raw := value.Raw
	if raw == "" {
		return false
	}
	if raw[0] == '{' {
		// Claude reports thinking progress with an empty thinking string and
		// estimated_tokens. That packet is model progress, not a keepalive.
		if value.Get("type").String() == "thinking_delta" {
			return true
		}
		return hasRealOutputRune(value.Get("text").String()) ||
			hasRealOutputRune(value.Get("thinking").String()) ||
			hasRealOutputRune(value.Get("partial_json").String())
	}
	if raw[0] != '[' {
		return false
	}
	for _, part := range value.Array() {
		if hasRealOutputRune(part.Get("text").String()) {
			return true
		}
	}
	return false
}

func jsonValueHasRealOutput(value gjson.Result) bool {
	if !value.Exists() || value.Type == gjson.Null {
		return false
	}
	switch value.Type {
	case gjson.String, gjson.Number:
		return hasRealOutputRune(value.String())
	case gjson.JSON:
		found := false
		value.ForEach(func(_, child gjson.Result) bool {
			if jsonValueHasRealOutput(child) {
				found = true
				return false
			}
			return true
		})
		return found
	default:
		return false
	}
}

func hasRealOutputRune(s string) bool {
	for _, r := range s {
		if r == utf8.RuneError {
			continue
		}
		if unicode.IsSpace(r) || isFormatPlaceholder(r) {
			continue
		}
		return true
	}
	return false
}

func isFormatPlaceholder(r rune) bool {
	switch r {
	case '\u180e', '\u200b', '\u200c', '\u200d', '\u2060', '\ufeff':
		return true
	default:
		return false
	}
}
