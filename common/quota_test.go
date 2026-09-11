package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTrustQuotaEnvironment(t *testing.T) {
	oldQuota, oldUnit := trustQuota, QuotaPerUnit
	QuotaPerUnit = 500000
	t.Cleanup(func() {
		trustQuota, QuotaPerUnit = oldQuota, oldUnit
	})
	for _, tc := range []struct {
		value string
		want  int
	}{
		{"", 5000000},
		{"10", 5000000},
		{"25", 12500000},
		{" 2.5 ", 1250000},
		{"10000", 5000000000},
		{"0", 0},
		{"-1", 5000000},
		{"invalid", 5000000},
		{"NaN", 5000000},
		{"Inf", 5000000},
		{"1e100", 5000000},
		{"1e-20", 5000000},
	} {
		t.Run(tc.value, func(t *testing.T) {
			t.Setenv("TRUST_QUOTA_USD", tc.value)
			initTrustQuota()
			assert.Equal(t, tc.want, GetTrustQuota())
			// Changes take effect at startup, not on the request hot path.
			t.Setenv("TRUST_QUOTA_USD", "99")
			assert.Equal(t, tc.want, GetTrustQuota())
		})
	}
}
