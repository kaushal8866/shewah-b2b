import StoreLayout from '@/components/d2c/StoreLayout'
import { Sparkles, ShieldCheck } from 'lucide-react'

export const metadata = {
  title: 'Jewellery Care Guide | Shewah',
  description: 'Expert advice on cleaning, protecting, and storing solid gold and diamond jewellery.',
}

export default function CareGuidePage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-12">
        <div className="text-center space-y-3 pb-8 border-b border-[#E8DFC9]">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
            Preserving Brilliance
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-light text-[#2A241B]">
            Jewellery Care Guide
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5347] max-w-lg mx-auto">
            How to keep your solid 18K gold and diamonds sparkling like the day they left our atelier.
          </p>
        </div>

        <div className="prose prose-stone text-xs sm:text-sm text-[#5C5347] space-y-6 max-w-none">
          <h3 className="font-serif text-xl text-[#2A241B]">1. Daily Wear Guidelines</h3>
          <p>
            Avoid wearing fine jewellery when swimming (chlorine can discolor gold alloys), lifting heavy gym weights (which can bend ring shanks), or using harsh chemical cleaners.
          </p>

          <h3 className="font-serif text-xl text-[#2A241B]">2. At-Home Cleaning</h3>
          <p>
            Soak your piece in warm water with a few drops of mild dish soap for 15 minutes. Use an ultra-soft baby toothbrush to gently clean behind the diamond pavilion where lotions and oils gather. Rinse under lukewarm running water and pat dry with a lint-free cloth.
          </p>

          <h3 className="font-serif text-xl text-[#2A241B]">3. Proper Storage</h3>
          <p>
            Diamonds are the hardest mineral on earth and can scratch other gemstones and metals. Always store each piece separately in your Shewah velvet travel pouch or a compartmentalized jewellery box.
          </p>
        </div>
      </div>
    </StoreLayout>
  )
}
