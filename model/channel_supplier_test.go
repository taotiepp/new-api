package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUpdateChannelSupplierKeepsUnknownProfileFields(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}))
	original := DB
	DB = db
	t.Cleanup(func() { DB = original })

	discount := 0.8
	channel := &Channel{
		Name:            "openai-main",
		Group:           "vip,default",
		Key:             "secret",
		Discount:        &discount,
		SupplierProfile: `{"tpm":10,"payment_method":"old","contract_no":"A-1"}`,
	}
	require.NoError(t, db.Create(channel).Error)

	rpm := 20
	payment := "prepaid"
	entity := "Acme Ltd"
	err = UpdateChannelSupplier(channel.Id, nil, SupplierProfileInput{
		RPM:           &rpm,
		PaymentMethod: &payment,
		CompanyEntity: &entity,
	})
	require.NoError(t, err)

	var stored Channel
	require.NoError(t, db.First(&stored, channel.Id).Error)
	assert.Nil(t, stored.Discount)
	assert.Equal(t, "secret", stored.Key)
	profile, err := ParseSupplierProfile(stored.SupplierProfile)
	require.NoError(t, err)
	assert.Nil(t, profile.TPM)
	require.NotNil(t, profile.RPM)
	assert.Equal(t, 20, *profile.RPM)
	assert.Equal(t, "prepaid", profile.PaymentMethod)
	assert.Equal(t, "Acme Ltd", profile.CompanyEntity)
	assert.Equal(t, "A-1", profile.Extra["contract_no"])

	rows, total, err := ListChannelSuppliers("openai", 0, 20)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, rows, 1)
	assert.Equal(t, channel.Id, rows[0].Id)
	assert.Equal(t, "openai-main", rows[0].Name)
	assert.Equal(t, []string{"vip", "default"}, rows[0].GetGroups())
	assert.Empty(t, rows[0].Key)

	negative := -1
	err = UpdateChannelSupplier(channel.Id, &discount, SupplierProfileInput{TPM: &negative})
	require.EqualError(t, err, "tpm and rpm must be between 0 and 1000000000")
	require.NoError(t, db.First(&stored, channel.Id).Error)
	assert.Nil(t, stored.Discount)
}
