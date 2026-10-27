package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useOperationsGroupRatios(t *testing.T) {
	t.Helper()
	previousGroups := ratio_setting.GroupRatio2JSONString()
	previousCross := ratio_setting.GroupGroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousGroups))
		require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(previousCross))
	})
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":0.5,"svip":1}`))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{"vip":{"default":0.8}}`))
}

func performUserOperationsRequest(t *testing.T, method string, userID int, role int, body string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(method, "/api/user/"+strconv.Itoa(userID)+"/operations", strings.NewReader(body))
	context.Request.Header.Set("Content-Type", "application/json")
	context.Params = gin.Params{{Key: "id", Value: strconv.Itoa(userID)}}
	context.Set("id", 9999)
	context.Set("role", role)
	context.Set("username", "operations-admin")
	context.Set(common.RequestIdKey, "operations-test-request")
	if method == http.MethodPut {
		UpdateUserOperations(context)
		return recorder
	}
	GetUserOperations(context)
	return recorder
}

func TestUserOperationsSettingsReadAndUpdate(t *testing.T) {
	db := setupManageUserTestDB(t)
	useOperationsGroupRatios(t)
	user := model.User{
		Username: "ops-member", Password: "password", DisplayName: "Member",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "vip",
		Quota: 42, AuthVersion: 3, Remark: "keep",
		GroupDiscounts: `{"vip":0.4}`, GroupModelDiscounts: `{"vip":{"gpt":0.2}}`,
		AffCode: "ops-member",
	}
	require.NoError(t, db.Create(&user).Error)

	recorder := performUserOperationsRequest(t, http.MethodGet, user.Id, common.RoleAdminUser, "")
	assert.Equal(t, http.StatusOK, recorder.Code)
	var read struct {
		Success bool               `json:"success"`
		Data    userOperationsView `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &read))
	assert.True(t, read.Success)
	assert.False(t, read.Data.Custom)
	byName := map[string]userOperationsGroup{}
	for _, group := range read.Data.Groups {
		byName[group.Name] = group
	}
	require.Contains(t, byName, "default")
	assert.InDelta(t, 0.8, byName["default"].DefaultRatio, 0.0001)
	assert.True(t, byName["default"].Inherited)
	assert.Nil(t, byName["default"].Discount)
	require.Contains(t, byName, "vip")
	assert.InDelta(t, 0.5, byName["vip"].DefaultRatio, 0.0001)
	assert.True(t, byName["vip"].Assigned)
	require.NotNil(t, byName["vip"].Discount)
	assert.InDelta(t, 0.4, *byName["vip"].Discount, 0.0001)
	require.Contains(t, byName, "svip")
	assert.False(t, byName["svip"].Inherited)
	assert.False(t, byName["svip"].Allowed)

	recorder = performUserOperationsRequest(t, http.MethodPut, user.Id, common.RoleAdminUser, `{"custom":true,"groups":["svip"],"discounts":{"svip":0.25,"vip":null}}`)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":true`)

	var updated model.User
	require.NoError(t, db.First(&updated, user.Id).Error)
	assert.Equal(t, "ops-member", updated.Username)
	assert.Equal(t, "keep", updated.Remark)
	assert.Equal(t, 42, updated.Quota)
	assert.EqualValues(t, 3, updated.AuthVersion)
	assert.JSONEq(t, `["svip","vip"]`, updated.UsableGroups)
	assert.JSONEq(t, `{"svip":0.25}`, updated.GroupDiscounts)
	assert.JSONEq(t, `{"vip":{"gpt":0.2}}`, updated.GroupModelDiscounts)

	recorder = performUserOperationsRequest(t, http.MethodPut, user.Id, common.RoleRootUser, `{"custom":false,"groups":[],"discounts":{}}`)
	assert.Contains(t, recorder.Body.String(), `"success":true`)
	require.NoError(t, db.First(&updated, user.Id).Error)
	assert.Empty(t, updated.UsableGroups)
	assert.Empty(t, updated.GroupDiscounts)
	assert.JSONEq(t, `{"vip":{"gpt":0.2}}`, updated.GroupModelDiscounts)
}

func TestUserOperationsSettingsRejectsUnauthorizedAndInvalidDiscounts(t *testing.T) {
	db := setupManageUserTestDB(t)
	useOperationsGroupRatios(t)
	member := model.User{
		Username: "ops-target", Password: "password", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
		AffCode: "ops-target",
	}
	peer := model.User{
		Username: "ops-peer-admin", Password: "password", Role: common.RoleAdminUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
		AffCode: "ops-peer",
	}
	require.NoError(t, db.Create(&member).Error)
	require.NoError(t, db.Create(&peer).Error)

	recorder := performUserOperationsRequest(t, http.MethodGet, member.Id, common.RoleCommonUser, "")
	assert.Contains(t, recorder.Body.String(), `"success":false`)

	recorder = performUserOperationsRequest(t, http.MethodPut, peer.Id, common.RoleAdminUser, `{"custom":true,"groups":["vip"],"discounts":{}}`)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	var unchanged model.User
	require.NoError(t, db.First(&unchanged, peer.Id).Error)
	assert.Empty(t, unchanged.UsableGroups)

	recorder = performUserOperationsRequest(t, http.MethodPut, member.Id, common.RoleAdminUser, `{"custom":true,"groups":["missing"],"discounts":{}}`)
	assert.Contains(t, recorder.Body.String(), `"success":false`)

	recorder = performUserOperationsRequest(t, http.MethodPut, member.Id, common.RoleAdminUser, `{"custom":false,"groups":[],"discounts":{"svip":0.2}}`)
	assert.Contains(t, recorder.Body.String(), `"success":false`)

	recorder = performUserOperationsRequest(t, http.MethodPut, member.Id, common.RoleAdminUser, `{"custom":true,"groups":["vip"],"discounts":{"vip":-1}}`)
	assert.Contains(t, recorder.Body.String(), `"success":false`)

	var memberAfter model.User
	require.NoError(t, db.First(&memberAfter, member.Id).Error)
	assert.Empty(t, memberAfter.UsableGroups)
	assert.Empty(t, memberAfter.GroupDiscounts)
}
