package model

import (
	"errors"
	"math"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	supplierProfileTPMKey           = "tpm"
	supplierProfileRPMKey           = "rpm"
	supplierProfilePaymentMethodKey = "payment_method"
	supplierProfileCompanyEntityKey = "company_entity"
	maxSupplierRate                 = 1_000_000_000
	maxSupplierPaymentMethodRunes   = 80
	maxSupplierCompanyEntityRunes   = 120
)

// SupplierProfile is the commercial record shown in supplier management.
// Extra holds attributes that this build does not know about yet.
type SupplierProfile struct {
	TPM           *int           `json:"tpm,omitempty"`
	RPM           *int           `json:"rpm,omitempty"`
	PaymentMethod string         `json:"payment_method,omitempty"`
	CompanyEntity string         `json:"company_entity,omitempty"`
	Extra         map[string]any `json:"extra,omitempty"`
}

// SupplierProfileInput is the editable commercial profile. Nil clears a field.
type SupplierProfileInput struct {
	TPM           *int    `json:"tpm"`
	RPM           *int    `json:"rpm"`
	PaymentMethod *string `json:"payment_method"`
	CompanyEntity *string `json:"company_entity"`
}

func ParseSupplierProfile(raw string) (SupplierProfile, error) {
	profile := SupplierProfile{}
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || trimmed == "{}" || trimmed == "null" {
		return profile, nil
	}
	var object map[string]any
	if err := common.Unmarshal([]byte(trimmed), &object); err != nil {
		return profile, errors.New("supplier profile is invalid")
	}
	tpm, err := takeSupplierRate(object, supplierProfileTPMKey)
	if err != nil {
		return profile, err
	}
	rpm, err := takeSupplierRate(object, supplierProfileRPMKey)
	if err != nil {
		return profile, err
	}
	payment, err := takeSupplierText(object, supplierProfilePaymentMethodKey, maxSupplierPaymentMethodRunes)
	if err != nil {
		return profile, err
	}
	entity, err := takeSupplierText(object, supplierProfileCompanyEntityKey, maxSupplierCompanyEntityRunes)
	if err != nil {
		return profile, err
	}
	profile.TPM = tpm
	profile.RPM = rpm
	profile.PaymentMethod = payment
	profile.CompanyEntity = entity
	if len(object) > 0 {
		profile.Extra = object
	}
	return profile, nil
}

func ApplySupplierProfile(existing string, input SupplierProfileInput) (string, error) {
	if err := validateSupplierProfileInput(input); err != nil {
		return "", err
	}
	profile, err := ParseSupplierProfile(existing)
	if err != nil {
		return "", err
	}
	profile.TPM = input.TPM
	profile.RPM = input.RPM
	if input.PaymentMethod == nil {
		profile.PaymentMethod = ""
	} else {
		profile.PaymentMethod = strings.TrimSpace(*input.PaymentMethod)
	}
	if input.CompanyEntity == nil {
		profile.CompanyEntity = ""
	} else {
		profile.CompanyEntity = strings.TrimSpace(*input.CompanyEntity)
	}
	return marshalSupplierProfile(profile)
}

func UpdateChannelSupplier(id int, discount *float64, input SupplierProfileInput) error {
	if id <= 0 {
		return gorm.ErrRecordNotFound
	}
	if err := validateDiscountFields(discount, ""); err != nil {
		return err
	}
	var current Channel
	err := DB.Select("id", "supplier_profile").First(&current, "id = ?", id).Error
	if err != nil {
		return err
	}
	encoded, err := ApplySupplierProfile(current.SupplierProfile, input)
	if err != nil {
		return err
	}
	return DB.Model(&Channel{}).Where("id = ?", id).Updates(map[string]any{
		"discount":         discount,
		"supplier_profile": encoded,
	}).Error
}

func ListChannelSuppliers(keyword string, offset int, limit int) ([]Channel, int64, error) {
	query := DB.Model(&Channel{})
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		escaped := strings.NewReplacer("!", "!!", "%", "!%", "_", "!_").Replace(keyword)
		query = query.Where("name LIKE ? ESCAPE '!'", "%"+escaped+"%")
	}
	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var channels []Channel
	err := query.Session(&gorm.Session{}).
		Select("Id", "Name", "Status", "Group", "Discount", "SupplierProfile").
		Order("id desc").
		Offset(offset).
		Limit(limit).
		Find(&channels).Error
	if err != nil {
		return nil, 0, err
	}
	return channels, total, nil
}

func marshalSupplierProfile(profile SupplierProfile) (string, error) {
	object := map[string]any{}
	for key, value := range profile.Extra {
		object[key] = value
	}
	if profile.TPM != nil {
		object[supplierProfileTPMKey] = *profile.TPM
	}
	if profile.RPM != nil {
		object[supplierProfileRPMKey] = *profile.RPM
	}
	if profile.PaymentMethod != "" {
		object[supplierProfilePaymentMethodKey] = profile.PaymentMethod
	}
	if profile.CompanyEntity != "" {
		object[supplierProfileCompanyEntityKey] = profile.CompanyEntity
	}
	if len(object) == 0 {
		return "", nil
	}
	encoded, err := common.Marshal(object)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func validateSupplierProfileInput(input SupplierProfileInput) error {
	if err := validateSupplierRate(input.TPM); err != nil {
		return err
	}
	if err := validateSupplierRate(input.RPM); err != nil {
		return err
	}
	if input.PaymentMethod != nil && utf8.RuneCountInString(strings.TrimSpace(*input.PaymentMethod)) > maxSupplierPaymentMethodRunes {
		return errors.New("payment method is too long")
	}
	if input.CompanyEntity != nil && utf8.RuneCountInString(strings.TrimSpace(*input.CompanyEntity)) > maxSupplierCompanyEntityRunes {
		return errors.New("company entity is too long")
	}
	return nil
}

func validateSupplierRate(value *int) error {
	if value == nil {
		return nil
	}
	if *value < 0 || *value > maxSupplierRate {
		return errors.New("tpm and rpm must be between 0 and 1000000000")
	}
	return nil
}

func takeSupplierRate(object map[string]any, key string) (*int, error) {
	value, ok := object[key]
	if !ok || value == nil {
		delete(object, key)
		return nil, nil
	}
	delete(object, key)
	number, ok := value.(float64)
	if !ok || math.IsNaN(number) || math.IsInf(number, 0) || number != math.Trunc(number) {
		return nil, errors.New("supplier profile is invalid")
	}
	if number < 0 || number > maxSupplierRate {
		return nil, errors.New("supplier profile is invalid")
	}
	rate := int(number)
	return &rate, nil
}

func takeSupplierText(object map[string]any, key string, maxRunes int) (string, error) {
	value, ok := object[key]
	if !ok || value == nil {
		delete(object, key)
		return "", nil
	}
	delete(object, key)
	text, ok := value.(string)
	if !ok {
		return "", errors.New("supplier profile is invalid")
	}
	text = strings.TrimSpace(text)
	if utf8.RuneCountInString(text) > maxRunes {
		return "", errors.New("supplier profile is invalid")
	}
	return text, nil
}
