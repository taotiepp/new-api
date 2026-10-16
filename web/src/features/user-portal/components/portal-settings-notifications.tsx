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
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PasswordInput } from '@/components/password-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { testUserNotification, updateUserSettings } from '@/features/profile/api'
import { normalizeUserSettings } from '@/features/profile/lib/user-settings'
import type { NotifyType, UserProfile } from '@/features/profile/types'
import {
  currencyAmountFromQuota,
  quotaFromCurrencyAmount,
  usePricingCurrency,
} from '@/lib/currency'
import { handleServerError } from '@/lib/handle-server-error'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'

const PORTAL_NOTIFY_METHODS = [
  { value: 'email', label: 'Email' },
  { value: 'feishu', label: 'Feishu bot' },
  { value: 'webhook', label: 'Generic webhook' },
] as const

const WEBHOOK_BODY_EXAMPLE = `{
  "type": "quota_exceed",
  "title": "Quota warning",
  "content": "Your remaining balance is below the warning threshold.",
  "timestamp": 1710000000
}`

type PortalNotifyMethod = (typeof PORTAL_NOTIFY_METHODS)[number]['value']

type PortalSettingsNotificationsProps = {
  profile: UserProfile
  onSaved: () => void
}

function isPortalNotifyMethod(value: NotifyType): value is PortalNotifyMethod {
  return PORTAL_NOTIFY_METHODS.some((method) => method.value === value)
}

export function PortalSettingsNotifications(
  props: PortalSettingsNotificationsProps
) {
  const { t } = useTranslation()
  const { currency, exchangeRate, quotaPerUnit } = usePricingCurrency()
  const isAdmin = (props.profile.role ?? 0) >= ROLE.ADMIN
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [settings, setSettings] = useState(() =>
    normalizeUserSettings(props.profile.setting)
  )
  const [thresholdAmount, setThresholdAmount] = useState(() =>
    String(
      currencyAmountFromQuota(
        normalizeUserSettings(props.profile.setting).quota_warning_threshold,
        quotaPerUnit,
        exchangeRate
      )
    )
  )

  useEffect(() => {
    const next = normalizeUserSettings(props.profile.setting)
    setSettings(next)
    setThresholdAmount(
      String(
        currencyAmountFromQuota(
          next.quota_warning_threshold,
          quotaPerUnit,
          exchangeRate
        )
      )
    )
  }, [exchangeRate, props.profile.setting, quotaPerUnit])

  const updateField = <K extends keyof typeof settings>(
    field: K,
    value: (typeof settings)[K]
  ) => {
    setSettings((current) => ({ ...current, [field]: value }))
  }

  const notificationSettings = () => ({
    ...settings,
    quota_warning_threshold: quotaFromCurrencyAmount(
      Number(thresholdAmount),
      quotaPerUnit,
      exchangeRate
    ),
  })

  const handleSave = async () => {
    const payload = notificationSettings()
    if (payload.quota_warning_threshold <= 0) {
      toast.error(t('Enter an amount greater than 0'))
      return
    }
    try {
      setLoading(true)
      const response = await updateUserSettings(payload)
      if (response.success) {
        toast.success(t('Settings updated successfully'))
        props.onSaved()
      } else {
        handleServerError(response, t('Failed to update settings'))
      }
    } catch (error) {
      handleServerError(error, t('Failed to update settings'))
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    const payload = notificationSettings()
    if (payload.quota_warning_threshold <= 0) {
      toast.error(t('Enter an amount greater than 0'))
      return
    }
    try {
      setTesting(true)
      const response = await testUserNotification(payload)
      if (response.success) {
        toast.success(t('Test notification sent'))
      } else {
        handleServerError(response, t('Failed to send test notification'))
      }
    } catch (error) {
      handleServerError(error, t('Failed to send test notification'))
    } finally {
      setTesting(false)
    }
  }

  const notifyType = settings.notify_type

  return (
    <section className='border-t border-[var(--portal-hairline)] pt-6'>
      <h2 className='text-base font-semibold text-[var(--portal-ink)]'>
        {t('Notification Method')}
      </h2>
      <p className='text-muted-foreground mt-1 text-sm'>
        {t('Quota alerts use the method selected here.')}
      </p>

      <div
        className='mt-4 flex flex-wrap gap-5'
        role='group'
        aria-label={t('Notification Method')}
      >
        {PORTAL_NOTIFY_METHODS.map((method) => (
          <Button
            key={method.value}
            type='button'
            size='sm'
            variant='ghost'
            className={cn(
              'h-8 rounded-none px-0 hover:bg-transparent',
              notifyType === method.value
                ? 'border-b-2 border-[var(--portal-accent)] font-medium text-[var(--portal-ink)]'
                : 'text-[var(--portal-ink-muted)]'
            )}
            aria-pressed={notifyType === method.value}
            onClick={() => updateField('notify_type', method.value)}
          >
            {t(method.label)}
          </Button>
        ))}
      </div>

      <div className='mt-5 space-y-1.5'>
        <Label htmlFor='portal-quota-threshold'>
          {t('Quota Warning Threshold')} ({currency})
        </Label>
        <Input
          id='portal-quota-threshold'
          type='number'
          min={0}
          step='0.01'
          value={thresholdAmount}
          onChange={(event) => setThresholdAmount(event.target.value)}
          placeholder={t('Enter threshold')}
        />
        <p className='text-muted-foreground text-xs'>
          {t(
            'Get notified when the balance falls below this {{currency}} amount',
            { currency }
          )}
        </p>
      </div>

      {notifyType === 'email' ? (
        <div className='mt-4 space-y-1.5'>
          <Label htmlFor='portal-notify-email'>{t('Notification Email')}</Label>
          <Input
            id='portal-notify-email'
            type='email'
            value={settings.notification_email}
            onChange={(event) =>
              updateField('notification_email', event.target.value)
            }
            placeholder={t('Leave empty to use account email')}
          />
        </div>
      ) : null}

      {notifyType === 'feishu' ? (
        <div className='mt-4 space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='portal-feishu-url'>
              {t('Feishu Bot Webhook URL')}
            </Label>
            <Input
              id='portal-feishu-url'
              type='url'
              value={settings.feishu_webhook_url}
              onChange={(event) =>
                updateField('feishu_webhook_url', event.target.value)
              }
              placeholder={t(
                'https://open.feishu.cn/open-apis/bot/v2/hook/...'
              )}
            />
            <p className='text-muted-foreground text-xs'>
              {t(
                'Supports Feishu (open.feishu.cn) and Lark (open.larksuite.com) custom bot webhooks.'
              )}
            </p>
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='portal-feishu-secret'>
              {t('Feishu Bot Secret')}
            </Label>
            <PasswordInput
              id='portal-feishu-secret'
              value={settings.feishu_webhook_secret}
              onChange={(event) =>
                updateField('feishu_webhook_secret', event.target.value)
              }
              placeholder={t('Enter secret key')}
            />
            <p className='text-muted-foreground text-xs'>
              {t('Leave empty if signature verification is not enabled')}
            </p>
          </div>
        </div>
      ) : null}

      {notifyType === 'webhook' ? (
        <div className='mt-4 space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='portal-webhook-url'>{t('Webhook URL')}</Label>
            <Input
              id='portal-webhook-url'
              type='url'
              value={settings.webhook_url}
              onChange={(event) =>
                updateField('webhook_url', event.target.value)
              }
              placeholder={t('https://example.com/webhook')}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='portal-webhook-secret'>{t('Webhook Secret')}</Label>
            <PasswordInput
              id='portal-webhook-secret'
              value={settings.webhook_secret}
              onChange={(event) =>
                updateField('webhook_secret', event.target.value)
              }
              placeholder={t('Enter secret key')}
            />
          </div>
          <WebhookContract />
        </div>
      ) : null}

      <div className='mt-6 space-y-3 border-t pt-5'>
        <h3 className='text-sm font-semibold text-[var(--portal-ink)]'>
          {t('Preferences')}
        </h3>
        {isAdmin ? (
          <PreferenceSwitch
            id='portal-upstream-model-notify'
            label={t('Receive Upstream Model Update Notifications')}
            description={t(
              'Only available for admins. When enabled, you will receive a summary notification via your selected method when the scheduled model check detects upstream model changes or check failures.'
            )}
            checked={settings.upstream_model_update_notify_enabled}
            onCheckedChange={(checked) =>
              updateField('upstream_model_update_notify_enabled', checked)
            }
          />
        ) : null}
        <PreferenceSwitch
          id='portal-accept-unset-price'
          label={t('Accept Unpriced Models')}
          description={t('Allow using models without price configuration')}
          checked={settings.accept_unset_model_ratio_model}
          onCheckedChange={(checked) =>
            updateField('accept_unset_model_ratio_model', checked)
          }
        />
      </div>

      <div className='mt-5 flex flex-wrap justify-end gap-2'>
        <Button
          type='button'
          variant='outline'
          disabled={loading || testing || !isPortalNotifyMethod(notifyType)}
          onClick={() => {
            void handleTest()
          }}
        >
          {testing ? <Loader2 className='size-4 animate-spin' /> : null}
          {testing ? t('Sending...') : t('Send test message')}
        </Button>
        <Button
          type='button'
          disabled={loading || testing}
          onClick={() => {
            void handleSave()
          }}
        >
          {loading ? <Loader2 className='size-4 animate-spin' /> : null}
          {loading ? t('Saving...') : t('Save Settings')}
        </Button>
      </div>
    </section>
  )
}

function WebhookContract() {
  const { t } = useTranslation()
  return (
    <div className='border-t border-[var(--portal-hairline)] pt-4'>
      <h3 className='text-sm font-semibold text-[var(--portal-ink)]'>
        {t('Webhook request')}
      </h3>
      <dl className='mt-3 space-y-3 text-sm'>
        <div>
          <dt className='text-muted-foreground'>{t('Request method')}</dt>
          <dd className='mt-0.5 font-medium text-[var(--portal-ink)]'>POST</dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('Content type')}</dt>
          <dd className='mt-0.5 font-medium text-[var(--portal-ink)]'>
            application/json
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('Signature header')}</dt>
          <dd className='text-muted-foreground mt-0.5'>
            {t(
              'When a secret is set, the request includes X-Webhook-Signature, the hex-encoded HMAC-SHA256 of the raw body signed with that secret. Leave the secret empty to send the body without a signature.'
            )}
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('Success response')}</dt>
          <dd className='text-muted-foreground mt-0.5'>
            {t('Respond with any HTTP status from 200 to 299.')}
          </dd>
        </div>
      </dl>
      <p className='mt-4 text-sm font-medium text-[var(--portal-ink)]'>
        {t('Request body')}
      </p>
      <pre className='mt-2 overflow-x-auto rounded-lg bg-[var(--portal-surface-muted)] p-3 font-mono text-xs leading-relaxed text-[var(--portal-ink)]'>
        {WEBHOOK_BODY_EXAMPLE}
      </pre>
      <p className='text-muted-foreground mt-2 text-xs'>
        {t(
          'type is quota_exceed, channel_update, or notify_test. title and content are text. values is an optional array and is omitted when empty. timestamp is Unix time in seconds.'
        )}
      </p>
    </div>
  )
}

function PreferenceSwitch(props: {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-[var(--portal-hairline)] py-3'
      )}
    >
      <div>
        <Label htmlFor={props.id}>{props.label}</Label>
        <p className='text-muted-foreground mt-1 text-xs'>{props.description}</p>
      </div>
      <Switch
        id={props.id}
        className='shrink-0'
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
      />
    </div>
  )
}
