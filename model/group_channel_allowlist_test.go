package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGroupChannelAllowlistKeepsPriorityInsideTheSelectedChannels(t *testing.T) {
	truncateTables(t)
	high := int64(20)
	low := int64(5)
	light := uint(1)
	heavy := uint(100)
	channels := []Channel{
		{Id: 910001, Type: constant.ChannelTypeOpenAI, Key: "sk-high", Status: common.ChannelStatusEnabled, Name: "aws-high", Models: "allowlist-opus", Group: "aws", Priority: &high, Weight: &light},
		{Id: 910002, Type: constant.ChannelTypeOpenAI, Key: "sk-low", Status: common.ChannelStatusEnabled, Name: "aws-low", Models: "allowlist-opus", Group: "aws", Priority: &low, Weight: &heavy},
		{Id: 910003, Type: constant.ChannelTypeOpenAI, Key: "sk-other", Status: common.ChannelStatusEnabled, Name: "azure-only", Models: "allowlist-opus", Group: "azure", Priority: &high, Weight: &heavy},
	}
	for i := range channels {
		require.NoError(t, channels[i].Insert())
	}

	onlyLow := map[int]struct{}{910002: {}}
	selected, err := GetChannel("aws", "allowlist-opus", 0, nil, onlyLow)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 910002, selected.Id)

	selected, err = GetChannel("aws", "allowlist-opus", 0, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 910001, selected.Id)

	selected, err = GetChannel("aws", "allowlist-opus", 0, nil, map[int]struct{}{910003: {}})
	require.NoError(t, err)
	assert.Nil(t, selected)

	previous := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = previous })
	InitChannelCache()

	selected, err = GetRandomSatisfiedChannel("aws", "allowlist-opus", 0, nil, onlyLow)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 910002, selected.Id)

	selected, err = GetRandomSatisfiedChannel("aws", "allowlist-opus", 0, nil)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 910001, selected.Id)
}

func TestNormalizeGroupChannelAllowlistChecksGroupMembership(t *testing.T) {
	truncateTables(t)
	priority := int64(1)
	weight := uint(1)
	channel := Channel{Id: 910011, Type: constant.ChannelTypeOpenAI, Key: "sk-aws", Status: common.ChannelStatusEnabled, Name: "aws-a", Models: "opus", Group: "aws,azure", Priority: &priority, Weight: &weight}
	require.NoError(t, channel.Insert())

	normalized, err := NormalizeGroupChannelAllowlist(map[string][]int{
		" aws ": {910011, 910011},
		"empty": {},
	})
	require.NoError(t, err)
	assert.Equal(t, map[string][]int{"aws": {910011}}, normalized)

	_, err = NormalizeGroupChannelAllowlist(map[string][]int{"azure": {910099}})
	require.Error(t, err)
	_, err = NormalizeGroupChannelAllowlist(map[string][]int{"vip": {910011}})
	require.Error(t, err)
}
