package tencent

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
)

const tokenHubBaseURL = "https://tokenhub.tencentmaas.com"

// DispatchAdaptor 按密钥格式分流:三段式 ak/sk 走原生 TC3。
// 单段 TokenHub key 按客户端协议原样转发 OpenAI Chat、Responses 和 Claude Messages。
type DispatchAdaptor struct {
	channel.Adaptor
}

func (a *DispatchAdaptor) Init(info *relaycommon.RelayInfo) {
	if strings.Contains(info.ApiKey, "|") {
		a.Adaptor = &Adaptor{}
	} else if info.RelayFormat == types.RelayFormatClaude {
		a.Adaptor = &claude.Adaptor{}
		useTokenHubBaseURL(info)
	} else {
		a.Adaptor = &openai.Adaptor{}
		useTokenHubBaseURL(info)
	}
	a.Adaptor.Init(info)
}

func useTokenHubBaseURL(info *relaycommon.RelayInfo) {
	if info.ChannelBaseUrl == "" || info.ChannelBaseUrl == constant.ChannelBaseURLs[constant.ChannelTypeTencent] {
		info.ChannelBaseUrl = tokenHubBaseURL
	}
}

func (a *DispatchAdaptor) GetModelList() []string {
	return ModelList
}

func (a *DispatchAdaptor) GetChannelName() string {
	return ChannelName
}
