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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LOG_TYPES } from '@/features/usage-logs/constants'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import {
  formatAppliedDiscount,
  getAppliedUserDiscount,
} from '@/features/usage-logs/lib/discount-display'
import {
  getTieredBillingSummary,
  parseLogOther,
} from '@/features/usage-logs/lib/format'
import {
  isPerCallBilling,
  isTimingLogType,
} from '@/features/usage-logs/lib/utils'
import type { LogOtherData } from '@/features/usage-logs/types'
import {
  formatBillingCurrencyFromUSD,
  usePricingCurrency,
} from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { formatNumber, formatUseTime } from '@/lib/format'

type PortalLogDetailsDialogProps = {
  log: UsageLog | null
  onOpenChange: (open: boolean) => void
}

const PRICE_OPTS = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }

export function PortalLogDetailsDialog(props: PortalLogDetailsDialogProps) {
  const { t } = useTranslation()
  const { formatQuota } = usePricingCurrency()
  const log = props.log
  const other = log ? parseLogOther(log.other) : null
  const typeLabel =
    LOG_TYPES.find((item) => item.value === log?.type)?.label ?? 'Unknown'
  const showTiming = log != null && isTimingLogType(log.type)
  const tokensPerSecond =
    log != null && log.use_time > 0 && log.completion_tokens > 0
      ? log.completion_tokens / log.use_time
      : null
  const cacheRead = other?.cache_tokens || 0
  const cacheWrite = other?.cache_creation_tokens || 0
  const cacheWrite5m = other?.cache_creation_tokens_5m || 0
  const cacheWrite1h = other?.cache_creation_tokens_1h || 0
  const firstTokenSeconds =
    other?.frt != null && other.frt > 0 ? other.frt / 1000 : null

  const rows = log
    ? [
        {
          label: t('Created'),
          value: dayjs.unix(log.created_at).format('YYYY-MM-DD HH:mm:ss'),
        },
        { label: t('Type'), value: t(typeLabel) },
        { label: t('Model'), value: log.model_name || t('Unknown model') },
        { label: t('Token Name'), value: log.token_name || '—' },
        { label: t('Request ID'), value: log.request_id || '—' },
        { label: t('Input tokens'), value: formatNumber(log.prompt_tokens) },
        {
          label: t('Output tokens'),
          value: formatNumber(log.completion_tokens),
        },
      ]
    : []

  if (showTiming && cacheRead > 0) {
    rows.push({ label: t('Cache Read'), value: formatNumber(cacheRead) })
  }
  if (
    showTiming &&
    cacheWrite > 0 &&
    cacheWrite5m === 0 &&
    cacheWrite1h === 0
  ) {
    rows.push({ label: t('Cache Write'), value: formatNumber(cacheWrite) })
  }
  if (showTiming && cacheWrite5m > 0) {
    rows.push({
      label: t('Cache Write (5m)'),
      value: formatNumber(cacheWrite5m),
    })
  }
  if (showTiming && cacheWrite1h > 0) {
    rows.push({
      label: t('Cache Write (1h)'),
      value: formatNumber(cacheWrite1h),
    })
  }
  if (showTiming && log) {
    let streamLabel = log.is_stream ? t('Stream') : t('Non-stream')
    if (other?.is_task === true) {
      streamLabel = t('Async')
    }
    rows.push({ label: t('Stream'), value: streamLabel })
    rows.push({
      label: t('Throughput short'),
      value:
        tokensPerSecond != null ? `${Math.round(tokensPerSecond)} t/s` : '—',
    })
    rows.push({ label: t('Duration'), value: formatUseTime(log.use_time) })
    if (log.is_stream) {
      rows.push({
        label: t('First token'),
        value:
          firstTokenSeconds == null
            ? t('N/A')
            : formatUseTime(firstTokenSeconds),
      })
    }
  }
  if (log) {
    rows.push({ label: t('Quota'), value: formatQuota(log.quota) })
    const userDiscount = getAppliedUserDiscount(other)
    if (userDiscount) {
      rows.push({
        label: t('Customer discount'),
        value: formatAppliedDiscount(userDiscount, t),
      })
    }
  }

  const formula =
    log != null ? formatPortalCostFormula(log, other, t, formatQuota) : ''

  return (
    <Dialog open={log != null} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Request Logs')}</DialogTitle>
        </DialogHeader>
        <dl className='grid gap-3'>
          {rows.map((row) => (
            <div key={row.label} className='grid gap-1 sm:grid-cols-[8rem_1fr]'>
              <dt className='text-muted-foreground text-sm'>{row.label}</dt>
              <dd className='text-sm break-all text-[var(--portal-ink)]'>
                {row.value}
              </dd>
            </div>
          ))}
          {formula ? (
            <div className='grid gap-1'>
              <dt className='text-muted-foreground text-sm'>
                {t('Cost formula')}
              </dt>
              <dd className='rounded-[var(--portal-radius)] bg-[var(--portal-surface-muted)] px-3 py-2 font-mono text-xs break-all whitespace-pre-wrap text-[var(--portal-ink)]'>
                {formula}
              </dd>
            </div>
          ) : null}
          {log?.content ? (
            <div className='grid gap-1'>
              <dt className='text-muted-foreground text-sm'>{t('Content')}</dt>
              <dd className='rounded-[var(--portal-radius)] bg-[var(--portal-surface-muted)] px-3 py-2 text-sm break-all whitespace-pre-wrap'>
                {log.content}
              </dd>
            </div>
          ) : null}
        </dl>
        <DialogFooter>
          <Button
            type='button'
            className='rounded-full'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatPrice(usd: number): string {
  return formatBillingCurrencyFromUSD(usd, PRICE_OPTS)
}

function effectiveGroupRatio(other: LogOtherData): {
  labelKey: 'User Exclusive Ratio' | 'Group Ratio'
  value: number
} | null {
  const userGR = other.user_group_ratio
  const isUserGR = userGR != null && Number.isFinite(userGR) && userGR !== -1
  const value = isUserGR ? userGR : other.group_ratio
  if (value == null || !Number.isFinite(value)) return null
  return {
    labelKey: isUserGR ? 'User Exclusive Ratio' : 'Group Ratio',
    value,
  }
}

function formatPortalCostFormula(
  log: UsageLog,
  other: LogOtherData | null,
  t: (key: string) => string,
  formatQuota: (quota: number) => string
): string {
  const total = `${t('Total Cost')} = ${formatQuota(log.quota)}`
  if (!other) return total

  const lines: string[] = []
  const userDiscount = getAppliedUserDiscount(other)
  const group = userDiscount ? null : effectiveGroupRatio(other)
  const isTieredExpr = other.billing_mode === 'tiered_expr'
  const isPerCall = isPerCallBilling(other.model_price)

  if (isTieredExpr) {
    lines.push(t('Dynamic Pricing'))
    if (other.matched_tier) {
      lines.push(`${t('Matched Tier')}: ${other.matched_tier}`)
    }
    const summary = getTieredBillingSummary(other)
    if (summary) {
      for (const entry of summary.priceEntries) {
        const unit = entry.unit === 'request' ? t('request') : 'M'
        lines.push(
          `${t(entry.shortLabel)}: ${formatPrice(entry.price)}/${unit}`
        )
      }
    }
  } else if (isPerCall) {
    lines.push(t('Per-call'))
    if (other.model_price != null) {
      lines.push(`${t('Model Price')} ${formatPrice(other.model_price)}`)
    }
  } else if (other.model_ratio != null) {
    const inputPrice = other.model_ratio * 2.0
    lines.push(t('Per-token'))
    lines.push(
      `${t('Input')} ${formatNumber(log.prompt_tokens)} × ${formatPrice(inputPrice)}/M`
    )
    if (other.completion_ratio != null) {
      lines.push(
        `+ ${t('Output')} ${formatNumber(log.completion_tokens)} × ${formatPrice(inputPrice * other.completion_ratio)}/M`
      )
    }
    if ((other.cache_tokens || 0) > 0) {
      const cacheRatio = other.cache_ratio ?? 1
      lines.push(
        `+ ${t('Cache Read')} ${formatNumber(other.cache_tokens || 0)} × ${formatPrice(inputPrice * cacheRatio)}/M`
      )
    }
    if (
      (other.cache_creation_tokens || 0) > 0 &&
      (other.cache_creation_tokens_5m || 0) === 0 &&
      (other.cache_creation_tokens_1h || 0) === 0
    ) {
      const writeRatio = other.cache_creation_ratio ?? 1
      lines.push(
        `+ ${t('Cache Write')} ${formatNumber(other.cache_creation_tokens || 0)} × ${formatPrice(inputPrice * writeRatio)}/M`
      )
    }
    if ((other.cache_creation_tokens_5m || 0) > 0) {
      const writeRatio = other.cache_creation_ratio_5m ?? 1
      lines.push(
        `+ ${t('Cache Write (5m)')} ${formatNumber(other.cache_creation_tokens_5m || 0)} × ${formatPrice(inputPrice * writeRatio)}/M`
      )
    }
    if ((other.cache_creation_tokens_1h || 0) > 0) {
      const writeRatio = other.cache_creation_ratio_1h ?? 1
      lines.push(
        `+ ${t('Cache Write (1h)')} ${formatNumber(other.cache_creation_tokens_1h || 0)} × ${formatPrice(inputPrice * writeRatio)}/M`
      )
    }
  }

  if (other.web_search && other.web_search_call_count) {
    let searchLine = `+ ${t('Web Search')} ${other.web_search_call_count}x`
    if (other.web_search_price) {
      searchLine += ` (${formatPrice(other.web_search_price)})`
    }
    lines.push(searchLine)
  }
  if (other.file_search && other.file_search_call_count) {
    let searchLine = `+ ${t('File Search')} ${other.file_search_call_count}x`
    if (other.file_search_price) {
      searchLine += ` (${formatPrice(other.file_search_price)})`
    }
    lines.push(searchLine)
  }
  if (other.image_generation_call && other.image_generation_call_price) {
    lines.push(
      `+ ${t('Image Generation')} ${formatPrice(other.image_generation_call_price)}`
    )
  }

  if (userDiscount) {
    lines.push(
      `× ${t('Customer discount')} ${formatAppliedDiscount(userDiscount, t)}`
    )
  } else if (group) {
    lines.push(`× ${t(group.labelKey)} ${group.value.toFixed(4)}x`)
  }

  if (lines.length === 0) return total
  lines.push(`= ${formatQuota(log.quota)}`)
  return lines.join('\n')
}
