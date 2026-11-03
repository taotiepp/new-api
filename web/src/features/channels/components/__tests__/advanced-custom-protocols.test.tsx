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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'sonner'
import { describe, expect, it, vi } from 'vitest'

import { stringifyAdvancedCustomConfig } from '../../lib/advanced-custom'
import { AdvancedCustomProtocolFields } from '../advanced-custom-protocols'

describe('advanced custom protocol fields', () => {
  it('starts with no protocol selected', () => {
    render(<AdvancedCustomProtocolFields value='' onChange={vi.fn()} />)

    expect(screen.getByRole('checkbox', { name: 'OpenAI Chat' })).not.toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'OpenAI Responses' })
    ).not.toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Claude Messages' })
    ).not.toBeChecked()
  })

  it('checks a protocol that already has a native route', () => {
    const value = stringifyAdvancedCustomConfig({
      advanced_routes: [
        {
          incoming_path: '/v1/responses',
          upstream_path: '/v1/responses',
          converter: 'none',
        },
      ],
    })

    render(<AdvancedCustomProtocolFields value={value} onChange={vi.fn()} />)

    expect(screen.getByRole('checkbox', { name: 'OpenAI Responses' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'OpenAI Chat' })).not.toBeChecked()
  })

  it('reports the selected protocol when a checkbox is turned on', async () => {
    const onChange = vi.fn()
    render(<AdvancedCustomProtocolFields value='' onChange={onChange} />)

    await userEvent.click(screen.getByRole('checkbox', { name: 'Claude Messages' }))

    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining('"/v1/messages"')
    )
    expect(onChange.mock.calls[0]?.[0]).not.toContain('/v1/chat/completions')
  })

  it('checks only the protocols detection reports as available', async () => {
    const onChange = vi.fn()
    render(
      <>
        <AdvancedCustomProtocolFields
          value=''
          onChange={onChange}
          onDetect={async () => ['openai-responses']}
        />
        <Toaster />
      </>
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Detect protocols' })
    )

    const next = onChange.mock.calls[0]?.[0] as string
    expect(next).toContain('/v1/responses')
    expect(next).not.toContain('/v1/messages')
    expect(next).not.toContain('/v1/chat/completions')
    expect(await screen.findByText('Detected OpenAI Responses')).toBeVisible()
  })
})
