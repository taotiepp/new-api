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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { DocsArticle } from '../components/docs-article'

const navigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('../api', () => ({
  getDocPage: vi.fn(async () => ({
    success: true,
    data: {
      path: 'model-calling',
      title: '模型调用',
      content:
        '见 [虚拟分组的使用](/app/docs/virtual-groups)。也可以看 [官网](https://example.com)。',
    },
  })),
}))

function renderArticle() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <DocsArticle path='model-calling' />
    </QueryClientProvider>
  )
}

describe('docs article links', () => {
  beforeEach(() => {
    navigate.mockClear()
  })

  test('opens another docs page in the current view', async () => {
    renderArticle()

    const link = await screen.findByRole('link', { name: '虚拟分组的使用' })
    expect(link).toHaveAttribute('href', '/app/docs/virtual-groups')
    expect(link).not.toHaveAttribute('target', '_blank')

    fireEvent.click(link)

    expect(navigate).toHaveBeenCalledWith({
      to: '/app/docs/$',
      params: { _splat: 'virtual-groups' },
    })
  })

  test('leaves external links for the browser', async () => {
    renderArticle()

    const link = await screen.findByRole('link', { name: '官网' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')

    fireEvent.click(link)

    expect(navigate).not.toHaveBeenCalled()
  })
})
