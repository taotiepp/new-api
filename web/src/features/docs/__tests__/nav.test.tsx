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
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { DocsNav } from '../components/docs-nav'
import type { DocNode } from '../types'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    to: string
    params?: { _splat?: string }
    children: React.ReactNode
    className?: string
    onClick?: () => void
    'aria-current'?: 'page'
  }) => (
    <a
      aria-current={props['aria-current']}
      className={props.className}
      href={props.params?._splat ? `/docs/${props.params._splat}` : props.to}
      onClick={props.onClick}
    >
      {props.children}
    </a>
  ),
}))

const nodes: DocNode[] = [
  {
    title: 'API reference',
    path: 'api',
    children: [
      {
        title: 'OpenAI',
        path: 'api/openai',
        children: [
          { title: 'API calls', path: 'api/openai/http' },
          { title: 'SDK calls', path: 'api/openai/sdk' },
        ],
      },
      {
        title: 'Gemini',
        path: 'api/gemini',
        children: [{ title: 'API calls', path: 'api/gemini/http' }],
      },
    ],
  },
]

describe('docs navigation', () => {
  test('marks the current page and keeps its parent groups expanded', () => {
    render(<DocsNav activePath='api/openai/http' nodes={nodes} />)

    const current = screen.getByRole('link', { current: 'page' })
    expect(current).toHaveAttribute('href', '/docs/api/openai/http')
    expect(current).toHaveTextContent('API calls')
    expect(screen.getByRole('link', { name: 'SDK calls' })).toHaveAttribute(
      'href',
      '/docs/api/openai/sdk'
    )
    expect(
      screen.getByRole('button', { name: 'Toggle Gemini' })
    ).toHaveAttribute('aria-expanded', 'false')
  })

  test('expands a collapsed group from its toggle', () => {
    render(<DocsNav activePath='api/openai/http' nodes={nodes} />)

    const toggle = screen.getByRole('button', { name: 'Toggle Gemini' })
    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'API calls', current: false })).toBeTruthy()
  })
})
