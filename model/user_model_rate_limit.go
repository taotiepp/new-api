package model

import (
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// UserModelRateLimit stores per-user overrides for TPM/RPM limits. A row with an
// empty ModelName is the user's default (applies to any model without a more
// specific row). Limits use the same semantics as setting.ModelRateLimit:
//
//	0  -> inherit (fall back to group/global settings)
//	-1 -> explicit unlimited
//	>0 -> concrete limit for the window
//
// TokenMode: "" inherit, "total", "input".
//
// This is a brand-new table, so no data migration is needed; defaults are set in
// code (Insert/Upsert) rather than via GORM boolean/number default tags to keep
// AutoMigrate idempotent across SQLite/MySQL/PostgreSQL.
type UserModelRateLimit struct {
	Id          int    `json:"id"`
	UserId      int    `json:"user_id" gorm:"not null;uniqueIndex:uk_umrl_user_model,priority:1"`
	ModelName   string `json:"model_name" gorm:"size:191;not null;uniqueIndex:uk_umrl_user_model,priority:2"`
	RPM         int    `json:"rpm"`
	TPM         int    `json:"tpm"`
	TokenMode   string `json:"token_mode" gorm:"size:16"`
	Enabled     bool   `json:"enabled"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime int64  `json:"updated_time" gorm:"bigint"`
}

func (UserModelRateLimit) TableName() string {
	return "user_model_rate_limits"
}

func (r *UserModelRateLimit) normalize() {
	switch r.TokenMode {
	case "total", "input":
	default:
		r.TokenMode = ""
	}
}

func (r *UserModelRateLimit) Insert() error {
	r.normalize()
	now := common.GetTimestamp()
	r.CreatedTime = now
	r.UpdatedTime = now
	if err := DB.Create(r).Error; err != nil {
		return err
	}
	InvalidateUserModelRateLimitCache(r.UserId)
	return nil
}

func (r *UserModelRateLimit) Update() error {
	r.normalize()
	r.UpdatedTime = common.GetTimestamp()
	// Select concrete columns so zero values (rpm=0/tpm=0/enabled=false) persist.
	err := DB.Model(r).Where("id = ?", r.Id).Select(
		"model_name", "rpm", "tpm", "token_mode", "enabled", "updated_time",
	).Updates(map[string]any{
		"model_name":   r.ModelName,
		"rpm":          r.RPM,
		"tpm":          r.TPM,
		"token_mode":   r.TokenMode,
		"enabled":      r.Enabled,
		"updated_time": r.UpdatedTime,
	}).Error
	if err != nil {
		return err
	}
	InvalidateUserModelRateLimitCache(r.UserId)
	return nil
}

func DeleteUserModelRateLimitById(id int) error {
	var row UserModelRateLimit
	if err := DB.Where("id = ?", id).First(&row).Error; err != nil {
		return err
	}
	if err := DB.Delete(&row).Error; err != nil {
		return err
	}
	InvalidateUserModelRateLimitCache(row.UserId)
	return nil
}

// UpsertUserModelRateLimit creates or updates the (userId, modelName) row.
func UpsertUserModelRateLimit(row *UserModelRateLimit) error {
	row.normalize()
	var existing UserModelRateLimit
	err := DB.Where("user_id = ? AND model_name = ?", row.UserId, row.ModelName).First(&existing).Error
	if err != nil {
		return row.Insert()
	}
	existing.RPM = row.RPM
	existing.TPM = row.TPM
	existing.TokenMode = row.TokenMode
	existing.Enabled = row.Enabled
	return existing.Update()
}

// GetUserModelRateLimits returns all rows for a user (direct DB read).
func GetUserModelRateLimits(userId int) ([]UserModelRateLimit, error) {
	var rows []UserModelRateLimit
	err := DB.Where("user_id = ?", userId).Order("model_name asc").Find(&rows).Error
	return rows, err
}

// ListUserModelRateLimits lists rows for the admin UI, optionally filtered by
// user id (0 = all users), with pagination.
func ListUserModelRateLimits(userId int, page, pageSize int) ([]UserModelRateLimit, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}
	tx := DB.Model(&UserModelRateLimit{})
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []UserModelRateLimit
	err := tx.Order("user_id asc, model_name asc").
		Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&rows).Error
	return rows, total, err
}

// ---------------------------------------------------------------- caching

const userModelRateLimitCacheTTL = 60 * time.Second

type umrlCacheEntry struct {
	rows     []UserModelRateLimit
	expireAt time.Time
}

var umrlLocalCache sync.Map // userId(int) -> *umrlCacheEntry

func umrlRedisKey(userId int) string {
	return "user_model_rate_limit:" + strconv.Itoa(userId)
}

// GetUserModelRateLimitsCached returns cached rows for a user. When Redis is
// enabled the cache is shared across nodes; otherwise a short-TTL in-process
// cache is used. Negative (empty) results are cached too.
func GetUserModelRateLimitsCached(userId int) []UserModelRateLimit {
	if common.RedisEnabled {
		if s, err := common.RedisGet(umrlRedisKey(userId)); err == nil {
			var rows []UserModelRateLimit
			if uerr := common.Unmarshal([]byte(s), &rows); uerr == nil {
				return rows
			}
		}
	} else if e, ok := umrlLocalCache.Load(userId); ok {
		entry := e.(*umrlCacheEntry)
		if time.Now().Before(entry.expireAt) {
			return entry.rows
		}
		umrlLocalCache.Delete(userId)
	}

	rows, err := GetUserModelRateLimits(userId)
	if err != nil {
		common.SysError("failed to load user model rate limits: " + err.Error())
		return nil
	}
	storeUserModelRateLimitCache(userId, rows)
	return rows
}

func storeUserModelRateLimitCache(userId int, rows []UserModelRateLimit) {
	if rows == nil {
		rows = []UserModelRateLimit{}
	}
	if common.RedisEnabled {
		b, err := common.Marshal(rows)
		if err != nil {
			return
		}
		if serr := common.RedisSet(umrlRedisKey(userId), string(b), userModelRateLimitCacheTTL); serr != nil {
			common.SysError("failed to cache user model rate limits: " + serr.Error())
		}
		return
	}
	umrlLocalCache.Store(userId, &umrlCacheEntry{rows: rows, expireAt: time.Now().Add(userModelRateLimitCacheTTL)})
}

// InvalidateUserModelRateLimitCache clears the cache for a user after a write.
func InvalidateUserModelRateLimitCache(userId int) {
	umrlLocalCache.Delete(userId)
	if common.RedisEnabled {
		if err := common.RedisDel(umrlRedisKey(userId)); err != nil {
			common.SysError("failed to invalidate user model rate limit cache: " + err.Error())
		}
	}
}
