package model

import (
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
)

const (
	maxVirtualGroups       = 20
	maxVirtualGroupModels  = 100
	maxVirtualGroupNameLen = 64
	maxVirtualModelNameLen = 128
)

// VirtualGroup is a user-owned catalog. It has no ratio and no channels.
// Requests resolve to SourceGroup and SourceModel before channel selection
// and billing. Redirect, when set, replaces only the upstream model name.
type VirtualGroup struct {
	Name   string              `json:"name"`
	Models []VirtualGroupModel `json:"models"`
}

type VirtualGroupModel struct {
	Name        string `json:"name"`
	SourceGroup string `json:"source_group"`
	SourceModel string `json:"source_model"`
	Redirect    string `json:"redirect,omitempty"`
}

// VirtualGroupResolution is a request that selected a virtual group.
// ClientModel is the name used for token model limits. SourceGroup and
// SourceModel are used for channel selection and billing.
type VirtualGroupResolution struct {
	Handled     bool
	ClientModel string
	SourceGroup string
	SourceModel string
	Redirect    string
	RewriteFrom string
}

// VirtualGroupFailure is a validation or lookup error with an i18n message id.
type VirtualGroupFailure struct {
	MessageID string
	Data      map[string]any
}

func (e *VirtualGroupFailure) Error() string {
	if e == nil {
		return ""
	}
	return e.MessageID
}

func virtualGroupFailure(messageID string, data map[string]any) *VirtualGroupFailure {
	return &VirtualGroupFailure{MessageID: messageID, Data: data}
}

// ParseVirtualGroups decodes a user's virtual group catalog.
// Empty and null payloads are an empty catalog.
func ParseVirtualGroups(raw string) ([]VirtualGroup, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "null" {
		return nil, nil
	}
	var groups []VirtualGroup
	if err := common.Unmarshal([]byte(raw), &groups); err != nil {
		return nil, err
	}
	return groups, nil
}

// NormalizeVirtualGroups validates the catalog and returns the compact JSON
// stored on the user. An empty catalog is stored as an empty string.
func NormalizeVirtualGroups(raw string, sourceGroups, reservedNames map[string]struct{}) (string, *VirtualGroupFailure) {
	groups, err := ParseVirtualGroups(raw)
	if err != nil {
		return "", virtualGroupFailure(i18n.MsgInvalidParams, nil)
	}
	normalized, failure := normalizeVirtualGroupList(groups, sourceGroups, reservedNames)
	if failure != nil {
		return "", failure
	}
	if len(normalized) == 0 {
		return "", nil
	}
	encoded, err := common.Marshal(normalized)
	if err != nil {
		return "", virtualGroupFailure(i18n.MsgInvalidParams, nil)
	}
	return string(encoded), nil
}

func normalizeVirtualGroupList(groups []VirtualGroup, sourceGroups, reservedNames map[string]struct{}) ([]VirtualGroup, *VirtualGroupFailure) {
	if len(groups) > maxVirtualGroups {
		return nil, virtualGroupFailure(i18n.MsgVirtualGroupTooMany, map[string]any{"Max": maxVirtualGroups})
	}
	seenGroups := make(map[string]struct{}, len(groups))
	normalized := make([]VirtualGroup, 0, len(groups))
	for _, group := range groups {
		name := strings.TrimSpace(group.Name)
		if name == "" {
			return nil, virtualGroupFailure(i18n.MsgVirtualGroupNameEmpty, nil)
		}
		if utf8.RuneCountInString(name) > maxVirtualGroupNameLen || strings.Contains(name, "/") || strings.ContainsAny(name, " \t\r\n") {
			return nil, virtualGroupFailure(i18n.MsgVirtualGroupNameInvalid, map[string]any{"Name": name})
		}
		if _, reserved := reservedNames[name]; reserved || name == "auto" {
			return nil, virtualGroupFailure(i18n.MsgVirtualGroupNameReserved, map[string]any{"Name": name})
		}
		if _, taken := seenGroups[name]; taken {
			return nil, virtualGroupFailure(i18n.MsgVirtualGroupNameTaken, map[string]any{"Name": name})
		}
		seenGroups[name] = struct{}{}
		if len(group.Models) > maxVirtualGroupModels {
			return nil, virtualGroupFailure(i18n.MsgVirtualGroupModelsTooMany, map[string]any{
				"Group": name,
				"Max":   maxVirtualGroupModels,
			})
		}
		seenModels := make(map[string]struct{}, len(group.Models))
		models := make([]VirtualGroupModel, 0, len(group.Models))
		for _, item := range group.Models {
			modelName := strings.TrimSpace(item.Name)
			sourceGroup := strings.TrimSpace(item.SourceGroup)
			sourceModel := strings.TrimSpace(item.SourceModel)
			redirect := strings.TrimSpace(item.Redirect)
			if modelName == "" || sourceModel == "" {
				return nil, virtualGroupFailure(i18n.MsgVirtualGroupModelEmpty, map[string]any{"Group": name})
			}
			if utf8.RuneCountInString(modelName) > maxVirtualModelNameLen || utf8.RuneCountInString(sourceModel) > maxVirtualModelNameLen {
				return nil, virtualGroupFailure(i18n.MsgVirtualGroupModelEmpty, map[string]any{"Group": name})
			}
			if _, taken := seenModels[modelName]; taken {
				return nil, virtualGroupFailure(i18n.MsgVirtualGroupModelTaken, map[string]any{
					"Group": name,
					"Model": modelName,
				})
			}
			if _, allowed := sourceGroups[sourceGroup]; !allowed {
				return nil, virtualGroupFailure(i18n.MsgVirtualGroupSourceDenied, map[string]any{"Group": sourceGroup})
			}
			if utf8.RuneCountInString(redirect) > maxVirtualModelNameLen {
				return nil, virtualGroupFailure(i18n.MsgVirtualGroupRedirectInvalid, map[string]any{"Model": modelName})
			}
			seenModels[modelName] = struct{}{}
			models = append(models, VirtualGroupModel{
				Name:        modelName,
				SourceGroup: sourceGroup,
				SourceModel: sourceModel,
				Redirect:    redirect,
			})
		}
		normalized = append(normalized, VirtualGroup{Name: name, Models: models})
	}
	return normalized, nil
}

// FindVirtualGroup returns the named catalog entry.
func FindVirtualGroup(raw, name string) (VirtualGroup, bool) {
	name = strings.TrimSpace(name)
	if name == "" {
		return VirtualGroup{}, false
	}
	groups, err := ParseVirtualGroups(raw)
	if err != nil {
		return VirtualGroup{}, false
	}
	for _, group := range groups {
		if group.Name == name {
			return group, true
		}
	}
	return VirtualGroup{}, false
}

// ResolveVirtualGroupRequest maps a request onto a virtual group entry.
// A leading "virtual/model" segment wins. Otherwise the active group is used
// when it names one of the user's virtual groups. Real groups are left untouched.
func ResolveVirtualGroupRequest(raw, usingGroup, requestedModel string) (VirtualGroupResolution, *VirtualGroupFailure) {
	groups, err := ParseVirtualGroups(raw)
	if err != nil || len(groups) == 0 {
		return VirtualGroupResolution{}, nil
	}
	requestedModel = strings.TrimSpace(requestedModel)
	if requestedModel == "" {
		return VirtualGroupResolution{}, nil
	}
	if groupName, bareModel, ok := strings.Cut(requestedModel, "/"); ok {
		groupName = strings.TrimSpace(groupName)
		bareModel = strings.TrimSpace(bareModel)
		if group, found := virtualGroupByName(groups, groupName); found {
			entry, ok := virtualModelByName(group, bareModel)
			if !ok {
				return VirtualGroupResolution{}, virtualGroupFailure(i18n.MsgVirtualGroupModelMissing, map[string]any{
					"Group": groupName,
					"Model": bareModel,
				})
			}
			return virtualResolution(entry, bareModel, requestedModel), nil
		}
	}
	usingGroup = strings.TrimSpace(usingGroup)
	group, found := virtualGroupByName(groups, usingGroup)
	if !found {
		return VirtualGroupResolution{}, nil
	}
	entry, ok := virtualModelByName(group, requestedModel)
	if !ok {
		return VirtualGroupResolution{}, virtualGroupFailure(i18n.MsgVirtualGroupModelMissing, map[string]any{
			"Group": usingGroup,
			"Model": requestedModel,
		})
	}
	return virtualResolution(entry, requestedModel, requestedModel), nil
}

func virtualResolution(entry VirtualGroupModel, clientModel, rewriteFrom string) VirtualGroupResolution {
	return VirtualGroupResolution{
		Handled:     true,
		ClientModel: clientModel,
		SourceGroup: entry.SourceGroup,
		SourceModel: entry.SourceModel,
		Redirect:    entry.Redirect,
		RewriteFrom: rewriteFrom,
	}
}

func virtualGroupByName(groups []VirtualGroup, name string) (VirtualGroup, bool) {
	for _, group := range groups {
		if group.Name == name {
			return group, true
		}
	}
	return VirtualGroup{}, false
}

func virtualModelByName(group VirtualGroup, name string) (VirtualGroupModel, bool) {
	for _, item := range group.Models {
		if item.Name == name {
			return item, true
		}
	}
	return VirtualGroupModel{}, false
}

func UpdateUserVirtualGroups(userID int, raw string) error {
	if userID <= 0 {
		return virtualGroupFailure(i18n.MsgInvalidParams, nil)
	}
	return DB.Model(&User{}).Where("id = ?", userID).Update("virtual_groups", raw).Error
}
