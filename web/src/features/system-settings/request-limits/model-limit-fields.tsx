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

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { ModelRateLimitValue, TokenMode } from './user-model-rate-limit-config'

type ModelLimitFieldsProps = {
  value: ModelRateLimitValue
  onChange: (value: ModelRateLimitValue) => void
  showTokenMode?: boolean
  disabled?: boolean
}

const LIMIT_MIN = -1
const LIMIT_MAX = 2147483647

function parseLimit(raw: string): number {
  if (raw.trim() === '') return 0
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  const rounded = Math.trunc(n)
  if (rounded < LIMIT_MIN) return LIMIT_MIN
  if (rounded > LIMIT_MAX) return LIMIT_MAX
  return rounded
}

// ModelLimitFields renders the shared RPM / TPM / token_mode controls used by
// the global default, group default, model dialog and per-user override dialog.
export function ModelLimitFields(props: ModelLimitFieldsProps) {
  const { t } = useTranslation()
  const showTokenMode = props.showTokenMode ?? true

  const setField = (patch: Partial<ModelRateLimitValue>) => {
    props.onChange({ ...props.value, ...patch })
  }

  return (
    <div className='grid gap-4 md:grid-cols-3'>
      <div className='grid gap-1.5'>
        <Label className='text-xs'>{t('RPM')}</Label>
        <Input
          type='number'
          min={LIMIT_MIN}
          max={LIMIT_MAX}
          step={1}
          disabled={props.disabled}
          value={props.value.rpm}
          onChange={(e) => setField({ rpm: parseLimit(e.target.value) })}
        />
        <p className='text-muted-foreground text-xs'>
          {t('0 = inherit, -1 = unlimited')}
        </p>
      </div>

      <div className='grid gap-1.5'>
        <Label className='text-xs'>{t('TPM')}</Label>
        <Input
          type='number'
          min={LIMIT_MIN}
          max={LIMIT_MAX}
          step={1}
          disabled={props.disabled}
          value={props.value.tpm}
          onChange={(e) => setField({ tpm: parseLimit(e.target.value) })}
        />
        <p className='text-muted-foreground text-xs'>
          {t('0 = inherit, -1 = unlimited')}
        </p>
      </div>

      {showTokenMode && (
        <div className='grid gap-1.5'>
          <Label className='text-xs'>{t('Token counting mode')}</Label>
          <Select
            items={[
              { value: '', label: t('Inherit') },
              { value: 'total', label: t('Total (prompt + completion)') },
              { value: 'input', label: t('Input only (prompt)') },
            ]}
            value={props.value.token_mode}
            onValueChange={(value) =>
              value !== null && setField({ token_mode: value as TokenMode })
            }
            disabled={props.disabled}
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value=''>{t('Inherit')}</SelectItem>
                <SelectItem value='total'>
                  {t('Total (prompt + completion)')}
                </SelectItem>
                <SelectItem value='input'>
                  {t('Input only (prompt)')}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className='text-muted-foreground text-xs'>
            {t('How TPM counts tokens for this limit')}
          </p>
        </div>
      )}
    </div>
  )
}
