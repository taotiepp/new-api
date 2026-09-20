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

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { GroupDiscountEntry } from '@/lib/discount'

import { DiscountEditor } from './index'

export type GroupDiscountEditorProps = {
  groups: string[]
  value: GroupDiscountEntry[]
  onChange: (entries: GroupDiscountEntry[]) => void
}

function entryForGroup(
  entries: GroupDiscountEntry[],
  group: string
): GroupDiscountEntry {
  return (
    entries.find((entry) => entry.group === group) ?? {
      group,
      discount: null,
      model_discounts: [],
    }
  )
}

function replaceGroup(
  entries: GroupDiscountEntry[],
  group: string,
  next: GroupDiscountEntry
): GroupDiscountEntry[] {
  const names = new Set(entries.map((entry) => entry.group))
  names.add(group)
  return [...names].sort().map((name) => {
    if (name === group) return next
    return entryForGroup(entries, name)
  })
}

export function GroupDiscountEditor(props: GroupDiscountEditorProps) {
  const { t } = useTranslation()
  const groups = [
    ...new Set(
      [...props.groups, ...props.value.map((entry) => entry.group)].filter(
        (group) => group.trim() !== ''
      )
    ),
  ].sort()

  if (groups.length === 0) {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('No resource groups available.')}
      </p>
    )
  }

  return (
    <Accordion className='rounded-lg border px-3'>
      {groups.map((group) => {
        const entry = entryForGroup(props.value, group)
        const hasOverride =
          entry.discount != null || entry.model_discounts.length > 0
        return (
          <AccordionItem key={group} value={group}>
            <AccordionTrigger>
              <span className='flex min-w-0 items-center gap-2'>
                <span className='truncate'>{group}</span>
                {hasOverride ? (
                  <span className='text-muted-foreground text-xs font-normal'>
                    {t('Custom discount')}
                  </span>
                ) : null}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <DiscountEditor
                defaultDiscount={entry.discount}
                onDefaultDiscountChange={(discount) =>
                  props.onChange(
                    replaceGroup(props.value, group, { ...entry, discount })
                  )
                }
                allowEmptyDefault
                defaultLabel={t('Resource group discount')}
                defaultDescription={t(
                  'Leave empty to use the resource group default.'
                )}
                modelLabel={t('Model discounts in this group')}
                emptyModelsHint={t(
                  'No per-model overrides. The group discount applies.'
                )}
                modelDiscounts={entry.model_discounts}
                onModelDiscountsChange={(rows) =>
                  props.onChange(
                    replaceGroup(props.value, group, {
                      ...entry,
                      model_discounts: rows,
                    })
                  )
                }
              />
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
