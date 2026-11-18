package model

import (
	"fmt"
	"slices"
	"strings"
)

const (
	maxGroupChannelAllowlistGroups   = 64
	maxGroupChannelAllowlistChannels = 128
)

// NormalizeGroupChannelAllowlist checks an administrator's per-group channel
// list. A missing group, or a group whose list is empty, keeps the default
// priority and weight selection. Every listed channel must currently belong
// to that group.
func NormalizeGroupChannelAllowlist(raw map[string][]int) (map[string][]int, error) {
	if len(raw) == 0 {
		return map[string][]int{}, nil
	}
	if len(raw) > maxGroupChannelAllowlistGroups {
		return nil, fmt.Errorf("too many group channel limits")
	}
	normalized := make(map[string][]int, len(raw))
	for group, ids := range raw {
		group = strings.TrimSpace(group)
		if group == "" || group == "auto" {
			return nil, fmt.Errorf("invalid group in channel allowlist")
		}
		if len(ids) > maxGroupChannelAllowlistChannels {
			return nil, fmt.Errorf("too many channels in group %s", group)
		}
		seen := make(map[int]struct{}, len(ids))
		cleaned := make([]int, 0, len(ids))
		for _, id := range ids {
			if id <= 0 {
				return nil, fmt.Errorf("invalid channel id %d", id)
			}
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			channel, err := GetChannelById(id, false)
			if err != nil {
				return nil, fmt.Errorf("channel %d not found", id)
			}
			if !slices.Contains(channel.GetGroups(), group) {
				return nil, fmt.Errorf("channel %d is not in group %s", id, group)
			}
			cleaned = append(cleaned, id)
		}
		if len(cleaned) == 0 {
			continue
		}
		slices.Sort(cleaned)
		normalized[group] = cleaned
	}
	return normalized, nil
}

// AllowSetForGroup returns the channels a user may use in one group.
// Nil means the group is unrestricted.
func AllowSetForGroup(raw map[string][]int, group string) map[int]struct{} {
	if len(raw) == 0 {
		return nil
	}
	ids := raw[strings.TrimSpace(group)]
	if len(ids) == 0 {
		return nil
	}
	allowed := make(map[int]struct{}, len(ids))
	for _, id := range ids {
		if id > 0 {
			allowed[id] = struct{}{}
		}
	}
	if len(allowed) == 0 {
		return nil
	}
	return allowed
}

func firstChannelAllowlist(allowed []map[int]struct{}) map[int]struct{} {
	if len(allowed) == 0 {
		return nil
	}
	return allowed[0]
}

// ListChannelGroupOptions returns channel identity and group membership for
// the operations screen. Keys are not loaded.
func ListChannelGroupOptions() ([]Channel, error) {
	var channels []Channel
	// Pass the bare column name so GORM quotes the reserved word for the active database.
	err := DB.Select("id", "name", "status", "group").Order("id").Find(&channels).Error
	return channels, err
}

func keepAllowedChannelIDs(ids []int, allowed map[int]struct{}) []int {
	if allowed == nil {
		return ids
	}
	kept := make([]int, 0, len(ids))
	for _, id := range ids {
		if _, ok := allowed[id]; ok {
			kept = append(kept, id)
		}
	}
	return kept
}
