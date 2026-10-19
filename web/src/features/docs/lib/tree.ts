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
import type { DocNode } from '../types'

export function firstDocPath(nodes: DocNode[]): string {
  for (const node of nodes) {
    if (node.path) return node.path
    const nested = firstDocPath(node.children ?? [])
    if (nested) return nested
  }
  return ''
}

export function docPathFromLocation(pathname: string): string {
  if (pathname === '/app/docs' || pathname === '/app/docs/') return ''
  const prefix = '/app/docs/'
  if (!pathname.startsWith(prefix)) return ''
  return decodeURIComponent(pathname.slice(prefix.length))
}
