package service

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/gin-gonic/gin"
)

func CloseResponseBodyGracefully(httpResponse *http.Response) {
	if httpResponse == nil || httpResponse.Body == nil {
		return
	}
	err := httpResponse.Body.Close()
	if err != nil {
		common.SysError("failed to close response body: " + err.Error())
	}
}

// maxUpstreamRequestIDLength matches logs.upstream_request_id varchar(128).
const maxUpstreamRequestIDLength = 128

// upstreamRequestIDHeaders prefers the provider's own request id. X-Oneapi-Request-Id
// remains the fallback when the upstream hop is another new-api instance.
var upstreamRequestIDHeaders = []string{
	"x-request-id",
	"request-id",
	common.RequestIdKey,
}

// CaptureUpstreamRequestID stores the original upstream request id for the usage log.
// Provider headers such as OpenAI x-request-id and Anthropic request-id win over
// X-Oneapi-Request-Id when both are present.
func CaptureUpstreamRequestID(c *gin.Context, header http.Header) {
	if c == nil || header == nil {
		return
	}
	for _, name := range upstreamRequestIDHeaders {
		id := strings.TrimSpace(header.Get(name))
		if id == "" {
			continue
		}
		if len(id) > maxUpstreamRequestIDLength {
			id = id[:maxUpstreamRequestIDLength]
		}
		c.Set(common.UpstreamRequestIdKey, id)
		return
	}
}

// ShouldCopyUpstreamHeader checks whether a given upstream response header
// should be copied to the client response. It returns false for Content-Length
// (managed separately) and X-Oneapi-Request-Id (to preserve the local instance
// ID). X-Oneapi-Request-Id is recorded only when no provider request id was captured.
func ShouldCopyUpstreamHeader(c *gin.Context, k string, v []string) bool {
	if strings.EqualFold(k, "Content-Length") {
		return false
	}
	if strings.EqualFold(k, common.RequestIdKey) {
		if c != nil && len(v) > 0 && strings.TrimSpace(c.GetString(common.UpstreamRequestIdKey)) == "" {
			id := strings.TrimSpace(v[0])
			if len(id) > maxUpstreamRequestIDLength {
				id = id[:maxUpstreamRequestIDLength]
			}
			if id != "" {
				c.Set(common.UpstreamRequestIdKey, id)
			}
		}
		return false
	}
	return true
}

func IOCopyBytesGracefully(c *gin.Context, src *http.Response, data []byte) {
	if c.Writer == nil {
		return
	}

	body := io.NopCloser(bytes.NewBuffer(data))

	// We shouldn't set the header before we parse the response body, because the parse part may fail.
	// And then we will have to send an error response, but in this case, the header has already been set.
	// So the httpClient will be confused by the response.
	// For example, Postman will report error, and we cannot check the response at all.
	if src != nil {
		for k, v := range src.Header {
			if !ShouldCopyUpstreamHeader(c, k, v) {
				continue
			}
			c.Writer.Header().Set(k, v[0])
		}
	}

	// set Content-Length header manually BEFORE calling WriteHeader
	c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))

	// Write header with status code (this sends the headers)
	if src != nil {
		c.Writer.WriteHeader(src.StatusCode)
	} else {
		c.Writer.WriteHeader(http.StatusOK)
	}

	_, err := io.Copy(c.Writer, body)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("failed to copy response body: %s", err.Error()))
	}
	c.Writer.Flush()
}
