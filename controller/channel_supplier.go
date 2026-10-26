package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type channelSupplierGroup struct {
	Name     string   `json:"name"`
	Discount *float64 `json:"discount,omitempty"`
}

type channelSupplierItem struct {
	ID       int                    `json:"id"`
	Name     string                 `json:"name"`
	Groups   []channelSupplierGroup `json:"groups"`
	Discount *float64               `json:"discount,omitempty"`
	Profile  model.SupplierProfile  `json:"profile"`
}

type updateChannelSupplierRequest struct {
	Discount *float64                   `json:"discount"`
	Profile  model.SupplierProfileInput `json:"profile"`
}

func GetChannelSuppliers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	channels, total, err := model.ListChannelSuppliers(c.Query("keyword"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.SysError("failed to list channel suppliers: " + err.Error())
		common.ApiErrorMsg(c, "failed to list suppliers")
		return
	}
	items := make([]channelSupplierItem, 0, len(channels))
	for _, channel := range channels {
		profile, parseErr := model.ParseSupplierProfile(channel.SupplierProfile)
		if parseErr != nil {
			common.SysError("failed to parse supplier profile: channel_id=" + strconv.Itoa(channel.Id))
			profile = model.SupplierProfile{}
		}
		groups := channel.GetGroups()
		views := make([]channelSupplierGroup, 0, len(groups))
		for _, name := range groups {
			if name == "" {
				continue
			}
			view := channelSupplierGroup{Name: name}
			if ratio_setting.ContainsGroupRatio(name) {
				ratio := ratio_setting.GetGroupRatio(name)
				view.Discount = &ratio
			}
			views = append(views, view)
		}
		items = append(items, channelSupplierItem{
			ID:       channel.Id,
			Name:     channel.Name,
			Groups:   views,
			Discount: channel.Discount,
			Profile:  profile,
		})
	}
	common.ApiSuccess(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
	})
}

func UpdateChannelSupplier(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid channel id"})
		return
	}
	var request updateChannelSupplierRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "invalid supplier profile")
		return
	}
	if err := model.UpdateChannelSupplier(id, request.Discount, request.Profile); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "channel not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
