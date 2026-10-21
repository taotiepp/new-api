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
  appendSourceModels,
  commitGroup,
  setSourceAliases,
  type EditorGroup,
  type EditorModel,
} from '../draft'

let nextId = 0

function createId() {
  nextId += 1
  return `id-${nextId}`
}

function model(
  partial: Partial<EditorModel> & Pick<EditorModel, 'name'>
): EditorModel {
  return {
    localId: partial.localId ?? partial.name,
    source_group: partial.source_group ?? 'default',
    source_model: partial.source_model ?? partial.name,
    redirect: partial.redirect ?? '',
    name: partial.name,
  }
}

describe('appendSourceModels', () => {
  it('adds every selected source model in one pass', () => {
    const existing = [model({ name: 'kept' })]
    const result = appendSourceModels(
      existing,
      'default',
      ['gpt-4o', 'claude-3'],
      createId
    )

    expect(result.added).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.models.map((item) => item.name)).toEqual([
      'kept',
      'gpt-4o',
      'claude-3',
    ])
    expect(result.models[1]).toMatchObject({
      source_group: 'default',
      source_model: 'gpt-4o',
      redirect: '',
    })
    expect(existing).toHaveLength(1)
  })

  it('skips models already present by public name or source pair', () => {
    const existing = [
      model({ name: 'gpt-4o' }),
      model({
        name: 'alias',
        source_group: 'vip',
        source_model: 'claude-3',
      }),
    ]
    const result = appendSourceModels(
      existing,
      'vip',
      ['gpt-4o', 'claude-3', 'gemini', ' '],
      createId
    )

    expect(result.added).toBe(1)
    expect(result.skipped).toBe(3)
    expect(result.models.map((item) => item.name)).toEqual([
      'gpt-4o',
      'alias',
      'gemini',
    ])
  })
})

describe('setSourceAliases', () => {
  it('keeps every alias on the same source model and clears upstream redirect', () => {
    const existing = [
      model({
        name: 'deepseek-flash',
        source_model: 'deepseek-flash',
        redirect: 'gpt-5.6-luna',
      }),
    ]

    const result = setSourceAliases(
      existing,
      'default',
      'deepseek-flash',
      ['deepseek-flash', 'gpt-5.6-luna', 'gpt-6-luna'],
      createId
    )

    expect(result.rejected).toEqual([])
    expect(result.models).toEqual([
      expect.objectContaining({
        name: 'deepseek-flash',
        source_group: 'default',
        source_model: 'deepseek-flash',
        redirect: '',
      }),
      expect.objectContaining({
        name: 'gpt-5.6-luna',
        source_group: 'default',
        source_model: 'deepseek-flash',
        redirect: '',
      }),
      expect.objectContaining({
        name: 'gpt-6-luna',
        source_group: 'default',
        source_model: 'deepseek-flash',
        redirect: '',
      }),
    ])
  })

  it('rejects an alias already used by another source model', () => {
    const existing = [
      model({ name: 'gpt-4o', source_model: 'gpt-4o' }),
      model({ name: 'deepseek-flash', source_model: 'deepseek-flash' }),
    ]

    const result = setSourceAliases(
      existing,
      'default',
      'deepseek-flash',
      ['deepseek-flash', 'gpt-4o'],
      createId
    )

    expect(result.rejected).toEqual(['gpt-4o'])
    expect(result.models.map((item) => item.name)).toEqual([
      'gpt-4o',
      'deepseek-flash',
    ])
  })
})

describe('commitGroup', () => {
  const groups: EditorGroup[] = [{ localId: 'g1', name: 'alias', models: [] }]

  it('rejects an empty or duplicate group name', () => {
    expect(
      commitGroup(
        groups,
        { mode: 'create' },
        { name: '  ', models: [] },
        createId
      ).ok
    ).toBe(false)
    expect(
      commitGroup(
        groups,
        { mode: 'create' },
        { name: 'alias', models: [] },
        createId
      )
    ).toMatchObject({ ok: false, reason: 'duplicate-name' })
  })

  it('keeps the edited group identity when the name changes', () => {
    const result = commitGroup(
      groups,
      { mode: 'edit', localId: 'g1' },
      { name: 'alias-2', models: [model({ name: 'gpt-4o' })] },
      createId
    )

    expect(result).toMatchObject({
      ok: true,
      groups: [{ localId: 'g1', name: 'alias-2' }],
    })
  })
})
