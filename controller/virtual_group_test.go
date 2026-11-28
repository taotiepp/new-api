package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateSelfVirtualGroupsDoesNotRequireSourcePermission(t *testing.T) {
	db := setupManageUserTestDB(t)
	previousRatios := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousRatios))
	})
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1}`))

	user := model.User{
		Username: "virtual-owner", Password: "password", DisplayName: "Owner",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default",
		UsableGroups: `["default"]`,
	}
	require.NoError(t, db.Create(&user).Error)
	assert.False(t, service.GroupAllowed(user.Group, user.UsableGroups, "vip"))

	gin.SetMode(gin.TestMode)
	save := func(body string) *httptest.ResponseRecorder {
		t.Helper()
		recorder := httptest.NewRecorder()
		context, _ := gin.CreateTestContext(recorder)
		context.Request = httptest.NewRequest(http.MethodPut, "/api/user/self/virtual-groups", strings.NewReader(body))
		context.Request.Header.Set("Content-Type", "application/json")
		context.Request.Header.Set("Accept-Language", "en")
		context.Set("id", user.Id)
		UpdateSelfVirtualGroups(context)
		return recorder
	}

	recorder := save(`[{"name":"coding","models":[{"name":"opus","source_group":"vip","source_model":"opus"}]}]`)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":true`)

	var stored model.User
	require.NoError(t, db.First(&stored, user.Id).Error)
	assert.Contains(t, stored.VirtualGroups, `"source_group":"vip"`)

	recorder = save(`[{"name":"coding","models":[{"name":"opus","source_group":"missing","source_model":"opus"}]}]`)
	assert.Contains(t, recorder.Body.String(), `"success":true`)
	assert.Contains(t, recorder.Body.String(), "missing")
	require.NoError(t, db.First(&stored, user.Id).Error)
	assert.Contains(t, stored.VirtualGroups, `"source_group":"missing"`)
}
