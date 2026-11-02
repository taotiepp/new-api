package service

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCaptureUpstreamRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name   string
		header http.Header
		want   string
	}{
		{
			name: "claude request-id",
			header: http.Header{
				"Request-Id": {"req_claude"},
			},
			want: "req_claude",
		},
		{
			name: "openai x-request-id",
			header: http.Header{
				"X-Request-Id": {"req_openai"},
			},
			want: "req_openai",
		},
		{
			name: "provider id wins over gateway id",
			header: http.Header{
				"Request-Id":          {"req_claude"},
				"X-Oneapi-Request-Id": {"gateway-id"},
			},
			want: "req_claude",
		},
		{
			name: "gateway id remains the fallback",
			header: http.Header{
				"X-Oneapi-Request-Id": {" gateway-id "},
			},
			want: "gateway-id",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			CaptureUpstreamRequestID(c, tt.header)
			require.Equal(t, tt.want, c.GetString(common.UpstreamRequestIdKey))
		})
	}
}

func TestCaptureUpstreamRequestIDTruncatesToLogColumn(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	header := http.Header{}
	header.Set("request-id", strings.Repeat("a", maxUpstreamRequestIDLength+10))

	CaptureUpstreamRequestID(c, header)

	require.Len(t, c.GetString(common.UpstreamRequestIdKey), maxUpstreamRequestIDLength)
}

func TestShouldCopyUpstreamHeaderKeepsProviderRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set(common.UpstreamRequestIdKey, "req_claude")

	copied := ShouldCopyUpstreamHeader(c, common.RequestIdKey, []string{"gateway-id"})

	require.False(t, copied)
	require.Equal(t, "req_claude", c.GetString(common.UpstreamRequestIdKey))
}
