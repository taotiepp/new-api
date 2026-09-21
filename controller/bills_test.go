package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type userBillResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message"`
	Data    model.UserBillOverview `json:"data"`
}

func setupUserBillControllerTestDB(t *testing.T) {
	t.Helper()
	setupFlowControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.UserBillItem{}))
	require.NoError(t, model.DB.AutoMigrate(&model.UserBillItem{}))
}

func requestUserBills(t *testing.T, userId int, query string) userBillResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", userId)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/bills/self?"+query, nil)
	GetUserBills(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	var payload userBillResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	return payload
}

func TestGetUserBillsReadsCurrentMonthFromQuotaWithoutPersisting(t *testing.T) {
	setupUserBillControllerTestDB(t)

	now := time.Now()
	current := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	period := current.Format("2006-01")
	createdAt := current.Add(2 * time.Hour).Unix()
	require.NoError(t, model.DB.Create(&model.QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: createdAt,
		Count:     3,
		Quota:     90,
		TokenUsed: 30,
	}).Error)
	require.NoError(t, model.DB.Create(&model.QuotaData{
		UserID:    2,
		Username:  "bob",
		ModelName: "gpt-b",
		CreatedAt: createdAt,
		Count:     8,
		Quota:     400,
		TokenUsed: 80,
	}).Error)

	payload := requestUserBills(t, 1, "period="+period+"&months=6")
	require.True(t, payload.Success, payload.Message)
	require.Equal(t, period, payload.Data.Period)
	require.Equal(t, 90, payload.Data.Quota)
	require.Equal(t, 3, payload.Data.Count)
	require.Equal(t, 30, payload.Data.TokenUsed)
	require.Len(t, payload.Data.Items, 1)
	require.Equal(t, "gpt-a", payload.Data.Items[0].ModelName)
	require.Len(t, payload.Data.Trend, 6)
	require.Equal(t, period, payload.Data.Trend[5].Period)
	require.Equal(t, 90, payload.Data.Trend[5].Quota)

	var persisted int64
	require.NoError(t, model.DB.Model(&model.UserBillItem{}).
		Where("user_id = ? AND period = ?", 1, period).
		Count(&persisted).Error)
	require.Zero(t, persisted)
}

func TestGetUserBillsReadsClosedMonthFromPersistedBills(t *testing.T) {
	setupUserBillControllerTestDB(t)

	now := time.Now()
	closed := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local).AddDate(0, -1, 0)
	period := closed.Format("2006-01")
	require.NoError(t, model.DB.Create(&model.UserBillItem{
		UserId:    1,
		Period:    period,
		ModelName: "gpt-a",
		Quota:     120,
		Count:     4,
		TokenUsed: 40,
		UpdatedAt: closed.Unix(),
	}).Error)
	require.NoError(t, model.DB.Create(&model.QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: closed.Add(3 * time.Hour).Unix(),
		Count:     9,
		Quota:     999,
		TokenUsed: 200,
	}).Error)

	payload := requestUserBills(t, 1, "period="+period+"&months=6")
	require.True(t, payload.Success, payload.Message)
	require.Equal(t, period, payload.Data.Period)
	require.Equal(t, 120, payload.Data.Quota)
	require.Equal(t, 4, payload.Data.Count)
	require.Equal(t, 40, payload.Data.TokenUsed)
	require.Len(t, payload.Data.Items, 1)
	require.Equal(t, "gpt-a", payload.Data.Items[0].ModelName)
	require.Equal(t, period, payload.Data.Trend[4].Period)
	require.Equal(t, 120, payload.Data.Trend[4].Quota)
}

func TestGenerateClosedUserBillsWritesLastClosedMonthFromQuota(t *testing.T) {
	setupUserBillControllerTestDB(t)

	now := time.Now()
	current := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	closed := current.AddDate(0, -1, 0)
	older := current.AddDate(0, -2, 0)
	require.NoError(t, model.DB.Create(&model.QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: closed.Add(4 * time.Hour).Unix(),
		Count:     5,
		Quota:     150,
		TokenUsed: 60,
	}).Error)
	require.NoError(t, model.DB.Create(&model.QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-b",
		CreatedAt: current.Add(time.Hour).Unix(),
		Count:     2,
		Quota:     70,
		TokenUsed: 20,
	}).Error)
	require.NoError(t, model.DB.Create(&model.UserBillItem{
		UserId:    1,
		Period:    older.Format("2006-01"),
		ModelName: "gpt-old",
		Quota:     10,
		Count:     1,
		TokenUsed: 2,
		UpdatedAt: older.Unix(),
	}).Error)
	require.NoError(t, model.DB.Create(&model.QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-old",
		CreatedAt: older.Add(time.Hour).Unix(),
		Count:     7,
		Quota:     888,
		TokenUsed: 99,
	}).Error)

	require.NoError(t, model.GenerateClosedUserBills(now))

	items, err := model.GetUserBillItems(1, closed.Format("2006-01"))
	require.NoError(t, err)
	require.Len(t, items, 1)
	require.Equal(t, "gpt-a", items[0].ModelName)
	require.Equal(t, 150, items[0].Quota)
	require.Equal(t, 5, items[0].Count)
	require.Equal(t, 60, items[0].TokenUsed)

	olderItems, err := model.GetUserBillItems(1, older.Format("2006-01"))
	require.NoError(t, err)
	require.Len(t, olderItems, 1)
	require.Equal(t, 10, olderItems[0].Quota)
	require.Equal(t, 2, olderItems[0].TokenUsed)

	var currentRows int64
	require.NoError(t, model.DB.Model(&model.UserBillItem{}).
		Where("user_id = ? AND period = ?", 1, current.Format("2006-01")).
		Count(&currentRows).Error)
	require.Zero(t, currentRows)
}

func TestGetUserBillsRejectsInvalidPeriod(t *testing.T) {
	setupUserBillControllerTestDB(t)

	payload := requestUserBills(t, 1, "period=2026-13")
	require.False(t, payload.Success)
	require.Equal(t, "invalid period", payload.Message)
}
