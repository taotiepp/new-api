package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func GetUserUsableGroups(userGroup string) map[string]string {
	return ResolveUserUsableGroups(userGroup, "")
}

func ParseUserUsableGroups(raw string) ([]string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "null" {
		return nil, false
	}
	var parsed []string
	if err := common.Unmarshal([]byte(raw), &parsed); err != nil {
		common.SysLog("failed to parse user usable groups: " + err.Error())
		return nil, false
	}
	out := make([]string, 0, len(parsed))
	seen := make(map[string]struct{}, len(parsed))
	for _, name := range parsed {
		name = strings.TrimSpace(name)
		if name == "" || name == "auto" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		out = append(out, name)
	}
	return out, true
}

func ResolveUserUsableGroups(userGroup, raw string) map[string]string {
	names, custom := ParseUserUsableGroups(raw)
	if !custom {
		return inheritedUserUsableGroups(userGroup)
	}
	out := make(map[string]string, len(names)+1)
	descs := setting.GetUserUsableGroupsCopy()
	for _, name := range names {
		desc := descs[name]
		if desc == "" {
			desc = name
		}
		out[name] = desc
	}
	if userGroup != "" {
		if _, ok := out[userGroup]; !ok {
			desc := descs[userGroup]
			if desc == "" {
				desc = "用户分组"
			}
			out[userGroup] = desc
		}
	}
	if desc, ok := descs["auto"]; ok {
		out["auto"] = desc
	}
	return out
}

func inheritedUserUsableGroups(userGroup string) map[string]string {
	groupsCopy := setting.GetUserUsableGroupsCopy()
	if userGroup != "" {
		specialSettings, b := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.Get(userGroup)
		if b {
			for specialGroup, desc := range specialSettings {
				if after, ok := strings.CutPrefix(specialGroup, "-:"); ok {
					delete(groupsCopy, after)
				} else if after, ok := strings.CutPrefix(specialGroup, "+:"); ok {
					groupsCopy[after] = desc
				} else {
					groupsCopy[specialGroup] = desc
				}
			}
		}
		if _, ok := groupsCopy[userGroup]; !ok {
			groupsCopy[userGroup] = "用户分组"
		}
	}
	return groupsCopy
}

func GroupInUserUsableGroups(userGroup, groupName string) bool {
	return GroupAllowed(userGroup, "", groupName)
}

func GroupAllowed(userGroup, raw, groupName string) bool {
	_, ok := ResolveUserUsableGroups(userGroup, raw)[groupName]
	return ok
}

func IsUserSelectableGroup(userGroup, groupName string) bool {
	return IsUserSelectableGroupFor(userGroup, "", groupName)
}

func IsUserSelectableGroupFor(userGroup, raw, groupName string) bool {
	if groupName == "" || groupName == "auto" {
		return false
	}
	return GroupAllowed(userGroup, raw, groupName) && ratio_setting.ContainsGroupRatio(groupName)
}

func usableGroupsRawFromContext(c *gin.Context) string {
	if c == nil {
		return ""
	}
	return common.GetContextKeyString(c, constant.ContextKeyUserUsableGroups)
}

// GetUserAutoGroup 根据用户分组获取自动分组设置
func GetUserAutoGroup(userGroup string) []string {
	return GetUserAutoGroupFor(userGroup, "")
}

func GetUserAutoGroupFor(userGroup, raw string) []string {
	autoGroups := make([]string, 0)
	seen := make(map[string]struct{})
	for _, group := range setting.GetAutoGroups() {
		if !IsUserSelectableGroupFor(userGroup, raw, group) {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		autoGroups = append(autoGroups, group)
	}
	return autoGroups
}

// FilterUserTokenAutoGroups applies current permissions before the current
// per-token limit. It intentionally does not fall back to the global Auto list.
func FilterUserTokenAutoGroups(userGroup string, groups []string) []string {
	return FilterUserTokenAutoGroupsFor(userGroup, "", groups)
}

func FilterUserTokenAutoGroupsFor(userGroup, raw string, groups []string) []string {
	maxCount := setting.GetMaxTokenAutoGroups()
	filtered := make([]string, 0, min(len(groups), maxCount))
	seen := make(map[string]struct{})
	for _, group := range groups {
		if !IsUserSelectableGroupFor(userGroup, raw, group) {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		filtered = append(filtered, group)
		if len(filtered) == maxCount {
			break
		}
	}
	return filtered
}

// GetRequestAutoGroups resolves the ordered Auto groups for the current token.
// The absence of the context value means that the token inherits the complete
// global Auto list; a present (even empty) value is an explicit token snapshot.
func GetRequestAutoGroups(c *gin.Context, userGroup string) []string {
	raw := usableGroupsRawFromContext(c)
	value, ok := common.GetContextKey(c, constant.ContextKeyTokenAutoGroups)
	if !ok {
		return GetUserAutoGroupFor(userGroup, raw)
	}
	groups, ok := value.([]string)
	if !ok {
		return []string{}
	}
	return FilterUserTokenAutoGroupsFor(userGroup, raw, groups)
}

// GetGroupsEnabledModels 按 groups 顺序获取各分组启用的模型并去重
func GetGroupsEnabledModels(groups []string) []string {
	seen := make(map[string]struct{})
	models := make([]string, 0)
	for _, group := range groups {
		for _, modelName := range model.GetGroupEnabledModels(group) {
			if _, ok := seen[modelName]; !ok {
				seen[modelName] = struct{}{}
				models = append(models, modelName)
			}
		}
	}
	return models
}

// GetUserGroupRatio 获取用户使用某个分组的倍率
// userGroup 用户分组
// group 需要获取倍率的分组
func GetUserGroupRatio(userGroup, group string) float64 {
	ratio, ok := ratio_setting.GetGroupGroupRatio(userGroup, group)
	if ok {
		return ratio
	}
	return ratio_setting.GetGroupRatio(group)
}
