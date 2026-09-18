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
  fr: {
    'Available balance': 'Solde disponible',
    'Back to Console': 'Retour à la console',
    'Browse model names and optional summaries.':
      'Parcourez les noms de modèles et leurs résumés optionnels.',
    'Chat with models in a focused workspace.':
      'Discutez avec des modèles dans un espace de travail dédié.',
    'Discover models, pricing, and capabilities in one place.':
      'Découvrez modèles, tarifs et capacités au même endroit.',
    'Experience Center': "Centre d'expérience",
    'Manage credentials for API access.':
      'Gérez les identifiants d’accès à l’API.',
    'Request Logs': 'Journaux de requêtes',
    'Review your API request history.':
      'Consultez l’historique de vos requêtes API.',
    'Search models by name or description...':
      'Rechercher par nom ou description de modèle…',
    'Track consumption and trends over time.':
      'Suivez la consommation et les tendances dans le temps.',
    'Try Online': 'Essayer en ligne',
    'User Portal': 'Portail utilisateur',
    'User Portal navigation': 'Navigation du portail utilisateur',
  },
  ja: {
    'Available balance': '利用可能残高',
    'Back to Console': 'コンソールに戻る',
    'Browse model names and optional summaries.':
      'モデル名と任意の概要を閲覧します。',
    'Chat with models in a focused workspace.':
      '集中できるワークスペースでモデルとチャット。',
    'Discover models, pricing, and capabilities in one place.':
      'モデル・料金・機能を一か所で確認。',
    'Experience Center': '体験センター',
    'Manage credentials for API access.':
      'API アクセス用の認証情報を管理します。',
    'Request Logs': 'リクエストログ',
    'Review your API request history.': 'API リクエスト履歴を確認。',
    'Search models by name or description...':
      'モデル名または概要で検索…',
    'Track consumption and trends over time.':
      '使用量と推移を確認します。',
    'Try Online': 'オンラインで試す',
    'User Portal': 'ユーザーポータル',
    'User Portal navigation': 'ユーザーポータルのナビゲーション',
  },
  ru: {
    'Available balance': 'Доступный баланс',
    'Back to Console': 'Вернуться в консоль',
    'Browse model names and optional summaries.':
      'Просматривайте названия моделей и необязательные описания.',
    'Chat with models in a focused workspace.':
      'Общайтесь с моделями в отдельном рабочем пространстве.',
    'Discover models, pricing, and capabilities in one place.':
      'Модели, цены и возможности — в одном месте.',
    'Experience Center': 'Центр тестирования',
    'Manage credentials for API access.':
      'Управляйте учётными данными для доступа к API.',
    'Request Logs': 'Журнал запросов',
    'Review your API request history.':
      'Просматривайте историю API-запросов.',
    'Search models by name or description...':
      'Поиск по названию или описанию модели…',
    'Track consumption and trends over time.':
      'Отслеживайте потребление и динамику.',
    'Try Online': 'Попробовать онлайн',
    'User Portal': 'Пользовательский портал',
    'User Portal navigation': 'Навигация пользовательского портала',
  },
  vi: {
    'Available balance': 'Số dư khả dụng',
    'Back to Console': 'Quay lại bảng điều khiển',
    'Browse model names and optional summaries.':
      'Duyệt tên mô hình và phần mô tả tùy chọn.',
    'Chat with models in a focused workspace.':
      'Trò chuyện với mô hình trong không gian tập trung.',
    'Discover models, pricing, and capabilities in one place.':
      'Khám phá mô hình, giá và khả năng ở một nơi.',
    'Experience Center': 'Trung tâm trải nghiệm',
    'Manage credentials for API access.':
      'Quản lý thông tin xác thực truy cập API.',
    'Request Logs': 'Nhật ký yêu cầu',
    'Review your API request history.':
      'Xem lịch sử yêu cầu API của bạn.',
    'Search models by name or description...':
      'Tìm theo tên hoặc mô tả mô hình…',
    'Track consumption and trends over time.':
      'Theo dõi mức tiêu thụ và xu hướng theo thời gian.',
    'Try Online': 'Dùng thử trực tuyến',
    'User Portal': 'Cổng người dùng',
    'User Portal navigation': 'Điều hướng cổng người dùng',
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
