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
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { RiskAcknowledgementDialog } from '@/components/risk-acknowledgement-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { TitledCard } from '@/components/ui/titled-card'
import { updateUserSettings } from '@/features/profile/api'
import { parseUserSettings } from '@/features/profile/lib/format'
import type { UserProfile } from '@/features/profile/types'
import { useStatus } from '@/hooks/use-status'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

type PrivacyCardProps = {
  profile: UserProfile
  onUpdate: () => void
}

export function FailedRequestBodyCard(props: PrivacyCardProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const [enabled, setEnabled] = useState(() =>
    Boolean(parseUserSettings(props.profile.setting).record_error_request_body)
  )
  const [consentOpen, setConsentOpen] = useState(false)
  useEffect(() => {
    setEnabled(
      Boolean(
        parseUserSettings(props.profile.setting).record_error_request_body
      )
    )
  }, [props.profile.setting])

  const ttlDays =
    typeof status?.log_ttl_days === 'number' ? status.log_ttl_days : null
  let retention = t('These inputs are not deleted on a fixed schedule.')
  if (ttlDays === null) {
    retention = t('Checking how long stored inputs are kept.')
  } else if (ttlDays > 0) {
    retention = t('These inputs are deleted after {{count}} days.', {
      count: ttlDays,
    })
  }

  const save = useMutation({
    mutationFn: async (next: boolean) => {
      const response = await updateUserSettings({
        record_error_request_body: next,
      })
      if (!response.success) {
        throw createServerError(response, t('Failed to update settings'))
      }
      return next
    },
    onSuccess: (next) => {
      setEnabled(next)
      setConsentOpen(false)
      toast.success(t('Settings updated successfully'))
      props.onUpdate()
    },
    onError: (error) =>
      handleServerError(error, t('Failed to update settings')),
  })

  return (
    <TitledCard
      title={t('Store failed requests')}
      description={t(
        "Store a failed request's input so you can review it later. Turning this on requires your agreement."
      )}
      disableHoverEffect
    >
      <div className='flex items-center justify-between gap-4'>
        <Label htmlFor='security-store-failed-request'>
          {t('Store failed requests')}
        </Label>
        <Switch
          id='security-store-failed-request'
          checked={enabled}
          onCheckedChange={(checked) => {
            if (checked) {
              setConsentOpen(true)
              return
            }
            setEnabled(false)
          }}
          disabled={save.isPending}
        />
      </div>
      <div className='mt-4 flex justify-end'>
        <Button
          type='button'
          onClick={() => save.mutate(enabled)}
          disabled={save.isPending}
        >
          {save.isPending && <Loader2 className='size-4 animate-spin' />}
          {save.isPending ? t('Saving...') : t('Save Settings')}
        </Button>
      </div>
      <RiskAcknowledgementDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        title={t('Turn on storage of failed requests?')}
        description={t(
          'This is only for debugging. Stored inputs are not used for anything else.'
        )}
        items={[
          t('Only the input sent with a failed request is stored.'),
          t('Successful requests are not stored.'),
          t('You can view the stored input in your usage logs.'),
          retention,
        ]}
        checklist={[
          t(
            'I understand the above and agree to store failed request inputs for debugging.'
          ),
        ]}
        confirmText={t('Agree and turn on')}
        destructive={false}
        isLoading={save.isPending || ttlDays === null}
        onConfirm={() => save.mutate(true)}
      />
    </TitledCard>
  )
}

export function PrivacyCard(props: PrivacyCardProps) {
  const { t } = useTranslation()
  const [recordIpLog, setRecordIpLog] = useState(() =>
    Boolean(parseUserSettings(props.profile.setting).record_ip_log)
  )
  useEffect(() => {
    setRecordIpLog(
      Boolean(parseUserSettings(props.profile.setting).record_ip_log)
    )
  }, [props.profile.setting])

  const save = useMutation({
    mutationFn: async () => {
      const response = await updateUserSettings({ record_ip_log: recordIpLog })
      if (!response.success) {
        throw createServerError(response, t('Failed to update settings'))
      }
    },
    onSuccess: () => {
      toast.success(t('Settings updated successfully'))
      props.onUpdate()
    },
    onError: (error) =>
      handleServerError(error, t('Failed to update settings')),
  })

  return (
    <TitledCard
      title={t('Record IP Address')}
      description={t('Log IP address for usage and error logs')}
      disableHoverEffect
    >
      <div className='flex items-center justify-between gap-4'>
        <Label htmlFor='security-record-ip'>{t('Record IP Address')}</Label>
        <Switch
          id='security-record-ip'
          checked={recordIpLog}
          onCheckedChange={setRecordIpLog}
          disabled={save.isPending}
        />
      </div>
      <div className='mt-4 flex justify-end'>
        <Button
          type='button'
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending && <Loader2 className='size-4 animate-spin' />}
          {save.isPending ? t('Saving...') : t('Save Settings')}
        </Button>
      </div>
    </TitledCard>
  )
}
