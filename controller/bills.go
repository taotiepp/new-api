package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetUserBills(c *gin.Context) {
	userId := c.GetInt("id")
	period := c.Query("period")
	if period == "" {
		now := time.Now()
		period = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local).Format("2006-01")
	}
	if _, _, ok := model.ParseBillPeriod(period); !ok {
		common.ApiErrorMsg(c, "invalid period")
		return
	}

	months := 6
	if raw := c.Query("months"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 12 {
			common.ApiErrorMsg(c, "invalid months")
			return
		}
		months = value
	}

	overview, err := model.LoadUserBillOverview(userId, period, months)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    overview,
	})
}
