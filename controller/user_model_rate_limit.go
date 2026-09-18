package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// validateUserModelRateLimit checks the writable fields of a per-user limit row.
func validateUserModelRateLimit(r *model.UserModelRateLimit) string {
	if r.UserId <= 0 {
		return "user_id is required"
	}
	if r.RPM < -1 || r.TPM < -1 {
		return "rpm/tpm must be >= -1 (-1 = unlimited, 0 = inherit)"
	}
	switch r.TokenMode {
	case "", "total", "input":
	default:
		return "token_mode must be empty, total or input"
	}
	return ""
}

// GetUserModelRateLimits lists per-user limit rows. Query: user_id (0/absent =
// all), p, page_size.
func GetUserModelRateLimits(c *gin.Context) {
	userId, _ := strconv.Atoi(c.Query("user_id"))
	page, _ := strconv.Atoi(c.Query("p"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	rows, total, err := model.ListUserModelRateLimits(userId, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     rows,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// CreateUserModelRateLimit upserts the (user_id, model_name) row.
func CreateUserModelRateLimit(c *gin.Context) {
	var r model.UserModelRateLimit
	if err := c.ShouldBindJSON(&r); err != nil {
		common.ApiError(c, err)
		return
	}
	if msg := validateUserModelRateLimit(&r); msg != "" {
		common.ApiErrorMsg(c, msg)
		return
	}
	r.Id = 0
	if err := model.UpsertUserModelRateLimit(&r); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, &r)
}

// UpdateUserModelRateLimit updates an existing row by id.
func UpdateUserModelRateLimit(c *gin.Context) {
	var r model.UserModelRateLimit
	if err := c.ShouldBindJSON(&r); err != nil {
		common.ApiError(c, err)
		return
	}
	if r.Id <= 0 {
		common.ApiErrorMsg(c, "id is required")
		return
	}
	if msg := validateUserModelRateLimit(&r); msg != "" {
		common.ApiErrorMsg(c, msg)
		return
	}
	if err := r.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, &r)
}

// DeleteUserModelRateLimit removes a row by id.
func DeleteUserModelRateLimit(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DeleteUserModelRateLimitById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, true)
}
