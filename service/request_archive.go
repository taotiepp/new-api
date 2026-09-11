package service

import (
	"bufio"
	"bytes"
	"cmp"
	"encoding/json"
	"maps"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
)

// NormalizeArchivedJSON redacts credential fields without decoding numbers into
// float64. Conversation text is intentionally retained; headers are never read.
func NormalizeArchivedJSON(body []byte) (string, string) {
	if len(bytes.TrimSpace(body)) == 0 {
		return "", "empty"
	}
	redacted, err := redactRecordedJSON(body)
	if err != nil {
		return "", "invalid_json"
	}
	return string(redacted), "complete"
}

func redactRecordedJSON(body json.RawMessage) (json.RawMessage, error) {
	body = bytes.TrimSpace(body)
	var value json.RawMessage
	if err := common.Unmarshal(body, &value); err != nil {
		return nil, err
	}
	switch body[0] {
	case '{':
		var fields map[string]json.RawMessage
		if err := common.Unmarshal(body, &fields); err != nil {
			return nil, err
		}
		for key, raw := range fields {
			normalized := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(key, "-", ""), "_", ""))
			switch normalized {
			case "authorization", "apikey", "xapikey", "password", "secret", "accesstoken", "refreshtoken", "cookie", "setcookie":
				fields[key] = json.RawMessage(`"[REDACTED]"`)
			default:
				redacted, err := redactRecordedJSON(raw)
				if err != nil {
					return nil, err
				}
				fields[key] = redacted
			}
		}
		return common.Marshal(fields)
	case '[':
		var items []json.RawMessage
		if err := common.Unmarshal(body, &items); err != nil {
			return nil, err
		}
		for i := range items {
			redacted, err := redactRecordedJSON(items[i])
			if err != nil {
				return nil, err
			}
			items[i] = redacted
		}
		return common.Marshal(items)
	default:
		return value, nil
	}
}

// NormalizeArchivedStream returns a native non-stream response, never raw SSE.
// Unknown/malformed streams are explicitly marked instead of being presented as
// a complete answer. The caller bounds the input before this function runs.
func NormalizeArchivedStream(body []byte) (string, string) {
	scanner := bufio.NewScanner(bytes.NewReader(body))
	scanner.Buffer(make([]byte, 4096), len(body)+1)
	var data strings.Builder
	acc := recordedStream{response: map[string]any{}, choices: map[int]map[string]any{}, blocks: map[int]map[string]any{}, responses: relayconvert.NewResponsesBufferedAccumulator()}
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if data.Len() > 0 {
				acc.event(strings.TrimSuffix(data.String(), "\n"))
				data.Reset()
			}
			continue
		}
		if value, ok := strings.CutPrefix(line, "data:"); ok {
			value, _ = strings.CutPrefix(value, " ")
			data.WriteString(value)
			data.WriteByte('\n')
		}
	}
	if data.Len() > 0 {
		acc.event(strings.TrimSuffix(data.String(), "\n"))
	}
	if scanner.Err() != nil {
		acc.invalid = true
	}
	if acc.format == "" {
		return "", "unsupported"
	}
	switch acc.format {
	case "chat":
		acc.response["object"] = "chat.completion"
		for _, choice := range acc.choices {
			if choice["finish_reason"] == nil {
				acc.invalid = true
			}
			if _, ok := choice["text"]; ok {
				acc.response["object"] = "text_completion"
			}
			message := recordedObject(choice["message"])
			tools, _ := message["tool_calls"].([]any)
			slices.SortFunc(tools, func(a, b any) int {
				return cmp.Compare(recordedIndex(recordedObject(a)["index"]), recordedIndex(recordedObject(b)["index"]))
			})
			for _, tool := range tools {
				delete(recordedObject(tool), "index")
			}
		}
		acc.response["choices"] = orderedRecordedItems(acc.choices)
	case "claude":
		acc.response["content"] = orderedRecordedItems(acc.blocks)
	case "gemini":
		acc.response["candidates"] = orderedRecordedItems(acc.choices)
	case "responses":
		output, _ := acc.response["output"].([]any)
		if len(output) == 0 {
			acc.response["output"] = acc.responses.BuildOutput()
		}
		if !acc.complete {
			status, _ := acc.response["status"].(string)
			if status != "failed" && status != "cancelled" {
				acc.response["status"] = "incomplete"
			}
		}
	}
	encoded, err := common.Marshal(acc.response)
	if err != nil {
		return "", "invalid_json"
	}
	normalized, state := NormalizeArchivedJSON(encoded)
	if state == "complete" && (!acc.complete || acc.invalid) {
		state = "incomplete"
	}
	return normalized, state
}

type recordedStream struct {
	format    string
	response  map[string]any
	choices   map[int]map[string]any
	blocks    map[int]map[string]any
	responses *relayconvert.ResponsesBufferedAccumulator
	complete  bool
	invalid   bool
}

// Builder-backed fields avoid quadratic copies when many small SSE deltas are
// accumulated. The JSON hook keeps their final representation a plain string.
type archivedText struct{ strings.Builder }

func (text *archivedText) MarshalJSON() ([]byte, error) { return common.Marshal(text.String()) }

func recordedTextValue(value any) (string, bool) {
	switch text := value.(type) {
	case string:
		return text, true
	case *archivedText:
		return text.String(), true
	default:
		return "", false
	}
}

func appendRecordedText(target map[string]any, key, fragment string) {
	text, ok := target[key].(*archivedText)
	if !ok {
		text = &archivedText{}
		if previous, ok := target[key].(string); ok {
			text.WriteString(previous)
		}
		target[key] = text
	}
	text.WriteString(fragment)
}

func recordedObject(value any) map[string]any {
	object, _ := value.(map[string]any)
	return object
}

func recordedIndex(value any) int {
	switch index := value.(type) {
	case float64:
		return int(index)
	case int:
		return index
	default:
		return 0
	}
}

func orderedRecordedItems(items map[int]map[string]any) []map[string]any {
	indices := slices.Sorted(maps.Keys(items))
	result := make([]map[string]any, 0, len(indices))
	for _, index := range indices {
		result = append(result, items[index])
	}
	return result
}

// appendRecordedDelta handles OpenAI text, reasoning, refusal and tool argument
// fragments. Indexed tool calls become ordinary tool_calls in the final message.
func appendRecordedDelta(target, delta map[string]any) {
	if target == nil {
		return
	}
	for key, value := range delta {
		if value == nil {
			continue
		}
		switch key {
		case "content", "reasoning_content", "reasoning", "refusal", "arguments":
			if fragment, ok := value.(string); ok {
				appendRecordedText(target, key, fragment)
			} else {
				target[key] = value
			}
		case "function_call", "function":
			object := recordedObject(target[key])
			if object == nil {
				object = map[string]any{}
				target[key] = object
			}
			appendRecordedDelta(object, recordedObject(value))
		case "tool_calls":
			tools, _ := target[key].([]any)
			fragments, _ := value.([]any)
			for _, fragment := range fragments {
				tool := recordedObject(fragment)
				index := recordedIndex(tool["index"])
				// Never allocate a slice according to an untrusted upstream index.
				var found map[string]any
				for _, existing := range tools {
					candidate := recordedObject(existing)
					if recordedIndex(candidate["index"]) == index {
						found = candidate
						break
					}
				}
				if found == nil {
					found = map[string]any{"index": index}
					tools = append(tools, found)
				}
				appendRecordedDelta(found, tool)
			}
			target[key] = tools
		default:
			target[key] = value
		}
	}
}

func (a *recordedStream) event(data string) {
	if data == "[DONE]" {
		if a.format == "chat" {
			a.complete = true
		}
		return
	}
	var event map[string]any
	if common.UnmarshalJsonStr(data, &event) != nil {
		a.invalid = true
		return
	}
	if event["error"] != nil {
		if a.format == "" {
			a.format = "error"
		}
		a.response["error"] = event["error"]
		a.invalid = true
		return
	}
	typeName, _ := event["type"].(string)
	switch {
	case strings.HasPrefix(typeName, "response."):
		a.format = "responses"
		var chunk dto.ResponsesStreamResponse
		if common.UnmarshalJsonStr(data, &chunk) != nil {
			a.invalid = true
			return
		}
		a.responses.ProcessEvent(&chunk)
		if response := recordedObject(event["response"]); response != nil {
			a.response = response
		}
		if typeName == "response.completed" {
			a.complete = recordedObject(event["response"]) != nil
		}
		if typeName == "response.failed" || typeName == "response.incomplete" {
			a.invalid = true
		}
	case typeName == "message_start":
		a.format = "claude"
		maps.Copy(a.response, recordedObject(event["message"]))
	case typeName == "content_block_start":
		a.blocks[recordedIndex(event["index"])] = recordedObject(event["content_block"])
	case typeName == "content_block_delta":
		block := a.blocks[recordedIndex(event["index"])]
		if block == nil {
			a.invalid = true
			return
		}
		delta := recordedObject(event["delta"])
		for _, key := range []string{"text", "thinking", "signature", "partial_json"} {
			if fragment, ok := delta[key].(string); ok {
				appendRecordedText(block, key, fragment)
			}
		}
		if citation := delta["citation"]; citation != nil {
			citations, _ := block["citations"].([]any)
			block["citations"] = append(citations, citation)
		}
	case typeName == "content_block_stop":
		block := a.blocks[recordedIndex(event["index"])]
		if partial, ok := recordedTextValue(block["partial_json"]); ok {
			var input any
			if common.UnmarshalJsonStr(partial, &input) == nil {
				block["input"] = input
				delete(block, "partial_json")
			} else {
				a.invalid = true
			}
		}
	case typeName == "message_delta":
		maps.Copy(a.response, recordedObject(event["delta"]))
		usage := recordedObject(a.response["usage"])
		if usage == nil {
			usage = map[string]any{}
			a.response["usage"] = usage
		}
		maps.Copy(usage, recordedObject(event["usage"]))
	case typeName == "message_stop":
		a.complete = true
	case event["choices"] != nil:
		a.format = "chat"
		for key, value := range event {
			if key != "choices" {
				a.response[key] = value
			}
		}
		choices, _ := event["choices"].([]any)
		for _, raw := range choices {
			chunk := recordedObject(raw)
			if chunk == nil {
				a.invalid = true
				continue
			}
			index := recordedIndex(chunk["index"])
			choice := a.choices[index]
			if choice == nil {
				choice = map[string]any{"index": index, "message": map[string]any{"role": "assistant"}, "finish_reason": nil}
				a.choices[index] = choice
			}
			appendRecordedDelta(recordedObject(choice["message"]), recordedObject(chunk["delta"]))
			if text, ok := chunk["text"].(string); ok {
				appendRecordedText(choice, "text", text)
				delete(choice, "message")
			}
			if reason := chunk["finish_reason"]; reason != nil {
				choice["finish_reason"] = reason
			}
			if logprobs := recordedObject(chunk["logprobs"]); logprobs != nil {
				merged := recordedObject(choice["logprobs"])
				if merged == nil {
					merged = map[string]any{}
					choice["logprobs"] = merged
				}
				for key, value := range logprobs {
					if fragments, ok := value.([]any); ok {
						previous, _ := merged[key].([]any)
						merged[key] = append(previous, fragments...)
					} else {
						merged[key] = value
					}
				}
			}
		}
	case event["candidates"] != nil || event["usageMetadata"] != nil || event["promptFeedback"] != nil:
		a.format = "gemini"
		for key, value := range event {
			if key != "candidates" {
				a.response[key] = value
			}
		}
		candidates, _ := event["candidates"].([]any)
		for _, raw := range candidates {
			chunk := recordedObject(raw)
			index := recordedIndex(chunk["index"])
			candidate := a.choices[index]
			if candidate == nil {
				candidate = map[string]any{"index": index, "content": map[string]any{"role": "model"}}
				a.choices[index] = candidate
			}
			for key, value := range chunk {
				if key != "content" {
					candidate[key] = value
				}
			}
			content := recordedObject(candidate["content"])
			parts, _ := content["parts"].([]any)
			incoming, _ := recordedObject(chunk["content"])["parts"].([]any)
			for _, part := range incoming {
				current := recordedObject(part)
				if len(parts) > 0 {
					last := recordedObject(parts[len(parts)-1])
					text, isText := current["text"].(string)
					_, wasText := recordedTextValue(last["text"])
					thought, _ := current["thought"].(bool)
					lastThought, _ := last["thought"].(bool)
					if isText && wasText && thought == lastThought && current["thoughtSignature"] == nil && last["thoughtSignature"] == nil {
						appendRecordedText(last, "text", text)
						continue
					}
				}
				parts = append(parts, current)
			}
			content["parts"] = parts
		}
		a.complete = len(a.choices) > 0
		if recordedObject(a.response["promptFeedback"])["blockReason"] != nil {
			a.complete = true
		}
		for _, candidate := range a.choices {
			if candidate["finishReason"] == nil {
				a.complete = false
			}
		}
	}
}
