package dto

import "strings"

// InvoiceParty is the address block printed on an invoice.
// The issuer (payee) and the bill-to party use the same fields.
type InvoiceParty struct {
	Name       string `json:"name,omitempty"`
	Line1      string `json:"line1,omitempty"`
	Line2      string `json:"line2,omitempty"`
	City       string `json:"city,omitempty"`
	Region     string `json:"region,omitempty"`
	PostalCode string `json:"postal_code,omitempty"`
	Country    string `json:"country,omitempty"`
	Phone      string `json:"phone,omitempty"`
	Email      string `json:"email,omitempty"`
}

func (p InvoiceParty) Normalized() InvoiceParty {
	return InvoiceParty{
		Name:       strings.TrimSpace(p.Name),
		Line1:      strings.TrimSpace(p.Line1),
		Line2:      strings.TrimSpace(p.Line2),
		City:       strings.TrimSpace(p.City),
		Region:     strings.TrimSpace(p.Region),
		PostalCode: strings.TrimSpace(p.PostalCode),
		Country:    strings.TrimSpace(p.Country),
		Phone:      strings.TrimSpace(p.Phone),
		Email:      strings.TrimSpace(p.Email),
	}
}

// Complete reports whether the party can be printed as a bill-to block.
// Line 2, region, and phone stay optional.
func (p InvoiceParty) Complete() bool {
	p = p.Normalized()
	return p.Name != "" && p.Line1 != "" && p.City != "" && p.PostalCode != "" && p.Country != "" && p.Email != ""
}
