package controller

import (
	"errors"
	"math"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

type userOperationsGroup struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Inherited    bool     `json:"inherited"`
	Allowed      bool     `json:"allowed"`
	Assigned     bool     `json:"assigned"`
	DefaultRatio float64  `json:"default_ratio"`
	Discount     *float64 `json:"discount"`
}

type userOperationsView struct {
	UserId      int                   `json:"user_id"`
	Username    string                `json:"username"`
	DisplayName string                `json:"display_name"`
	Group       string                `json:"group"`
	Custom      bool                  `json:"custom"`
	Groups      []userOperationsGroup `json:"groups"`
}

type userOperationsUpdate struct {
	Custom    bool                `json:"custom"`
	Groups    []string            `json:"groups"`
	Discounts map[string]*float64 `json:"discounts"`
}

func GetUserOperations(c *gin.Context) {
	user, ok := loadOperationsUser(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    buildUserOperations(user),
	})
}

func UpdateUserOperations(c *gin.Context) {
	user, ok := loadOperationsUser(c)
	if !ok {
		return
	}
	var request userOperationsUpdate
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	usableGroups, allowed, err := operationsPermissionList(user, request.Custom, request.Groups)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserInputInvalid, map[string]any{"Error": err.Error()})
		return
	}
	groupDiscounts, err := operationsDiscountJSON(allowed, request.Discounts)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserInputInvalid, map[string]any{"Error": err.Error()})
		return
	}
	if err := user.UpdateOperationsSettings(usableGroups, groupDiscounts); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, user.Id, "user.operations_update", map[string]any{
		"username": user.Username,
		"id":       user.Id,
		"custom":   request.Custom,
		"groups":   usableGroups,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func loadOperationsUser(c *gin.Context) (*model.User, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return nil, false
	}
	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return nil, false
	}
	myRole := c.GetInt("role")
	if myRole < common.RoleAdminUser || !canManageTargetRole(myRole, user.Role) {
		common.ApiErrorI18n(c, i18n.MsgUserNoPermissionSameLevel)
		return nil, false
	}
	return user, true
}

func buildUserOperations(user *model.User) userOperationsView {
	_, custom := service.ParseUserUsableGroups(user.UsableGroups)
	inherited := service.ResolveUserUsableGroups(user.Group, "")
	effective := service.ResolveUserUsableGroups(user.Group, user.UsableGroups)
	customDiscounts := service.ParseGroupDiscounts(user.GroupDiscounts)
	assigned := strings.TrimSpace(user.Group)
	names := operationsGroupNames(user.Group)
	groups := make([]userOperationsGroup, 0, len(names))
	for _, name := range names {
		_, isInherited := inherited[name]
		_, isAllowed := effective[name]
		group := userOperationsGroup{
			Name:         name,
			Description:  setting.GetUsableGroupDescription(name),
			Inherited:    isInherited,
			Allowed:      isAllowed,
			Assigned:     name == assigned,
			DefaultRatio: operationsDefaultRatio(user.Group, name),
		}
		if value, ok := customDiscounts[name]; ok {
			copied := value
			group.Discount = &copied
		}
		groups = append(groups, group)
	}
	return userOperationsView{
		UserId:      user.Id,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		Group:       user.Group,
		Custom:      custom,
		Groups:      groups,
	}
}

func operationsGroupNames(assigned string) []string {
	seen := map[string]struct{}{}
	names := make([]string, 0)
	for name := range ratio_setting.GetGroupRatioCopy() {
		if !operationsGroupNameAllowed(name) {
			continue
		}
		seen[name] = struct{}{}
		names = append(names, name)
	}
	assigned = strings.TrimSpace(assigned)
	if operationsGroupNameAllowed(assigned) {
		if _, ok := seen[assigned]; !ok {
			names = append(names, assigned)
		}
	}
	slices.Sort(names)
	return names
}

func operationsGroupNameAllowed(name string) bool {
	return name != "" && name != "auto"
}

func operationsDefaultRatio(userGroup, usingGroup string) float64 {
	return service.ResolveUserDiscount(service.UserDiscountInput{
		UserGroup:  userGroup,
		UsingGroup: usingGroup,
	}).Ratio
}

func operationsPermissionList(user *model.User, custom bool, selected []string) (string, map[string]struct{}, error) {
	if !custom {
		allowed := map[string]struct{}{}
		for name := range service.ResolveUserUsableGroups(user.Group, "") {
			if operationsGroupNameAllowed(name) {
				allowed[name] = struct{}{}
			}
		}
		return "", allowed, nil
	}
	allowed := map[string]struct{}{}
	assigned := strings.TrimSpace(user.Group)
	if operationsGroupNameAllowed(assigned) {
		allowed[assigned] = struct{}{}
	}
	configured := ratio_setting.GetGroupRatioCopy()
	for _, name := range selected {
		name = strings.TrimSpace(name)
		if !operationsGroupNameAllowed(name) {
			continue
		}
		if _, ok := configured[name]; !ok && name != assigned {
			return "", nil, errors.New("unknown group " + name)
		}
		allowed[name] = struct{}{}
	}
	names := make([]string, 0, len(allowed))
	for name := range allowed {
		names = append(names, name)
	}
	slices.Sort(names)
	encoded, err := common.Marshal(names)
	if err != nil {
		return "", nil, err
	}
	return string(encoded), allowed, nil
}

func operationsDiscountJSON(allowed map[string]struct{}, discounts map[string]*float64) (string, error) {
	saved := map[string]float64{}
	for name, value := range discounts {
		name = strings.TrimSpace(name)
		if value == nil {
			continue
		}
		if _, ok := allowed[name]; !ok {
			return "", errors.New("discount is not allowed for group " + name)
		}
		if math.IsNaN(*value) || math.IsInf(*value, 0) || *value < 0 {
			return "", errors.New("discount must be a finite number ≥ 0")
		}
		saved[name] = *value
	}
	if len(saved) == 0 {
		return "", nil
	}
	encoded, err := common.Marshal(saved)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}
