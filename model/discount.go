package model

import (
	"errors"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

func validateDiscountFields(discount *float64, modelDiscounts string) error {
	if discount != nil {
		if math.IsNaN(*discount) || math.IsInf(*discount, 0) || *discount < 0 {
			return errors.New("discount must be a finite number ≥ 0")
		}
	}
	if err := validateDiscountMap(modelDiscounts, "model_discounts"); err != nil {
		return err
	}
	return nil
}

func validateUserDiscountFields(discount *float64, modelDiscounts, groupDiscounts, groupModelDiscounts string) error {
	if err := validateDiscountFields(discount, modelDiscounts); err != nil {
		return err
	}
	if err := validateDiscountMap(groupDiscounts, "group_discounts"); err != nil {
		return err
	}
	raw := strings.TrimSpace(groupModelDiscounts)
	if raw == "" || raw == "{}" {
		return nil
	}
	parsed := make(map[string]map[string]float64)
	if err := common.Unmarshal([]byte(raw), &parsed); err != nil {
		return errors.New("group_model_discounts must be a JSON object of group to model discounts")
	}
	for group, models := range parsed {
		if strings.TrimSpace(group) == "" {
			return errors.New("group_model_discounts keys must be non-empty")
		}
		for name, ratio := range models {
			if strings.TrimSpace(name) == "" {
				return errors.New("group_model_discounts model keys must be non-empty")
			}
			if math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio < 0 {
				return errors.New("group_model_discounts values must be finite numbers ≥ 0")
			}
		}
	}
	return nil
}

func validateDiscountMap(rawJSON, field string) error {
	raw := strings.TrimSpace(rawJSON)
	if raw == "" || raw == "{}" {
		return nil
	}
	parsed := make(map[string]float64)
	if err := common.Unmarshal([]byte(raw), &parsed); err != nil {
		return errors.New(field + " must be a JSON object of name to discount")
	}
	for name, ratio := range parsed {
		if strings.TrimSpace(name) == "" {
			return errors.New(field + " keys must be non-empty")
		}
		if math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio < 0 {
			return errors.New(field + " values must be finite numbers ≥ 0")
		}
	}
	return nil
}

func validateUsableGroups(rawJSON string) error {
	raw := strings.TrimSpace(rawJSON)
	if raw == "" || raw == "null" {
		return nil
	}
	var parsed []string
	if err := common.Unmarshal([]byte(raw), &parsed); err != nil {
		return errors.New("usable_groups must be a JSON array of group names")
	}
	for _, name := range parsed {
		if strings.TrimSpace(name) == "" {
			return errors.New("usable_groups entries must be non-empty")
		}
	}
	return nil
}
