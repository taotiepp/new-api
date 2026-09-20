package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetPricingDisplayType(t *testing.T) {
	original := generalSetting
	t.Cleanup(func() { generalSetting = original })

	t.Run("empty follows CNY quota", func(t *testing.T) {
		generalSetting.QuotaDisplayType = QuotaDisplayTypeCNY
		generalSetting.PricingDisplayType = ""
		assert.Equal(t, QuotaDisplayTypeCNY, GetPricingDisplayType())
	})

	t.Run("empty follows non-CNY quota as USD", func(t *testing.T) {
		generalSetting.QuotaDisplayType = QuotaDisplayTypeTokens
		generalSetting.PricingDisplayType = ""
		assert.Equal(t, QuotaDisplayTypeUSD, GetPricingDisplayType())
	})

	t.Run("explicit USD overrides CNY quota", func(t *testing.T) {
		generalSetting.QuotaDisplayType = QuotaDisplayTypeCNY
		generalSetting.PricingDisplayType = QuotaDisplayTypeUSD
		assert.Equal(t, QuotaDisplayTypeUSD, GetPricingDisplayType())
	})

	t.Run("explicit CNY overrides USD quota", func(t *testing.T) {
		generalSetting.QuotaDisplayType = QuotaDisplayTypeUSD
		generalSetting.PricingDisplayType = QuotaDisplayTypeCNY
		assert.Equal(t, QuotaDisplayTypeCNY, GetPricingDisplayType())
	})
}
