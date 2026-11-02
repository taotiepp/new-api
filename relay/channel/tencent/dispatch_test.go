package tencent

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDispatchAdaptorInit(t *testing.T) {
	tests := []struct {
		name        string
		apiKey      string
		baseURL     string
		wantTC3     bool
		wantClaude  bool
		relayFormat types.RelayFormat
		wantBaseURL string
	}{
		{
			name:        "legacy three-segment key selects TC3 adaptor and keeps base url",
			apiKey:      "1300000000|AKIDxxxxxxxx|secretxxxxxxxx",
			baseURL:     constant.ChannelBaseURLs[constant.ChannelTypeTencent],
			wantTC3:     true,
			wantBaseURL: constant.ChannelBaseURLs[constant.ChannelTypeTencent],
		},
		{
			name:        "tokenhub key with default base url rewrites to tokenhub",
			apiKey:      "sk-xxxxxxxxxxxxxxxx",
			baseURL:     constant.ChannelBaseURLs[constant.ChannelTypeTencent],
			wantTC3:     false,
			wantBaseURL: tokenHubBaseURL,
		},
		{
			name:        "tokenhub key with empty base url rewrites to tokenhub",
			apiKey:      "sk-xxxxxxxxxxxxxxxx",
			baseURL:     "",
			wantTC3:     false,
			wantBaseURL: tokenHubBaseURL,
		},
		{
			name:        "tokenhub key with custom base url is preserved",
			apiKey:      "sk-xxxxxxxxxxxxxxxx",
			baseURL:     "https://proxy.example.com",
			wantTC3:     false,
			wantBaseURL: "https://proxy.example.com",
		},
		{
			name:        "tokenhub claude messages uses the claude adaptor",
			apiKey:      "sk-xxxxxxxxxxxxxxxx",
			baseURL:     "",
			relayFormat: types.RelayFormatClaude,
			wantClaude:  true,
			wantBaseURL: tokenHubBaseURL,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				RelayFormat: tt.relayFormat,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:    constant.ChannelTypeTencent,
					ApiKey:         tt.apiKey,
					ChannelBaseUrl: tt.baseURL,
				},
			}

			dispatch := &DispatchAdaptor{}
			dispatch.Init(info)

			require.NotNil(t, dispatch.Adaptor)
			switch {
			case tt.wantTC3:
				assert.IsType(t, &Adaptor{}, dispatch.Adaptor)
			case tt.wantClaude:
				assert.IsType(t, &claude.Adaptor{}, dispatch.Adaptor)
			default:
				assert.IsType(t, &openai.Adaptor{}, dispatch.Adaptor)
			}
			assert.Equal(t, tt.wantBaseURL, info.ChannelBaseUrl)
		})
	}
}

func TestTokenHubKeepsNativeProtocolURLs(t *testing.T) {
	tests := []struct {
		name        string
		format      types.RelayFormat
		mode        int
		requestPath string
		wantURL     string
	}{
		{
			name:        "chat completions",
			format:      types.RelayFormatOpenAI,
			mode:        relayconstant.RelayModeChatCompletions,
			requestPath: "/v1/chat/completions",
			wantURL:     tokenHubBaseURL + "/v1/chat/completions",
		},
		{
			name:        "responses",
			format:      types.RelayFormatOpenAIResponses,
			mode:        relayconstant.RelayModeResponses,
			requestPath: "/v1/responses",
			wantURL:     tokenHubBaseURL + "/v1/responses",
		},
		{
			name:        "claude messages",
			format:      types.RelayFormatClaude,
			requestPath: "/v1/messages",
			wantURL:     tokenHubBaseURL + "/v1/messages",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				RelayFormat:    tt.format,
				RelayMode:      tt.mode,
				RequestURLPath: tt.requestPath,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType: constant.ChannelTypeTencent,
					ApiKey:      "sk-xxxxxxxxxxxxxxxx",
				},
			}
			dispatch := &DispatchAdaptor{}
			dispatch.Init(info)

			got, err := dispatch.GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, tt.wantURL, got)
		})
	}
}
