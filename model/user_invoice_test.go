package model

import (
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func TestCollectInvoiceDeltasReadsAllocationsFromALockedSession(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&QuotaData{}, &UserInvoiceAllocation{}))

	period := time.Now().Format("2006-01")
	start, _, ok := ParseBillPeriod(period)
	require.True(t, ok)
	row := &QuotaData{
		UserID:    7,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: start.Add(time.Hour).Unix(),
		Quota:     150,
		Count:     3,
		TokenUsed: 55,
	}
	require.NoError(t, db.Create(row).Error)
	require.NoError(t, db.Create(&UserInvoiceAllocation{
		UserId:      row.UserID,
		QuotaDataId: row.Id,
		Quota:       100,
		Count:       2,
		TokenUsed:   40,
	}).Error)

	var deltas []invoiceDelta
	err = db.Transaction(func(tx *gorm.DB) error {
		// Clauses() is the non-reusable session MySQL lockForUpdate returns.
		var queryErr error
		deltas, queryErr = collectInvoiceDeltas(tx.Clauses(), row.UserID, period)
		return queryErr
	})
	require.NoError(t, err)
	require.Len(t, deltas, 1)
	assert.Equal(t, 50, deltas[0].quota)
	assert.Equal(t, 1, deltas[0].count)
	assert.Equal(t, 15, deltas[0].tokenUsed)

	locked := db.Clauses(clause.Locking{Strength: "UPDATE"})
	queried := invoiceQuery(locked)
	_, hasLock := queried.Statement.Clauses["FOR"]
	assert.True(t, hasLock)
	allocationSQL := queried.ToSQL(func(tx *gorm.DB) *gorm.DB {
		return tx.Where("user_id = ? AND quota_data_id IN ?", row.UserID, []int{row.Id}).
			Find(&[]UserInvoiceAllocation{})
	})
	normalized := strings.ToUpper(allocationSQL)
	assert.Contains(t, normalized, "USER_INVOICE_ALLOCATIONS")
	assert.NotContains(t, normalized, "FROM `QUOTA_DATA`")
	assert.NotContains(t, normalized, "FROM QUOTA_DATA")
}
