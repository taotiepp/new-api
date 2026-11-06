package channel

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDoRequestReturnsUpstreamRedirectWithoutFollowing(t *testing.T) {
	service.InitHttpClient()
	gin.SetMode(gin.TestMode)
	sharedClient := service.GetHttpClient()
	require.NotNil(t, sharedClient)
	require.NotNil(t, sharedClient.CheckRedirect)
	originalRedirectPolicy := reflect.ValueOf(sharedClient.CheckRedirect).Pointer()

	var targetRequests atomic.Int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		targetRequests.Add(1)
		w.WriteHeader(http.StatusTeapot)
	}))
	defer target.Close()

	const responseBody = "redirect response"
	tests := []int{
		http.StatusMovedPermanently,
		http.StatusFound,
		http.StatusSeeOther,
		http.StatusTemporaryRedirect,
		http.StatusPermanentRedirect,
	}

	for _, statusCode := range tests {
		t.Run(http.StatusText(statusCode), func(t *testing.T) {
			targetRequests.Store(0)
			var sourceRequests atomic.Int32
			type sourceResult struct {
				body []byte
				err  error
			}
			sourceResultCh := make(chan sourceResult, 1)
			source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				sourceRequests.Add(1)
				body, err := io.ReadAll(r.Body)
				sourceResultCh <- sourceResult{body: body, err: err}
				w.Header().Set("Location", target.URL+"/redirect-target")
				w.WriteHeader(statusCode)
				_, _ = io.WriteString(w, responseBody)
			}))
			defer source.Close()

			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/relay", nil)

			req, err := http.NewRequest(http.MethodPost, source.URL, bytes.NewReader([]byte("request body")))
			require.NoError(t, err)
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

			resp, err := doRequest(ctx, req, info)
			require.NoError(t, err)
			defer resp.Body.Close()
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			gotSource := <-sourceResultCh
			require.NoError(t, gotSource.err)

			assert.Equal(t, statusCode, resp.StatusCode)
			assert.Equal(t, target.URL+"/redirect-target", resp.Header.Get("Location"))
			assert.Equal(t, responseBody, string(body))
			assert.Equal(t, []byte("request body"), gotSource.body)
			assert.EqualValues(t, 1, sourceRequests.Load())
			assert.Zero(t, targetRequests.Load())
		})
	}

	assert.Equal(t, originalRedirectPolicy, reflect.ValueOf(sharedClient.CheckRedirect).Pointer(), "the cached client must not be mutated")
}

func TestDoRequestStreamStatusTimeoutCancelsHungUpstream(t *testing.T) {
	service.InitHttpClient()
	gin.SetMode(gin.TestMode)

	release := make(chan struct{})
	var releaseOnce sync.Once
	upstream := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		<-release
	}))
	t.Cleanup(func() {
		releaseOnce.Do(func() { close(release) })
		upstream.CloseClientConnections()
		upstream.Close()
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	req, err := http.NewRequest(http.MethodPost, upstream.URL, bytes.NewReader([]byte(`{"stream":true}`)))
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{
		IsStream:    true,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
	info.SetFirstProgressTimeoutForTest(200 * time.Millisecond)

	started := time.Now()
	resp, err := doRequest(ctx, req, info)
	if resp != nil && resp.Body != nil {
		_ = resp.Body.Close()
	}
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no HTTP status before the first-progress timeout")
	assert.Less(t, time.Since(started), 2*time.Second)
}

func TestDoRequestStreamStatusTimeoutLeavesAFastBodyReadable(t *testing.T) {
	service.InitHttpClient()
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "data: hi\n\n")
	}))
	t.Cleanup(upstream.Close)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	req, err := http.NewRequest(http.MethodPost, upstream.URL, bytes.NewReader([]byte(`{"stream":true}`)))
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{
		IsStream:    true,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
	info.SetFirstProgressTimeoutForTest(2 * time.Second)

	resp, err := doRequest(ctx, req, info)
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "data: hi\n\n", string(body))
}
