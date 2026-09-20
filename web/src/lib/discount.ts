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
export type ModelDiscountRow = {
  id?: string
  model: string
  discount: number
}

function isValidDiscount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function normalizeDiscountMap(
  raw: Record<string, unknown>
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw)) {
    const name = key.trim()
    if (!name || !isValidDiscount(value)) continue
    out[name] = value
  }
  return out
}

export function parseModelDiscounts(raw: unknown): Record<string, number> {
  if (raw == null || raw === '') return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return normalizeDiscountMap(raw as Record<string, unknown>)
  }
  if (typeof raw !== 'string') return {}
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '{}') return {}
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return normalizeDiscountMap(parsed as Record<string, unknown>)
    }
  } catch {
    return {}
  }
  return {}
}

export function modelDiscountsToRows(
  map: Record<string, number>
): ModelDiscountRow[] {
  return Object.entries(map).map(([model, discount]) => ({
    id: `discount-${model}`,
    model,
    discount,
  }))
}

export function serializeModelDiscounts(rows: ModelDiscountRow[]): string {
  const map: Record<string, number> = {}
  for (const row of rows) {
    const name = row.model.trim()
    if (!name || !isValidDiscount(row.discount)) continue
    map[name] = row.discount
  }
  return Object.keys(map).length === 0 ? '' : JSON.stringify(map)
}

export type GroupDiscountEntry = {
  group: string
  discount: number | null
  model_discounts: ModelDiscountRow[]
}

export type DisplayDiscountUser = {
  discount?: number | null
  model_discounts?: unknown
  group_discounts?: unknown
  group_model_discounts?: unknown
  group?: string
}

function parseJSONObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '{}') return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }
  return null
}

export function parseGroupDiscounts(raw: unknown): Record<string, number> {
  return parseModelDiscounts(raw)
}

export function parseGroupModelDiscounts(
  raw: unknown
): Record<string, Record<string, number>> {
  const parsed = parseJSONObject(raw)
  if (!parsed) return {}
  const out: Record<string, Record<string, number>> = {}
  for (const [group, value] of Object.entries(parsed)) {
    const name = group.trim()
    if (!name) continue
    const models = parseModelDiscounts(value)
    if (Object.keys(models).length > 0) {
      out[name] = models
    }
  }
  return out
}

export function serializeGroupDiscounts(entries: GroupDiscountEntry[]): string {
  const map: Record<string, number> = {}
  for (const entry of entries) {
    const group = entry.group.trim()
    if (!group || !isValidDiscount(entry.discount)) continue
    map[group] = entry.discount
  }
  return Object.keys(map).length === 0 ? '' : JSON.stringify(map)
}

export function serializeGroupModelDiscounts(
  entries: GroupDiscountEntry[]
): string {
  const map: Record<string, Record<string, number>> = {}
  for (const entry of entries) {
    const group = entry.group.trim()
    if (!group) continue
    const models: Record<string, number> = {}
    for (const row of entry.model_discounts) {
      const name = row.model.trim()
      if (!name || !isValidDiscount(row.discount)) continue
      models[name] = row.discount
    }
    if (Object.keys(models).length === 0) continue
    map[group] = models
  }
  return Object.keys(map).length === 0 ? '' : JSON.stringify(map)
}

export function groupDiscountEntriesFromUser(
  user: DisplayDiscountUser,
  groups: string[] = []
): GroupDiscountEntry[] {
  const groupDiscounts = parseGroupDiscounts(user.group_discounts)
  const groupModels = parseGroupModelDiscounts(user.group_model_discounts)
  const names = new Set<string>()
  for (const group of groups) {
    const name = group.trim()
    if (name) names.add(name)
  }
  if (user.group?.trim()) names.add(user.group.trim())
  for (const group of Object.keys(groupDiscounts)) names.add(group)
  for (const group of Object.keys(groupModels)) names.add(group)

  const hasScoped =
    Object.keys(groupDiscounts).length > 0 || Object.keys(groupModels).length > 0
  const legacyModels = parseModelDiscounts(user.model_discounts)
  if (
    !hasScoped &&
    (isValidDiscount(user.discount) || Object.keys(legacyModels).length > 0)
  ) {
    const fallbackGroup = user.group?.trim() || 'default'
    names.add(fallbackGroup)
    if (isValidDiscount(user.discount)) {
      groupDiscounts[fallbackGroup] = user.discount
    }
    if (Object.keys(legacyModels).length > 0) {
      groupModels[fallbackGroup] = legacyModels
    }
  }

  return [...names].sort().map((group) => ({
    group,
    discount: Object.hasOwn(groupDiscounts, group) ? groupDiscounts[group] : null,
    model_discounts: modelDiscountsToRows(groupModels[group] ?? {}),
  }))
}

export function resolveUserDisplayDiscount(
  modelName: string,
  user: DisplayDiscountUser | null | undefined,
  groupRatio: Record<string, number> = {},
  usingGroup?: string
): number {
  if (!user) return 1
  const group = usingGroup?.trim() || user.group?.trim() || ''
  const groupModels = parseGroupModelDiscounts(user.group_model_discounts)
  if (group && modelName && Object.hasOwn(groupModels[group] ?? {}, modelName)) {
    return groupModels[group][modelName]
  }
  const groupDiscounts = parseGroupDiscounts(user.group_discounts)
  if (group && Object.hasOwn(groupDiscounts, group)) {
    return groupDiscounts[group]
  }
  const modelMap = parseModelDiscounts(user.model_discounts)
  if (modelName && Object.hasOwn(modelMap, modelName)) {
    return modelMap[modelName]
  }
  if (isValidDiscount(user.discount)) {
    return user.discount
  }
  if (group && Object.hasOwn(groupRatio, group)) {
    const ratio = groupRatio[group]
    if (isValidDiscount(ratio)) return ratio
  }
  return 1
}
