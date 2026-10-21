package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetGroups(c *gin.Context) {
	groupNames := make([]string, 0)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		groupNames = append(groupNames, groupName)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupNames,
	})
}

func GetUserGroups(c *gin.Context) {
	usableGroups := make(map[string]map[string]any)
	userGroup := ""
	userId := c.GetInt("id")
	userGroup, _ = model.GetUserGroup(userId, false)
	usableGroupsRaw := ""
	groupDiscountsRaw := ""
	virtualGroupsRaw := ""
	if user, err := model.GetUserCache(userId); err == nil && user != nil {
		userGroup = user.Group
		usableGroupsRaw = user.UsableGroups
		groupDiscountsRaw = user.GroupDiscounts
		virtualGroupsRaw = user.VirtualGroups
	}
	userUsableGroups := service.ResolveUserUsableGroups(userGroup, usableGroupsRaw)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		desc, ok := userUsableGroups[groupName]
		if !ok {
			continue
		}
		usableGroups[groupName] = map[string]any{
			"ratio": service.GetUserGroupRatio(userGroup, groupName, groupDiscountsRaw),
			"desc":  desc,
		}
	}
	if _, ok := userUsableGroups["auto"]; ok {
		usableGroups["auto"] = map[string]any{
			"ratio": "自动",
			"desc":  setting.GetUsableGroupDescription("auto"),
		}
	}
	if groups, parseErr := model.ParseVirtualGroups(virtualGroupsRaw); parseErr == nil {
		for _, group := range groups {
			usableGroups[group.Name] = map[string]any{
				"ratio":   "source",
				"desc":    group.Name,
				"virtual": true,
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}
