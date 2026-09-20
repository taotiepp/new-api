package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
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

func TestCatalogVendorsForItemsIncludesDisplayVendors(t *testing.T) {
	items := []model.Pricing{
		{ModelName: "gpt-4", VendorID: -1012},
		{ModelName: "local-test"},
	}
	vendors := []model.PricingVendor{
		{ID: -1012, Name: "OpenAI", Icon: "OpenAI"},
		{ID: 3, Name: "Unused"},
	}
	require.Equal(t, []model.PricingVendor{
		{ID: -1012, Name: "OpenAI", Icon: "OpenAI"},
	}, catalogVendorsForItems(items, vendors))
}

func TestCatalogEffectiveRateLimits(t *testing.T) {
	oldDB, oldRedis := model.DB, common.RedisEnabled
	oldConfig := setting.UserModelRateLimitConfig2JSONString()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.UserModelRateLimit{}))
	model.DB, common.RedisEnabled = db, false
	const uid = 986532
	model.InvalidateUserModelRateLimitCache(uid)
	t.Cleanup(func() {
		model.InvalidateUserModelRateLimitCache(uid)
		model.DB, common.RedisEnabled = oldDB, oldRedis
		require.NoError(t, setting.UpdateUserModelRateLimitConfigByJSONString(oldConfig))
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, (&model.UserModelRateLimit{UserId: uid, ModelName: "m", RPM: 100, Enabled: true}).Insert())
	for _, tc := range []struct {
		name, config     string
		rpm, tpm, window int
	}{
		{"disabled", `{"enabled":false,"duration_minutes":5,"default":{"tpm":9000}}`, 0, 0, 60},
		{"five minute override", `{"enabled":true,"duration_minutes":5,"default":{"rpm":20,"tpm":9000}}`, 100, 9000, 300},
		{"one minute", `{"enabled":true,"duration_minutes":1,"default":{"tpm":-1}}`, 100, -1, 60},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, setting.UpdateUserModelRateLimitConfigByJSONString(tc.config))
			items := []model.Pricing{{ModelName: "m"}}
			attachCatalogUserRateLimits(items, uid, "default")
			require.NotNil(t, items[0].RPM)
			require.NotNil(t, items[0].TPM)
			require.Equal(t, tc.rpm, *items[0].RPM)
			require.Equal(t, tc.tpm, *items[0].TPM)
			require.Equal(t, tc.window, items[0].RateLimitWindowSeconds)
		})
	}
}
