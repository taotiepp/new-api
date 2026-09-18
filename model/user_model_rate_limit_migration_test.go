package model

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// TestUserModelRateLimitMigrationSQLite runs against the shared in-memory DB
// configured in TestMain. AutoMigrate is executed twice to prove idempotency
// (no repeated ALTER churn), then the CRUD surface is exercised.
func TestUserModelRateLimitMigrationSQLite(t *testing.T) {
	for range 2 {
		require.NoError(t, DB.AutoMigrate(&UserModelRateLimit{}))
	}
	require.True(t, DB.Migrator().HasTable(&UserModelRateLimit{}))
	assert.True(t, DB.Migrator().HasIndex(&UserModelRateLimit{}, "uk_umrl_user_model"))

	t.Cleanup(func() { DB.Exec("DELETE FROM user_model_rate_limits") })

	// Insert (user default row: empty ModelName).
	def := &UserModelRateLimit{UserId: 9001, ModelName: "", RPM: 10, TPM: 1000, TokenMode: "total", Enabled: true}
	require.NoError(t, def.Insert())
	assert.NotZero(t, def.Id)
	assert.NotZero(t, def.CreatedTime)

	// Insert a per-model row for the same user.
	modelRow := &UserModelRateLimit{UserId: 9001, ModelName: "gpt-4o", RPM: -1, TPM: 0, TokenMode: "input", Enabled: true}
	require.NoError(t, modelRow.Insert())

	rows, err := GetUserModelRateLimits(9001)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	// Ordered by model_name asc: "" sorts before "gpt-4o".
	assert.Equal(t, "", rows[0].ModelName)
	assert.EqualValues(t, 10, rows[0].RPM)
	assert.Equal(t, "gpt-4o", rows[1].ModelName)
	assert.EqualValues(t, -1, rows[1].RPM)

	// Upsert updates the existing (userId, modelName) row instead of duplicating.
	require.NoError(t, UpsertUserModelRateLimit(&UserModelRateLimit{
		UserId: 9001, ModelName: "gpt-4o", RPM: 5, TPM: 500, TokenMode: "total", Enabled: false,
	}))
	rows, err = GetUserModelRateLimits(9001)
	require.NoError(t, err)
	require.Len(t, rows, 2, "upsert must not create a second row")
	for _, r := range rows {
		if r.ModelName == "gpt-4o" {
			assert.EqualValues(t, 5, r.RPM)
			assert.EqualValues(t, 500, r.TPM)
			assert.Equal(t, "total", r.TokenMode)
			assert.False(t, r.Enabled)
		}
	}

	// Update persists zero values (rpm=0, enabled=false) via Select+Updates.
	def.RPM = 0
	def.TPM = 0
	def.Enabled = false
	require.NoError(t, def.Update())
	var reloaded UserModelRateLimit
	require.NoError(t, DB.Where("id = ?", def.Id).First(&reloaded).Error)
	assert.EqualValues(t, 0, reloaded.RPM)
	assert.EqualValues(t, 0, reloaded.TPM)
	assert.False(t, reloaded.Enabled)

	// Delete by id.
	require.NoError(t, DeleteUserModelRateLimitById(modelRow.Id))
	rows, err = GetUserModelRateLimits(9001)
	require.NoError(t, err)
	assert.Len(t, rows, 1)

	// List with pagination.
	list, total, err := ListUserModelRateLimits(9001, 1, 10)
	require.NoError(t, err)
	assert.EqualValues(t, 1, total)
	assert.Len(t, list, 1)
}

func TestUserModelRateLimitUniqueIndexSQLite(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&UserModelRateLimit{}))
	t.Cleanup(func() { DB.Exec("DELETE FROM user_model_rate_limits") })

	require.NoError(t, (&UserModelRateLimit{UserId: 9002, ModelName: "claude", RPM: 1, Enabled: true}).Insert())
	// A second row with the same (userId, modelName) must violate the unique index.
	err := (&UserModelRateLimit{UserId: 9002, ModelName: "claude", RPM: 2, Enabled: true}).Insert()
	assert.Error(t, err)
}

func TestUserModelRateLimitCacheInvalidation(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&UserModelRateLimit{}))
	t.Cleanup(func() { DB.Exec("DELETE FROM user_model_rate_limits") })

	// Empty result is cached (negative caching) without error.
	InvalidateUserModelRateLimitCache(9003)
	assert.Empty(t, GetUserModelRateLimitsCached(9003))

	require.NoError(t, (&UserModelRateLimit{UserId: 9003, ModelName: "m", RPM: 7, Enabled: true}).Insert())
	// Insert invalidates the cache, so the fresh row is visible.
	cached := GetUserModelRateLimitsCached(9003)
	require.Len(t, cached, 1)
	assert.EqualValues(t, 7, cached[0].RPM)
}

// migrateUserModelRateLimitTwice proves AutoMigrate is idempotent on a fresh
// engine-specific table (no repeated ALTER, index preserved).
func migrateUserModelRateLimitTwice(t *testing.T, db *gorm.DB) {
	t.Helper()
	tableName := "user_model_rate_limit_mig_" + time.Now().Format("150405.000000000")
	t.Cleanup(func() { _ = db.Migrator().DropTable(tableName) })

	tableDB := db.Table(tableName)
	for range 2 {
		require.NoError(t, tableDB.AutoMigrate(&UserModelRateLimit{}))
	}
	require.True(t, tableDB.Migrator().HasIndex(&UserModelRateLimit{}, "uk_umrl_user_model"))
	require.NoError(t, tableDB.Create(&UserModelRateLimit{UserId: 1, ModelName: "x", RPM: 1}).Error)
}

func TestUserModelRateLimitMigrationMySQL(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("TEST_MYSQL_DSN"))
	if dsn == "" {
		t.Skip("TEST_MYSQL_DSN is not configured")
	}
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	migrateUserModelRateLimitTwice(t, db)
}

func TestUserModelRateLimitMigrationPostgreSQL(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN"))
	if dsn == "" {
		t.Skip("TEST_POSTGRES_DSN is not configured")
	}
	db, err := gorm.Open(postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true}), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	migrateUserModelRateLimitTwice(t, db)
}
