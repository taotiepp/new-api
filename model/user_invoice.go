package model

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ErrNothingToInvoice means every quota row in the period is already covered.
var ErrNothingToInvoice = errors.New("nothing new to invoice")

// UserInvoice is one issued statement. Later invoices for the same month
// cover only quota that was not on an earlier invoice.
type UserInvoice struct {
	Id             int               `json:"id"`
	UserId         int               `json:"user_id" gorm:"uniqueIndex:uk_user_invoice_seq,priority:1"`
	Period         string            `json:"period" gorm:"size:7;uniqueIndex:uk_user_invoice_seq,priority:2"`
	Sequence       int               `json:"sequence" gorm:"uniqueIndex:uk_user_invoice_seq,priority:3"`
	Number         string            `json:"number" gorm:"size:64;uniqueIndex"`
	Quota          int               `json:"quota"`
	Count          int               `json:"count"`
	TokenUsed      int               `json:"token_used"`
	CreatedAt      int64             `json:"created_at"`
	IssuerSnapshot string            `json:"-" gorm:"column:issuer;type:text"`
	BillToSnapshot string            `json:"-" gorm:"column:bill_to;type:text"`
	Items          []UserInvoiceItem `json:"items" gorm:"-"`
	Issuer         dto.InvoiceParty  `json:"issuer" gorm:"-"`
	BillTo         dto.InvoiceParty  `json:"bill_to" gorm:"-"`
}

type UserInvoiceItem struct {
	Id        int    `json:"id"`
	InvoiceId int    `json:"invoice_id" gorm:"index"`
	ModelName string `json:"model_name" gorm:"size:64"`
	Quota     int    `json:"quota"`
	Count     int    `json:"count"`
	TokenUsed int    `json:"token_used"`
}

// UserInvoiceAllocation stores how much of a quota_data row is already invoiced.
// The next invoice bills the difference, including a later increase of the same hour.
type UserInvoiceAllocation struct {
	Id          int `gorm:"primaryKey"`
	UserId      int `gorm:"uniqueIndex:uk_invoice_alloc,priority:1"`
	QuotaDataId int `gorm:"uniqueIndex:uk_invoice_alloc,priority:2"`
	Quota       int
	Count       int
	TokenUsed   int
}

type UserInvoiceHistory struct {
	Invoices    []UserInvoice    `json:"invoices"`
	Uninvoiced  UserInvoiceSlice `json:"uninvoiced"`
	Issuer      dto.InvoiceParty `json:"issuer"`
	BillTo      dto.InvoiceParty `json:"bill_to"`
	BillToReady bool             `json:"bill_to_ready"`
}

type UserInvoiceSlice struct {
	Quota     int               `json:"quota"`
	Count     int               `json:"count"`
	TokenUsed int               `json:"token_used"`
	Items     []UserInvoiceItem `json:"items"`
}

type invoiceDelta struct {
	row       QuotaData
	quota     int
	count     int
	tokenUsed int
}

func formatUserInvoiceNumber(period string, userId int, sequence int) string {
	return fmt.Sprintf("INV-%s-%04d-%02d", period, userId, sequence)
}

// invoiceQuery starts a new statement on db. lockForUpdate returns a session
// GORM will not clone, so a second query would keep quota_data as its table.
// A row lock on that session is applied again to the new statement.
func invoiceQuery(db *gorm.DB) *gorm.DB {
	ctx := context.Background()
	locked := false
	if db != nil && db.Statement != nil {
		if db.Statement.Context != nil {
			ctx = db.Statement.Context
		}
		_, locked = db.Statement.Clauses["FOR"]
	}
	session := db.Session(&gorm.Session{NewDB: true, Context: ctx})
	if locked {
		return session.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	return session
}

func collectInvoiceDeltas(db *gorm.DB, userId int, period string) ([]invoiceDelta, error) {
	start, end, ok := ParseBillPeriod(period)
	if !ok {
		return nil, fmt.Errorf("invalid period")
	}
	var rows []QuotaData
	if err := invoiceQuery(db).Where("user_id = ? AND created_at >= ? AND created_at <= ?", userId, start.Unix(), end.Unix()).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return []invoiceDelta{}, nil
	}

	ids := make([]int, 0, len(rows))
	for _, row := range rows {
		if row.Id > 0 {
			ids = append(ids, row.Id)
		}
	}
	allocated := map[int]UserInvoiceAllocation{}
	if len(ids) > 0 {
		var existing []UserInvoiceAllocation
		if err := invoiceQuery(db).Where("user_id = ? AND quota_data_id IN ?", userId, ids).Find(&existing).Error; err != nil {
			return nil, err
		}
		for _, item := range existing {
			allocated[item.QuotaDataId] = item
		}
	}

	deltas := make([]invoiceDelta, 0)
	for _, row := range rows {
		prev := allocated[row.Id]
		delta := invoiceDelta{
			row:       row,
			quota:     row.Quota - prev.Quota,
			count:     row.Count - prev.Count,
			tokenUsed: row.TokenUsed - prev.TokenUsed,
		}
		if delta.quota == 0 && delta.count == 0 && delta.tokenUsed == 0 {
			continue
		}
		deltas = append(deltas, delta)
	}
	return deltas, nil
}

func summarizeInvoiceDeltas(deltas []invoiceDelta) UserInvoiceSlice {
	byModel := map[string]*UserInvoiceItem{}
	slice := UserInvoiceSlice{Items: []UserInvoiceItem{}}
	for _, delta := range deltas {
		item := byModel[delta.row.ModelName]
		if item == nil {
			item = &UserInvoiceItem{ModelName: delta.row.ModelName}
			byModel[delta.row.ModelName] = item
		}
		item.Quota += delta.quota
		item.Count += delta.count
		item.TokenUsed += delta.tokenUsed
		slice.Quota += delta.quota
		slice.Count += delta.count
		slice.TokenUsed += delta.tokenUsed
	}
	for _, item := range byModel {
		slice.Items = append(slice.Items, *item)
	}
	slices.SortFunc(slice.Items, func(a, b UserInvoiceItem) int {
		if n := cmp.Compare(b.Quota, a.Quota); n != 0 {
			return n
		}
		return cmp.Compare(a.ModelName, b.ModelName)
	})
	return slice
}

func attachInvoiceItems(db *gorm.DB, invoices []UserInvoice) error {
	if len(invoices) == 0 {
		return nil
	}
	ids := make([]int, 0, len(invoices))
	index := make(map[int]int, len(invoices))
	for i := range invoices {
		invoices[i].Items = []UserInvoiceItem{}
		ids = append(ids, invoices[i].Id)
		index[invoices[i].Id] = i
	}
	var items []UserInvoiceItem
	if err := db.Where("invoice_id IN ?", ids).Order("quota DESC").Find(&items).Error; err != nil {
		return err
	}
	for _, item := range items {
		position, ok := index[item.InvoiceId]
		if !ok {
			continue
		}
		invoices[position].Items = append(invoices[position].Items, item)
	}
	return nil
}

func ListUserInvoices(userId int, period string) (*UserInvoiceHistory, error) {
	if _, _, ok := ParseBillPeriod(period); !ok {
		return nil, fmt.Errorf("invalid period")
	}
	invoices := make([]UserInvoice, 0)
	if err := DB.Where("user_id = ? AND period = ?", userId, period).
		Order("sequence DESC").
		Find(&invoices).Error; err != nil {
		return nil, err
	}
	if err := attachInvoiceItems(DB, invoices); err != nil {
		return nil, err
	}
	for i := range invoices {
		invoices[i].Issuer = decodeInvoiceParty(invoices[i].IssuerSnapshot)
		invoices[i].BillTo = decodeInvoiceParty(invoices[i].BillToSnapshot)
	}
	deltas, err := collectInvoiceDeltas(DB, userId, period)
	if err != nil {
		return nil, err
	}
	return &UserInvoiceHistory{
		Invoices:   invoices,
		Uninvoiced: summarizeInvoiceDeltas(deltas),
	}, nil
}

func IssueUserInvoice(userId int, period string, now time.Time, issuer dto.InvoiceParty, billTo dto.InvoiceParty) (*UserInvoice, error) {
	if _, _, ok := ParseBillPeriod(period); !ok {
		return nil, fmt.Errorf("invalid period")
	}
	var issued *UserInvoice
	err := DB.Transaction(func(tx *gorm.DB) error {
		deltas, err := collectInvoiceDeltas(lockForUpdate(tx), userId, period)
		if err != nil {
			return err
		}
		if len(deltas) == 0 {
			return ErrNothingToInvoice
		}
		summary := summarizeInvoiceDeltas(deltas)

		var last UserInvoice
		if err := lockForUpdate(tx).
			Where("user_id = ? AND period = ?", userId, period).
			Order("sequence DESC").
			Limit(1).
			Find(&last).Error; err != nil {
			return err
		}
		sequence := 1
		if last.Id > 0 {
			sequence = last.Sequence + 1
		}
		issuer = issuer.Normalized()
		billTo = billTo.Normalized()
		issuerRaw, err := common.Marshal(issuer)
		if err != nil {
			return err
		}
		billToRaw, err := common.Marshal(billTo)
		if err != nil {
			return err
		}
		invoice := &UserInvoice{
			UserId:         userId,
			Period:         period,
			Sequence:       sequence,
			Number:         formatUserInvoiceNumber(period, userId, sequence),
			Quota:          summary.Quota,
			Count:          summary.Count,
			TokenUsed:      summary.TokenUsed,
			CreatedAt:      now.Unix(),
			IssuerSnapshot: string(issuerRaw),
			BillToSnapshot: string(billToRaw),
			Issuer:         issuer,
			BillTo:         billTo,
		}
		if err := tx.Create(invoice).Error; err != nil {
			return err
		}
		for i := range summary.Items {
			summary.Items[i].InvoiceId = invoice.Id
		}
		if err := tx.Create(&summary.Items).Error; err != nil {
			return err
		}
		for _, delta := range deltas {
			var current UserInvoiceAllocation
			err := invoiceQuery(tx).Where("user_id = ? AND quota_data_id = ?", userId, delta.row.Id).
				Limit(1).
				Find(&current).Error
			if err != nil {
				return err
			}
			if current.Id > 0 {
				if err := tx.Model(&UserInvoiceAllocation{}).Where("id = ?", current.Id).
					Updates(map[string]any{
						"quota":      delta.row.Quota,
						"count":      delta.row.Count,
						"token_used": delta.row.TokenUsed,
					}).Error; err != nil {
					return err
				}
				continue
			}
			if err := tx.Create(&UserInvoiceAllocation{
				UserId:      userId,
				QuotaDataId: delta.row.Id,
				Quota:       delta.row.Quota,
				Count:       delta.row.Count,
				TokenUsed:   delta.row.TokenUsed,
			}).Error; err != nil {
				return err
			}
		}
		invoice.Items = summary.Items
		issued = invoice
		return nil
	})
	if err != nil {
		return nil, err
	}
	return issued, nil
}

func decodeInvoiceParty(raw string) dto.InvoiceParty {
	if raw == "" {
		return dto.InvoiceParty{}
	}
	var party dto.InvoiceParty
	if err := common.UnmarshalJsonStr(raw, &party); err != nil {
		return dto.InvoiceParty{}
	}
	return party.Normalized()
}
