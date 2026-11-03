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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

import {
  ADVANCED_CUSTOM_SELECTABLE_PROTOCOLS,
  applyDetectedProtocols,
  selectedAdvancedCustomProtocols,
  withAdvancedCustomProtocol,
  type AdvancedCustomSelectableProtocol,
} from '../lib/advanced-custom'

function protocolLabel(
  protocolId: AdvancedCustomSelectableProtocol,
  translate: (key: string) => string
): string {
  if (protocolId === 'openai-chat') return translate('OpenAI Chat')
  if (protocolId === 'openai-responses') return translate('OpenAI Responses')
  return translate('Claude Messages')
}

export function AdvancedCustomProtocolFields(props: {
  value: string | undefined
  onChange: (value: string) => void
  onDetect?: () => Promise<readonly string[] | null>
}) {
  const { t } = useTranslation()
  const [detecting, setDetecting] = useState(false)
  const selected = new Set(selectedAdvancedCustomProtocols(props.value))

  const detect = async () => {
    if (!props.onDetect || detecting) return
    setDetecting(true)
    try {
      const available = await props.onDetect()
      if (available === null) return
      props.onChange(applyDetectedProtocols(props.value, available))
      if (available.length === 0) {
        toast.info(t('No supported protocols detected'))
        return
      }
      const names = ADVANCED_CUSTOM_SELECTABLE_PROTOCOLS.flatMap((protocol) =>
        available.includes(protocol.id) ? [protocolLabel(protocol.id, t)] : []
      )
      toast.success(t('Detected {{protocols}}', { protocols: names.join(', ') }))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Protocol detection failed')
      toast.error(message)
    } finally {
      setDetecting(false)
    }
  }

  return (
    <fieldset className='flex flex-col gap-2'>
      <legend className='flex w-full flex-wrap items-center justify-between gap-2 text-sm font-medium'>
        <span>{t('Supported protocols')}</span>
        {props.onDetect && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={detecting}
            onClick={() => void detect()}
          >
            {detecting ? t('Detecting protocols...') : t('Detect protocols')}
          </Button>
        )}
      </legend>
      <p className='text-muted-foreground text-xs'>
        {t('Select the protocols this channel accepts natively.')}
      </p>
      <div className='flex flex-col gap-2'>
        {ADVANCED_CUSTOM_SELECTABLE_PROTOCOLS.map((protocol) => {
          const inputId = `advanced-custom-protocol-${protocol.id}`
          return (
            <div key={protocol.id} className='flex items-center gap-2'>
              <Checkbox
                id={inputId}
                checked={selected.has(protocol.id)}
                onCheckedChange={(checked) =>
                  props.onChange(
                    withAdvancedCustomProtocol(
                      props.value,
                      protocol.id,
                      checked === true
                    )
                  )
                }
              />
              <Label htmlFor={inputId} className='text-sm font-normal'>
                {protocolLabel(protocol.id, t)}
              </Label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
