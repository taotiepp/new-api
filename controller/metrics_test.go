package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMetricsExportsUserModelRatesInPrometheusFormat(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	require.NoError(t, db.AutoMigrate(&model.Log{}))

	previous := model.LOG_DB
	model.LOG_DB = db
	t.Cleanup(func() { model.LOG_DB = previous })

	now := time.Now().Unix()
	logs := []model.Log{
		{UserId: 1, Username: "alice", ModelName: "gpt-4.1", Type: model.LogTypeConsume, CreatedAt: now, PromptTokens: 10, CompletionTokens: 20},
		{UserId: 1, Username: "alice", ModelName: "gpt-4.1", Type: model.LogTypeConsume, CreatedAt: now, PromptTokens: 5, CompletionTokens: 5},
		{UserId: 1, Username: "alice", ModelName: "gpt-4o", Type: model.LogTypeConsume, CreatedAt: now, PromptTokens: 100, CompletionTokens: 0},
		{UserId: 2, Username: "bob", ModelName: "gpt-4.1", Type: model.LogTypeConsume, CreatedAt: now, PromptTokens: 1, CompletionTokens: 1},
		{UserId: 1, Username: "alice", ModelName: "gpt-4.1", Type: model.LogTypeConsume, CreatedAt: now - 120, PromptTokens: 999, CompletionTokens: 999},
		{UserId: 1, Username: "alice", ModelName: "gpt-4.1", Type: model.LogTypeError, CreatedAt: now, PromptTokens: 50, CompletionTokens: 50},
	}
	require.NoError(t, db.Create(&logs).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/metrics", nil)
	Metrics(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Header().Get("Content-Type"), "text/plain")
	require.Contains(t, recorder.Header().Get("Content-Type"), "version=0.0.4")
	body := recorder.Body.String()
	for _, line := range []string{
		"# HELP newapi_user_model_requests_per_minute Consume requests in the last 60 seconds for one user and model.",
		"# TYPE newapi_user_model_requests_per_minute gauge",
		`newapi_user_model_requests_per_minute{model="gpt-4.1",user_id="1",username="alice"} 2`,
		`newapi_user_model_requests_per_minute{model="gpt-4o",user_id="1",username="alice"} 1`,
		`newapi_user_model_requests_per_minute{model="gpt-4.1",user_id="2",username="bob"} 1`,
		"# HELP newapi_user_model_tokens_per_minute Prompt plus completion tokens in the last 60 seconds for one user and model.",
		"# TYPE newapi_user_model_tokens_per_minute gauge",
		`newapi_user_model_tokens_per_minute{model="gpt-4.1",user_id="1",username="alice"} 40`,
		`newapi_user_model_tokens_per_minute{model="gpt-4o",user_id="1",username="alice"} 100`,
		`newapi_user_model_tokens_per_minute{model="gpt-4.1",user_id="2",username="bob"} 2`,
	} {
		require.Contains(t, body, line)
	}
	require.NotContains(t, body, "999")
}
