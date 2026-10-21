package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetSelfVirtualGroups(c *gin.Context) {
	user, err := model.GetUserCache(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	groups, err := model.ParseVirtualGroups(user.VirtualGroups)
	if err != nil {
		groups = nil
	}
	if groups == nil {
		groups = []model.VirtualGroup{}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groups,
	})
}

func UpdateSelfVirtualGroups(c *gin.Context) {
	var groups []model.VirtualGroup
	if err := common.DecodeJson(c.Request.Body, &groups); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	userID := c.GetInt("id")
	user, err := model.GetUserCache(userID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	encoded, err := common.Marshal(groups)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	normalized, failure := model.NormalizeVirtualGroups(string(encoded), sourceGroupsForUser(user), reservedGroupNames())
	if failure != nil {
		common.ApiErrorI18n(c, failure.MessageID, failure.Data)
		return
	}
	if err := model.UpdateUserVirtualGroups(userID, normalized); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.PublishUserAuthCache(userID); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func sourceGroupsForUser(user *model.UserBase) map[string]struct{} {
	resolved := service.ResolveUserUsableGroups(user.Group, user.UsableGroups)
	source := make(map[string]struct{}, len(resolved))
	for name := range resolved {
		if name == "auto" || !ratio_setting.ContainsGroupRatio(name) {
			continue
		}
		source[name] = struct{}{}
	}
	return source
}

func reservedGroupNames() map[string]struct{} {
	reserved := map[string]struct{}{"auto": {}}
	for name := range ratio_setting.GetGroupRatioCopy() {
		reserved[name] = struct{}{}
	}
	return reserved
}
