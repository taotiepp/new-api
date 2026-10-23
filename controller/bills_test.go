package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	settingconfig "github.com/QuantumNous/new-api/setting/config"
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
	require.NoError(t, model.DB.AutoMigrate(&model.UserInvoice{}, &model.UserInvoiceItem{}, &model.UserInvoiceAllocation{}))
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

func requestScopedUserBills(t *testing.T, userId int, role int, query string) userBillResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", userId)
	ctx.Set("role", role)
	ctx.Set("username", "alice")
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/bills/self?"+query, nil)
	GetUserBills(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	var payload userBillResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	return payload
}

func TestGetUserBillsAdminReadsAnotherUser(t *testing.T) {
	setupUserBillControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{Id: 1, Username: "alice", Role: common.RoleAdminUser, AffCode: "alice-bill"}).Error)
	require.NoError(t, model.DB.Create(&model.User{Id: 2, Username: "bob", Role: common.RoleCommonUser, AffCode: "bob-bill"}).Error)

	now := time.Now()
	current := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	period := current.Format("2006-01")
	createdAt := current.Add(2 * time.Hour).Unix()
	require.NoError(t, model.DB.Create(&model.QuotaData{
		UserID: 1, Username: "alice", ModelName: "gpt-a", CreatedAt: createdAt, Count: 1, Quota: 10, TokenUsed: 1,
	}).Error)
	require.NoError(t, model.DB.Create(&model.QuotaData{
		UserID: 2, Username: "bob", ModelName: "gpt-b", CreatedAt: createdAt, Count: 4, Quota: 80, TokenUsed: 8,
	}).Error)

	payload := requestScopedUserBills(t, 1, common.RoleAdminUser, "period="+period+"&months=6&user_id=2")
	require.True(t, payload.Success, payload.Message)
	require.Equal(t, 80, payload.Data.Quota)
	require.Equal(t, 4, payload.Data.Count)
	require.Len(t, payload.Data.Items, 1)
	require.Equal(t, "gpt-b", payload.Data.Items[0].ModelName)
}

func TestGetUserBillsRejectsCrossUserAndInvalidTarget(t *testing.T) {
	setupUserBillControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{Id: 1, Username: "alice", Role: common.RoleCommonUser, AffCode: "alice-deny"}).Error)

	denied := requestScopedUserBills(t, 1, common.RoleCommonUser, "user_id=2")
	require.False(t, denied.Success)
	require.Equal(t, "access denied", denied.Message)

	invalid := requestScopedUserBills(t, 1, common.RoleAdminUser, "user_id=0")
	require.False(t, invalid.Success)
	require.Equal(t, "invalid user id", invalid.Message)

	missing := requestScopedUserBills(t, 1, common.RoleAdminUser, "user_id=99")
	require.False(t, missing.Success)
	require.Equal(t, "user not found", missing.Message)
}

type scopedLogListResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Items []struct {
			UserId    int    `json:"user_id"`
			ModelName string `json:"model_name"`
		} `json:"items"`
		Total int `json:"total"`
	} `json:"data"`
}

type scopedLogStatResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Quota int `json:"quota"`
	} `json:"data"`
}

func TestGetUserLogsAdminReadsAnotherUser(t *testing.T) {
	setupUserBillControllerTestDB(t)
	require.NoError(t, model.LOG_DB.AutoMigrate(&model.Log{}))
	require.NoError(t, model.DB.Create(&model.User{Id: 1, Username: "alice", Role: common.RoleAdminUser, AffCode: "alice-log"}).Error)
	require.NoError(t, model.DB.Create(&model.User{Id: 2, Username: "bob", Role: common.RoleCommonUser, AffCode: "bob-log"}).Error)
	createdAt := time.Now().Unix()
	require.NoError(t, model.LOG_DB.Create(&model.Log{
		UserId: 1, Username: "alice", ModelName: "gpt-a", Type: model.LogTypeConsume, Quota: 10, CreatedAt: createdAt,
	}).Error)
	require.NoError(t, model.LOG_DB.Create(&model.Log{
		UserId: 2, Username: "bob", ModelName: "gpt-b", Type: model.LogTypeConsume, Quota: 40, CreatedAt: createdAt,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)
	ctx.Set("username", "alice")
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/log/self?user_id=2", nil)
	GetUserLogs(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	var listed scopedLogListResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &listed))
	require.True(t, listed.Success, listed.Message)
	require.Equal(t, 1, listed.Data.Total)
	require.Len(t, listed.Data.Items, 1)
	require.Equal(t, 2, listed.Data.Items[0].UserId)
	require.Equal(t, "gpt-b", listed.Data.Items[0].ModelName)

	statRecorder := httptest.NewRecorder()
	statCtx, _ := gin.CreateTestContext(statRecorder)
	statCtx.Set("id", 1)
	statCtx.Set("role", common.RoleAdminUser)
	statCtx.Set("username", "alice")
	statCtx.Request = httptest.NewRequest(http.MethodGet, "/api/log/self/stat?user_id=2", nil)
	GetLogsSelfStat(statCtx)
	require.Equal(t, http.StatusOK, statRecorder.Code)
	var stat scopedLogStatResponse
	require.NoError(t, common.Unmarshal(statRecorder.Body.Bytes(), &stat))
	require.True(t, stat.Success, stat.Message)
	require.Equal(t, 40, stat.Data.Quota)

	deniedRecorder := httptest.NewRecorder()
	deniedCtx, _ := gin.CreateTestContext(deniedRecorder)
	deniedCtx.Set("id", 1)
	deniedCtx.Set("role", common.RoleCommonUser)
	deniedCtx.Set("username", "alice")
	deniedCtx.Request = httptest.NewRequest(http.MethodGet, "/api/log/self?user_id=2", nil)
	GetUserLogs(deniedCtx)
	require.Equal(t, http.StatusOK, deniedRecorder.Code)
	var denied scopedLogListResponse
	require.NoError(t, common.Unmarshal(deniedRecorder.Body.Bytes(), &denied))
	require.False(t, denied.Success)
	require.Equal(t, "access denied", denied.Message)
}

type userInvoiceResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Data    model.UserInvoice `json:"data"`
}

type userInvoiceHistoryResponse struct {
	Success bool                     `json:"success"`
	Message string                   `json:"message"`
	Data    model.UserInvoiceHistory `json:"data"`
}

func requestIssueInvoice(t *testing.T, userId int, role int, query string) userInvoiceResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", userId)
	ctx.Set("role", role)
	ctx.Set("username", "alice")
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/bills/invoices?"+query, nil)
	IssueUserInvoice(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	var payload userInvoiceResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	return payload
}

func seedInvoiceUser(t *testing.T) {
	t.Helper()
	raw, err := common.Marshal(dto.UserSetting{
		InvoiceProfile: dto.InvoiceParty{
			Name:       "Ada Zhang",
			Line1:      "zhongguandonglu",
			Line2:      "haidian",
			City:       "Beijing",
			PostalCode: "100010",
			Country:    "China",
			Email:      "ada@example.com",
		},
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.User{
		Id:       1,
		Username: "alice",
		Password: "unused-password",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		AffCode:  "alice-bill",
		Setting:  string(raw),
	}).Error)
}

func useInvoiceIssuer(t *testing.T) {
	t.Helper()
	cfg := settingconfig.GlobalConfig.Get("invoice_setting")
	require.NotNil(t, cfg)
	values := map[string]string{
		"name":        "Cursor",
		"line1":       "801 West End Avenue",
		"city":        "New York",
		"region":      "New York",
		"postal_code": "10025",
		"country":     "United States",
		"phone":       "+1 831-425-9504",
		"email":       "hi@cursor.com",
	}
	require.NoError(t, settingconfig.UpdateConfigFromMap(cfg, values))
	t.Cleanup(func() {
		cleared := map[string]string{}
		for key := range values {
			cleared[key] = ""
		}
		_ = settingconfig.UpdateConfigFromMap(cfg, cleared)
	})
}

func TestIssueUserInvoiceKeepsHistoryAndBillsOnlyTheIncrease(t *testing.T) {
	setupUserBillControllerTestDB(t)
	seedInvoiceUser(t)
	useInvoiceIssuer(t)

	now := time.Now()
	current := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	period := current.Format("2006-01")
	row := &model.QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: current.Add(2 * time.Hour).Unix(),
		Count:     2,
		Quota:     100,
		TokenUsed: 40,
	}
	require.NoError(t, model.DB.Create(row).Error)
	require.NoError(t, model.DB.Create(&model.QuotaData{
		UserID:    2,
		Username:  "bob",
		ModelName: "gpt-b",
		CreatedAt: current.Add(2 * time.Hour).Unix(),
		Count:     9,
		Quota:     900,
		TokenUsed: 90,
	}).Error)

	first := requestIssueInvoice(t, 1, common.RoleCommonUser, "period="+period)
	require.True(t, first.Success, first.Message)
	require.Equal(t, "INV-"+period+"-0001-01", first.Data.Number)
	require.Equal(t, 1, first.Data.Sequence)
	require.Equal(t, 100, first.Data.Quota)
	require.Equal(t, 2, first.Data.Count)
	require.Equal(t, 40, first.Data.TokenUsed)
	require.Equal(t, "Cursor", first.Data.Issuer.Name)
	require.Equal(t, "hi@cursor.com", first.Data.Issuer.Email)
	require.Equal(t, "Ada Zhang", first.Data.BillTo.Name)
	require.Equal(t, "100010", first.Data.BillTo.PostalCode)
	require.Len(t, first.Data.Items, 1)
	require.Equal(t, "gpt-a", first.Data.Items[0].ModelName)

	again := requestIssueInvoice(t, 1, common.RoleCommonUser, "period="+period)
	require.False(t, again.Success)
	require.Equal(t, "nothing new to invoice", again.Message)

	require.NoError(t, model.DB.Model(&model.QuotaData{}).Where("id = ?", row.Id).
		Updates(map[string]any{"quota": 150, "count": 3, "token_used": 55}).Error)

	second := requestIssueInvoice(t, 1, common.RoleCommonUser, "period="+period)
	require.True(t, second.Success, second.Message)
	require.Equal(t, "INV-"+period+"-0001-02", second.Data.Number)
	require.Equal(t, 50, second.Data.Quota)
	require.Equal(t, 1, second.Data.Count)
	require.Equal(t, 15, second.Data.TokenUsed)
	require.Equal(t, 50, second.Data.Items[0].Quota)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleCommonUser)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/bills/invoices?period="+period, nil)
	ListUserInvoices(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	var history userInvoiceHistoryResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &history))
	require.True(t, history.Success, history.Message)
	require.Len(t, history.Data.Invoices, 2)
	require.Equal(t, second.Data.Number, history.Data.Invoices[0].Number)
	require.Equal(t, 100, history.Data.Invoices[1].Quota)
	require.Zero(t, history.Data.Uninvoiced.Quota)
	require.Zero(t, history.Data.Uninvoiced.Count)
	require.Empty(t, history.Data.Uninvoiced.Items)
	require.True(t, history.Data.BillToReady)
	require.Equal(t, "Cursor", history.Data.Issuer.Name)
	require.Equal(t, "Ada Zhang", history.Data.Invoices[0].BillTo.Name)
}

func TestIssueUserInvoiceRequiresBillingDetails(t *testing.T) {
	setupUserBillControllerTestDB(t)
	seedInvoiceUser(t)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 1).Update("setting", "{}").Error)
	require.NoError(t, model.DB.Create(&model.QuotaData{
		UserID:    1,
		Username:  "alice",
		ModelName: "gpt-a",
		CreatedAt: time.Now().Unix(),
		Count:     1,
		Quota:     10,
		TokenUsed: 4,
	}).Error)

	payload := requestIssueInvoice(t, 1, common.RoleCommonUser, "")
	require.False(t, payload.Success)
	require.Equal(t, "invoice profile required", payload.Message)
}

func TestUpdateSelfInvoiceProfileStoresTheBillToParty(t *testing.T) {
	setupUserBillControllerTestDB(t)
	seedInvoiceUser(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 1)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/user/invoice-profile", strings.NewReader(`{"name":"Ada","email":"ada@example.com"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	UpdateSelfInvoiceProfile(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	var rejected userBillResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &rejected))
	require.False(t, rejected.Success)
	require.Equal(t, "invoice profile required", rejected.Message)

	body := `{"name":"Ada Zhang","line1":"zhongguandonglu","line2":"haidian","city":"Beijing","postal_code":"100010","country":"China","email":"it@baichuan-inc.com"}`
	saved := httptest.NewRecorder()
	savedCtx, _ := gin.CreateTestContext(saved)
	savedCtx.Set("id", 1)
	savedCtx.Request = httptest.NewRequest(http.MethodPut, "/api/user/invoice-profile", strings.NewReader(body))
	savedCtx.Request.Header.Set("Content-Type", "application/json")
	UpdateSelfInvoiceProfile(savedCtx)
	require.Equal(t, http.StatusOK, saved.Code)
	var accepted userBillResponse
	require.NoError(t, common.Unmarshal(saved.Body.Bytes(), &accepted))
	require.True(t, accepted.Success, accepted.Message)

	user, err := model.GetUserById(1, false)
	require.NoError(t, err)
	require.Equal(t, "it@baichuan-inc.com", user.GetSetting().InvoiceProfile.Email)
	require.Equal(t, "haidian", user.GetSetting().InvoiceProfile.Line2)
}
