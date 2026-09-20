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
import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { PortalBezel } from '@/components/layout/portal/portal-bezel'
import { PortalPublicShell } from '@/components/layout/portal/portal-public-shell'
import { FadeIn } from '@/components/page-transition'
import { Skeleton } from '@/components/ui/skeleton'
import { ModelPriceCell } from '@/features/pricing/components/model-price-cell'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import type { PricingModel } from '@/features/pricing/types'
import { PortalNavLinks } from '@/features/user-portal/components/portal-nav-links'
import { UserPortalHeader } from '@/features/user-portal/components/user-portal-header'
import { usePortalCatalogData } from '@/features/user-portal/hooks/use-portal-catalog-data'
import { getLobeIcon } from '@/lib/lobe-icon'
import { useAuthStore } from '@/stores/auth-store'

import '@/features/home/styles/home-landing.css'

export function HomeLanding() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const publicCatalog = usePricingData(!user)
  const portalCatalog = usePortalCatalogData(Boolean(user))
  const catalog = user ? portalCatalog : publicCatalog
  const origin =
    typeof window === 'undefined'
      ? ''
      : window.location.origin.replace(/\/$/, '')
  const snippet = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${origin}/v1",
  apiKey: "YOUR_KEY",
});`

  return (
    <PortalPublicShell>
      <div className='portal-main'>
        <UserPortalHeader />
        <main className='portal-content' id='home-landing-main'>
          <div className='portal-marketing-stage'>
            <div className='portal-module'>
            <section className='home-landing-hero'>
              <FadeIn>
                <h1 className='portal-hero-title'>
                  {t('The Unified Interface For Every Model')}
                </h1>
              </FadeIn>
              <FadeIn delay={0.08}>
                <p className='portal-hero-subtitle'>
                  {t('Better prices, better routing, no extra protocol.')}
                </p>
              </FadeIn>
              <FadeIn delay={0.14}>
                <div className='home-landing-cta-row'>
                  {user ? (
                    <Link to='/app/keys' className='portal-action-pill'>
                      <span>{t('Get API Key')}</span>
                      <span className='portal-action-pill-icon'>
                        <ArrowRight className='size-4' />
                      </span>
                    </Link>
                  ) : (
                    <Link to='/sign-up' className='portal-action-pill'>
                      <span>{t('Get API Key')}</span>
                      <span className='portal-action-pill-icon'>
                        <ArrowRight className='size-4' />
                      </span>
                    </Link>
                  )}
                  {user ? (
                    <Link to='/app' className='home-landing-cta-ghost'>
                      {t('Discover Models')}
                    </Link>
                  ) : (
                    <Link to='/pricing' className='home-landing-cta-ghost'>
                      {t('Discover Models')}
                    </Link>
                  )}
                </div>
              </FadeIn>
            </section>

            <HomeLandingStats
              modelCount={catalog.models.length}
              vendorCount={catalog.vendors.length}
              isLoading={catalog.isLoading}
            />
            <HomeLandingFeatured
              models={catalog.models}
              isLoading={catalog.isLoading}
              priceRate={catalog.priceRate}
              usdExchangeRate={catalog.usdExchangeRate}
              signedIn={Boolean(user)}
            />

            <section className='home-landing-section'>
                <div className='home-landing-feature-grid'>
                <PortalBezel
                  as='article'
                  tone='card'
                  className='home-landing-feature-card'
                  innerClassName='h-full p-5 sm:p-6'
                >
                  <h2 className='text-lg font-semibold tracking-tight text-[var(--portal-ink)]'>
                    {t('Text, images, and audio')}
                  </h2>
                  <p className='mt-2 max-w-[28rem] text-sm leading-relaxed text-[var(--portal-ink-muted)]'>
                    {t(
                      'Generate through a single, unified interface. All models you serve sit behind one API.'
                    )}
                  </p>
                </PortalBezel>
                <PortalBezel
                  as='article'
                  tone='card'
                  className='home-landing-feature-card'
                  innerClassName='h-full p-5 sm:p-6'
                >
                  <h2 className='text-lg font-semibold tracking-tight text-[var(--portal-ink)]'>
                    {t('Higher availability')}
                  </h2>
                  <p className='mt-2 text-sm leading-relaxed text-[var(--portal-ink-muted)]'>
                    {t(
                      'Route across channels and fall back when an upstream goes down.'
                    )}
                  </p>
                </PortalBezel>
                <PortalBezel
                  as='article'
                  tone='card'
                  className='home-landing-feature-card'
                  innerClassName='h-full p-5 sm:p-6'
                >
                  <h2 className='text-lg font-semibold tracking-tight text-[var(--portal-ink)]'>
                    {t('Price and performance')}
                  </h2>
                  <p className='mt-2 text-sm leading-relaxed text-[var(--portal-ink-muted)]'>
                    {t(
                      'Keep costs in view without a second protocol. Usage settles in one ledger.'
                    )}
                  </p>
                </PortalBezel>
                <PortalBezel
                  as='article'
                  tone='card'
                  className='home-landing-feature-card'
                  innerClassName='h-full p-5 sm:p-6'
                >
                  <h2 className='text-lg font-semibold tracking-tight text-[var(--portal-ink)]'>
                    {t('Your instance, your keys')}
                  </h2>
                  <p className='mt-2 text-sm leading-relaxed text-[var(--portal-ink-muted)]'>
                    {t(
                      'Keys, groups, and limits stay on the instance you run.'
                    )}
                  </p>
                </PortalBezel>
                </div>
            </section>

            <section className='home-landing-section'>
              <div className='home-landing-steps'>
                <div className='home-landing-step-list'>
                  <div>
                    <span className='portal-step-index'>1</span>
                    <h2 className='mt-2 text-base font-semibold text-[var(--portal-ink)]'>
                      {t('Signup')}
                    </h2>
                    <p className='mt-1 text-sm leading-relaxed text-[var(--portal-ink-muted)]'>
                      {t('Create an account to get started.')}
                    </p>
                  </div>
                  <div>
                    <span className='portal-step-index'>2</span>
                    <h2 className='mt-2 text-base font-semibold text-[var(--portal-ink)]'>
                      {t('Get your API key')}
                    </h2>
                    <p className='mt-1 text-sm leading-relaxed text-[var(--portal-ink-muted)]'>
                      {t('Create an API key and start making requests.')}{' '}
                      {t('Fully OpenAI compatible')}
                    </p>
                  </div>
                  <div>
                    <span className='portal-step-index'>3</span>
                    <h2 className='mt-2 text-base font-semibold text-[var(--portal-ink)]'>
                      {t('Call the API')}
                    </h2>
                    <p className='mt-1 text-sm leading-relaxed text-[var(--portal-ink-muted)]'>
                      {t(
                        'Point any OpenAI SDK at this gateway and pick a model.'
                      )}
                    </p>
                  </div>
                </div>
                <PortalBezel tone='card' innerClassName='overflow-hidden p-0'>
                  <div className='home-landing-code'>
                    <CopyButton
                      value={snippet}
                      className='home-landing-copy text-[var(--portal-ink-muted)] hover:text-[var(--portal-ink)]'
                      tooltip={t('Copy')}
                    />
                    <pre>
                      <code>{snippet}</code>
                    </pre>
                  </div>
                </PortalBezel>
              </div>
            </section>

            <footer className='home-landing-footer'>
              <a
                href='https://github.com/QuantumNous/new-api'
                target='_blank'
                rel='noopener noreferrer'
                className='font-medium text-[var(--portal-ink)]/70 hover:text-[var(--portal-ink)]'
              >
                {t('New API')}
              </a>
            </footer>
            </div>
          </div>
        </main>
      </div>
      <nav
        aria-label={t('User Portal navigation')}
        className='portal-mobile-nav lg:hidden'
      >
        <PortalNavLinks layout='mobile' />
      </nav>
    </PortalPublicShell>
  )
}

function HomeLandingStats(props: {
  modelCount: number
  vendorCount: number
  isLoading: boolean
}) {
  const { t } = useTranslation()

  return (
    <section>
      <div className='home-landing-stats'>
        <div className='portal-card px-3 py-4'>
          <p className='portal-stat-value'>
            {props.isLoading ? '—' : props.modelCount}
          </p>
          <p className='home-landing-stat-label'>{t('Models')}</p>
        </div>
        <div className='portal-card px-3 py-4'>
          <p className='portal-stat-value'>
            {props.isLoading ? '—' : props.vendorCount}
          </p>
          <p className='home-landing-stat-label'>{t('Providers')}</p>
        </div>
        <div className='portal-card px-3 py-4'>
          <p className='portal-stat-value'>1</p>
          <p className='home-landing-stat-label'>{t('Unified API')}</p>
        </div>
        <div className='portal-card px-3 py-4'>
          <p className='portal-stat-value'>v1</p>
          <p className='home-landing-stat-label'>{t('Compatible routes')}</p>
        </div>
      </div>
    </section>
  )
}

function HomeLandingFeatured(props: {
  models: PricingModel[]
  isLoading: boolean
  priceRate: number
  usdExchangeRate: number
  signedIn: boolean
}) {
  const { t } = useTranslation()
  const featured = useMemo(() => {
    const picked: PricingModel[] = []
    const seen = new Set<string>()
    for (const model of props.models) {
      const vendorKey = String(
        model.vendor_id ?? model.vendor_name ?? model.model_name
      )
      if (seen.has(vendorKey)) continue
      seen.add(vendorKey)
      picked.push(model)
      if (picked.length === 3) break
    }
    if (picked.length < 3) {
      for (const model of props.models) {
        if (picked.includes(model)) continue
        picked.push(model)
        if (picked.length === 3) break
      }
    }
    return picked
  }, [props.models])
  const providerCount = new Set(
    props.models.map((model) => model.vendor_id ?? model.vendor_name)
  ).size

  return (
    <section className='home-landing-section'>
      <div className='home-landing-section-head'>
        <div>
          <h2 className='home-landing-section-title'>{t('Featured Models')}</h2>
          <p className='home-landing-section-sub'>
            {t('{{modelCount}} models on {{providerCount}} providers', {
              modelCount: props.models.length,
              providerCount,
            })}
          </p>
        </div>
        {props.signedIn ? (
          <Link
            to='/app'
            className='text-sm font-medium text-[var(--portal-ink-muted)] hover:text-[var(--portal-ink)]'
          >
            {t('View all')}
          </Link>
        ) : (
          <Link
            to='/pricing'
            className='text-sm font-medium text-[var(--portal-ink-muted)] hover:text-[var(--portal-ink)]'
          >
            {t('View all')}
          </Link>
        )}
      </div>
      <div className='home-landing-model-grid'>
        {props.isLoading
          ? [0, 1, 2].map((key) => (
              <Skeleton key={key} className='h-44 rounded-[1.75rem]' />
            ))
          : featured.map((model) => {
              const iconKey = model.icon || model.vendor_icon
              const icon = iconKey ? getLobeIcon(iconKey, 28) : null
              const vendor = model.vendor_name || t('Other')
              const card = (
                <>
                  <div className='flex items-center gap-3'>
                    <span className='flex size-9 items-center justify-center overflow-hidden rounded-xl bg-[var(--portal-module)]'>
                      {icon ?? (
                        <span className='text-sm font-semibold text-[var(--portal-accent)]'>
                          {model.model_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-semibold tracking-tight text-[var(--portal-ink)]'>
                        {model.model_name}
                      </p>
                      <p className='truncate text-xs text-[var(--portal-ink-muted)]'>
                        {t('by {{vendor}}', { vendor })}
                      </p>
                    </div>
                  </div>
                  <div className='mt-6'>
                    <ModelPriceCell
                      model={model}
                      options={{
                        tokenUnit: 'M',
                        priceRate: props.priceRate,
                        usdExchangeRate: props.usdExchangeRate,
                      }}
                      showExpression={false}
                    />
                  </div>
                </>
              )
              const cardClassName =
                'flex h-full min-h-[11rem] flex-col justify-between p-5'

              return (
                <PortalBezel
                  key={model.model_name}
                  tone='card'
                  className='portal-model-tile h-full'
                  innerClassName='h-full p-0'
                >
                  {props.signedIn ? (
                    <Link
                      to='/app/models/$modelId'
                      params={{ modelId: model.model_name }}
                      className={cardClassName}
                    >
                      {card}
                    </Link>
                  ) : (
                    <Link
                      to='/pricing/$modelId'
                      params={{ modelId: model.model_name }}
                      className={cardClassName}
                    >
                      {card}
                    </Link>
                  )}
                </PortalBezel>
              )
            })}
      </div>
    </section>
  )
}
