package types

const (
	DiscountSourceUserGroupModel = "user_group_model"
	DiscountSourceUserGroup      = "user_group"
	DiscountSourceGroupDefault   = "group_default"
	DiscountSourceUserModel      = "user_model"
	DiscountSourceUserDefault    = "user_default"
	DiscountSourceGroupLegacy    = "group_legacy"
	DiscountSourceChannelModel   = "channel_model"
	DiscountSourceChannelDefault = "channel_default"
)

// DiscountResolution is the commercial multiplier applied to one ledger.
type DiscountResolution struct {
	Ratio  float64
	Source string
}
