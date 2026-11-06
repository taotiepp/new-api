import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Assumed input-token prefill speed. One second is allowed for each group of this many tokens. Use a lower value for slower models.':
      'Assumed input-token prefill speed. One second is allowed for each group of this many tokens. Use a lower value for slower models.',
    'Before any text, reasoning, or tool output, fail the stream after the minimum of the cap and base plus input tokens divided by the prefill speed plus reasoning-effort seconds. Retry only if the client has not received any response bytes.':
      'Before any text, reasoning, or tool output, fail the stream after the minimum of the cap and base plus input tokens divided by the prefill speed plus reasoning-effort seconds. Retry only if the client has not received any response bytes.',
    'Prefill tokens per second': 'Prefill tokens per second',
  },
  zh: {
    'Assumed input-token prefill speed. One second is allowed for each group of this many tokens. Use a lower value for slower models.':
      '按这个速度消化输入 token，每这么多 token 允许 1 秒。模型越慢，这个值要设得越小。',
    'Before any text, reasoning, or tool output, fail the stream after the minimum of the cap and base plus input tokens divided by the prefill speed plus reasoning-effort seconds. Retry only if the client has not received any response bytes.':
      '在出现文本、推理或工具输出之前，按上限与“基础秒数 + 输入 token / 预填速度 + 推理强度附加秒数”中的较小值判定失败。只有客户端还没收到任何响应正文时才会重试。',
    'Prefill tokens per second': '预填每秒 token 数',
  },
  'zh-TW': {
    'Assumed input-token prefill speed. One second is allowed for each group of this many tokens. Use a lower value for slower models.':
      '按這個速度消化輸入 token，每這麼多 token 允許 1 秒。模型越慢，這個值要設得越小。',
    'Before any text, reasoning, or tool output, fail the stream after the minimum of the cap and base plus input tokens divided by the prefill speed plus reasoning-effort seconds. Retry only if the client has not received any response bytes.':
      '在出現文字、推理或工具輸出之前，按上限與「基礎秒數 + 輸入 token / 預填速度 + 推理強度附加秒數」中的較小值判定失敗。只有客戶端還沒收到任何回應正文時才會重試。',
    'Prefill tokens per second': '預填每秒 token 數',
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
