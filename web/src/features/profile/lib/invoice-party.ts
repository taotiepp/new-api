/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { InvoiceParty } from '../types'

export function emptyInvoiceParty(): InvoiceParty {
  return {
    name: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postal_code: '',
    country: '',
    phone: '',
    email: '',
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function readInvoiceParty(value: unknown): InvoiceParty {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    name: text(source.name),
    line1: text(source.line1),
    line2: text(source.line2),
    city: text(source.city),
    region: text(source.region),
    postal_code: text(source.postal_code),
    country: text(source.country),
    phone: text(source.phone),
    email: text(source.email),
  }
}

export function invoicePartyReady(party: InvoiceParty): boolean {
  return (
    party.name !== '' &&
    party.line1 !== '' &&
    party.city !== '' &&
    party.postal_code !== '' &&
    party.country !== '' &&
    party.email.includes('@')
  )
}

export function invoiceAddressLines(party: InvoiceParty): string[] {
  const regionPostal = [party.region, party.postal_code]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ')
  const locality = [party.city.trim(), regionPostal]
    .filter((part) => part.length > 0)
    .join(', ')
  return [party.line1, party.line2, locality, party.country, party.phone, party.email]
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
