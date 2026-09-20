package service

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeDiscount(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name   string
		in     float64
		want   float64
		wantOK bool
	}{
		{name: "free", in: 0, want: 0, wantOK: true},
		{name: "eight_off", in: 0.8, want: 0.8, wantOK: true},
		{name: "list", in: 1, want: 1, wantOK: true},
		{name: "negative", in: -0.1, wantOK: false},
		{name: "nan", in: math.NaN(), wantOK: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, ok := NormalizeDiscount(tc.in)
			assert.Equal(t, tc.wantOK, ok)
			if tc.wantOK {
				assert.Equal(t, tc.want, got)
			}
		})
	}
	_, ok := NormalizeDiscount(math.Inf(1))
	assert.False(t, ok)
}

func TestResolveUserDiscountPriority(t *testing.T) {
	originalGroup := ratio_setting.GroupRatio2JSONString()
	originalSpecial := ratio_setting.GroupGroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroup))
		require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(originalSpecial))
	})
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"vip":0.7}`))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{"vip":{"vip":0.6}}`))

	userDefault := 0.5
	got := ResolveUserDiscount(UserDiscountInput{
		GroupModelDiscounts: map[string]map[string]float64{"vip": {"gpt-4o": 0.2}},
		GroupDiscounts:      map[string]float64{"vip": 0.5},
		ModelName:           "gpt-4o",
		UserGroup:           "vip",
		UsingGroup:          "vip",
	})
	assert.Equal(t, types.DiscountSourceUserGroupModel, got.Source)
	assert.Equal(t, 0.2, got.Ratio)

	got = ResolveUserDiscount(UserDiscountInput{
		GroupDiscounts: map[string]float64{"vip": 0.5},
		ModelName:      "gpt-4o",
		UserGroup:      "vip",
		UsingGroup:     "vip",
	})
	assert.Equal(t, types.DiscountSourceUserGroup, got.Source)
	assert.Equal(t, 0.5, got.Ratio)

	got = ResolveUserDiscount(UserDiscountInput{
		GroupDiscounts: map[string]float64{"vip": 0.5},
		ModelName:      "gpt-4o",
		UserGroup:      "vip",
		UsingGroup:     "pro",
	})
	assert.Equal(t, types.DiscountSourceGroupDefault, got.Source)
	assert.Equal(t, 1.0, got.Ratio)

	got = ResolveUserDiscount(UserDiscountInput{
		LegacyDiscount:       &userDefault,
		LegacyModelDiscounts: map[string]float64{"gpt-4o": 0.2},
		ModelName:            "gpt-4o",
		UserGroup:            "vip",
		UsingGroup:           "vip",
	})
	assert.Equal(t, types.DiscountSourceUserModel, got.Source)
	assert.Equal(t, 0.2, got.Ratio)

	got = ResolveUserDiscount(UserDiscountInput{
		LegacyDiscount: &userDefault,
		ModelName:      "gpt-4o",
		UserGroup:      "vip",
		UsingGroup:     "vip",
	})
	assert.Equal(t, types.DiscountSourceUserDefault, got.Source)
	assert.Equal(t, 0.5, got.Ratio)

	got = ResolveUserDiscount(UserDiscountInput{
		ModelName:  "gpt-4o",
		UserGroup:  "vip",
		UsingGroup: "vip",
	})
	assert.Equal(t, types.DiscountSourceGroupDefault, got.Source)
	assert.Equal(t, 0.6, got.Ratio)

	got = ResolveUserDiscount(UserDiscountInput{
		ModelName:  "gpt-4o",
		UserGroup:  "default",
		UsingGroup: "vip",
	})
	assert.Equal(t, types.DiscountSourceGroupDefault, got.Source)
	assert.Equal(t, 0.7, got.Ratio)
}

func TestResolveChannelDiscountFallback(t *testing.T) {
	t.Parallel()
	channelDefault := 0.8
	got := ResolveChannelDiscount(&channelDefault, map[string]float64{"claude-3": 0.4}, "claude-3")
	assert.Equal(t, types.DiscountSourceChannelModel, got.Source)
	assert.Equal(t, 0.4, got.Ratio)

	got = ResolveChannelDiscount(&channelDefault, map[string]float64{"claude-3": 0.4}, "gpt-4o")
	assert.Equal(t, types.DiscountSourceChannelDefault, got.Source)
	assert.Equal(t, 0.8, got.Ratio)

	got = ResolveChannelDiscount(nil, nil, "gpt-4o")
	assert.Equal(t, types.DiscountSourceChannelDefault, got.Source)
	assert.Equal(t, 1.0, got.Ratio)
}

func TestSplitLedgerQuotasIndependent(t *testing.T) {
	t.Parallel()
	ledger := common.SplitLedgerQuotas(1000, 0.5, 0.8)
	assert.Equal(t, 500, ledger.Sell)
	assert.Equal(t, 800, ledger.Cost)

	freeCustomer := common.SplitLedgerQuotas(1000, 0, 0.8)
	assert.Equal(t, 0, freeCustomer.Sell)
	assert.Equal(t, 800, freeCustomer.Cost)
}

func TestApplyLedgerKeepsDiscountsIndependent(t *testing.T) {
	t.Parallel()
	priceData := &types.PriceData{UserDiscount: 0.5, ChannelDiscount: 0.9}
	ledger := ApplyLedgerToPriceData(priceData, 1000)
	assert.Equal(t, 500, ledger.Sell)
	assert.Equal(t, 900, ledger.Cost)
	assert.Equal(t, 1000.0, priceData.CatalogQuota)
	assert.Equal(t, 900, priceData.CostQuota)

	priceData.ChannelDiscount = 0.4
	retried := ApplyLedgerToPriceData(priceData, 1000)
	assert.Equal(t, 500, retried.Sell)
	assert.Equal(t, 400, retried.Cost)
}

func TestParseModelDiscountsRejectsInvalid(t *testing.T) {
	t.Parallel()
	parsed := ParseModelDiscounts(`{"ok":0.5,"bad":-1,"nan":null}`)
	require.NotNil(t, parsed)
	assert.Equal(t, 0.5, parsed["ok"])
	_, hasBad := parsed["bad"]
	assert.False(t, hasBad)
}

func TestParseGroupModelDiscounts(t *testing.T) {
	t.Parallel()
	parsed := ParseGroupModelDiscounts(`{"vip":{"gpt-4o":0.2,"bad":-1}," ":{"x":1}}`)
	require.NotNil(t, parsed)
	require.Equal(t, 0.2, parsed["vip"]["gpt-4o"])
	_, hasBad := parsed["vip"]["bad"]
	assert.False(t, hasBad)
	_, hasBlank := parsed[" "]
	assert.False(t, hasBlank)
}
