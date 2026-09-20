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
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(process.cwd(), '..')

describe('portal logs source packaging', () => {
  it('keeps the request logs route eligible for commits while ignoring runtime logs', () => {
    const result = spawnSync(
      'git',
      [
        'check-ignore',
        '--no-index',
        'web/src/routes/_authenticated/app/logs/index.tsx',
        'logs/server.log',
        'web/logs/dev.log',
      ],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stdout.trim().split('\n')).toEqual([
      'logs/server.log',
      'web/logs/dev.log',
    ])
  })
})
