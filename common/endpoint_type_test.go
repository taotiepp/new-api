package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
)

func TestGetEndpointTypesByChannelTypeDetectsModelKind(t *testing.T) {
	tests := []struct {
		name        string
		channelType int
		modelName   string
		want        []constant.EndpointType
	}{
		{
			name:        "bge reranker takes precedence over embedding family",
			channelType: constant.ChannelTypeSiliconFlow,
			modelName:   "BAAI/bge-reranker-v2-m3",
			want:        []constant.EndpointType{constant.EndpointTypeJinaRerank},
		},
		{name: "bge embedding remains embedding", channelType: constant.ChannelTypeSiliconFlow, modelName: "BAAI/bge-m3", want: []constant.EndpointType{constant.EndpointTypeEmbeddings}},
		{
			name:        "openai chat stays chat completions",
			channelType: constant.ChannelTypeOpenAI,
			modelName:   "gpt-4o",
			want:        []constant.EndpointType{constant.EndpointTypeOpenAI},
		},
		{
			name:        "openai embedding uses embeddings path",
			channelType: constant.ChannelTypeOpenAI,
			modelName:   "text-embedding-3-small",
			want:        []constant.EndpointType{constant.EndpointTypeEmbeddings},
		},
		{
			name:        "gemini chat keeps native and openai",
			channelType: constant.ChannelTypeGemini,
			modelName:   "gemini-2.5-flash",
			want: []constant.EndpointType{
				constant.EndpointTypeGemini,
				constant.EndpointTypeOpenAI,
			},
		},
		{
			name:        "gemini embedding uses embeddings path",
			channelType: constant.ChannelTypeGemini,
			modelName:   "gemini-embedding-001",
			want:        []constant.EndpointType{constant.EndpointTypeEmbeddings},
		},
		{
			name:        "jina rerank stays rerank",
			channelType: constant.ChannelTypeJina,
			modelName:   "jina-rerank-v2",
			want:        []constant.EndpointType{constant.EndpointTypeJinaRerank},
		},
		{
			name:        "jina embedding uses embeddings path",
			channelType: constant.ChannelTypeJina,
			modelName:   "jina-embeddings-v3",
			want:        []constant.EndpointType{constant.EndpointTypeEmbeddings},
		},
		{
			name:        "mokaai is embeddings",
			channelType: constant.ChannelTypeMokaAI,
			modelName:   "m3e-base",
			want:        []constant.EndpointType{constant.EndpointTypeEmbeddings},
		},
		{
			name:        "image model prepends image generation",
			channelType: constant.ChannelTypeOpenAI,
			modelName:   "dall-e-3",
			want: []constant.EndpointType{
				constant.EndpointTypeImageGeneration,
				constant.EndpointTypeOpenAI,
			},
		},
		{
			name:        "seedream is image generation",
			channelType: constant.ChannelTypeVolcEngine,
			modelName:   "doubao-seedream-4.0",
			want: []constant.EndpointType{
				constant.EndpointTypeImageGeneration,
				constant.EndpointTypeOpenAI,
			},
		},
		{
			name:        "codex model uses responses",
			channelType: constant.ChannelTypeOpenAI,
			modelName:   "gpt-5-codex",
			want:        []constant.EndpointType{constant.EndpointTypeOpenAIResponse},
		},
		{
			name:        "new-api chat keeps multiprotocol list",
			channelType: constant.ChannelTypeNewAPI,
			modelName:   "gpt-5",
			want: []constant.EndpointType{
				constant.EndpointTypeOpenAI,
				constant.EndpointTypeOpenAIResponse,
				constant.EndpointTypeOpenAIResponseCompact,
				constant.EndpointTypeAnthropic,
				constant.EndpointTypeGemini,
				constant.EndpointTypeOpenAIAlphaSearch,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(
				t,
				test.want,
				GetEndpointTypesByChannelType(test.channelType, test.modelName),
			)
		})
	}
}
