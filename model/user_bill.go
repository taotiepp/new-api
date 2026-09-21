package model

import (
	"cmp"
	"fmt"
	"slices"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// UserBillItem is a closed-month statement line: one user, one calendar month, one model.
type UserBillItem struct {
	Id        int    `json:"id"`
	UserId    int    `json:"user_id" gorm:"uniqueIndex:uk_user_bill_item,priority:1"`
	Period    string `json:"period" gorm:"size:7;uniqueIndex:uk_user_bill_item,priority:2"`
	ModelName string `json:"model_name" gorm:"size:64;uniqueIndex:uk_user_bill_item,priority:3"`
	Quota     int    `json:"quota"`
	Count     int    `json:"count"`
	TokenUsed int    `json:"token_used"`
	UpdatedAt int64  `json:"updated_at"`
}

type UserBillMonthTotal struct {
	Period    string `json:"period"`
	Quota     int    `json:"quota"`
	Count     int    `json:"count"`
	TokenUsed int    `json:"token_used"`
}

type UserBillOverview struct {
	Period    string               `json:"period"`
	Quota     int                  `json:"quota"`
	Count     int                  `json:"count"`
	TokenUsed int                  `json:"token_used"`
	Items     []*UserBillItem      `json:"items"`
	Trend     []UserBillMonthTotal `json:"trend"`
}

func ParseBillPeriod(period string) (time.Time, time.Time, bool) {
	start, err := time.ParseInLocation("2006-01", period, time.Local)
	if err != nil {
		return time.Time{}, time.Time{}, false
	}
	start = time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, time.Local)
	end := start.AddDate(0, 1, 0).Add(-time.Second)
	return start, end, true
}

func CurrentBillPeriod(now time.Time) string {
	return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01")
}

func ListRecentBillPeriods(now time.Time, count int) []string {
	if count < 1 {
		count = 1
	}
	cursor := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	periods := make([]string, 0, count)
	for offset := count - 1; offset >= 0; offset-- {
		periods = append(periods, cursor.AddDate(0, -offset, 0).Format("2006-01"))
	}
	return periods
}

func AggregateQuotaByModel(userId int, period string) ([]*UserBillItem, error) {
	start, end, ok := ParseBillPeriod(period)
	if !ok {
		return nil, fmt.Errorf("invalid period")
	}
	rows, err := GetQuotaDataByUserId(userId, start.Unix(), end.Unix())
	if err != nil {
		return nil, err
	}

	totals := make(map[string]*UserBillItem)
	updatedAt := time.Now().Unix()
	for _, row := range rows {
		item := totals[row.ModelName]
		if item == nil {
			item = &UserBillItem{
				UserId:    userId,
				Period:    period,
				ModelName: row.ModelName,
				UpdatedAt: updatedAt,
			}
			totals[row.ModelName] = item
		}
		item.Quota += row.Quota
		item.Count += row.Count
		item.TokenUsed += row.TokenUsed
	}

	items := make([]*UserBillItem, 0, len(totals))
	for _, item := range totals {
		items = append(items, item)
	}
	slices.SortFunc(items, func(a, b *UserBillItem) int {
		if n := cmp.Compare(b.Quota, a.Quota); n != 0 {
			return n
		}
		return cmp.Compare(a.ModelName, b.ModelName)
	})
	return items, nil
}

func SyncUserBillPeriod(userId int, period string) error {
	items, err := AggregateQuotaByModel(userId, period)
	if err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND period = ?", userId, period).Delete(&UserBillItem{}).Error; err != nil {
			return err
		}
		if len(items) == 0 {
			return nil
		}
		return tx.Create(&items).Error
	})
}

func GetUserBillItems(userId int, period string) ([]*UserBillItem, error) {
	items := make([]*UserBillItem, 0)
	err := DB.Where("user_id = ? AND period = ?", userId, period).
		Order("quota DESC").
		Find(&items).Error
	return items, err
}

func SumUserBillsByPeriod(userId int, periods []string) ([]UserBillMonthTotal, error) {
	if len(periods) == 0 {
		return []UserBillMonthTotal{}, nil
	}
	totals := make([]UserBillMonthTotal, 0)
	err := DB.Model(&UserBillItem{}).
		Select("period, sum(quota) as quota, sum(count) as count, sum(token_used) as token_used").
		Where("user_id = ? AND period IN ?", userId, periods).
		Group("period").
		Find(&totals).Error
	return totals, err
}

func LoadUserBillOverview(userId int, period string, months int) (*UserBillOverview, error) {
	now := time.Now()
	current := CurrentBillPeriod(now)
	trendPeriods := ListRecentBillPeriods(now, months)

	var items []*UserBillItem
	var err error
	if period == current {
		items, err = AggregateQuotaByModel(userId, period)
	} else {
		items, err = GetUserBillItems(userId, period)
	}
	if err != nil {
		return nil, err
	}

	closedPeriods := make([]string, 0, len(trendPeriods))
	for _, item := range trendPeriods {
		if item != current {
			closedPeriods = append(closedPeriods, item)
		}
	}
	sums, err := SumUserBillsByPeriod(userId, closedPeriods)
	if err != nil {
		return nil, err
	}
	byPeriod := make(map[string]UserBillMonthTotal, len(sums)+1)
	for _, total := range sums {
		byPeriod[total.Period] = total
	}
	if slices.Contains(trendPeriods, current) {
		live := items
		if period != current {
			live, err = AggregateQuotaByModel(userId, current)
			if err != nil {
				return nil, err
			}
		}
		total := UserBillMonthTotal{Period: current}
		for _, item := range live {
			total.Quota += item.Quota
			total.Count += item.Count
			total.TokenUsed += item.TokenUsed
		}
		byPeriod[current] = total
	}

	trend := make([]UserBillMonthTotal, 0, len(trendPeriods))
	for _, item := range trendPeriods {
		total, ok := byPeriod[item]
		if !ok {
			total = UserBillMonthTotal{Period: item}
		}
		trend = append(trend, total)
	}

	overview := &UserBillOverview{
		Period: period,
		Items:  items,
		Trend:  trend,
	}
	for _, item := range items {
		overview.Quota += item.Quota
		overview.Count += item.Count
		overview.TokenUsed += item.TokenUsed
	}
	return overview, nil
}

func GenerateClosedUserBills(now time.Time) error {
	current := CurrentBillPeriod(now)
	periods := ListRecentBillPeriods(now, 12)
	lastClosed := ""
	if len(periods) >= 2 {
		lastClosed = periods[len(periods)-2]
	}
	for _, period := range periods {
		if period == current {
			continue
		}
		start, end, ok := ParseBillPeriod(period)
		if !ok {
			continue
		}
		var userIDs []int
		if err := DB.Table("quota_data").
			Distinct("user_id").
			Where("created_at >= ? AND created_at <= ?", start.Unix(), end.Unix()).
			Pluck("user_id", &userIDs).Error; err != nil {
			return err
		}
		for _, userId := range userIDs {
			if period != lastClosed {
				var n int64
				if err := DB.Model(&UserBillItem{}).
					Where("user_id = ? AND period = ?", userId, period).
					Count(&n).Error; err != nil {
					return err
				}
				if n > 0 {
					continue
				}
			}
			if err := SyncUserBillPeriod(userId, period); err != nil {
				return err
			}
		}
	}
	return nil
}

func UpdateUserBills() {
	for {
		if common.IsMasterNode {
			common.SysLog("generating closed-month user bills...")
			if err := GenerateClosedUserBills(time.Now()); err != nil {
				common.SysError("failed to generate closed-month user bills: " + err.Error())
			}
		}
		time.Sleep(time.Hour)
	}
}
