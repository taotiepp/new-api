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

export function insertModelAlias(
  models: readonly EditorModel[],
  localId: string,
  createId: () => string
): { models: EditorModel[]; localId: string | null } {
  const index = models.findIndex((model) => model.localId === localId)
  if (index < 0) {
    return { models: models.map((model) => ({ ...model })), localId: null }
  }
  const source = models[index]
  const insertedId = createId()
  const inserted: EditorModel = {
    name: '',
    source_group: source.source_group,
    source_model: source.source_model,
    redirect: '',
    localId: insertedId,
  }
  return {
    localId: insertedId,
    models: [
      ...models.slice(0, index + 1).map((model) => ({ ...model })),
      inserted,
      ...models.slice(index + 1).map((model) => ({ ...model })),
    ],
  }
}

export function renameModelAlias(
  models: readonly EditorModel[],
  localId: string,
  name: string
): { models: EditorModel[]; rejected: boolean } {
  const trimmed = name.trim()
  const taken =
    trimmed !== '' &&
    models.some(
      (model) => model.localId !== localId && model.name.trim() === trimmed
    )
  if (taken) {
    return { models: models.map((model) => ({ ...model })), rejected: true }
  }
  return {
    rejected: false,
    models: models.map((model) =>
      model.localId === localId ? { ...model, name } : { ...model }
    ),
  }
}

export function modelsForSave(models: readonly EditorModel[]): EditorModel[] {
  const seen = new Set<string>()
  const saved: EditorModel[] = []
  for (const model of models) {
    const name = model.name.trim()
    if (name === '' || seen.has(name)) continue
    seen.add(name)
    saved.push({ ...model, name, redirect: '' })
  }
  return saved
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
