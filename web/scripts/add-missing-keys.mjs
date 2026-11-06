import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Add one second for each group of this many estimated input tokens.':
      'Add one second for each group of this many estimated input tokens.',
    'Base seconds': 'Base seconds',
    'Before any text, reasoning, or tool output, fail the stream after the minimum of the cap and base plus input tokens divided by the divisor plus reasoning-effort seconds. Retry only if the client has not received any response bytes.':
      'Before any text, reasoning, or tool output, fail the stream after the minimum of the cap and base plus input tokens divided by the divisor plus reasoning-effort seconds. Retry only if the client has not received any response bytes.',
    'Extra seconds for low, medium, and high reasoning effort. xhigh and max use the high value.':
      'Extra seconds for low, medium, and high reasoning effort. xhigh and max use the high value.',
    'First-progress timeout': 'First-progress timeout',
    'High reasoning-effort seconds': 'High reasoning-effort seconds',
    'Input token divisor': 'Input token divisor',
    'Low reasoning-effort seconds': 'Low reasoning-effort seconds',
    'Maximum seconds': 'Maximum seconds',
    'Medium reasoning-effort seconds': 'Medium reasoning-effort seconds',
    'Starting wait for every streaming request.':
      'Starting wait for every streaming request.',
    'The calculated wait cannot exceed this value or the streaming idle timeout.':
      'The calculated wait cannot exceed this value or the streaming idle timeout.',
    'The cap must be at least the base seconds.':
      'The cap must be at least the base seconds.',
  },
  zh: {
    'Add one second for each group of this many estimated input tokens.':
      '每这么多估算输入 token 增加 1 秒。',
    'Base seconds': '基础秒数',
    'Before any text, reasoning, or tool output, fail the stream after the minimum of the cap and base plus input tokens divided by the divisor plus reasoning-effort seconds. Retry only if the client has not received any response bytes.':
      '在出现文本、推理或工具输出之前，按上限与“基础秒数 + 输入 token / 除数 + 推理强度附加秒数”中的较小值判定失败。只有客户端还没收到任何响应正文时才会重试。',
    'Extra seconds for low, medium, and high reasoning effort. xhigh and max use the high value.':
      '按 low、medium、high 推理强度追加的秒数。xhigh 和 max 使用 high 的值。',
    'First-progress timeout': '首个进展时限',
    'High reasoning-effort seconds': '高推理强度附加秒数',
    'Input token divisor': '输入 token 除数',
    'Low reasoning-effort seconds': '低推理强度附加秒数',
    'Maximum seconds': '上限秒数',
    'Medium reasoning-effort seconds': '中推理强度附加秒数',
    'Starting wait for every streaming request.':
      '每个流式请求的起始等待时间。',
    'The calculated wait cannot exceed this value or the streaming idle timeout.':
      '计算结果不能超过这个值，也不能超过流式空闲超时。',
    'The cap must be at least the base seconds.': '上限不能小于基础秒数。',
  },
  'zh-TW': {
    'Add one second for each group of this many estimated input tokens.':
      '每這麼多估算輸入 token 增加 1 秒。',
    'Base seconds': '基礎秒數',
    'Before any text, reasoning, or tool output, fail the stream after the minimum of the cap and base plus input tokens divided by the divisor plus reasoning-effort seconds. Retry only if the client has not received any response bytes.':
      '在出現文字、推理或工具輸出之前，按上限與「基礎秒數 + 輸入 token / 除數 + 推理強度附加秒數」中的較小值判定失敗。只有客戶端還沒收到任何回應正文時才會重試。',
    'Extra seconds for low, medium, and high reasoning effort. xhigh and max use the high value.':
      '按 low、medium、high 推理強度追加的秒數。xhigh 和 max 使用 high 的值。',
    'First-progress timeout': '首個進展時限',
    'High reasoning-effort seconds': '高推理強度附加秒數',
    'Input token divisor': '輸入 token 除數',
    'Low reasoning-effort seconds': '低推理強度附加秒數',
    'Maximum seconds': '上限秒數',
    'Medium reasoning-effort seconds': '中推理強度附加秒數',
    'Starting wait for every streaming request.':
      '每個流式請求的起始等待時間。',
    'The calculated wait cannot exceed this value or the streaming idle timeout.':
      '計算結果不能超過這個值，也不能超過流式空閒逾時。',
    'The cap must be at least the base seconds.': '上限不能小於基礎秒數。',
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
