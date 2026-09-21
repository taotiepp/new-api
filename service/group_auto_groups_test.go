package service

import (
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func configureRequestAutoGroupsTest(t *testing.T) {
	t.Helper()
	originalMax := setting.GetMaxTokenAutoGroups()
	originalAutoGroups := setting.AutoGroups2JsonString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, setting.UpdateMaxTokenAutoGroups("2"))
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["vip","default","svip"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","svip":"SVIP"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1,"svip":1}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateMaxTokenAutoGroups(fmt.Sprintf("%d", originalMax)))
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})
}

func newRequestAutoGroupsContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	return ctx
}

func TestGetRequestAutoGroupsInheritedListIsNotLimited(t *testing.T) {
	configureRequestAutoGroupsTest(t)
	ctx := newRequestAutoGroupsContext()

	groups := GetRequestAutoGroups(ctx, "default")

	assert.Equal(t, []string{"vip", "default", "svip"}, groups)
}

func TestGetRequestAutoGroupsFiltersBeforeApplyingCurrentLimit(t *testing.T) {
	configureRequestAutoGroupsTest(t)
	ctx := newRequestAutoGroupsContext()
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"revoked", "vip", "default", "svip"})
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`[]`))

	groups := GetRequestAutoGroups(ctx, "default")

	assert.Equal(t, []string{"vip", "default"}, groups)
	require.NoError(t, setting.UpdateMaxTokenAutoGroups("1"))
	assert.Equal(t, []string{"vip"}, GetRequestAutoGroups(ctx, "default"))
}

func TestParseUserUsableGroups(t *testing.T) {
	names, custom := ParseUserUsableGroups("")
	assert.Nil(t, names)
	assert.False(t, custom)

	names, custom = ParseUserUsableGroups(`["vip","vip","auto","", "svip"]`)
	assert.True(t, custom)
	assert.Equal(t, []string{"vip", "svip"}, names)

	names, custom = ParseUserUsableGroups("{")
	assert.Nil(t, names)
	assert.False(t, custom)
}

func TestResolveUserUsableGroupsCustomAllowlist(t *testing.T) {
	configureRequestAutoGroupsTest(t)
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","svip":"SVIP","auto":"Auto"}`))

	resolved := ResolveUserUsableGroups("vip", `["svip"]`)
	assert.Equal(t, "VIP", resolved["vip"])
	assert.Equal(t, "SVIP", resolved["svip"])
	assert.Equal(t, "Auto", resolved["auto"])
	_, hasDefault := resolved["default"]
	assert.False(t, hasDefault)

	assert.True(t, GroupAllowed("vip", `["svip"]`, "vip"))
	assert.True(t, GroupAllowed("vip", `["svip"]`, "svip"))
	assert.False(t, GroupAllowed("vip", `["svip"]`, "default"))
	assert.True(t, IsUserSelectableGroupFor("vip", `["svip"]`, "svip"))
	assert.False(t, IsUserSelectableGroupFor("vip", `["svip"]`, "default"))
	assert.False(t, IsUserSelectableGroupFor("vip", `["svip"]`, "auto"))

	inherited := ResolveUserUsableGroups("vip", "")
	assert.Equal(t, "Default", inherited["default"])
	assert.Equal(t, "VIP", inherited["vip"])
}

func TestGetRequestAutoGroupsDoesNotFallBackAfterPermissionChange(t *testing.T) {
	configureRequestAutoGroupsTest(t)
	ctx := newRequestAutoGroupsContext()
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip"})
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default"}`))

	groups := GetRequestAutoGroups(ctx, "default")

	assert.Empty(t, groups)
}
