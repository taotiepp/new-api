import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Available balance': 'Available balance',
    'Back to Console': 'Back to Console',
    'Browse model names and optional summaries.':
      'Browse model names and optional summaries.',
    'Chat with models in a focused workspace.':
      'Chat with models in a focused workspace.',
    'Discover models, pricing, and capabilities in one place.':
      'Discover models, pricing, and capabilities in one place.',
    'Experience Center': 'Experience Center',
    'Manage credentials for API access.':
      'Manage credentials for API access.',
    'Request Logs': 'Request Logs',
    'Review your API request history.': 'Review your API request history.',
    'Search models by name or description...':
      'Search models by name or description...',
    'Track consumption and trends over time.':
      'Track consumption and trends over time.',
    'Try Online': 'Try Online',
    'User Portal': 'User Portal',
    'User Portal navigation': 'User Portal navigation',
  },
  zh: {
    'Available balance': '可用余额',
    'Back to Console': '返回控制台',
    'Browse model names and optional summaries.':
      '浏览模型名称与可选简介。',
    'Chat with models in a focused workspace.':
      '在专注的工作区中与模型对话。',
    'Discover models, pricing, and capabilities in one place.':
      '在一个地方浏览模型、价格与能力。',
    'Experience Center': '体验中心',
    'Manage credentials for API access.': '管理 API 访问凭证。',
    'Request Logs': '调用日志',
    'Review your API request history.': '查看 API 调用记录。',
    'Search models by name or description...':
      '按模型名称或简介搜索…',
    'Track consumption and trends over time.': '查看用量与趋势变化。',
    'Try Online': '在线体验',
    'User Portal': '用户端',
    'User Portal navigation': '用户端导航',
  },
  'zh-TW': {
    'Available balance': '可用餘額',
    'Back to Console': '返回控制台',
    'Browse model names and optional summaries.':
      '瀏覽模型名稱與可選簡介。',
    'Chat with models in a focused workspace.':
      '在專注的工作區中與模型對話。',
    'Discover models, pricing, and capabilities in one place.':
      '在同一處瀏覽模型、價格與能力。',
    'Experience Center': '體驗中心',
    'Manage credentials for API access.': '管理 API 存取憑證。',
    'Request Logs': '呼叫日誌',
    'Review your API request history.': '查看 API 呼叫記錄。',
    'Search models by name or description...':
      '依模型名稱或簡介搜尋…',
    'Track consumption and trends over time.': '查看用量與趨勢變化。',
    'Try Online': '線上體驗',
    'User Portal': '使用者入口',
    'User Portal navigation': '使用者入口導覽',
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
