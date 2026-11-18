package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
)

// UserChannelAllowSet is the channel set for one concrete group.
// Nil means this user still follows that group's priority and weight.
func UserChannelAllowSet(c *gin.Context, group string) map[int]struct{} {
	setting, ok := userSettingFromContext(c)
	if !ok || group == "" || group == "auto" {
		return nil
	}
	return model.AllowSetForGroup(setting.GroupChannelAllowlist, group)
}

// UserAllowsChannel reports whether a pinned or affinity channel is still
// legal for this user. An auto group is legal when any of its concrete groups
// either has no limit or includes the channel.
func UserAllowsChannel(c *gin.Context, group string, channelID int) bool {
	setting, ok := userSettingFromContext(c)
	if !ok || len(setting.GroupChannelAllowlist) == 0 || channelID <= 0 {
		return true
	}
	if group == "auto" {
		names := GetRequestAutoGroups(c, common.GetContextKeyString(c, constant.ContextKeyUserGroup))
		if len(names) == 0 {
			return true
		}
		for _, name := range names {
			allowed := model.AllowSetForGroup(setting.GroupChannelAllowlist, name)
			if allowed == nil {
				return true
			}
			if _, ok := allowed[channelID]; ok {
				return true
			}
		}
		return false
	}
	allowed := model.AllowSetForGroup(setting.GroupChannelAllowlist, group)
	if allowed == nil {
		return true
	}
	_, ok = allowed[channelID]
	return ok
}

func userSettingFromContext(c *gin.Context) (dto.UserSetting, bool) {
	if c == nil {
		return dto.UserSetting{}, false
	}
	return common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting)
}
