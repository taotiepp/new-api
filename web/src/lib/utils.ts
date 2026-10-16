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
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sleep(ms: number = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 清理 CSS 变量名，替换特殊字符
 * 用于将模型名称（如 gpt-3.5-turbo）转换为有效的 CSS 变量名（gpt-3-5-turbo）
 * @param name - 原始名称
 * @returns 清理后的 CSS 变量名
 */
export function sanitizeCssVariableName(name: string): string {
  // 将点号、空格、斜杠替换为连字符
  // 移除其他不允许在 CSS 变量名中的特殊字符
  return name.replace(/[.\s/]/g, '-').replace(/[^\w-]/g, '')
}

/**
 * Generates page numbers for pagination with ellipsis
 * @param currentPage - Current page number (1-based)
 * @param totalPages - Total number of pages
 * @returns Array of page numbers and ellipsis strings
 *
 * Examples:
 * - Small dataset: [1, 2, 3, 4]
 * - Near beginning: [1, 2, 3, '...', 10]
 * - In middle: [1, '...', 4, 5, 6, '...', 10]
 * - Near end: [1, '...', 8, 9, 10]
 */
export function getPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 1) {
    return totalPages === 1 ? [1] : []
  }

  const pages = new Set<number>([1, totalPages])
  for (const page of [currentPage - 1, currentPage, currentPage + 1]) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page)
    }
  }

  const sorted = [...pages].sort((left, right) => left - right)
  const rangeWithDots: Array<number | '...'> = []
  for (const page of sorted) {
    const previous = rangeWithDots.at(-1)
    if (typeof previous === 'number' && page - previous > 1) {
      rangeWithDots.push('...')
    }
    rangeWithDots.push(page)
  }
  return rangeWithDots
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Try to parse and pretty-print JSON, fallback to original text if invalid
 * @param text - Text that might be JSON
 * @returns Pretty-printed JSON or original text
 */
export function tryPrettyJson(text: string): string {
  const raw = (text ?? '').toString().trim()
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}
