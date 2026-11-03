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
import { describe, expect, it } from 'vitest'

import {
  applyDetectedProtocols,
  selectedAdvancedCustomProtocols,
  stringifyAdvancedCustomConfig,
  withAdvancedCustomProtocol,
} from '../advanced-custom'

describe('applyDetectedProtocols', () => {
  it('checks detected protocols and clears the other native protocols', () => {
    const existing = stringifyAdvancedCustomConfig({
      advanced_routes: [
        {
          incoming_path: '/v1/chat/completions',
          upstream_path: '/v1/chat/completions',
          converter: 'none',
        },
        {
          incoming_path: '/v1beta/models/{model}:generateContent',
          upstream_path: '/v1beta/models/{model}:generateContent',
          converter: 'none',
        },
      ],
    })

    const next = applyDetectedProtocols(existing, ['claude-messages'])
    const routes = JSON.parse(next).advanced_routes

    expect(selectedAdvancedCustomProtocols(next)).toEqual(['claude-messages'])
    expect(routes).toEqual([
      expect.objectContaining({
        incoming_path: '/v1beta/models/{model}:generateContent',
      }),
      expect.objectContaining({
        incoming_path: '/v1/messages',
        converter: 'none',
      }),
    ])
  })
})

describe('advanced custom protocol selection', () => {
  it('adds only the protocol that was selected', () => {
    const next = withAdvancedCustomProtocol('', 'claude-messages', true)

    expect(selectedAdvancedCustomProtocols(next)).toEqual(['claude-messages'])
    expect(JSON.parse(next).advanced_routes).toEqual([
      {
        incoming_path: '/v1/messages',
        upstream_path: '/v1/messages',
        converter: 'none',
        auth: {
          type: 'header',
          name: 'x-api-key',
          value: '{api_key}',
        },
      },
    ])
  })

  it('keeps previously selected protocols when another one is added', () => {
    const chat = withAdvancedCustomProtocol('', 'openai-chat', true)
    const next = withAdvancedCustomProtocol(chat, 'openai-responses', true)

    expect(selectedAdvancedCustomProtocols(next)).toEqual([
      'openai-chat',
      'openai-responses',
    ])
  })

  it('removes one native protocol and keeps the others', () => {
    const chat = withAdvancedCustomProtocol('', 'openai-chat', true)
    const both = withAdvancedCustomProtocol(chat, 'claude-messages', true)
    const next = withAdvancedCustomProtocol(both, 'openai-chat', false)

    expect(selectedAdvancedCustomProtocols(next)).toEqual(['claude-messages'])
  })

  it('replaces a converted catch-all with native forwarding for that protocol', () => {
    const converted = stringifyAdvancedCustomConfig({
      advanced_routes: [
        {
          incoming_path: '/v1/messages',
          upstream_path: '/v1/chat/completions',
          converter: 'anthropic_messages_to_openai_chat_completions',
        },
      ],
    })

    const next = withAdvancedCustomProtocol(converted, 'claude-messages', true)

    expect(JSON.parse(next).advanced_routes).toEqual([
      expect.objectContaining({
        incoming_path: '/v1/messages',
        upstream_path: '/v1/messages',
        converter: 'none',
      }),
    ])
  })

  it('keeps model-specific routes and places the native catch-all after them', () => {
    const existing = stringifyAdvancedCustomConfig({
      advanced_routes: [
        {
          incoming_path: '/v1/chat/completions',
          upstream_path: '/v1/chat/completions',
          converter: 'none',
          models: ['gpt-4o'],
        },
      ],
    })

    const next = withAdvancedCustomProtocol(existing, 'openai-chat', true)
    const routes = JSON.parse(next).advanced_routes

    expect(routes).toEqual([
      expect.objectContaining({ models: ['gpt-4o'] }),
      expect.objectContaining({
        incoming_path: '/v1/chat/completions',
        converter: 'none',
      }),
    ])
    expect(routes[1].models).toBeUndefined()
  })
})
