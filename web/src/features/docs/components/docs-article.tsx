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
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { RichContent } from '@/components/rich-content'

import { getDocPage } from '../api'
import { docPathFromHref } from '../lib/tree'

export function DocsArticle(props: { path: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pageQuery = useQuery({
    queryKey: ['doc-site', 'page', props.path],
    queryFn: () => getDocPage(props.path),
    enabled: props.path !== '',
    retry: false,
    meta: { errorToast: false },
  })

  if (props.path === '') {
    return (
      <p className='text-muted-foreground p-6 text-sm'>
        {t('No documentation is available yet.')}
      </p>
    )
  }

  if (pageQuery.isPending) {
    return <LoadingState className='min-h-80' />
  }

  if (pageQuery.isError) {
    const missing =
      isAxiosError(pageQuery.error) && pageQuery.error.response?.status === 404
    return (
      <ErrorState
        title={missing ? t('This documentation page does not exist.') : undefined}
        description={missing ? undefined : t('Failed to load documentation')}
        onRetry={missing ? undefined : () => void pageQuery.refetch()}
      />
    )
  }

  return (
    <article
      className='min-w-0'
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return
        }
        const anchor = (event.target as Element | null)?.closest('a')
        if (!anchor || !event.currentTarget.contains(anchor)) return
        if (anchor.target === '_blank') return
        const href = anchor.getAttribute('href')
        if (!href || href.startsWith('#')) return
        const docPath = docPathFromHref(href, window.location.href)
        if (docPath === null) return
        event.preventDefault()
        if (docPath === '') {
          void navigate({ to: '/app/docs' })
          return
        }
        void navigate({ to: '/app/docs/$', params: { _splat: docPath } })
      }}
    >
      <RichContent content={pageQuery.data.data.content} />
    </article>
  )
}
