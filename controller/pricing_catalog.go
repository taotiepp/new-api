package controller

import (
	"slices"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

func redactPricingForUserCatalog(items []model.Pricing, usableGroup map[string]string) []model.Pricing {
	if len(items) == 0 {
		return items
	}
	allowed := catalogGroupNames(usableGroup)
	out := make([]model.Pricing, len(items))
	for i, item := range items {
		item.EnableGroup = groupsVisibleInCatalog(item.EnableGroup, allowed)
		out[i] = item
	}
	return out
}

func catalogGroupNames(usableGroup map[string]string) []string {
	names := make([]string, 0, len(usableGroup))
	for name := range usableGroup {
		if name == "" || name == "auto" {
			continue
		}
		names = append(names, name)
	}
	slices.Sort(names)
	return names
}

func groupsVisibleInCatalog(enable, allowed []string) []string {
	if len(allowed) == 0 {
		return []string{}
	}
	if slices.Contains(enable, "all") {
		out := make([]string, len(allowed))
		copy(out, allowed)
		return out
	}
	visible := make([]string, 0, len(enable))
	for _, name := range allowed {
		if slices.Contains(enable, name) {
			visible = append(visible, name)
		}
	}
	return visible
}

func attachCatalogUserRateLimits(items []model.Pricing, userId int, group string) {
	if userId <= 0 || len(items) == 0 {
		return
	}
	resolver := service.NewUserModelLimitResolver(userId, group)
	for i := range items {
		limit := resolver.Resolve(items[i].ModelName)
		items[i].RPM = &limit.Requests
		items[i].TPM = &limit.Tokens
		items[i].RateLimitWindowSeconds = limit.WindowSeconds
	}
}

func catalogVendorsForItems(items []model.Pricing, vendors []model.PricingVendor) []model.PricingVendor {
	if len(items) == 0 || len(vendors) == 0 {
		return []model.PricingVendor{}
	}
	wanted := make(map[int]struct{})
	for _, item := range items {
		if item.VendorID != 0 {
			wanted[item.VendorID] = struct{}{}
		}
	}
	if len(wanted) == 0 {
		return []model.PricingVendor{}
	}
	out := make([]model.PricingVendor, 0, len(wanted))
	for _, vendor := range vendors {
		if _, ok := wanted[vendor.ID]; ok {
			out = append(out, vendor)
		}
	}
	return out
}
