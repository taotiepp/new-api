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
import { sanitizeAuthRedirect } from '@/features/auth/lib/auth-redirect'
import { ROLE } from '@/lib/roles'

const PERSONAL_AUTHENTICATED_PREFIXES = [
  '/profile',
  '/security',
  '/wallet',
  '/errors',
  '/403',
] as const

const CONSOLE_AUTHENTICATED_PREFIXES = [
  '/dashboard',
  '/channels',
  '/users',
  '/keys',
  '/usage-logs',
  '/playground',
  '/models',
  '/system-settings',
  '/redemption-codes',
  '/subscriptions',
  '/task-plugins',
  '/system-info',
  '/chat',
] as const

export function isAdminRole(role: number | undefined): boolean {
  return (role ?? ROLE.GUEST) >= ROLE.ADMIN
}

export function isUserPortalPath(pathname: string): boolean {
  return pathname === '/app' || pathname.startsWith('/app/')
}

export function isPersonalAuthenticatedPath(pathname: string): boolean {
  return PERSONAL_AUTHENTICATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function isConsoleAuthenticatedPath(pathname: string): boolean {
  return CONSOLE_AUTHENTICATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function mapConsolePathToUserPortal(pathname: string): string {
  if (pathname.startsWith('/dashboard')) return '/app/usage'
  if (pathname.startsWith('/keys')) return '/app/keys'
  if (pathname.startsWith('/playground')) return '/app/playground'
  if (pathname.startsWith('/usage-logs')) return '/app/logs'
  return '/app'
}

export function resolveDefaultAuthenticatedPath(role: number): string {
  return isAdminRole(role) ? '/dashboard' : '/app'
}

export function resolvePostLoginTarget(
  redirect: unknown,
  role: number,
  origin: string
): string {
  const sanitized = sanitizeAuthRedirect(redirect, origin)
  if (sanitized) {
    if (!isAdminRole(role) && isConsoleAuthenticatedPath(sanitized)) {
      return mapConsolePathToUserPortal(sanitized)
    }
    return sanitized
  }
  return resolveDefaultAuthenticatedPath(role)
}

/** Redirect target for non-admin users on console routes, or null if allowed. */
export function resolveUserPortalRedirectForPath(
  role: number,
  pathname: string
): string | null {
  if (isAdminRole(role)) return null
  if (isUserPortalPath(pathname) || isPersonalAuthenticatedPath(pathname)) {
    return null
  }
  if (isConsoleAuthenticatedPath(pathname)) {
    return mapConsolePathToUserPortal(pathname)
  }
  return null
}

export function isUserPortalLogsPath(pathname: string): boolean {
  return pathname === '/app/logs' || pathname.startsWith('/app/logs/')
}
