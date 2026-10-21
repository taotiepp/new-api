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
import type { VirtualGroup, VirtualGroupModel } from '@/lib/api'

export type EditorModel = VirtualGroupModel & { localId: string }

export type EditorGroup = {
  localId: string
  name: string
  models: EditorModel[]
}

export type GroupDraft = {
  name: string
  models: EditorModel[]
}

export type GroupSession =
  | { mode: 'create' }
  | { mode: 'edit'; localId: string }

export function withLocalIds(
  groups: readonly VirtualGroup[],
  createId: () => string
): EditorGroup[] {
  return groups.map((group) => ({
    localId: createId(),
    name: group.name,
    models: (group.models ?? []).map((model) => ({
      name: model.name,
      source_group: model.source_group,
      source_model: model.source_model,
      redirect: model.redirect ?? '',
      localId: createId(),
    })),
  }))
}

export function toVirtualGroups(
  groups: readonly EditorGroup[]
): VirtualGroup[] {
  return groups.map((group) => ({
    name: group.name,
    models: group.models.map((model) => ({
      name: model.name,
      source_group: model.source_group,
      source_model: model.source_model,
      redirect: model.redirect ?? '',
    })),
  }))
}

export function appendSourceModels(
  models: readonly EditorModel[],
  sourceGroup: string,
  sourceModels: readonly string[],
  createId: () => string
): { models: EditorModel[]; added: number; skipped: number } {
  const names = new Set(models.map((model) => model.name))
  const sources = new Set(
    models.map((model) => `${model.source_group}\0${model.source_model}`)
  )
  const next = models.map((model) => ({ ...model }))
  let added = 0
  let skipped = 0
  const group = sourceGroup.trim()
  for (const sourceModel of sourceModels) {
    const name = sourceModel.trim()
    if (group === '' || name === '') {
      skipped += 1
      continue
    }
    const sourceKey = `${group}\0${name}`
    if (names.has(name) || sources.has(sourceKey)) {
      skipped += 1
      continue
    }
    names.add(name)
    sources.add(sourceKey)
    next.push({
      name,
      source_group: group,
      source_model: name,
      redirect: '',
      localId: createId(),
    })
    added += 1
  }
  return { models: next, added, skipped }
}

export type SourceModelAliases = {
  source_group: string
  source_model: string
  aliases: string[]
}

export function sourceModelAliases(
  models: readonly EditorModel[]
): SourceModelAliases[] {
  const cards: SourceModelAliases[] = []
  const index = new Map<string, SourceModelAliases>()
  for (const model of models) {
    const key = `${model.source_group}\0${model.source_model}`
    const existing = index.get(key)
    if (!existing) {
      const card: SourceModelAliases = {
        source_group: model.source_group,
        source_model: model.source_model,
        aliases: [model.name],
      }
      index.set(key, card)
      cards.push(card)
      continue
    }
    if (!existing.aliases.includes(model.name)) {
      existing.aliases.push(model.name)
    }
  }
  return cards
}

export function setSourceAliases(
  models: readonly EditorModel[],
  sourceGroup: string,
  sourceModel: string,
  aliases: readonly string[],
  createId: () => string
): { models: EditorModel[]; rejected: string[] } {
  const key = `${sourceGroup}\0${sourceModel}`
  const usedByOthers = new Set(
    models
      .filter((model) => `${model.source_group}\0${model.source_model}` !== key)
      .map((model) => model.name)
  )
  const previous = new Map(
    models
      .filter((model) => `${model.source_group}\0${model.source_model}` === key)
      .map((model) => [model.name, model])
  )
  const nextAliases: EditorModel[] = []
  const seen = new Set<string>()
  const rejected: string[] = []
  for (const raw of aliases) {
    const name = raw.trim()
    if (name === '' || seen.has(name)) continue
    if (usedByOthers.has(name)) {
      rejected.push(name)
      continue
    }
    seen.add(name)
    nextAliases.push({
      name,
      source_group: sourceGroup,
      source_model: sourceModel,
      redirect: '',
      localId: previous.get(name)?.localId ?? createId(),
    })
  }
  if (nextAliases.length === 0 && rejected.length > 0) {
    return { models: models.map((model) => ({ ...model })), rejected }
  }
  const result: EditorModel[] = []
  let inserted = false
  for (const model of models) {
    if (`${model.source_group}\0${model.source_model}` !== key) {
      result.push({ ...model })
      continue
    }
    if (!inserted) {
      result.push(...nextAliases)
      inserted = true
    }
  }
  if (!inserted) result.push(...nextAliases)
  return { models: result, rejected }
}

export function commitGroup(
  groups: readonly EditorGroup[],
  session: GroupSession,
  draft: GroupDraft,
  createId: () => string
):
  | { ok: true; groups: EditorGroup[] }
  | { ok: false; reason: 'empty-name' | 'duplicate-name' } {
  const name = draft.name.trim()
  if (name === '') return { ok: false, reason: 'empty-name' }
  const localId = session.mode === 'edit' ? session.localId : createId()
  const duplicated = groups.some(
    (group) => group.name === name && group.localId !== localId
  )
  if (duplicated) return { ok: false, reason: 'duplicate-name' }
  const nextGroup: EditorGroup = {
    localId,
    name,
    models: draft.models.map((model) => ({ ...model })),
  }
  if (session.mode === 'create') {
    return { ok: true, groups: [...groups, nextGroup] }
  }
  const exists = groups.some((group) => group.localId === localId)
  if (!exists) return { ok: true, groups: [...groups, nextGroup] }
  return {
    ok: true,
    groups: groups.map((group) =>
      group.localId === localId ? nextGroup : group
    ),
  }
}
