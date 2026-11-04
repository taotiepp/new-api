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
import { useEffect, useState } from 'react'

export const PORTAL_LOG_COLUMNS = [
  { id: 'time', label: 'Time' },
  { id: 'type', label: 'Type' },
  { id: 'model', label: 'Model' },
  { id: 'token', label: 'API Key' },
  { id: 'group', label: 'Group' },
  { id: 'content', label: 'Content' },
  { id: 'input', label: 'Input' },
  { id: 'output', label: 'Output' },
  { id: 'cache', label: 'Cache' },
  { id: 'duration', label: 'Duration' },
  { id: 'stream', label: 'Stream' },
  { id: 'cost', label: 'Cost' },
] as const

const STORAGE_KEY = 'portal-logs:column-visibility'

export function usePortalLogColumnVisibility() {
  const [hiddenColumnIds, setHiddenColumnIds] = useState<ReadonlySet<string>>(
    () => readHiddenPortalLogColumns()
  )

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...hiddenColumnIds]))
    } catch {
      return
    }
  }, [hiddenColumnIds])

  const setColumnVisible = (id: string, visible: boolean) => {
    setHiddenColumnIds((current) => {
      const next = new Set(current)
      if (visible) {
        next.delete(id)
        return next
      }
      if (next.has(id)) return current
      if (PORTAL_LOG_COLUMNS.length - next.size <= 1) return current
      next.add(id)
      return next
    })
  }

  return { hiddenColumnIds, setColumnVisible }
}

function readHiddenPortalLogColumns(): Set<string> {
  const known = new Set<string>(PORTAL_LOG_COLUMNS.map((column) => column.id))
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    const hidden = parsed.filter(
      (id): id is string => typeof id === 'string' && known.has(id)
    )
    if (hidden.length >= known.size) return new Set()
    return new Set(hidden)
  } catch {
    return new Set()
  }
}
