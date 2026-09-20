package service

import (
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// NormalizeDiscount accepts a commercial multiplier. 0 is free; negatives,
// NaN, and infinities are rejected so they cannot become credits.
func NormalizeDiscount(ratio float64) (float64, bool) {
	if math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio < 0 {
		return 0, false
	}
	return ratio, true
}

func ParseModelDiscounts(raw string) map[string]float64 {
	return parseNamedDiscounts(raw, "model discounts")
}

func ParseGroupDiscounts(raw string) map[string]float64 {
	return parseNamedDiscounts(raw, "group discounts")
}

func parseNamedDiscounts(raw, label string) map[string]float64 {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "{}" {
		return nil
	}
	parsed := make(map[string]float64)
	if err := common.Unmarshal([]byte(raw), &parsed); err != nil {
		common.SysLog("failed to parse " + label + ": " + err.Error())
		return nil
	}
	out := make(map[string]float64, len(parsed))
	for name, ratio := range parsed {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if normalized, ok := NormalizeDiscount(ratio); ok {
			out[name] = normalized
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func ParseGroupModelDiscounts(raw string) map[string]map[string]float64 {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "{}" {
		return nil
	}
	parsed := make(map[string]map[string]float64)
	if err := common.Unmarshal([]byte(raw), &parsed); err != nil {
		common.SysLog("failed to parse group model discounts: " + err.Error())
		return nil
	}
	out := make(map[string]map[string]float64, len(parsed))
	for group, models := range parsed {
		group = strings.TrimSpace(group)
		if group == "" {
			continue
		}
		normalized := make(map[string]float64, len(models))
		for name, ratio := range models {
			name = strings.TrimSpace(name)
			if name == "" {
				continue
			}
			if value, ok := NormalizeDiscount(ratio); ok {
				normalized[name] = value
			}
		}
		if len(normalized) > 0 {
			out[group] = normalized
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func modelDiscountFromMap(modelDiscounts map[string]float64, modelName string) (float64, bool) {
	if modelName == "" || len(modelDiscounts) == 0 {
		return 0, false
	}
	ratio, ok := modelDiscounts[modelName]
	if !ok {
		return 0, false
	}
	return NormalizeDiscount(ratio)
}

type UserDiscountInput struct {
	GroupDiscounts       map[string]float64
	GroupModelDiscounts  map[string]map[string]float64
	LegacyDiscount       *float64
	LegacyModelDiscounts map[string]float64
	ModelName            string
	UserGroup            string
	UsingGroup           string
}

// ResolveUserDiscount applies the sell multiplier for the resource group
// actually used: group-model override, then the user's group discount, then
// the resource group's default. Legacy flat user fields stay as fallback.
func ResolveUserDiscount(in UserDiscountInput) types.DiscountResolution {
	usingGroup := in.UsingGroup
	if usingGroup == "" {
		usingGroup = in.UserGroup
	}
	if models := in.GroupModelDiscounts[usingGroup]; len(models) > 0 {
		if ratio, ok := modelDiscountFromMap(models, in.ModelName); ok {
			return types.DiscountResolution{Ratio: ratio, Source: types.DiscountSourceUserGroupModel}
		}
	}
	if ratio, ok := in.GroupDiscounts[usingGroup]; ok {
		if normalized, valid := NormalizeDiscount(ratio); valid {
			return types.DiscountResolution{Ratio: normalized, Source: types.DiscountSourceUserGroup}
		}
	}
	if ratio, ok := modelDiscountFromMap(in.LegacyModelDiscounts, in.ModelName); ok {
		return types.DiscountResolution{Ratio: ratio, Source: types.DiscountSourceUserModel}
	}
	if in.LegacyDiscount != nil {
		if ratio, ok := NormalizeDiscount(*in.LegacyDiscount); ok {
			return types.DiscountResolution{Ratio: ratio, Source: types.DiscountSourceUserDefault}
		}
	}
	if userGroupRatio, ok := ratio_setting.GetGroupGroupRatio(in.UserGroup, usingGroup); ok {
		if ratio, ok := NormalizeDiscount(userGroupRatio); ok {
			return types.DiscountResolution{Ratio: ratio, Source: types.DiscountSourceGroupDefault}
		}
	}
	groupRatio := ratio_setting.GetGroupRatio(usingGroup)
	if ratio, ok := NormalizeDiscount(groupRatio); ok {
		return types.DiscountResolution{Ratio: ratio, Source: types.DiscountSourceGroupDefault}
	}
	return types.DiscountResolution{Ratio: 1, Source: types.DiscountSourceGroupDefault}
}

// ResolveChannelDiscount prefers a per-model channel override, then the
// channel default. Unset channel discounts are treated as 1 (list cost).
func ResolveChannelDiscount(discount *float64, modelDiscounts map[string]float64, modelName string) types.DiscountResolution {
	if ratio, ok := modelDiscountFromMap(modelDiscounts, modelName); ok {
		return types.DiscountResolution{Ratio: ratio, Source: types.DiscountSourceChannelModel}
	}
	if discount != nil {
		if ratio, ok := NormalizeDiscount(*discount); ok {
			return types.DiscountResolution{Ratio: ratio, Source: types.DiscountSourceChannelDefault}
		}
	}
	return types.DiscountResolution{Ratio: 1, Source: types.DiscountSourceChannelDefault}
}

func userDiscountFromContext(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) types.DiscountResolution {
	in := UserDiscountInput{}
	if relayInfo != nil {
		in.LegacyDiscount = relayInfo.UserDiscount
		in.LegacyModelDiscounts = ParseModelDiscounts(relayInfo.UserModelDiscounts)
		in.GroupDiscounts = ParseGroupDiscounts(relayInfo.UserGroupDiscounts)
		in.GroupModelDiscounts = ParseGroupModelDiscounts(relayInfo.UserGroupModelDiscounts)
		in.UserGroup = relayInfo.UserGroup
		in.UsingGroup = relayInfo.UsingGroup
		in.ModelName = relayInfo.GetBillingModelName()
	}
	if ctx != nil {
		if in.LegacyDiscount == nil {
			if stored, ok := common.GetContextKeyType[*float64](ctx, constant.ContextKeyUserDiscount); ok {
				in.LegacyDiscount = stored
			}
		}
		if len(in.LegacyModelDiscounts) == 0 {
			in.LegacyModelDiscounts = ParseModelDiscounts(common.GetContextKeyString(ctx, constant.ContextKeyUserModelDiscounts))
		}
		if len(in.GroupDiscounts) == 0 {
			in.GroupDiscounts = ParseGroupDiscounts(common.GetContextKeyString(ctx, constant.ContextKeyUserGroupDiscounts))
		}
		if len(in.GroupModelDiscounts) == 0 {
			in.GroupModelDiscounts = ParseGroupModelDiscounts(common.GetContextKeyString(ctx, constant.ContextKeyUserGroupModelDiscounts))
		}
		if in.UserGroup == "" {
			in.UserGroup = common.GetContextKeyString(ctx, constant.ContextKeyUserGroup)
		}
		if in.UsingGroup == "" {
			in.UsingGroup = common.GetContextKeyString(ctx, constant.ContextKeyUsingGroup)
		}
	}
	return ResolveUserDiscount(in)
}

func ApplyUserDiscount(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, priceData *types.PriceData) types.DiscountResolution {
	resolved := userDiscountFromContext(ctx, relayInfo)
	if priceData != nil {
		priceData.UserDiscount = resolved.Ratio
		priceData.UserDiscountSource = resolved.Source
		priceData.GroupRatioInfo.GroupRatio = resolved.Ratio
		priceData.GroupRatioInfo.UserDiscountSource = resolved.Source
		priceData.GroupRatioInfo.GroupSpecialRatio = -1
		if resolved.Source == types.DiscountSourceGroupDefault || resolved.Source == types.DiscountSourceGroupLegacy {
			userGroup := ""
			usingGroup := ""
			if relayInfo != nil {
				userGroup = relayInfo.UserGroup
				usingGroup = relayInfo.UsingGroup
			}
			if special, ok := ratio_setting.GetGroupGroupRatio(userGroup, usingGroup); ok {
				priceData.GroupRatioInfo.HasSpecialRatio = true
				priceData.GroupRatioInfo.GroupSpecialRatio = special
			}
		}
	}
	return resolved
}

// RefreshChannelDiscount resolves cost discount from the channel actually used
// for this attempt so retries follow the final channel.
func RefreshChannelDiscount(relayInfo *relaycommon.RelayInfo) types.DiscountResolution {
	if relayInfo == nil {
		return types.DiscountResolution{Ratio: 1, Source: types.DiscountSourceChannelDefault}
	}
	resolved := types.DiscountResolution{Ratio: 1, Source: types.DiscountSourceChannelDefault}
	if channelId := relayInfo.GetChannelID(); channelId > 0 {
		channel, err := model.CacheGetChannel(channelId)
		if err == nil && channel != nil {
			resolved = ResolveChannelDiscount(channel.Discount, ParseModelDiscounts(channel.ModelDiscounts), relayInfo.GetBillingModelName())
		}
	}
	relayInfo.PriceData.ChannelDiscount = resolved.Ratio
	relayInfo.PriceData.ChannelDiscountSource = resolved.Source
	return resolved
}

func ApplyLedgerToPriceData(priceData *types.PriceData, catalog float64) common.LedgerQuotas {
	if priceData == nil {
		return common.SplitLedgerQuotas(catalog, 1, 1)
	}
	ledger := common.SplitLedgerQuotas(catalog, priceData.UserDiscount, priceData.ChannelDiscount)
	priceData.CatalogQuota = catalog
	priceData.CostQuota = ledger.Cost
	return ledger
}
