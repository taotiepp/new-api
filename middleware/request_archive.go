package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/pkg/requestarchive"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// recordBuffer bounds memory even when an upstream sends an endless stream.
// SSE keepalive writers can run concurrently with the response writer.
type recordBuffer struct {
	mu       sync.Mutex
	body     bytes.Buffer
	limit    int
	exceeded bool
}

func (b *recordBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if !b.exceeded {
		if len(p) > b.limit-b.body.Len() {
			b.exceeded = true
			b.body.Reset()
		} else {
			_, _ = b.body.Write(p)
		}
	}
	return len(p), nil
}

func (b *recordBuffer) snapshot() ([]byte, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return bytes.Clone(b.body.Bytes()), b.exceeded
}

type requestRecordReader struct {
	io.Reader
	io.Closer
}

type requestRecordWriter struct {
	gin.ResponseWriter
	buffer *recordBuffer
}

func (w *requestRecordWriter) Write(p []byte) (int, error) {
	n, err := w.ResponseWriter.Write(p)
	_, _ = w.buffer.Write(p[:n])
	return n, err
}

func (w *requestRecordWriter) WriteString(s string) (int, error) {
	return w.Write([]byte(s))
}

// RequestArchiving belongs after authentication and before distribution/body
// rewriting. It neither buffers delivery nor changes SSE flushing semantics.
// WebSocket frames and binary bodies are not recorded.
func RequestArchiving(archive *requestarchive.Archive) gin.HandlerFunc {
	return func(c *gin.Context) {
		if archive == nil || c.Request.Method == http.MethodGet || strings.EqualFold(c.GetHeader("Upgrade"), "websocket") {
			c.Next()
			return
		}
		started := time.Now()
		requestBuffer := &recordBuffer{limit: archive.MaxBodyBytes()}
		responseBuffer := &recordBuffer{limit: archive.MaxBodyBytes()}
		contentType, _, _ := mime.ParseMediaType(c.GetHeader("Content-Type"))
		isJSON := contentType == "" || contentType == "application/json" || strings.HasSuffix(contentType, "+json")
		if isJSON && c.Request.Body != nil {
			original := c.Request.Body
			c.Request.Body = &requestRecordReader{Reader: io.TeeReader(original, requestBuffer), Closer: original}
		}
		writer := &requestRecordWriter{ResponseWriter: c.Writer, buffer: responseBuffer}
		c.Writer = writer
		finished := false
		defer func() {
			requestBody, requestExceeded := requestBuffer.snapshot()
			responseBody, responseExceeded := responseBuffer.snapshot()
			record := requestarchive.Entry{
				RequestID: c.GetString(common.RequestIdKey),
				UserID:    common.GetContextKeyInt(c, constant.ContextKeyUserId),
				TokenID:   common.GetContextKeyInt(c, constant.ContextKeyTokenId),
				ChannelID: common.GetContextKeyInt(c, constant.ContextKeyChannelId),
				Model:     common.GetContextKeyString(c, constant.ContextKeyOriginalModel),
				CreatedAt: started.Unix(), Method: c.Request.Method, Path: c.Request.URL.Path,
				StatusCode: writer.Status(), DurationMs: time.Since(started).Milliseconds(),
				RequestState: "unsupported", ResponseState: "unsupported",
			}
			if record.RequestID == "" {
				record.RequestID = common.NewRequestId()
			}
			if record.UserID == 0 {
				record.UserID = c.GetInt("id")
			}
			if isJSON {
				body, state := service.NormalizeArchivedJSON(requestBody)
				record.Request, record.RequestState = json.RawMessage(body), state
				if len(requestBody) == 0 && c.Request.ContentLength > 0 {
					record.RequestState = "not_read"
				}
			}
			if requestExceeded {
				record.Request, record.RequestState = nil, "too_large"
			}
			responseType, _, _ := mime.ParseMediaType(writer.Header().Get("Content-Type"))
			record.Stream = responseType == "text/event-stream"
			if record.Stream {
				body, state := service.NormalizeArchivedStream(responseBody)
				record.Response, record.ResponseState = json.RawMessage(body), state
			} else if responseType == "application/json" || strings.HasSuffix(responseType, "+json") {
				body, state := service.NormalizeArchivedJSON(responseBody)
				record.Response, record.ResponseState = json.RawMessage(body), state
			}
			if responseExceeded {
				record.Response, record.ResponseState = nil, "too_large"
			}
			if !finished {
				record.StatusCode, record.ResponseState = http.StatusInternalServerError, "incomplete"
			}
			if err := archive.Append(record); err != nil {
				logger.LogError(c, "failed to append request archive: "+err.Error())
			}
		}()
		c.Next()
		finished = true
	}
}
