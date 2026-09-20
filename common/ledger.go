package common

import "github.com/shopspring/decimal"

// LedgerQuotas is the customer (sell) and channel (cost) pair derived from one
// catalog amount. The two discounts are never multiplied together.
type LedgerQuotas struct {
	Sell      int
	Cost      int
	SellClamp *QuotaClamp
	CostClamp *QuotaClamp
}

// SplitLedgerQuotas applies independent commercial discounts to a catalog
// amount already expressed in quota units.
func SplitLedgerQuotas(catalog float64, userDiscount, channelDiscount float64) LedgerQuotas {
	sell, sellClamp := QuotaRoundChecked(catalog * userDiscount)
	cost, costClamp := QuotaRoundChecked(catalog * channelDiscount)
	return LedgerQuotas{Sell: sell, Cost: cost, SellClamp: sellClamp, CostClamp: costClamp}
}

// SplitLedgerQuotasDecimal is the decimal equivalent of SplitLedgerQuotas.
func SplitLedgerQuotasDecimal(catalog decimal.Decimal, userDiscount, channelDiscount float64) LedgerQuotas {
	sell, sellClamp := QuotaFromDecimalChecked(catalog.Mul(decimal.NewFromFloat(userDiscount)))
	cost, costClamp := QuotaFromDecimalChecked(catalog.Mul(decimal.NewFromFloat(channelDiscount)))
	return LedgerQuotas{Sell: sell, Cost: cost, SellClamp: sellClamp, CostClamp: costClamp}
}
