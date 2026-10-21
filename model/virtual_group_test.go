package model

import (
	"testing"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeVirtualGroupsRejectsReservedAndDuplicateNames(t *testing.T) {
	source := map[string]struct{}{"vip": {}, "default": {}}
	reserved := map[string]struct{}{"auto": {}, "vip": {}, "default": {}}

	_, failure := NormalizeVirtualGroups(`[{"name":"vip","models":[]}]`, source, reserved)
	require.NotNil(t, failure)
	assert.Equal(t, i18n.MsgVirtualGroupNameReserved, failure.MessageID)

	_, failure = NormalizeVirtualGroups(`[{"name":"coding","models":[]},{"name":"coding","models":[]}]`, source, reserved)
	require.NotNil(t, failure)
	assert.Equal(t, i18n.MsgVirtualGroupNameTaken, failure.MessageID)

	raw, failure := NormalizeVirtualGroups(`[
		{"name":" coding ","models":[
			{"name":"my-gpt","source_group":"vip","source_model":"gpt-4o","redirect":"gpt-4o-2024-08-06"},
			{"name":"gpt-4o","source_group":"default","source_model":"gpt-4o"}
		]}
	]`, source, reserved)
	require.Nil(t, failure)
	group, ok := FindVirtualGroup(raw, "coding")
	require.True(t, ok)
	require.Len(t, group.Models, 2)
	assert.Equal(t, "gpt-4o", group.Models[0].SourceModel)
	assert.Equal(t, "gpt-4o-2024-08-06", group.Models[0].Redirect)
}

func TestResolveVirtualGroupRequestUsesSourceGroupAndModel(t *testing.T) {
	raw := `[{"name":"coding","models":[{"name":"my-gpt","source_group":"vip","source_model":"gpt-4o","redirect":"gpt-4o-mini"}]}]`

	resolved, failure := ResolveVirtualGroupRequest(raw, "default", "coding/my-gpt")
	require.Nil(t, failure)
	assert.True(t, resolved.Handled)
	assert.Equal(t, "my-gpt", resolved.ClientModel)
	assert.Equal(t, "vip", resolved.SourceGroup)
	assert.Equal(t, "gpt-4o", resolved.SourceModel)
	assert.Equal(t, "gpt-4o-mini", resolved.Redirect)

	resolved, failure = ResolveVirtualGroupRequest(raw, "coding", "my-gpt")
	require.Nil(t, failure)
	assert.Equal(t, "vip", resolved.SourceGroup)
	assert.Equal(t, "gpt-4o", resolved.SourceModel)

	resolved, failure = ResolveVirtualGroupRequest(raw, "default", "gpt-4o")
	require.Nil(t, failure)
	assert.False(t, resolved.Handled)

	_, failure = ResolveVirtualGroupRequest(raw, "coding", "missing")
	require.NotNil(t, failure)
	assert.Equal(t, i18n.MsgVirtualGroupModelMissing, failure.MessageID)
}
