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
import { describe, expect, test } from 'vitest'

import { docPathFromHref, docPathFromLocation, firstDocPath } from '../lib/tree'
import type { DocNode } from '../types'

const tree: DocNode[] = [
  {
    title: 'API',
    path: 'api',
    children: [
      {
        title: 'OpenAI',
        path: 'api/openai',
        children: [{ title: 'API calls', path: 'api/openai/http' }],
      },
    ],
  },
]

describe('doc tree helpers', () => {
  test('chooses the first page that has a path', () => {
    expect(firstDocPath(tree)).toBe('api')
    expect(
      firstDocPath([{ title: 'Group', path: '', children: tree }])
    ).toBe('api')
    expect(firstDocPath([])).toBe('')
  })

  test('reads the document path from the docs location', () => {
    expect(docPathFromLocation('/app/docs')).toBe('')
    expect(docPathFromLocation('/app/docs/api/openai/http')).toBe(
      'api/openai/http'
    )
    expect(docPathFromLocation('/app/docs/api/openai/http%20guide')).toBe(
      'api/openai/http guide'
    )
    expect(docPathFromLocation('/pricing')).toBe('')
  })

  test('resolves links that stay inside the docs site', () => {
    const base = 'https://gateway.example/app/docs/model-calling'
    expect(docPathFromHref('/app/docs/virtual-groups', base)).toBe(
      'virtual-groups'
    )
    expect(docPathFromHref('virtual-groups', base)).toBe('virtual-groups')
    expect(docPathFromHref('/app/docs/api/openai/http', base)).toBe(
      'api/openai/http'
    )
    expect(docPathFromHref('/app/docs', base)).toBe('')
    expect(docPathFromHref('https://example.com/app/docs/virtual-groups', base)).toBe(
      null
    )
    expect(docPathFromHref('/pricing', base)).toBe(null)
    expect(docPathFromHref('#section', base)).toBe(null)
  })
})
