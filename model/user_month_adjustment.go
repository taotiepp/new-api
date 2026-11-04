package model

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	BalanceBucketRegular = "regular"
	BalanceBucketTest    = "test"
)

var (
	ErrInvalidMonthAdjustment = errors.New("invalid month adjustment")
	ErrMonthAdjustmentBalance = errors.New("adjustment exceeds the balance")
)

// UserMonthAdjustment is one administrator correction for a calendar month.
// Quota is a signed balance delta: positive credits the bucket, negative charges it.
// Regular adjustments are copied onto the next invoice. Test credit is a voucher
// and is applied when that invoice is issued, not as its own invoice line.
type UserMonthAdjustment struct {
	Id        int    `json:"id"`
	UserId    int    `json:"user_id" gorm:"index:idx_user_month_adjustment,priority:1"`
	Period    string `json:"period" gorm:"size:7;index:idx_user_month_adjustment,priority:2"`
	Bucket    string `json:"bucket" gorm:"size:16"`
	Quota     int    `json:"quota"`
	Note      string `json:"note" gorm:"size:80"`
	AdminId   int    `json:"admin_id"`
	InvoiceId int    `json:"invoice_id" gorm:"index"`
	CreatedAt int64  `json:"created_at"`
}

func ListUserMonthAdjustments(userId int, period string) ([]UserMonthAdjustment, error) {
	rows := make([]UserMonthAdjustment, 0)
	err := DB.Where("user_id = ? AND period = ?", userId, period).Order("id DESC").Find(&rows).Error
	return rows, err
}

func listOpenRegularAdjustments(db *gorm.DB, userId int, period string) ([]UserMonthAdjustment, error) {
	rows := make([]UserMonthAdjustment, 0)
	err := invoiceQuery(db).
		Where("user_id = ? AND period = ? AND bucket = ? AND invoice_id = ?", userId, period, BalanceBucketRegular, 0).
		Order("id ASC").
		Find(&rows).Error
	return rows, err
}

func CreateUserMonthAdjustment(adminID, operatorRole, userID int, period, bucket string, quota int, note string) (*UserMonthAdjustment, error) {
	note = strings.TrimSpace(note)
	if adminID <= 0 || userID <= 0 || quota == 0 || utf8.RuneCountInString(note) == 0 || utf8.RuneCountInString(note) > 80 {
		return nil, ErrInvalidMonthAdjustment
	}
	if bucket != BalanceBucketRegular && bucket != BalanceBucketTest {
		return nil, ErrInvalidMonthAdjustment
	}
	if _, _, ok := ParseBillPeriod(period); !ok {
		return nil, ErrInvalidMonthAdjustment
	}
	if quota > common.MaxWalletQuota || quota < -common.MaxWalletQuota {
		return nil, ErrWalletQuotaLimitExceeded
	}

	var saved *UserMonthAdjustment
	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).First(&user, userID).Error; err != nil {
			return err
		}
		if operatorRole != common.RoleRootUser && user.Role >= operatorRole && user.Id != adminID {
			return ErrUserQuotaPermission
		}
		current := int64(user.Quota)
		column := "quota"
		if bucket == BalanceBucketTest {
			current = int64(user.TestQuota)
			column = "test_quota"
		}
		next := current + int64(quota)
		if next < 0 {
			return ErrMonthAdjustmentBalance
		}
		if next > int64(common.MaxWalletQuota) {
			return ErrWalletQuotaLimitExceeded
		}
		if err := tx.Model(&User{}).Where("id = ?", userID).Update(column, int(next)).Error; err != nil {
			return err
		}
		row := &UserMonthAdjustment{
			UserId:    userID,
			Period:    period,
			Bucket:    bucket,
			Quota:     quota,
			Note:      note,
			AdminId:   adminID,
			CreatedAt: time.Now().Unix(),
		}
		if err := tx.Create(row).Error; err != nil {
			return err
		}
		saved = row
		return nil
	})
	if err != nil {
		return nil, err
	}
	if bucket == BalanceBucketRegular {
		if err := cacheIncrUserQuota(userID, int64(quota)); err != nil {
			common.SysError("failed to sync month adjustment to user quota cache: " + err.Error())
		}
	}
	return saved, nil
}
