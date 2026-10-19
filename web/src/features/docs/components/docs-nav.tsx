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
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

import type { DocNode } from '../types'

type DocsNavProps = {
  nodes: DocNode[]
  activePath: string
  onNavigate?: () => void
}

export function DocsNav(props: DocsNavProps) {
  const { t } = useTranslation()

  return (
    <nav aria-label={t('Documentation menu')} className='flex flex-col gap-0.5 p-3'>
      {props.nodes.map((node) => (
        <DocsNavBranch
          key={node.path || node.title}
          node={node}
          activePath={props.activePath}
          depth={0}
          onNavigate={props.onNavigate}
        />
      ))}
    </nav>
  )
}

function DocsNavBranch(props: {
  node: DocNode
  activePath: string
  depth: number
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const children = props.node.children ?? []
  const hasChildren = children.length > 0
  const current = props.node.path !== '' && props.node.path === props.activePath
  const branchActive =
    props.activePath === props.node.path ||
    props.activePath.startsWith(`${props.node.path}/`)
  const [open, setOpen] = useState(branchActive)
  useEffect(() => {
    if (branchActive) setOpen(true)
  }, [branchActive])

  const label = (
    <span className='min-w-0 flex-1 truncate text-left'>{props.node.title}</span>
  )
  const itemClass = cn(
    'flex min-w-0 flex-1 items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted',
    current && 'bg-muted font-medium'
  )

  const row = props.node.path ? (
    <Link
      aria-current={current ? 'page' : undefined}
      className={itemClass}
      params={{ _splat: props.node.path }}
      to='/docs/$'
      onClick={props.onNavigate}
    >
      {label}
    </Link>
  ) : (
    <span className={cn(itemClass, 'text-muted-foreground')}>{label}</span>
  )

  if (!hasChildren) {
    return (
      <div style={{ paddingInlineStart: `${props.depth * 0.75}rem` }}>{row}</div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className='flex items-center gap-0.5'
        style={{ paddingInlineStart: `${props.depth * 0.75}rem` }}
      >
        {row}
        <CollapsibleTrigger
          aria-label={t('Toggle {{name}}', { name: props.node.title })}
          className='text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md'
        >
          <ChevronRight
            aria-hidden
            className={cn('size-4 transition-transform', open && 'rotate-90')}
          />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        {children.map((child) => (
          <DocsNavBranch
            key={child.path || child.title}
            node={child}
            activePath={props.activePath}
            depth={props.depth + 1}
            onNavigate={props.onNavigate}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
