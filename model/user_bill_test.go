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

func TestListMonthCostControlGroupsUserAndChannelViews(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))
	originalDB, originalLog := DB, LOG_DB
	originalGroup := logGroupCol
	DB, LOG_DB = db, db
	logGroupCol = "`group`"
	t.Cleanup(func() {
		DB, LOG_DB = originalDB, originalLog
		logGroupCol = originalGroup
	})

	start, _, ok := ParseBillPeriod("2026-11")
	require.True(t, ok)
	inside := start.Unix() + 3600
	outside := start.Unix() - 3600
	require.NoError(t, db.Create([]*Log{
		{UserId: 5, Username: "alice", CreatedAt: inside, Type: LogTypeConsume, Group: "aws", ChannelId: 7, TokenId: 1, TokenName: "a", ModelName: "opus", Quota: 100, CostQuota: 80},
		{UserId: 5, Username: "alice", CreatedAt: inside + 10, Type: LogTypeConsume, Group: "aws", ChannelId: 7, TokenId: 1, TokenName: "a", ModelName: "opus", Quota: 50, CostQuota: 40},
		{UserId: 5, Username: "alice", CreatedAt: inside, Type: LogTypeConsume, Group: "azure", ChannelId: 8, TokenId: 2, TokenName: "b", ModelName: "sonnet", Quota: 10, CostQuota: 30},
		{UserId: 5, Username: "alice", CreatedAt: outside, Type: LogTypeConsume, Group: "aws", ChannelId: 7, TokenId: 1, TokenName: "a", ModelName: "opus", Quota: 999, CostQuota: 999},
		{UserId: 5, Username: "alice", CreatedAt: inside, Type: LogTypeError, Group: "aws", ChannelId: 7, TokenId: 1, TokenName: "a", ModelName: "opus", Quota: 70, CostQuota: 70},
		{UserId: 6, Username: "bob", CreatedAt: inside, Type: LogTypeConsume, Group: "aws", ChannelId: 7, TokenId: 3, TokenName: "c", ModelName: "opus", Quota: 7, CostQuota: 9},
	}).Error)

	userRows, truncated, err := ListMonthCostControl(MonthCostControlQuery{
		Period:     "2026-11",
		View:       "user",
		UserID:     5,
		Dimensions: []string{"group", "channel", "token", "model"},
	})
	require.NoError(t, err)
	assert.False(t, truncated)
	require.Len(t, userRows, 2)
	assert.Equal(t, "aws", userRows[0].GroupName)
	assert.Equal(t, 7, userRows[0].ChannelId)
	assert.Equal(t, 1, userRows[0].TokenId)
	assert.Equal(t, "a", userRows[0].TokenName)
	assert.Equal(t, "opus", userRows[0].ModelName)
	assert.Equal(t, 150, userRows[0].Quota)
	assert.Equal(t, 120, userRows[0].CostQuota)
	assert.Equal(t, 2, userRows[0].Count)
	assert.Equal(t, "azure", userRows[1].GroupName)
	assert.Equal(t, 10, userRows[1].Quota)
	assert.Equal(t, 30, userRows[1].CostQuota)

	channelID := 7
	channelRows, _, err := ListMonthCostControl(MonthCostControlQuery{
		Period:     "2026-11",
		View:       "channel",
		ChannelID:  &channelID,
		Dimensions: []string{"user", "model"},
	})
	require.NoError(t, err)
	require.Len(t, channelRows, 2)
	assert.Equal(t, 5, channelRows[0].UserId)
	assert.Equal(t, "alice", channelRows[0].Username)
	assert.Equal(t, "opus", channelRows[0].ModelName)
	assert.Equal(t, 150, channelRows[0].Quota)
	assert.Equal(t, 120, channelRows[0].CostQuota)
	assert.Equal(t, 6, channelRows[1].UserId)
	assert.Equal(t, 7, channelRows[1].Quota)
	assert.Equal(t, 9, channelRows[1].CostQuota)

	totals, _, err := ListMonthCostControl(MonthCostControlQuery{
		Period: "2026-11",
		View:   "user",
		UserID: 5,
	})
	require.NoError(t, err)
	require.Len(t, totals, 1)
	assert.Equal(t, 160, totals[0].Quota)
	assert.Equal(t, 150, totals[0].CostQuota)
	assert.Equal(t, 3, totals[0].Count)

	_, _, err = ListMonthCostControl(MonthCostControlQuery{
		Period:     "2026-11",
		View:       "channel",
		ChannelID:  &channelID,
		Dimensions: []string{"group"},
	})
	require.ErrorIs(t, err, ErrInvalidMonthCostControl)

	byGroup, _, err := ListMonthCostControl(MonthCostControlQuery{
		Period:     "2026-11",
		View:       "user",
		UserID:     5,
		Dimensions: []string{"group"},
	})
	require.NoError(t, err)
	require.Len(t, byGroup, 2)
	assert.Equal(t, "aws", byGroup[0].GroupName)
	assert.Equal(t, 120, byGroup[0].CostQuota)
	assert.Equal(t, "azure", byGroup[1].GroupName)
	assert.Equal(t, 30, byGroup[1].CostQuota)
}
