'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight, Hammer, Sparkles, ShieldCheck, Microscope } from 'lucide-react'

export default function CraftsmanshipSection() {
  const steps = [
    {
      num: '01',
      title: '3D CAD Architectural Modeling',
      desc: 'Settings are mathematically customized to securely seat the exact girdle and pavilion depth of each stone, minimizing superfluous metal weight.',
    },
    {
      num: '02',
      title: 'Lost-Wax Solid Gold Casting',
      desc: 'Cast in individual flasks using certified 18K solid gold alloys and 950 platinum. Never plated brass, never hollow stamped shells.',
    },
    {
      num: '03',
      title: 'Microscope Stone Setting',
      desc: 'Master karigars examine every prong and bead under 40x stereomicroscopes, ensuring uniform height, optical alignment, and lifelong retention.',
    },
    {
      num: '04',
      title: 'Certified Assay Hallmarking',
      desc: 'Multi-stage rouge polish followed by independent assay testing and legal fineness hallmarking (BIS Hallmark with HUID / Assay 750).',
    },
  ]

  return (
    <section className="py-20 sm:py-24 bg-[#FBF7F0] border-b border-[#E8DFC9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center mb-16">
          {/* Left: Copy (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold block">
              Atelier Artisanship • Surat & Antwerp
            </span>

            <h2 className="font-serif text-3xl sm:text-5xl text-[#2A241B] font-light leading-tight">
              Where Mathematical Geometry Meets Ancient Mastery.
            </h2>

            <p className="text-xs sm:text-sm text-[#5C5347] font-light leading-relaxed">
              Unlike commercial jewellery brands that rely on mass stamping lines, Shewah functions as an authentic private atelier. In our Surat workshops, hereditary master goldsmiths work alongside digital 3D sculptors to craft each creation individually.
            </p>

            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[#E8DFC9]">
              <div>
                <div className="font-serif text-2xl text-[#2A241B] font-medium">100%</div>
                <div className="text-[11px] text-[#5C5347] mt-0.5">Individually Cast to Order</div>
              </div>
              <div>
                <div className="font-serif text-2xl text-[#2A241B] font-medium">Assay 750</div>
                <div className="text-[11px] text-[#5C5347] mt-0.5">Certified Solid Gold Hallmarking</div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/craftsmanship"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-[#2A241B] hover:text-[#A88A4F] transition-colors"
              >
                <span>Read Full Craftsmanship Story</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Right: Atelier Visual (6 cols) */}
          <div className="lg:col-span-6 relative">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-[#E8DFC9]">
              <img
                src="https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1200&q=80"
                alt="Master karigar handcrafting jewellery at Shewah Atelier"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* 4 Process Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => (
            <div
              key={step.num}
              className="p-6 bg-white rounded-2xl border border-[#E8DFC9] space-y-2.5 shadow-sm hover:border-[#A88A4F] transition-colors"
            >
              <span className="font-serif text-2xl text-[#C9A86A] font-semibold block">
                {step.num}
              </span>
              <h4 className="font-serif text-base text-[#2A241B] font-medium">
                {step.title}
              </h4>
              <p className="text-[11px] text-[#5C5347] font-light leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
