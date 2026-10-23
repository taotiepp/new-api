package controller

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

func GetUserBills(c *gin.Context) {
	subject, ok := resolveScopedUser(c)
	if !ok {
		return
	}
	userId := subject.ID
	period := c.Query("period")
	if period == "" {
		now := time.Now()
		period = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local).Format("2006-01")
	}
	if _, _, ok := model.ParseBillPeriod(period); !ok {
		common.ApiErrorMsg(c, "invalid period")
		return
	}

	months := 6
	if raw := c.Query("months"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 12 {
			common.ApiErrorMsg(c, "invalid months")
			return
		}
		months = value
	}

	overview, err := model.LoadUserBillOverview(userId, period, months)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    overview,
	})
}

func billPeriod(c *gin.Context) (string, bool) {
	period := c.Query("period")
	if period == "" {
		period = model.CurrentBillPeriod(time.Now())
	}
	if _, _, ok := model.ParseBillPeriod(period); !ok {
		common.ApiErrorMsg(c, "invalid period")
		return "", false
	}
	return period, true
}

func ListUserInvoices(c *gin.Context) {
	subject, ok := resolveScopedUser(c)
	if !ok {
		return
	}
	period, ok := billPeriod(c)
	if !ok {
		return
	}
	history, err := model.ListUserInvoices(subject.ID, period)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := fillInvoiceParties(subject.ID, history); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, history)
}

func IssueUserInvoice(c *gin.Context) {
	subject, ok := resolveScopedUser(c)
	if !ok {
		return
	}
	period, ok := billPeriod(c)
	if !ok {
		return
	}
	issuer, billTo, message, err := invoicePartiesForUser(subject.ID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if message != "" {
		common.ApiErrorMsg(c, message)
		return
	}
	invoice, err := model.IssueUserInvoice(subject.ID, period, time.Now(), issuer, billTo)
	if errors.Is(err, model.ErrNothingToInvoice) {
		common.ApiErrorMsg(c, "nothing new to invoice")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, invoice)
}

func fillInvoiceParties(userId int, history *model.UserInvoiceHistory) error {
	user, err := model.GetUserById(userId, false)
	if err != nil {
		return err
	}
	billTo := user.GetSetting().InvoiceProfile.Normalized()
	history.BillTo = billTo
	history.BillToReady = billTo.Complete() && invoiceEmailOK(billTo.Email)
	history.Issuer = operation_setting.InvoiceIssuer()
	return nil
}
