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
import { z } from 'zod'

import {
  type PermissionCatalog,
  type AdminPermissionMatrix,
  normalizeAdminPermissions,
} from '@/lib/admin-permissions'
import {
  groupDiscountEntriesFromUser,
  serializeGroupDiscounts,
  serializeGroupModelDiscounts,
  type GroupDiscountEntry,
} from '@/lib/discount'
import { quotaUnitsToDollars } from '@/lib/format'
import { ROLE } from '@/lib/roles'

import { DEFAULT_GROUP } from '../constants'
import type { UserFormData, User } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

export const userFormSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  display_name: z.string().optional(),
  password: z.string().optional(),
  role: z.number().optional(),
  quota_dollars: z.number().min(0).optional(),
  group: z.string().optional(),
  custom_usable_groups: z.boolean().optional(),
  usable_groups: z.array(z.string()).optional(),
  remark: z.string().optional(),
  group_discount_entries: z
    .array(
      z.object({
        group: z.string(),
        discount: z.number().min(0).nullable(),
        model_discounts: z.array(
          z.object({
            id: z.string().optional(),
            model: z.string(),
            discount: z.number().min(0),
          })
        ),
      })
    )
    .optional(),
  admin_permissions: z
    .record(z.string(), z.record(z.string(), z.boolean()))
    .optional(),
})

export type UserFormValues = z.infer<typeof userFormSchema>

// ============================================================================
// Form Defaults
// ============================================================================

export const USER_FORM_DEFAULT_VALUES: UserFormValues = {
  username: '',
  display_name: '',
  password: '',
  role: 1, // Default to common user
  quota_dollars: 0,
  group: DEFAULT_GROUP,
  custom_usable_groups: false,
  usable_groups: [] as string[],
  remark: '',
  group_discount_entries: [] as GroupDiscountEntry[],
  // Filled against the backend catalog at render time; see UsersMutateDrawer.
  admin_permissions: {},
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 */
export function transformFormDataToPayload(
  data: UserFormValues,
  userId?: number,
  catalog?: PermissionCatalog
): UserFormData & { id?: number } {
  const payload: UserFormData & { id?: number } = {
    username: data.username,
    display_name: data.display_name || data.username,
    password: data.password || undefined,
  }

  const role = userId === undefined ? data.role || 1 : (data.role ?? 0)

  // Only send the permission matrix when the target is an admin and the catalog
  // is available; without the catalog we cannot build a full matrix, so we omit
  // the field (the backend then leaves existing permissions untouched).
  if (role >= ROLE.ADMIN && catalog) {
    payload.admin_permissions = normalizeAdminPermissions(
      data.admin_permissions as AdminPermissionMatrix | undefined,
      catalog
    )
  }

  // For create: only send required fields
  if (userId === undefined) {
    payload.role = role
  } else {
    // For update: quota is adjusted atomically via /api/user/manage, not sent here
    payload.group = data.group
    payload.usable_groups = serializeUsableGroups(
      data.custom_usable_groups,
      data.group,
      data.usable_groups
    )
    payload.remark = data.remark || undefined
    payload.discount = null
    payload.model_discounts = ''
    payload.group_discounts = serializeGroupDiscounts(
      data.group_discount_entries ?? []
    )
    payload.group_model_discounts = serializeGroupModelDiscounts(
      data.group_discount_entries ?? []
    )
    payload.id = userId
  }

  return payload
}

/**
 * Transform user data to form defaults. The admin permission matrix is passed
 * through as-is (the backend already returns a full matrix); it is filled against
 * the catalog at render time in UsersMutateDrawer.
 */
export function transformUserToFormDefaults(
  user: User,
  groups: string[] = []
): UserFormValues {
  return {
    username: user.username,
    display_name: user.display_name,
    password: '',
    role: user.role,
    quota_dollars: quotaUnitsToDollars(user.quota),
    group: user.group || DEFAULT_GROUP,
    custom_usable_groups: parseUsableGroups(user.usable_groups) != null,
    usable_groups: parseUsableGroups(user.usable_groups) ?? [],
    remark: user.remark || '',
    group_discount_entries: groupDiscountEntriesFromUser(user, groups),
    admin_permissions: user.admin_permissions ?? {},
  }
}

function serializeUsableGroups(
  custom: boolean | undefined,
  assignedGroup: string | undefined,
  groups: string[] | undefined
): string {
  if (!custom) {
    return ''
  }
  const names = new Set<string>()
  const assigned = assignedGroup?.trim()
  if (assigned && assigned !== 'auto') {
    names.add(assigned)
  }
  for (const group of groups ?? []) {
    const name = group.trim()
    if (name !== '' && name !== 'auto') {
      names.add(name)
    }
  }
  return JSON.stringify([...names].sort())
}

function parseUsableGroups(raw?: string | null): string[] | null {
  const trimmed = raw?.trim()
  if (!trimmed || trimmed === 'null') {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) {
      return null
    }
    const names: string[] = []
    const seen = new Set<string>()
    for (const item of parsed) {
      if (typeof item !== 'string') {
        continue
      }
      const name = item.trim()
      if (name === '' || name === 'auto' || seen.has(name)) {
        continue
      }
      seen.add(name)
      names.push(name)
    }
    return names
  } catch {
    return null
  }
}
