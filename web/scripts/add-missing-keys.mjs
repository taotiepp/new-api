import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Account, balance, notifications, and language.':
      'Account, balance, notifications, and language.',
    'Add credit': 'Add credit',
    Adjustment: 'Adjustment',
    'Adjustment note': 'Adjustment note',
    'Adjustment saved': 'Adjustment saved',
    'Administrators issue invoices here. Test credit is deducted from the invoice automatically.':
      'Administrators issue invoices here. Test credit is deducted from the invoice automatically.',
    'Apply adjustment': 'Apply adjustment',
    'Billing details are required before an invoice can be issued.':
      'Billing details are required before an invoice can be issued.',
    Deduct: 'Deduct',
    'Enter an amount': 'Enter an amount',
    'Monthly adjustment': 'Monthly adjustment',
    'Regular balance': 'Regular balance',
    'Test credit': 'Test credit',
    'Test credit is a voucher. It is deducted automatically when an invoice is issued.':
      'Test credit is a voucher. It is deducted automatically when an invoice is issued.',
    'These billing details are printed on the invoice.':
      'These billing details are printed on the invoice.',
  },
  zh: {
    'Account, balance, notifications, and language.': '账号、余额、通知和语言。',
    'Add credit': '增加',
    Adjustment: '调账',
    'Adjustment note': '调账说明',
    'Adjustment saved': '调账已保存',
    'Administrators issue invoices here. Test credit is deducted from the invoice automatically.':
      '管理员在这里开具 invoice。测试额度会在开票时自动抵扣。',
    'Apply adjustment': '提交调账',
    'Billing details are required before an invoice can be issued.':
      '开具 invoice 前需要先填写开票信息。',
    Deduct: '扣减',
    'Enter an amount': '请输入金额',
    'Monthly adjustment': '月度调账',
    'Regular balance': '普通余额',
    'Test credit': '测试额度',
    'Test credit is a voucher. It is deducted automatically when an invoice is issued.':
      '测试额度是抵扣券，开具 invoice 时会自动从账单金额中扣掉。',
    'These billing details are printed on the invoice.':
      '这些开票信息会印在 invoice 上。',
  },
  'zh-TW': {
    'Account, balance, notifications, and language.': '帳號、餘額、通知和語言。',
    'Add credit': '增加',
    Adjustment: '調帳',
    'Adjustment note': '調帳說明',
    'Adjustment saved': '調帳已儲存',
    'Administrators issue invoices here. Test credit is deducted from the invoice automatically.':
      '管理員在這裡開具 invoice。測試額度會在開票時自動抵扣。',
    'Apply adjustment': '提交調帳',
    'Billing details are required before an invoice can be issued.':
      '開具 invoice 前需要先填寫開票資訊。',
    Deduct: '扣減',
    'Enter an amount': '請輸入金額',
    'Monthly adjustment': '月度調帳',
    'Regular balance': '普通餘額',
    'Test credit': '測試額度',
    'Test credit is a voucher. It is deducted automatically when an invoice is issued.':
      '測試額度是抵扣券，開具 invoice 時會自動從帳單金額中扣掉。',
    'These billing details are printed on the invoice.':
      '這些開票資訊會印在 invoice 上。',
  },
}

async function main() {
  let totalAdded = 0

  for (const [locale, trans] of Object.entries(newKeys)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    const json = JSON.parse(await fs.readFile(filePath, 'utf8'))

    let count = 0
    for (const [key, value] of Object.entries(trans)) {
      if (!Object.prototype.hasOwnProperty.call(json.translation, key)) {
        json.translation[key] = value
        count++
      } else if (json.translation[key] !== value) {
        json.translation[key] = value
        count++
      }
    }

    if (count > 0) {
      json.translation = Object.fromEntries(
        Object.entries(json.translation).sort(([a], [b]) => a.localeCompare(b))
      )
      await fs.writeFile(filePath, stableStringify(json), 'utf8')
    }

    console.log(`${locale}: ${count} translations applied`)
    totalAdded += count
  }

  console.log(`\nTotal: ${totalAdded} translations applied`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
