package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestRedactPricingForUserCatalog(t *testing.T) {
	items := []model.Pricing{
		{
			ModelName:   "gpt-test",
			VendorID:    42,
			EnableGroup: []string{"default", "vip"},
			Description: "Catalog summary from model metadata.",
		},
	}
	redacted := redactPricingForUserCatalog(items)
	require.Len(t, redacted, 1)
	require.Equal(t, "gpt-test", redacted[0].ModelName)
	require.Equal(t, "Catalog summary from model metadata.", redacted[0].Description)
	require.Equal(t, 42, redacted[0].VendorID)
	require.Nil(t, redacted[0].EnableGroup)
}

func TestCatalogVendorsForItems(t *testing.T) {
	items := []model.Pricing{
		{ModelName: "gpt-test", VendorID: 2},
		{ModelName: "claude-test", VendorID: 1},
		{ModelName: "local-test"},
	}
	vendors := []model.PricingVendor{
		{ID: 1, Name: "Anthropic", Icon: "Claude"},
		{ID: 2, Name: "OpenAI", Icon: "OpenAI"},
		{ID: 3, Name: "Unused"},
	}
	got := catalogVendorsForItems(items, vendors)
	require.Equal(t, []model.PricingVendor{
		{ID: 1, Name: "Anthropic", Icon: "Claude"},
		{ID: 2, Name: "OpenAI", Icon: "OpenAI"},
	}, got)
	require.Empty(t, catalogVendorsForItems(nil, vendors))
}
