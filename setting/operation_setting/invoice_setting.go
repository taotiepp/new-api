package operation_setting

import (
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/config"
)

// InvoiceSetting is the payee printed on exported invoices.
type InvoiceSetting struct {
	Name       string `json:"name"`
	Line1      string `json:"line1"`
	Line2      string `json:"line2"`
	City       string `json:"city"`
	Region     string `json:"region"`
	PostalCode string `json:"postal_code"`
	Country    string `json:"country"`
	Phone      string `json:"phone"`
	Email      string `json:"email"`
}

var invoiceSetting = InvoiceSetting{}

func init() {
	config.GlobalConfig.Register("invoice_setting", &invoiceSetting)
}

func GetInvoiceSetting() *InvoiceSetting {
	return &invoiceSetting
}

func InvoiceIssuer() dto.InvoiceParty {
	return dto.InvoiceParty{
		Name:       invoiceSetting.Name,
		Line1:      invoiceSetting.Line1,
		Line2:      invoiceSetting.Line2,
		City:       invoiceSetting.City,
		Region:     invoiceSetting.Region,
		PostalCode: invoiceSetting.PostalCode,
		Country:    invoiceSetting.Country,
		Phone:      invoiceSetting.Phone,
		Email:      invoiceSetting.Email,
	}.Normalized()
}
