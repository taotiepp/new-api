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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { getUserGroups, getVirtualGroups, updateVirtualGroups } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import { GroupEditorCard } from './components/group-editor-card'
import { GroupList } from './components/group-list'
import {
  commitGroup,
  toVirtualGroups,
  withLocalIds,
  type EditorGroup,
  type GroupDraft,
  type GroupSession,
} from './lib/draft'

export function VirtualGroupsPage(props: { embedded?: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [groups, setGroups] = useState<EditorGroup[]>([])
  const [session, setSession] = useState<GroupSession | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const draftStore = useRef<{ draft: GroupDraft | null }>({ draft: null })

  const catalogQuery = useQuery({
    queryKey: ['virtual-groups'],
    queryFn: async () => requireServerSuccess(await getVirtualGroups()),
  })
  const groupsQuery = useQuery({
    queryKey: ['user-groups'],
    queryFn: async () => requireServerSuccess(await getUserGroups()),
  })

  useEffect(() => {
    if (!catalogQuery.data || loaded) return
    setGroups(
      withLocalIds(catalogQuery.data.data ?? [], () => crypto.randomUUID())
    )
    setLoaded(true)
  }, [catalogQuery.data, loaded])

  const sourceGroups = useMemo(
    () =>
      Object.entries(groupsQuery.data?.data ?? {})
        .filter(([name, info]) => name !== 'auto' && !info.virtual)
        .map(([name, info]) => ({
          value: name,
          label: info.desc ? `${name} · ${info.desc}` : name,
        })),
    [groupsQuery.data]
  )

  const saveMutation = useMutation({
    mutationFn: async (next: EditorGroup[]) =>
      requireServerSuccess(await updateVirtualGroups(toVirtualGroups(next))),
    onSuccess: async (_data, next) => {
      setGroups(next)
      setSession(null)
      toast.success(t('Virtual groups saved'))
      await queryClient.invalidateQueries({ queryKey: ['virtual-groups'] })
      await queryClient.invalidateQueries({ queryKey: ['user-groups'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const editing =
    session?.mode === 'edit'
      ? groups.find((group) => group.localId === session.localId)
      : undefined
  const removeTarget = groups.find((group) => group.localId === removeId)

  const saveEditing = () => {
    if (!session || saveMutation.isPending) return
    const draft = draftStore.current.draft
    if (!draft) return
    const result = commitGroup(groups, session, draft, () =>
      crypto.randomUUID()
    )
    if (!result.ok) {
      toast.error(
        result.reason === 'empty-name'
          ? t('Group name is required')
          : t('Virtual group name is duplicated')
      )
      return
    }
    saveMutation.mutate(result.groups)
  }

  let initialSourceGroup = sourceGroups[0]?.value ?? ''
  const editingSource = editing?.models[0]?.source_group
  if (
    editingSource &&
    sourceGroups.some((option) => option.value === editingSource)
  ) {
    initialSourceGroup = editingSource
  }

  const loadError =
    catalogQuery.isError && !loaded && catalogQuery.error instanceof Error
      ? catalogQuery.error.message
      : ''

  let catalogBody: ReactNode
  if (loadError !== '') {
    catalogBody = <p className='text-destructive text-sm'>{loadError}</p>
  } else if (session === null) {
    catalogBody = (
      <GroupList
        groups={groups}
        loading={!loaded && catalogQuery.isLoading}
        onAdd={() => setSession({ mode: 'create' })}
        onEdit={(localId) => setSession({ mode: 'edit', localId })}
        onRemove={setRemoveId}
      />
    )
  } else {
    catalogBody = (
      <GroupEditorCard
        key={session.mode === 'edit' ? session.localId : 'create'}
        mode={session.mode}
        initialName={editing?.name ?? ''}
        initialModels={editing?.models ?? []}
        initialSourceGroup={initialSourceGroup}
        sourceGroups={sourceGroups}
        draftStore={draftStore}
        pending={saveMutation.isPending}
        onSave={saveEditing}
        onCancel={() => {
          if (saveMutation.isPending) return
          setSession(null)
        }}
      />
    )
  }

  const editor = (
    <div className='flex max-w-4xl flex-col gap-4'>
      {props.embedded || session != null ? null : (
        <p className='text-muted-foreground text-sm'>
          {t(
            'Add models from groups you can already use. Requests are billed with the source group and source model.'
          )}
        </p>
      )}
      {catalogBody}
      <ConfirmDialog
        open={removeTarget != null}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null)
        }}
        title={t('Remove virtual group')}
        desc={t('{{name}} will be removed from this list.', {
          name: removeTarget?.name ?? '',
        })}
        confirmText={t('Remove')}
        destructive
        isLoading={saveMutation.isPending}
        handleConfirm={() => {
          if (!removeTarget || saveMutation.isPending) return
          const next = groups.filter(
            (group) => group.localId !== removeTarget.localId
          )
          setRemoveId(null)
          saveMutation.mutate(next)
        }}
      />
    </div>
  )

  if (props.embedded) return editor

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Virtual groups')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>{editor}</SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
