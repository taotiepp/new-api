package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdvancedCustomProtocolProbeAvailable(t *testing.T) {
	t.Parallel()

	assert.True(t, advancedCustomProtocolProbeAvailable(http.StatusBadRequest, []byte(`{"error":{"message":"bad model"}}`)))
	assert.True(t, advancedCustomProtocolProbeAvailable(http.StatusUnauthorized, nil))
	assert.True(t, advancedCustomProtocolProbeAvailable(http.StatusNotFound, []byte(`{"error":{"code":"model_not_found"}}`)))
	assert.False(t, advancedCustomProtocolProbeAvailable(http.StatusNotFound, []byte(`<html>not found</html>`)))
	assert.False(t, advancedCustomProtocolProbeAvailable(http.StatusNotFound, []byte(`{"error":{"message":"Invalid URL (POST /v1/responses)"}}`)))
	assert.False(t, advancedCustomProtocolProbeAvailable(http.StatusMethodNotAllowed, nil))
	assert.False(t, advancedCustomProtocolProbeAvailable(http.StatusBadGateway, []byte(`upstream down`)))
}

func TestDetectAdvancedCustomProtocolsChecksTheThreeNativeRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var seenMu sync.Mutex
	var seen []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenMu.Lock()
		seen = append(seen, r.URL.Path+" "+r.Header.Get("Authorization")+" "+r.Header.Get("x-api-key")+" "+r.Header.Get("anthropic-version"))
		seenMu.Unlock()
		switch r.URL.Path {
		case "/v1/chat/completions":
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":{"message":"model not found","type":"invalid_request_error"}}`))
		case "/v1/responses":
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`<html>not found</html>`))
		case "/v1/messages":
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"type":"error","error":{"type":"authentication_error"}}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	body, err := common.Marshal(detectAdvancedCustomProtocolsRequest{
		BaseURL: server.URL,
		Key:     "probe-key",
	})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/detect_protocols", strings.NewReader(string(body)))
	ctx.Request.Header.Set("Content-Type", "application/json")
	DetectAdvancedCustomProtocols(ctx)

	var response struct {
		Success bool                                `json:"success"`
		Message string                              `json:"message"`
		Data    []advancedCustomProtocolProbeResult `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success, response.Message)
	require.Equal(t, []advancedCustomProtocolProbeResult{
		{ID: "openai-chat", Available: true},
		{ID: "openai-responses", Available: false},
		{ID: "claude-messages", Available: true},
	}, response.Data)
	require.ElementsMatch(t, []string{
		"/v1/chat/completions Bearer probe-key  ",
		"/v1/responses Bearer probe-key  ",
		"/v1/messages  probe-key 2023-06-01",
	}, seen)
	assert.NotContains(t, recorder.Body.String(), "probe-key")
}

func TestResolveAdvancedCustomProtocolProbeKeyUsesTheSavedKey(t *testing.T) {
	t.Parallel()

	channel := &model.Channel{
		Id:   7,
		Type: constant.ChannelTypeAdvancedCustom,
		Key:  "saved-key",
	}
	key, err := resolveAdvancedCustomProtocolProbeKey(channel, "")
	require.NoError(t, err)
	assert.Equal(t, "saved-key", key)

	key, err = resolveAdvancedCustomProtocolProbeKey(channel, " typed-key \nsecond")
	require.NoError(t, err)
	assert.Equal(t, "typed-key", key)

	_, err = resolveAdvancedCustomProtocolProbeKey(&model.Channel{}, "")
	require.EqualError(t, err, "API key is required")
}
