package model

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestListAccountMonthCostsSumsTheCalendarMonth(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &QuotaData{}))
	original := DB
	DB = db
	t.Cleanup(func() { DB = original })

	start, _, ok := ParseBillPeriod("2026-10")
	require.True(t, ok)
	inside := start.Unix() + 3600
	require.NoError(t, db.Create(&User{
		Id: 1, Username: "alice", DisplayName: "Alice", Password: "secret", AffCode: "aaaa",
	}).Error)
	require.NoError(t, db.Create(&User{
		Id: 2, Username: "bob", DisplayName: "Bob", Password: "secret", AffCode: "bbbb",
	}).Error)
	require.NoError(t, db.Create(&User{
		Id: 3, Username: "carol", DisplayName: "Carol", Password: "secret", AffCode: "cccc",
	}).Error)
	require.NoError(t, db.Create(&User{
		Id: 4, Username: "gone", DisplayName: "Gone", Password: "secret", AffCode: "dddd",
		DeletedAt: gorm.DeletedAt{Time: time.Now(), Valid: true},
	}).Error)
	require.NoError(t, db.Create(&QuotaData{UserID: 1, Username: "alice", ModelName: "gpt", CreatedAt: inside, Quota: 70, Count: 2, TokenUsed: 10}).Error)
	require.NoError(t, db.Create(&QuotaData{UserID: 1, Username: "alice", ModelName: "claude", CreatedAt: inside + 3600, Quota: 30, Count: 1, TokenUsed: 4}).Error)
	require.NoError(t, db.Create(&QuotaData{UserID: 1, Username: "alice", ModelName: "gpt", CreatedAt: start.Unix() - 3600, Quota: 999, Count: 9, TokenUsed: 9}).Error)
	require.NoError(t, db.Create(&QuotaData{UserID: 2, Username: "bob", ModelName: "gpt", CreatedAt: inside, Quota: 40, Count: 1, TokenUsed: 2}).Error)
	require.NoError(t, db.Create(&QuotaData{UserID: 4, Username: "gone", ModelName: "gpt", CreatedAt: inside, Quota: 500, Count: 1, TokenUsed: 1}).Error)

	rows, total, err := ListAccountMonthCosts("2026-10", "", 0, 20)
	require.NoError(t, err)
	require.Equal(t, int64(3), total)
	require.Len(t, rows, 3)
	assert.Equal(t, 1, rows[0].UserId)
	assert.Equal(t, "alice", rows[0].Username)
	assert.Equal(t, "Alice", rows[0].DisplayName)
	assert.Equal(t, 100, rows[0].Quota)
	assert.Equal(t, 3, rows[0].Count)
	assert.Equal(t, 14, rows[0].TokenUsed)
	assert.Equal(t, 2, rows[1].UserId)
	assert.Equal(t, 40, rows[1].Quota)
	assert.Equal(t, 3, rows[2].UserId)
	assert.Equal(t, 0, rows[2].Quota)

	filtered, filteredTotal, err := ListAccountMonthCosts("2026-10", "ali", 0, 20)
	require.NoError(t, err)
	require.Equal(t, int64(1), filteredTotal)
	require.Len(t, filtered, 1)
	assert.Equal(t, "alice", filtered[0].Username)

	_, _, err = ListAccountMonthCosts("2026-13", "", 0, 20)
	require.Error(t, err)
}
