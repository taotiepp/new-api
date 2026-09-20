package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInitDefaultVendorMappingFillsMissingVendorFromModelName(t *testing.T) {
	openai := &Vendor{Id: 2, Name: "OpenAI"}
	anthropic := &Vendor{Id: 1, Name: "Anthropic"}
	vendorMap := map[int]*Vendor{2: openai, 1: anthropic}

	prefix := &Model{
		ModelName:   "gpt",
		Description: "family description",
		Status:      1,
		NameRule:    NameRulePrefix,
	}
	edited := &Model{
		ModelName:   "claude-sonnet",
		Description: "edited description",
		Status:      1,
		NameRule:    NameRuleExact,
	}
	owned := &Model{
		ModelName: "gemini-flash",
		VendorID:  99,
		Status:    1,
		NameRule:  NameRuleExact,
	}
	metaMap := map[string]*Model{
		"gpt-4":         prefix,
		"claude-sonnet": edited,
		"gemini-flash":  owned,
	}

	initDefaultVendorMapping(metaMap, vendorMap, []AbilityWithChannel{
		{Ability: Ability{Model: "gpt-4"}},
		{Ability: Ability{Model: "claude-sonnet"}},
		{Ability: Ability{Model: "gemini-flash"}},
		{Ability: Ability{Model: "deepseek-chat"}},
	})

	require.Equal(t, 2, metaMap["gpt-4"].VendorID)
	assert.Equal(t, "family description", metaMap["gpt-4"].Description)
	assert.Zero(t, prefix.VendorID, "shared prefix metadata must not be mutated")

	require.Equal(t, 1, metaMap["claude-sonnet"].VendorID)
	assert.Equal(t, "edited description", metaMap["claude-sonnet"].Description)

	assert.Equal(t, 99, metaMap["gemini-flash"].VendorID)

	require.NotNil(t, metaMap["deepseek-chat"])
	assert.Equal(t, defaultVendorDisplayIDs["DeepSeek"], metaMap["deepseek-chat"].VendorID)
	assert.Equal(t, "DeepSeek", vendorMap[defaultVendorDisplayIDs["DeepSeek"]].Name)
}
