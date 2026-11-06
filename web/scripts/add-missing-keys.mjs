import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Global prefill speed': 'Global prefill speed',
    'Leave empty to use the global prefill speed.':
      'Leave empty to use the global prefill speed.',
    'Prefill speed must be a positive integer.':
      'Prefill speed must be a positive integer.',
  },
  zh: {
    'Global prefill speed': '全局预填速度',
    'Leave empty to use the global prefill speed.':
      '留空则使用全局预填速度。',
    'Prefill speed must be a positive integer.': '预填速度必须是正整数。',
  },
  'zh-TW': {
    'Global prefill speed': '全域預填速度',
    'Leave empty to use the global prefill speed.':
      '留空則使用全域預填速度。',
    'Prefill speed must be a positive integer.': '預填速度必須是正整數。',
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
