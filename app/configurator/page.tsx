'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Layers, Diamond, Scale, PlusCircle, AlertOctagon, Settings,
  ArrowRight, Activity, Hammer, CheckCircle2, FileText
} from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'

type DashboardMetrics = {
  metalsCount: number
  finishesCount: number
  rulesCount: number
  addonsCount: number
  suggestionsCount: number
  stoneTypesCount: number
  labourCount: number
}

export default function ConfiguratorDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    metalsCount: 0,
    finishesCount: 0,
    rulesCount: 0,
    addonsCount: 0,
    suggestionsCount: 0,
    stoneTypesCount: 0,
    labourCount: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const [metalsRes, finishesRes, rulesRes, addonsRes, suggestionsRes, stonesRes, labourRes] = await Promise.all([
          fetch('/api/configurator/metals'),
          fetch('/api/configurator/finishes'),
          fetch('/api/configurator/rules'),
          fetch('/api/configurator/addons'),
          fetch('/api/configurator/suggestions'),
          fetch('/api/configurator/stones'),
          fetch('/api/configurator/labour')
        ])

        const [metals, finishes, rules, addons, suggestions, stones, labour] = await Promise.all([
          metalsRes.ok ? metalsRes.json() : { metals: [] },
          finishesRes.ok ? finishesRes.json() : { finishes: [] },
          rulesRes.ok ? rulesRes.json() : { rules: [] },
          addonsRes.ok ? addonsRes.json() : { addons: [] },
          suggestionsRes.ok ? suggestionsRes.json() : { suggestions: [] },
          stonesRes.ok ? stonesRes.json() : { stoneTypes: [] },
          labourRes.ok ? labourRes.json() : { labourRates: [] }
        ])

        setMetrics({
          metalsCount: metals.metals?.length || 0,
          finishesCount: finishes.finishes?.length || 0,
          rulesCount: rules.rules?.length || 0,
          addonsCount: addons.addons?.length || 0,
          suggestionsCount: suggestions.suggestions?.length || 0,
          stoneTypesCount: stones.stoneTypes?.length || 0,
          labourCount: labour.labourRates?.length || 0
        })
      } catch (error) {
        console.error('Failed to load metrics', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  const sections = [
    {
      title: 'Material Master',
      description: 'Manage metal alloys (Yellow Gold, Platinum, etc.), karat configurations, and surface textures.',
      href: '/configurator/materials',
      icon: Layers,
      color: 'bg-stone-800/10 text-stone-800',
      stat: loading ? '...' : `${metrics.metalsCount} Metals · ${metrics.finishesCount} Finishes`
    },
    {
      title: 'Stones Registry & Prices',
      description: 'Register stone types (Natural Diamond, Moissanite, etc.), clarity/color grades, and manage the shape-size price matrix.',
      href: '/configurator/stones',
      icon: Diamond,
      color: 'bg-indigo-50 text-indigo-700',
      stat: loading ? '...' : `${metrics.stoneTypesCount} Stone Types`
    },
    {
      title: 'Labour Costs Grid',
      description: 'Configure standard making charges / labour cost per gram based on metal, karat, finish, and jewelry category.',
      href: '/configurator/labour',
      icon: Hammer,
      color: 'bg-amber-50 text-amber-700',
      stat: loading ? '...' : `${metrics.labourCount} Rates Defined`
    },
    {
      title: 'Product Add-ons',
      description: 'Define customer-facing additions like custom engraving, premium packaging, certification bodies, and shipping insurance.',
      href: '/configurator/addons',
      icon: PlusCircle,
      color: 'bg-emerald-50 text-emerald-700',
      stat: loading ? '...' : `${metrics.addonsCount} Add-on Options`
    },
    {
      title: 'Configuration Rules Engine',
      description: 'Establish rules to prevent incompatible choices (e.g., specific finishes on silver, or certain stone settings).',
      href: '/configurator/rules',
      icon: AlertOctagon,
      color: 'bg-rose-50 text-rose-700',
      stat: loading ? '...' : `${metrics.rulesCount} Active Rules`
    },
    {
      title: 'Product Options Mapper',
      description: 'Map specific configurable options (metals, stones, variant photos, dimension constraints) to individual catalog products.',
      href: '/configurator/products',
      icon: Settings,
      color: 'bg-teal-50 text-teal-700',
      stat: 'Interactive Simulation'
    },
    {
      title: 'Substitution Suggestions',
      description: 'Set up smart alternative suggestions to show users (e.g., standard chain upgrade, or lab-grown vs natural diamond savings).',
      href: '/configurator/suggestions',
      icon: FileText,
      color: 'bg-violet-50 text-violet-700',
      stat: loading ? '...' : `${metrics.suggestionsCount} Active Suggestions`
    }
  ]

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-semibold text-stone-900 flex items-center gap-2">
          <Activity className="w-7 h-7 text-stone-800" />
          Configurator Engine
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          Admin cockpit to manage master data, pricing matrixes, compatibility rules, and product configuration mapping.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sections.map((section, idx) => {
          const Icon = section.icon
          return (
            <Link key={idx} href={section.href} className="group">
              <Card className="h-full border border-stone-200 hover:border-stone-800/40 hover:shadow-md transition-all duration-250 cursor-pointer overflow-hidden flex flex-col justify-between">
                <div>
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${section.color} shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <CardTitle className="text-base font-semibold text-stone-900 group-hover:text-stone-800 transition-colors">
                        {section.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <div className="px-5 pb-4 text-stone-500 text-xs leading-relaxed">
                    {section.description}
                  </div>
                </div>
                
                <div className="bg-stone-50/70 border-t border-stone-100 px-5 py-3 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400">
                    {section.stat}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-stone-800 group-hover:translate-x-1 transition-transform">
                    Manage <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="mt-8 bg-stone-900 text-white rounded-2xl p-6 border border-stone-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Pricing & Consistency Guarantee
          </h3>
          <p className="text-stone-400 text-xs mt-1 max-w-xl">
            This master data engine drives the real-time storefront pricing calculation. Changes made here propagate instantly to catalog cards, detail modal, and reseller order BRIEF snapshots.
          </p>
        </div>
        <Link href="/catalog" className="bg-white/10 hover:bg-white/15 text-white px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all shrink-0">
          View catalog products
        </Link>
      </div>
    </div>
  )
}
