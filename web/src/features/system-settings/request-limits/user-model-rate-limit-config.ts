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

// Frontend mirror of the backend `UserModelRateLimitConfig` option blob
// (setting/user_model_rate_limit.go). Limit value semantics per field:
//   0  -> inherit / unset
//   -1 -> explicit unlimited
//   >0 -> concrete limit for the window
// token_mode: '' inherit, 'total' (prompt+completion), 'input' (prompt only).

export type TokenMode = '' | 'total' | 'input'

export type ModelRateLimitValue = {
  rpm: number
  tpm: number
  token_mode: TokenMode
}

export type GroupModelRateLimitValue = {
  default: ModelRateLimitValue
  models: Record<string, ModelRateLimitValue>
}

export type UserModelRateLimitConfigValue = {
  enabled: boolean
  duration_minutes: number
  default: ModelRateLimitValue
  models: Record<string, ModelRateLimitValue>
  groups: Record<string, GroupModelRateLimitValue>
}

export const TOKEN_MODE_TOTAL: TokenMode = 'total'
export const TOKEN_MODE_INPUT: TokenMode = 'input'

export const emptyModelRateLimit = (): ModelRateLimitValue => ({
  rpm: 0,
  tpm: 0,
  token_mode: '',
})

const LIMIT_MAX = 2147483647

function clampLimit(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  const rounded = Math.trunc(n)
  if (rounded < -1) return -1
  if (rounded > LIMIT_MAX) return LIMIT_MAX
  return rounded
}

function normalizeTokenMode(value: unknown): TokenMode {
  if (value === 'total' || value === 'input') return value
  return ''
}

function normalizeModelRateLimit(value: unknown): ModelRateLimitValue {
  const src = (value ?? {}) as Record<string, unknown>
  return {
    rpm: clampLimit(src.rpm),
    tpm: clampLimit(src.tpm),
    token_mode: normalizeTokenMode(src.token_mode),
  }
}

// parseUserModelRateLimitConfig turns the raw option string into a fully
// populated config object, tolerating missing/partial fields and bad JSON.
export function parseUserModelRateLimitConfig(
  raw: string | undefined
): UserModelRateLimitConfigValue {
  const base: UserModelRateLimitConfigValue = {
    enabled: false,
    duration_minutes: 1,
    default: { ...emptyModelRateLimit(), token_mode: TOKEN_MODE_TOTAL },
    models: {},
    groups: {},
  }
  if (!raw || raw.trim() === '') return base

  let parsed: Record<string, unknown>
  try {
    const value = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return base
    }
    parsed = value as Record<string, unknown>
  } catch {
    return base
  }

  const durationMinutes = Number(parsed.duration_minutes)
  const models: Record<string, ModelRateLimitValue> = {}
  const rawModels = parsed.models
  if (rawModels && typeof rawModels === 'object' && !Array.isArray(rawModels)) {
    for (const [name, limit] of Object.entries(
      rawModels as Record<string, unknown>
    )) {
      models[name] = normalizeModelRateLimit(limit)
    }
  }

  const groups: Record<string, GroupModelRateLimitValue> = {}
  const rawGroups = parsed.groups
  if (rawGroups && typeof rawGroups === 'object' && !Array.isArray(rawGroups)) {
    for (const [name, group] of Object.entries(
      rawGroups as Record<string, unknown>
    )) {
      const g = (group ?? {}) as Record<string, unknown>
      const groupModels: Record<string, ModelRateLimitValue> = {}
      const rawGroupModels = g.models
      if (
        rawGroupModels &&
        typeof rawGroupModels === 'object' &&
        !Array.isArray(rawGroupModels)
      ) {
        for (const [modelName, limit] of Object.entries(
          rawGroupModels as Record<string, unknown>
        )) {
          groupModels[modelName] = normalizeModelRateLimit(limit)
        }
      }
      groups[name] = {
        default: normalizeModelRateLimit(g.default),
        models: groupModels,
      }
    }
  }

  return {
    enabled: parsed.enabled === true || parsed.enabled === 'true',
    duration_minutes:
      Number.isFinite(durationMinutes) && durationMinutes >= 0
        ? Math.trunc(durationMinutes)
        : 1,
    default: normalizeModelRateLimit(parsed.default),
    models,
    groups,
  }
}

export function serializeUserModelRateLimitConfig(
  config: UserModelRateLimitConfigValue
): string {
  return JSON.stringify(config, null, 2)
}

// isValidUserModelRateLimitConfigJSON is a zod refine helper for the raw option
// string: empty is allowed, otherwise it must parse to an object.
export function isValidUserModelRateLimitConfigJSON(
  value: string | undefined
): boolean {
  if (!value || value.trim() === '') return true
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
  } catch {
    return false
  }
}
