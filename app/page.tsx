import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import StoreLayout from '@/components/d2c/StoreLayout'
import Link from 'next/link'
import { Diamond, ShieldCheck, Sparkles, ArrowRight, Clock, Award, Hammer } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'SHEWAH | High Jewellery Atelier & Certified Diamonds',
  description: 'Handcrafted fine jewellery made to order in solid gold and certified diamonds. Discover solitaire rings, tennis bracelets, and bespoke atelier creations with worldwide insured delivery.',
  openGraph: {
    title: 'SHEWAH | High Jewellery Atelier & Certified Diamonds',
    description: 'Handcrafted fine jewellery made to order in solid gold and certified diamonds.',
    type: 'website',
  },
}

function dashboardForRole(role: string | undefined): string {
  if (role === 'manufacturer') return '/portal/manufacturer'
  if (role === 'retailer')     return '/portal/retailer'
  return '/dashboard'
}

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    redirect(dashboardForRole((session.user as any).role))
  }

  const collections = [
    {
      title: 'Solitaire & Engagement',
      subtitle: 'Antwerp-Cut Solitaires in Solid 18K Gold',
      href: '/jewellery?category=rings',
      image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
    },
    {
      title: 'Tennis Bracelets',
      subtitle: 'Seamless Pavé & Bezel Settings',
      href: '/jewellery?category=bracelets',
      image: 'https://images.unsplash.com/photo-1611591475870-760a927a4e69?auto=format&fit=crop&w=800&q=80',
    },
    {
      title: 'Necklaces & Pendants',
      subtitle: 'Timeless Cascades & Minimalist Icons',
      href: '/jewellery?category=necklaces',
      image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
    },
    {
      title: 'Diamond Earrings',
      subtitle: 'Studs, Huggies & Architectural Drops',
      href: '/jewellery?category=earrings',
      image: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=800&q=80',
    },
  ]

  return (
    <StoreLayout>
      {/* 1. Cinematic Hero */}
      <section className="relative min-h-[85vh] flex items-center justify-center bg-stone-950 text-white overflow-hidden">
        {/* Ambient atmospheric backdrop */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 scale-105 transition-transform duration-1000"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1920&q=85')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-6 pt-12">
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-[#C9A86A] font-medium block">
            Atelier Shewah • Est. Antwerp & Surat
          </span>

          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-light tracking-tight leading-[1.1] text-[#FBF7F0]">
            Modern Heirlooms, <br className="hidden sm:inline" />
            Consciously Crafted.
          </h1>

          <p className="text-sm sm:text-base text-stone-300 max-w-xl mx-auto font-light leading-relaxed">
            Every piece is individually handcrafted in solid 18K gold and set with certified diamonds.
            Crafted especially for you with transparent provenance.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/jewellery"
              className="w-full sm:w-auto px-8 py-3.5 bg-[#C9A86A] text-[#2A241B] text-xs uppercase tracking-widest font-semibold rounded-full hover:bg-[#E8D6AC] transition-all shadow-lg hover:shadow-[#C9A86A]/20"
            >
              Explore The Collection
            </Link>
            <Link
              href="/bespoke"
              className="w-full sm:w-auto px-8 py-3.5 border border-[#E8DFC9]/40 text-white text-xs uppercase tracking-widest font-medium rounded-full hover:bg-white/10 transition-colors"
            >
              Commission Bespoke
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Brand Value Proposition Ribbon */}
      <section className="bg-[#F4ECDD] border-y border-[#E8DFC9] py-8">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-[#E8DFC9] text-[#A88A4F] flex items-center justify-center mx-auto mb-2">
              <Diamond className="w-4 h-4" />
            </div>
            <h4 className="font-serif text-sm font-medium text-[#2A241B]">Antwerp Certified</h4>
            <p className="text-[11px] text-[#5C5347]">IGI & GIA graded diamonds</p>
          </div>

          <div className="space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-[#E8DFC9] text-[#A88A4F] flex items-center justify-center mx-auto mb-2">
              <Hammer className="w-4 h-4" />
            </div>
            <h4 className="font-serif text-sm font-medium text-[#2A241B]">Made to Order</h4>
            <p className="text-[11px] text-[#5C5347]">Hand-set in solid 18K gold</p>
          </div>

          <div className="space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-[#E8DFC9] text-[#A88A4F] flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="font-serif text-sm font-medium text-[#2A241B]">Insured Worldwide</h4>
            <p className="text-[11px] text-[#5C5347]">Door-to-door priority courier</p>
          </div>

          <div className="space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-[#E8DFC9] text-[#A88A4F] flex items-center justify-center mx-auto mb-2">
              <Award className="w-4 h-4" />
            </div>
            <h4 className="font-serif text-sm font-medium text-[#2A241B]">Lifetime Care</h4>
            <p className="text-[11px] text-[#5C5347]">Complimentary inspection & polish</p>
          </div>
        </div>
      </section>

      {/* 3. Curated Collections Grid */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-xl mx-auto space-y-3 mb-14">
          <span className="text-[11px] uppercase tracking-[0.3em] text-[#A88A4F] font-medium">
            Curated Categories
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B] font-light">
            Crafted for Generations
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5347] font-light leading-relaxed">
            Discover iconic high jewellery designs forged from the purest metals and cut diamonds.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {collections.map((col) => (
            <Link
              key={col.title}
              href={col.href}
              className="group relative h-96 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-end p-6 border border-[#E8DFC9] transition-all hover:shadow-xl"
            >
              <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url('${col.image}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent" />

              <div className="relative z-10 text-white space-y-1">
                <h3 className="font-serif text-xl font-medium tracking-wide">
                  {col.title}
                </h3>
                <p className="text-xs text-stone-300 font-light">
                  {col.subtitle}
                </p>
                <div className="pt-2 flex items-center gap-1.5 text-xs text-[#C9A86A] font-medium tracking-wider uppercase group-hover:translate-x-1 transition-transform">
                  <span>Explore</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Atelier Craftsmanship Editorial */}
      <section className="bg-white border-y border-[#E8DFC9] py-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-[11px] uppercase tracking-[0.3em] text-[#A88A4F] font-medium">
              The Shewah Atelier
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B] font-light leading-snug">
              Every creation begins with pure elements and bespoke precision.
            </h2>
            <p className="text-sm text-[#5C5347] leading-relaxed font-light">
              Unlike mass-manufactured jewellery, Shewah operates as a traditional atelier.
              Each order is cast individually from 18K solid gold alloys, hand-set by master karigars,
              and rigorously audited through multi-point optical quality checks before certification.
            </p>

            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[#E8DFC9]">
              <div>
                <div className="font-serif text-2xl text-[#2A241B] font-medium">100%</div>
                <div className="text-xs text-[#5C5347] mt-0.5">Ethically Sourced & Conflict-Free</div>
              </div>
              <div>
                <div className="font-serif text-2xl text-[#2A241B] font-medium">BIS 750</div>
                <div className="text-xs text-[#5C5347] mt-0.5">Solid 18K Gold Hallmarking</div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/craftsmanship"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-[#2A241B] hover:text-[#A88A4F] transition-colors"
              >
                <span>Read About Our Craftsmanship</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[4/3] border border-[#E8DFC9]">
            <img
              src="https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1200&q=80"
              alt="Artisan handcrafting jewellery at Shewah Atelier"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* 5. Bespoke Invitation */}
      <section className="bg-[#2A241B] text-[#FBF7F0] py-20 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6 relative z-10">
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.35em] text-[#C9A86A] font-medium">
            Custom Commissions
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-light text-white leading-tight">
            Have a bespoke dream in mind? <br />
            Our atelier crafts one-of-a-kind treasures.
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 max-w-lg mx-auto font-light leading-relaxed">
            Collaborate directly with our master designers and 3D CAD artists to bring your personal story to life.
          </p>

          <div className="pt-4">
            <Link
              href="/bespoke"
              className="inline-block px-8 py-3.5 bg-[#C9A86A] text-[#2A241B] text-xs uppercase tracking-widest font-semibold rounded-full hover:bg-[#E8D6AC] transition-all shadow-xl"
            >
              Start Your Bespoke Journey
            </Link>
          </div>
        </div>
      </section>
    </StoreLayout>
  )
}
