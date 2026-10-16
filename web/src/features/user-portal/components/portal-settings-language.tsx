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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { updateUserLanguage } from '@/features/profile/api'
import { parseUserSettings } from '@/features/profile/lib'
import type { UserProfile } from '@/features/profile/types'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const PORTAL_LANGUAGES = [
  { code: 'zhCN', label: 'Simplified Chinese' },
  { code: 'en', label: 'English' },
] as const

type PortalLanguage = (typeof PORTAL_LANGUAGES)[number]['code']

type PortalSettingsLanguageProps = {
  profile: UserProfile
  onSaved: () => void
}

function portalLanguage(value?: string | null): PortalLanguage | null {
  if (!value) return null
  const lower = value.trim().replaceAll('_', '-').toLowerCase()
  if (lower === 'en' || lower.startsWith('en-')) return 'en'
  if (
    lower === 'zh' ||
    lower === 'zhcn' ||
    lower === 'zh-cn' ||
    lower === 'zh-hans' ||
    lower.startsWith('zh-hans-')
  ) {
    return 'zhCN'
  }
  return null
}

export function PortalSettingsLanguage(props: PortalSettingsLanguageProps) {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const setUser = useAuthStore((state) => state.auth.setUser)
  const savedLanguage =
    portalLanguage(parseUserSettings(props.profile.setting).language) ??
    portalLanguage(i18n.language)
  const [saving, setSaving] = useState(false)

  const handleLanguage = async (nextLanguage: PortalLanguage) => {
    if (nextLanguage === savedLanguage || saving) return
    const previousLanguage = i18n.language
    setSaving(true)
    await i18n.changeLanguage(nextLanguage)
    try {
      const response = await updateUserLanguage(nextLanguage)
      if (!response.success) {
        throw createServerError(response, t('Failed to update settings'))
      }
      if (user) {
        const existingSetting =
          typeof user.setting === 'string'
            ? parseUserSettings(user.setting)
            : (user.setting ?? {})
        setUser({
          ...user,
          setting: JSON.stringify({
            ...existingSetting,
            language: nextLanguage,
          }),
        })
      }
      props.onSaved()
      toast.success(t('Language preference saved'))
    } catch (error) {
      await i18n.changeLanguage(previousLanguage)
      handleServerError(error, t('Failed to update settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className='border-t border-[var(--portal-hairline)] pt-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h2 className='text-base font-semibold text-[var(--portal-ink)]'>
            {t('Language Preferences')}
          </h2>
          <p className='text-muted-foreground mt-1 max-w-xl text-sm'>
            {t(
              'Choose Simplified Chinese or English. This language is used across the interface and in API error messages.'
            )}
          </p>
        </div>
        <div className='flex items-center gap-5'>
          {PORTAL_LANGUAGES.map((language) => (
            <Button
              key={language.code}
              type='button'
              size='sm'
              variant='ghost'
              className={cn(
                'h-8 rounded-none px-0 hover:bg-transparent',
                savedLanguage === language.code
                  ? 'border-b-2 border-[var(--portal-accent)] font-medium text-[var(--portal-ink)]'
                  : 'text-[var(--portal-ink-muted)]'
              )}
              aria-pressed={savedLanguage === language.code}
              disabled={saving}
              onClick={() => {
                void handleLanguage(language.code)
              }}
            >
              {t(language.label)}
            </Button>
          ))}
          {saving ? (
            <Loader2 className='text-muted-foreground size-4 animate-spin' />
          ) : null}
        </div>
      </div>
    </section>
  )
}
