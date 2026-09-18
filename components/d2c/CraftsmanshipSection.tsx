'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight, Hammer, Sparkles, ShieldCheck, Microscope } from 'lucide-react'

export default function CraftsmanshipSection() {
  const steps = [
    {
      num: '01',
      title: '3D Precision Modeling',
      desc: 'Settings are mathematically customized to securely seat the exact girdle and depth of each stone, ensuring structural integrity.',
    },
    {
      num: '02',
      title: 'Solid 18K Gold Crafting',
      desc: 'Crafted individually in solid 18K gold. Never plated brass, never hollow stamped shells.',
    },
    {
      num: '03',
      title: 'Artisanal Stone Setting',
      desc: 'Skilled jewelers examine every prong and bead under magnification, ensuring uniform alignment and dependable retention.',
    },
    {
      num: '04',
      title: 'Precious Metal Finishing',
      desc: 'Multi-stage hand polish followed by fineness verification and hallmarking for solid gold authenticity.',
    },
  ]

  return (
    <section className="py-20 sm:py-28 bg-[#F6F4F2] border-b border-[#E3DBD4]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center mb-16">
          {/* Left: Copy (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium block">
              Atelier Artisanship
            </span>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#051F34] font-normal leading-tight">
              Where Precision Engineering Meets Timeless Craft.
            </h2>

            <p className="text-sm text-[#69727D] font-light leading-relaxed">
              Unlike commercial jewellery brands that rely on mass production lines, Shewah functions as an authentic fine jewellery atelier. In our workshops, dedicated goldsmiths work alongside digital 3D designers to craft each creation individually.
            </p>

            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[#E3DBD4]">
              <div>
                <div className="font-serif text-2xl text-[#051F34] font-medium">100%</div>
                <div className="text-xs text-[#69727D] mt-1 font-light">Crafted to Order</div>
              </div>
              <div>
                <div className="font-serif text-2xl text-[#051F34] font-medium">Solid 18K</div>
                <div className="text-xs text-[#69727D] mt-1 font-light">Hallmarked Precious Metal</div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/craftsmanship"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-semibold text-[#051F34] hover:text-[#CB9274] transition-colors"
              >
                <span>Read Full Craftsmanship Story</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Right: Atelier Visual (6 cols) */}
          <div className="lg:col-span-6 relative">
            <div className="relative aspect-[4/3] rounded-none overflow-hidden border border-[#E3DBD4]">
              <img
                src="https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1200&q=80"
                alt="Jeweler handcrafting jewellery at Shewah Atelier"
                className="w-full h-full object-cover transition-transform duration-700 ease-out hover:scale-105"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* 4 Process Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {steps.map((step) => (
            <div
              key={step.num}
              className="p-6 sm:p-8 bg-white rounded-none border border-[#E3DBD4] space-y-3 transition-colors hover:border-[#051F34]"
            >
              <span className="font-serif text-2xl text-[#CB9274] font-normal block">
                {step.num}
              </span>
              <h4 className="font-serif text-lg text-[#051F34] font-normal">
                {step.title}
              </h4>
              <p className="text-xs text-[#69727D] font-light leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
