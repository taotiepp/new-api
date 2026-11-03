package controller

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/advancedcustom"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const advancedCustomProtocolProbeTimeout = 15 * time.Second
const advancedCustomProtocolProbeBodyLimit = 64 << 10

type advancedCustomProtocolProbe struct {
	id     string
	path   string
	body   string
	claude bool
}

type advancedCustomProtocolProbeResult struct {
	ID        string `json:"id"`
	Available bool   `json:"available"`
}

type detectAdvancedCustomProtocolsRequest struct {
	ChannelID      int     `json:"channel_id"`
	BaseURL        string  `json:"base_url"`
	Key            string  `json:"key"`
	HeaderOverride *string `json:"header_override"`
	Proxy          *string `json:"proxy"`
}

var advancedCustomProtocolProbes = []advancedCustomProtocolProbe{
	{
		id:   "openai-chat",
		path: "/v1/chat/completions",
		body: `{"model":"protocol-probe","messages":[{"role":"user","content":"ping"}],"max_tokens":1}`,
	},
	{
		id:   "openai-responses",
		path: "/v1/responses",
		body: `{"model":"protocol-probe","input":"ping","max_output_tokens":16}`,
	},
	{
		id:     "claude-messages",
		path:   "/v1/messages",
		body:   `{"model":"protocol-probe","max_tokens":1,"messages":[{"role":"user","content":"ping"}]}`,
		claude: true,
	},
}

func DetectAdvancedCustomProtocols(c *gin.Context) {
	var req detectAdvancedCustomProtocolsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request",
		})
		return
	}

	channel, key, baseURL, err := advancedCustomProtocolProbeChannel(req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	results, err := probeAdvancedCustomProtocols(channel, key, baseURL)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": sanitizeFetchModelsError(err, key).Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    results,
	})
}

func advancedCustomProtocolProbeChannel(req detectAdvancedCustomProtocolsRequest) (*model.Channel, string, string, error) {
	var channel *model.Channel
	if req.ChannelID > 0 {
		savedChannel, err := model.GetChannelById(req.ChannelID, true)
		if err != nil {
			return nil, "", "", err
		}
		if savedChannel.Type != constant.ChannelTypeAdvancedCustom {
			return nil, "", "", fmt.Errorf("channel %d is not an advanced custom channel", req.ChannelID)
		}
		channel = savedChannel
	} else {
		channel = &model.Channel{Type: constant.ChannelTypeAdvancedCustom}
	}

	baseURL := strings.TrimSpace(req.BaseURL)
	if baseURL == "" {
		baseURL = strings.TrimSpace(channel.GetBaseURL())
	}
	if baseURL == "" {
		return nil, "", "", fmt.Errorf("base URL is required")
	}
	channel.BaseURL = &baseURL

	key, err := resolveAdvancedCustomProtocolProbeKey(channel, req.Key)
	if err != nil {
		return nil, "", "", err
	}

	if req.HeaderOverride != nil && strings.TrimSpace(*req.HeaderOverride) != "" {
		rawHeaderOverride := strings.TrimSpace(*req.HeaderOverride)
		var headerOverride map[string]any
		if err := common.UnmarshalJsonStr(rawHeaderOverride, &headerOverride); err != nil {
			return nil, "", "", fmt.Errorf("header_override must be a JSON object")
		}
		channel.HeaderOverride = &rawHeaderOverride
	}
	if req.Proxy != nil {
		settings := channel.GetSetting()
		settings.Proxy = strings.TrimSpace(*req.Proxy)
		channel.SetSetting(settings)
	}
	return channel, key, baseURL, nil
}

func resolveAdvancedCustomProtocolProbeKey(channel *model.Channel, requestKey string) (string, error) {
	requestKey = strings.TrimSpace(requestKey)
	if requestKey != "" {
		return strings.TrimSpace(strings.Split(requestKey, "\n")[0]), nil
	}
	if channel == nil || channel.Id == 0 {
		return "", fmt.Errorf("API key is required")
	}
	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		return "", fmt.Errorf("API key is required")
	}
	key = strings.TrimSpace(strings.Split(key, "\n")[0])
	if key == "" {
		return "", fmt.Errorf("API key is required")
	}
	return key, nil
}

func probeAdvancedCustomProtocols(channel *model.Channel, key string, baseURL string) ([]advancedCustomProtocolProbeResult, error) {
	if _, err := advancedcustom.JoinUpstreamURL(baseURL, "/v1/chat/completions"); err != nil {
		return nil, err
	}
	if err := applyFetchModelsHeaderOverrides(channel, key, make(http.Header)); err != nil {
		return nil, err
	}

	proxy := ""
	if channel != nil {
		proxy = channel.GetSetting().Proxy
	}
	client, err := service.NewProxyHttpClient(proxy)
	if err != nil {
		return nil, err
	}
	probeClient := *client
	probeClient.Timeout = advancedCustomProtocolProbeTimeout

	results := make([]advancedCustomProtocolProbeResult, len(advancedCustomProtocolProbes))
	var waitGroup sync.WaitGroup
	for index, probe := range advancedCustomProtocolProbes {
		waitGroup.Go(func() {
			results[index] = advancedCustomProtocolProbeResult{ID: probe.id}
			available, probeErr := executeAdvancedCustomProtocolProbe(channel, &probeClient, key, baseURL, probe)
			if probeErr == nil {
				results[index].Available = available
			}
		})
	}
	waitGroup.Wait()
	return results, nil
}

func executeAdvancedCustomProtocolProbe(channel *model.Channel, client *http.Client, key string, baseURL string, probe advancedCustomProtocolProbe) (bool, error) {
	targetURL, err := advancedcustom.JoinUpstreamURL(baseURL, probe.path)
	if err != nil {
		return false, err
	}
	header := advancedCustomProtocolProbeHeader(probe, key)
	if err := applyFetchModelsHeaderOverrides(channel, key, header); err != nil {
		return false, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), advancedCustomProtocolProbeTimeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, strings.NewReader(probe.body))
	if err != nil {
		return false, err
	}
	request.Header = header
	response, err := client.Do(request)
	if err != nil {
		return false, nil
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, advancedCustomProtocolProbeBodyLimit))
	if err != nil {
		return false, nil
	}
	return advancedCustomProtocolProbeAvailable(response.StatusCode, body), nil
}

func advancedCustomProtocolProbeHeader(probe advancedCustomProtocolProbe, key string) http.Header {
	header := make(http.Header)
	header.Set("Content-Type", "application/json")
	if probe.claude {
		header.Set("x-api-key", key)
		header.Set("anthropic-version", "2023-06-01")
		return header
	}
	header.Set("Authorization", "Bearer "+key)
	return header
}

func advancedCustomProtocolProbeAvailable(status int, body []byte) bool {
	switch status {
	case http.StatusNotFound, http.StatusMethodNotAllowed, http.StatusNotImplemented:
		return advancedCustomProtocolProbeBody(body)
	default:
		if status >= http.StatusInternalServerError {
			return advancedCustomProtocolProbeBody(body)
		}
		return status >= http.StatusOK && status < http.StatusInternalServerError
	}
}

func advancedCustomProtocolProbeBody(body []byte) bool {
	text := strings.ToLower(string(body))
	if strings.Contains(text, "invalid url") {
		return false
	}
	markers := []string{
		"model_not_found",
		"not_found_error",
		"invalid_request_error",
		"authentication_error",
		"permission_error",
		"rate_limit_error",
	}
	for _, marker := range markers {
		if strings.Contains(text, marker) {
			return true
		}
	}
	return false
}
