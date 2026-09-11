package middleware_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/pkg/requestarchive"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequestArchiveStreamNormalization(t *testing.T) {
	tests := []struct{ name, input, expected, state string }{
		{"chat", "data: {\"id\":\"r1\",\"model\":\"m\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"reasoning_content\":\"think\",\"content\":\"你\"}}]}\n\ndata: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"好\"},\"finish_reason\":\"stop\"}]}\n\ndata: {\"choices\":[],\"usage\":{\"total_tokens\":9}}\n\ndata: [DONE]\n\n", `{"id":"r1","model":"m","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"你好","reasoning_content":"think"},"finish_reason":"stop"}],"usage":{"total_tokens":9}}`, "complete"},
		{"out-of-order tools and multiple choices", "data: " + `{"choices":[{"index":1,"delta":{"content":"other"},"finish_reason":"stop"},{"index":0,"delta":{"tool_calls":[{"index":1,"id":"b","type":"function","function":{"name":"second","arguments":"{"}},{"index":0,"id":"a","type":"function","function":{"name":"first","arguments":"{\"x\":"}}]}}]}` + "\n\ndata: " + `{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"1}"}},{"index":1,"function":{"arguments":"}"}}]},"finish_reason":"tool_calls"}]}` + "\n\ndata: [DONE]\n\n", `{"object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","tool_calls":[{"id":"a","type":"function","function":{"name":"first","arguments":"{\"x\":1}"}},{"id":"b","type":"function","function":{"name":"second","arguments":"{}"}}]},"finish_reason":"tool_calls"},{"index":1,"message":{"role":"assistant","content":"other"},"finish_reason":"stop"}]}`, "complete"},
		{"claude", "data: " + `{"type":"message_start","message":{"id":"c1","type":"message","role":"assistant","model":"claude","usage":{"input_tokens":2},"content":[]}}` + "\n\ndata: " + `{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}` + "\n\ndata: " + `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hello"}}` + "\n\ndata: " + `{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"t1","name":"weather","input":{}}}` + "\n\ndata: " + `{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"city\":\"Paris\"}"}}` + "\n\ndata: " + `{"type":"content_block_stop","index":1}` + "\n\ndata: " + `{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":3}}` + "\n\ndata: " + `{"type":"message_stop"}` + "\n\n", `{"id":"c1","type":"message","role":"assistant","model":"claude","usage":{"input_tokens":2,"output_tokens":3},"stop_reason":"tool_use","content":[{"type":"text","text":"hello"},{"type":"tool_use","id":"t1","name":"weather","input":{"city":"Paris"}}]}`, "complete"},
		{"gemini", "data: " + `{"candidates":[{"index":0,"content":{"parts":[{"text":"hel"}]}}]}` + "\n\ndata: " + `{"candidates":[{"index":0,"content":{"parts":[{"text":"lo"},{"functionCall":{"name":"f","args":{"x":1}}}]},"finishReason":"STOP"}],"usageMetadata":{"totalTokenCount":4}}` + "\n\n", `{"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"hello"},{"functionCall":{"name":"f","args":{"x":1}}}]},"finishReason":"STOP"}],"usageMetadata":{"totalTokenCount":4}}`, "complete"},
		{"responses", "event: response.completed\r\ndata: " + `{"type":"response.completed","response":{"id":"resp_1","object":"response","status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"hello"}]}],"usage":{"total_tokens":3}}}` + "\r\n\r\n", `{"id":"resp_1","object":"response","status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"hello"}]}],"usage":{"total_tokens":3}}`, "complete"},
		{"interrupted chat", "data: " + `{"choices":[{"index":0,"delta":{"content":"partial"}}]}` + "\n\n", `{"object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"partial"},"finish_reason":null}]}`, "incomplete"},
		{"error", "data: " + `{"error":{"message":"upstream failed"}}` + "\n\n", `{"error":{"message":"upstream failed"}}`, "incomplete"},
		{"unknown", "data: {\"custom\":1}\n\n", "", "unsupported"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			actual, state := service.NormalizeArchivedStream([]byte(tc.input))
			assert.Equal(t, tc.state, state)
			if tc.expected == "" {
				assert.Empty(t, actual)
			} else {
				assert.JSONEq(t, tc.expected, actual)
			}
		})
	}
}

func TestRequestArchiveRedactionPreservesNumbersAndConversation(t *testing.T) {
	actual, state := service.NormalizeArchivedJSON([]byte(`{"seed":9007199254740993,"api_key":"secret","messages":[{"role":"user","content":"hello"}],"metadata":{"access_token":"secret"}}`))
	assert.Equal(t, "complete", state)
	assert.Contains(t, actual, "9007199254740993")
	assert.NotContains(t, actual, "secret")
	assert.Contains(t, actual, "hello")
}

func TestRequestArchiveResponsesFailureKeepsPartialTextAndFailureStatus(t *testing.T) {
	stream := `data: {"type":"response.created","response":{"id":"r1","status":"in_progress"}}

data: {"type":"response.output_text.delta","output_index":0,"item_id":"m1","delta":"partial answer"}

data: {"type":"response.failed","response":{"id":"r1","status":"failed","error":{"code":"server_error"}}}

`
	body, state := service.NormalizeArchivedStream([]byte(stream))
	assert.Equal(t, "incomplete", state)
	var response struct {
		Status string            `json:"status"`
		Error  map[string]string `json:"error"`
		Output []struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
	}
	require.NoError(t, common.UnmarshalJsonStr(body, &response))
	assert.Equal(t, "failed", response.Status)
	assert.Equal(t, "server_error", response.Error["code"])
	require.Len(t, response.Output, 1)
	require.Len(t, response.Output[0].Content, 1)
	assert.Equal(t, "partial answer", response.Output[0].Content[0].Text)
}

func TestRequestArchiveBlockedGeminiPreservesPromptFeedback(t *testing.T) {
	body, state := service.NormalizeArchivedStream([]byte("data: {\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}\n\n"))
	assert.Equal(t, "complete", state)
	assert.JSONEq(t, `{"promptFeedback":{"blockReason":"SAFETY"},"candidates":[]}`, body)
}

func readRequestArchive(t *testing.T, directory string) []requestarchive.Entry {
	t.Helper()
	files, err := filepath.Glob(filepath.Join(directory, "*.jsonl"))
	require.NoError(t, err)
	var records []requestarchive.Entry
	for _, file := range files {
		data, err := os.ReadFile(file)
		require.NoError(t, err)
		for line := range strings.SplitSeq(strings.TrimSpace(string(data)), "\n") {
			if line == "" {
				continue
			}
			var entry requestarchive.Entry
			require.NoError(t, common.UnmarshalJsonStr(line, &entry), "each physical line must be standalone JSON")
			records = append(records, entry)
		}
	}
	return records
}

func TestRequestArchiveCaptureDoesNotChangeDelivery(t *testing.T) {
	for _, tc := range []struct {
		name, requestType, request, responseType, response, requestState, responseState string
		disabled                                                                        bool
	}{
		{"disabled", "application/json", `{"messages":[]}`, "application/json", `{"ok":true}`, "", "", true},
		{"json", "application/json", `{"messages":[{"content":"hello"}],"api_key":"secret"}`, "application/json", `{"answer":"你好\nworld"}`, "complete", "complete", false},
		{"sse", "application/json", `{"stream":true}`, "text/event-stream", "data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"hello\"},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n", "complete", "complete", false},
		{"oversized request", "application/json", `{"text":"` + strings.Repeat("x", 1024) + `"}`, "application/json", `{}`, "too_large", "complete", false},
		{"oversized response", "application/json", `{}`, "application/json", `{"text":"` + strings.Repeat("x", 1024) + `"}`, "complete", "too_large", false},
		{"binary", "audio/wav", "binary audio", "audio/mpeg", "binary output", "unsupported", "unsupported", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			directory := t.TempDir()
			var archive *requestarchive.Archive
			if !tc.disabled {
				var err error
				archive, err = requestarchive.Open(requestarchive.Config{Directory: directory, MaxBodyBytes: 1024})
				require.NoError(t, err)
				t.Cleanup(func() { require.NoError(t, archive.Close()) })
			}
			router := gin.New()
			router.Use(func(c *gin.Context) { c.Set(string(constant.ContextKeyUserId), 7); c.Set(common.RequestIdKey, tc.name) })
			router.POST("/v1/chat/completions", middleware.RequestArchiving(archive), func(c *gin.Context) {
				// Exercise the same reusable storage path used by distribution and retries.
				incoming, err := common.GetBodyStorage(c)
				require.NoError(t, err)
				defer common.CleanupBodyStorage(c)
				body, err := incoming.Bytes()
				require.NoError(t, err)
				assert.Equal(t, tc.request, string(body))
				c.Header("Content-Type", tc.responseType)
				n := len(tc.response) / 2
				_, _ = c.Writer.Write([]byte(tc.response[:n]))
				c.Writer.Flush()
				_, _ = c.Writer.WriteString(tc.response[n:])
				c.Writer.Flush()
			})
			request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions?key=secret", strings.NewReader(tc.request))
			request.Header.Set("Content-Type", tc.requestType)
			request.Header.Set("Authorization", "Bearer secret")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			assert.Equal(t, http.StatusOK, response.Code)
			assert.True(t, response.Flushed)
			assert.Equal(t, tc.response, response.Body.String())
			records := readRequestArchive(t, directory)
			if tc.disabled {
				assert.Empty(t, records)
				return
			}
			require.Len(t, records, 1)
			record := records[0]
			assert.Equal(t, "/v1/chat/completions", record.Path)
			assert.Equal(t, 7, record.UserID)
			assert.Equal(t, tc.requestState, record.RequestState)
			assert.Equal(t, tc.responseState, record.ResponseState)
			assert.NotContains(t, string(record.Response), "data:")
			assert.NotContains(t, string(record.Request), "secret")
			if tc.requestState == "too_large" {
				assert.Empty(t, record.Request)
			}
			if tc.responseState == "too_large" {
				assert.Empty(t, record.Response)
			}
		})
	}
}

func TestRequestArchiveConcurrentWritersKeepSeparateValidLines(t *testing.T) {
	directory := t.TempDir()
	first, err := requestarchive.Open(requestarchive.Config{Directory: directory, MaxBodyBytes: 1024})
	require.NoError(t, err)
	second, err := requestarchive.Open(requestarchive.Config{Directory: directory, MaxBodyBytes: 1024})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, first.Close()); require.NoError(t, second.Close()) })
	var group sync.WaitGroup
	for _, entry := range []struct {
		writer *requestarchive.Archive
		id     string
	}{{first, "first"}, {first, "second"}, {second, "replica"}} {
		group.Go(func() {
			assert.NoError(t, entry.writer.Append(requestarchive.Entry{RequestID: entry.id, Request: json.RawMessage(`{"text":"line1\nline2"}`)}))
		})
	}
	group.Wait()
	records := readRequestArchive(t, directory)
	require.Len(t, records, 3)
	ids := make([]string, 0, 3)
	for _, record := range records {
		ids = append(ids, record.RequestID)
		assert.JSONEq(t, `{"text":"line1\nline2"}`, string(record.Request))
	}
	assert.ElementsMatch(t, []string{"first", "second", "replica"}, ids)
	files, err := filepath.Glob(filepath.Join(directory, "*.jsonl"))
	require.NoError(t, err)
	require.Len(t, files, 2)
	for _, file := range files {
		info, err := os.Stat(file)
		require.NoError(t, err)
		assert.Equal(t, os.FileMode(0600), info.Mode().Perm())
	}
}

func TestRequestArchiveRotatesByUTCRequestDateAndRetainsFilesByDefault(t *testing.T) {
	directory := t.TempDir()
	archive, err := requestarchive.Open(requestarchive.Config{Directory: directory, MaxBodyBytes: 1024})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, archive.Close()) })
	for _, day := range []string{"2026-01-01", "2026-01-02"} {
		date, err := time.Parse(time.DateOnly, day)
		require.NoError(t, err)
		require.NoError(t, archive.Append(requestarchive.Entry{RequestID: day, CreatedAt: date.Unix()}))
		files, err := filepath.Glob(filepath.Join(directory, "requests-"+day+"-*.jsonl"))
		require.NoError(t, err)
		require.Len(t, files, 1)
	}
	require.NoError(t, archive.Cleanup(time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC)))
	assert.Len(t, readRequestArchive(t, directory), 2)
}

func TestRequestArchiveRetentionOnlyDeletesExpiredArchiveFiles(t *testing.T) {
	directory := t.TempDir()
	archive, err := requestarchive.Open(requestarchive.Config{Directory: directory, MaxBodyBytes: 1024, RetentionDays: 7})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, archive.Close()) })
	now := time.Now().UTC()
	expired := now.AddDate(0, 0, -8)
	boundary := now.AddDate(0, 0, -7)
	require.NoError(t, archive.Append(requestarchive.Entry{RequestID: "expired", CreatedAt: expired.Unix()}))
	require.NoError(t, archive.Append(requestarchive.Entry{RequestID: "retained", CreatedAt: boundary.Unix()}))
	unrelated := filepath.Join(directory, "notes.jsonl")
	require.NoError(t, os.WriteFile(unrelated, []byte("leave untouched"), 0600))
	outside := filepath.Join(t.TempDir(), "outside.jsonl")
	require.NoError(t, os.WriteFile(outside, []byte("outside"), 0600))
	link := filepath.Join(directory, "requests-2000-01-01-"+strings.Repeat("A", 26)+".jsonl")
	require.NoError(t, os.Symlink(outside, link))
	require.NoError(t, archive.Cleanup(now))
	old, err := filepath.Glob(filepath.Join(directory, "requests-"+expired.Format(time.DateOnly)+"-*.jsonl"))
	require.NoError(t, err)
	assert.Empty(t, old)
	kept, err := filepath.Glob(filepath.Join(directory, "requests-"+boundary.Format(time.DateOnly)+"-*.jsonl"))
	require.NoError(t, err)
	assert.Len(t, kept, 1)
	assert.FileExists(t, unrelated)
	assert.FileExists(t, outside)
	_, err = os.Lstat(link)
	require.NoError(t, err)
}

func TestRequestArchiveFailureAndCancellationDoNotBreakResponse(t *testing.T) {
	for _, closed := range []bool{false, true} {
		t.Run(map[bool]string{false: "cancelled request", true: "closed archive"}[closed], func(t *testing.T) {
			directory := t.TempDir()
			archive, err := requestarchive.Open(requestarchive.Config{Directory: directory, MaxBodyBytes: 1024})
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, archive.Close()) })
			if closed {
				require.NoError(t, archive.Close())
			}
			ctx, cancel := context.WithCancel(context.Background())
			router := gin.New()
			router.POST("/v1/chat/completions", middleware.RequestArchiving(archive), func(c *gin.Context) {
				_, err := io.ReadAll(c.Request.Body)
				require.NoError(t, err)
				cancel()
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid model"})
			})
			request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{}`)).WithContext(ctx)
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			assert.Equal(t, http.StatusBadRequest, response.Code)
			assert.JSONEq(t, `{"error":"invalid model"}`, response.Body.String())
			records := readRequestArchive(t, directory)
			if closed {
				assert.Empty(t, records)
			} else {
				require.Len(t, records, 1)
				assert.Equal(t, http.StatusBadRequest, records[0].StatusCode)
			}
		})
	}
}

func TestRequestArchiveEnvironmentIsOptInAndValidated(t *testing.T) {
	directory := filepath.Join(t.TempDir(), "archive")
	t.Setenv("REQUEST_ARCHIVE_ENABLED", "false")
	t.Setenv("REQUEST_ARCHIVE_DIR", directory)
	t.Setenv("REQUEST_ARCHIVE_MAX_BODY_BYTES", "1024")
	t.Setenv("REQUEST_ARCHIVE_RETENTION_DAYS", "0")
	archive, err := requestarchive.OpenFromEnv()
	require.NoError(t, err)
	assert.Nil(t, archive)
	assert.NoDirExists(t, directory)
	t.Setenv("REQUEST_ARCHIVE_ENABLED", "true")
	t.Setenv("REQUEST_ARCHIVE_MAX_BODY_BYTES", "0")
	_, err = requestarchive.OpenFromEnv()
	require.Error(t, err)
	t.Setenv("REQUEST_ARCHIVE_MAX_BODY_BYTES", "1024")
	t.Setenv("REQUEST_ARCHIVE_RETENTION_DAYS", "-1")
	_, err = requestarchive.OpenFromEnv()
	require.Error(t, err)
	t.Setenv("REQUEST_ARCHIVE_RETENTION_DAYS", "0")
	archive, err = requestarchive.OpenFromEnv()
	require.NoError(t, err)
	require.NoError(t, archive.Close())
	assert.DirExists(t, directory)
}
