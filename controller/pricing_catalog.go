package controller

import "github.com/QuantumNous/new-api/model"

func redactPricingForUserCatalog(items []model.Pricing) []model.Pricing {
	if len(items) == 0 {
		return items
	}
	out := make([]model.Pricing, len(items))
	for i, item := range items {
		item.EnableGroup = nil
		out[i] = item
	}
	return out
}

func catalogVendorsForItems(items []model.Pricing, vendors []model.PricingVendor) []model.PricingVendor {
	if len(items) == 0 || len(vendors) == 0 {
		return []model.PricingVendor{}
	}
	wanted := make(map[int]struct{})
	for _, item := range items {
		if item.VendorID > 0 {
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
