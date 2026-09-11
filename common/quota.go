package common

import (
	"math"
	"strconv"
	"strings"

	"github.com/shopspring/decimal"
)

// Loaded at startup so request handling only reads the converted quota.
var trustQuota = QuotaFromFloat(10 * QuotaPerUnit)

func initTrustQuota() {
	trustQuota = QuotaFromFloat(10 * QuotaPerUnit)
	value := strings.TrimSpace(GetEnvOrDefaultString("TRUST_QUOTA_USD", "10"))
	dollars, err := strconv.ParseFloat(value, 64)
	if err != nil || dollars < 0 || math.IsNaN(dollars) || math.IsInf(dollars, 0) {
		SysError("TRUST_QUOTA_USD must be a finite non-negative dollar amount, using default: 10")
		return
	}
	quota, err := WalletQuotaFromDecimalStrict(decimal.NewFromFloat(dollars).Mul(decimal.NewFromFloat(QuotaPerUnit)))
	if err != nil || (dollars > 0 && quota == 0) {
		SysError("TRUST_QUOTA_USD is outside the supported quota range, using default: 10")
		return
	}
	trustQuota = quota
}

func GetTrustQuota() int {
	return trustQuota
}
