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
import { createFileRoute, redirect } from '@tanstack/react-router'

import { getDocTree } from '@/features/docs/api'
import { DocsArticle } from '@/features/docs/components/docs-article'
import { firstDocPath } from '@/features/docs/lib/tree'

export const Route = createFileRoute('/docs/')({
  beforeLoad: async ({ context }) => {
    const tree = await context.queryClient.ensureQueryData({
      queryKey: ['doc-site', 'tree'],
      queryFn: getDocTree,
    })
    const path = firstDocPath(tree.data ?? [])
    if (!path) return
    throw redirect({
      to: '/docs/$',
      params: { _splat: path },
      replace: true,
    })
  },
  component: DocsIndex,
})

function DocsIndex() {
  return <DocsArticle path='' />
}
