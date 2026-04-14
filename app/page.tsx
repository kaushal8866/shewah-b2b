'use client'

import Link from 'next/link'
import { Manrope, Noto_Serif } from 'next/font/google'
import { ArrowRight, ShoppingBag, User } from 'lucide-react'

// Fetch the fonts specifically for the landing page
const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-manrope' })
const notoSerif = Noto_Serif({ subsets: ['latin'], style: ['normal', 'italic'], weight: ['300', '400', '700'], display: 'swap', variable: '--font-noto-serif' })

export default function B2BLandingPage() {
  return (
    <div className={`${manrope.variable} ${notoSerif.variable} font-manrope bg-[#f8f9fa] text-[#2b3437] min-h-screen selection:bg-[#d4d4d7]`}>
      
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md flex justify-between items-center px-6 lg:px-12 h-20 border-b border-[#737c7f]/10">
        <div className="text-2xl font-noto tracking-[0.2em] font-light uppercase text-slate-900">SHEWAH</div>
        
        <div className="hidden lg:flex items-center space-x-12 font-noto tracking-tight text-slate-800">
          <a className="text-slate-500 hover:text-slate-800 transition-colors uppercase text-xs tracking-[0.2em]" href="#">COLLECTIONS</a>
          <a className="text-slate-900 font-bold border-b border-slate-900 pb-1 uppercase text-xs tracking-[0.2em]" href="#">BESPOKE B2B</a>
          <a className="text-slate-500 hover:text-slate-800 transition-colors uppercase text-xs tracking-[0.2em]" href="#">LOOSE DIAMONDS</a>
          <a className="text-slate-500 hover:text-slate-800 transition-colors uppercase text-xs tracking-[0.2em]" href="#">HERITAGE</a>
        </div>
        
        <div className="flex items-center space-x-6 text-slate-700">
          <a href="mailto:partners@shewah.co" className="hidden md:flex text-xs tracking-[0.2em] uppercase hover:opacity-70 transition-opacity font-bold items-center gap-2 border-b border-transparent hover:border-slate-700 pb-1">
            Apply to Join <ArrowRight className="w-3 h-3" />
          </a>
          <button className="hover:opacity-70 transition-opacity duration-300">
            <ShoppingBag className="w-5 h-5 stroke-[1.5]" />
          </button>
          <button className="hover:opacity-70 transition-opacity duration-300">
            <User className="w-5 h-5 stroke-[1.5]" />
          </button>
        </div>
      </nav>

      <main className="pt-20">
        
        {/* Hero Section: Brilliance Carousel Style */}
        <section className="relative h-[80vh] min-h-[600px] overflow-hidden bg-[#0c0f10]">
          <div className="absolute inset-0 opacity-60">
            <img 
              alt="master jeweler working" 
              className="w-full h-full object-cover grayscale-[20%] contrast-[1.1]" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7slljM-Koq8d-TuDVo-X8HD_lk0sHQ-BRdMh19sKJ27anmzoD1rYUXlK-I0Hudxkcu-aJcEAms-qNAfz_aZLuJDfmBclmZNfVDJ-AeJFyWEcFKFl0jkZcx60-FnSBNEDCh5fwwCbp7OMj31s5DArlCP9qS2wAmhrEr8iryKtdVyGNFX6IB-AvpqqJD2mpdnSoqIfV8ZDFsQgU0qYzuFZutbtKNtLGN8RxFsSsWixRCxoyV7ClnSYlqf_rxSs9eiMPkn_lX-dN-l8"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent"></div>
          
          <div className="relative z-10 h-full flex flex-col justify-center items-start px-6 lg:px-24 max-w-7xl mx-auto">
            <span className="text-xs uppercase tracking-[0.3em] text-[#dbe4e7] mb-6">Exclusivity for Partners</span>
            <h1 className="text-5xl md:text-7xl lg:text-8xl text-white font-noto leading-[1.1] mb-8 max-w-4xl tracking-tight">
              Bespoke Artistry: <br className="hidden md:block"/>Your Vision, Our Craft
            </h1>
            <p className="text-lg text-[#f1f4f6] font-light max-w-xl mb-12 leading-relaxed opacity-90">
              Elevate your inventory with one-of-a-kind masterpieces. From initial concept to the final polish, our master artisans bring your client's most ambitious dreams to life.
            </p>
            <div className="flex space-x-6">
              <a href="mailto:partners@shewah.co" className="bg-[#5d5e61] text-[#f7f7fa] px-10 py-5 uppercase text-xs tracking-widest font-bold hover:bg-[#515255] transition-colors border border-transparent hover:border-[#abb3b7]/30">
                Initiate Consultation
              </a>
            </div>
          </div>
        </section>

        {/* The Custom Process Section */}
        <section className="py-24 lg:py-32 bg-[#f8f9fa]">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 lg:mb-24 space-y-6 md:space-y-0">
              <div className="max-w-2xl">
                <h2 className="text-4xl font-noto text-[#2b3437] mb-6 tracking-tight">The Architectural Journey</h2>
                <p className="text-[#586064] font-light leading-relaxed text-lg">
                  Our multi-stage collaborative process ensures that every nuance of your design is captured with technical precision and artistic soul.
                </p>
              </div>
              <div className="text-[#586064] text-xs tracking-[0.2em] font-medium uppercase border-b border-[#abb3b7]/30 pb-2">
                Process Overview / 01-04
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
              
              {/* Step 1 */}
              <div className="group">
                <div className="aspect-[3/4] bg-[#eaeff1] mb-8 relative overflow-hidden">
                  <img 
                    alt="jewelry sketch" 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 filter grayscale hover:grayscale-0" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDdoQ6kwj2yciBWmToGiaUly8NlSl5wzT8QtxeM8e8WH3I8e0XBULCSwNgM0BxoYAi9J-MbEMxSfD3AtEbahIMqoDIe14Z_XzurAv5mYocYOez4_Or1uxzSnFV1TukWVdXYp5sSLW30LjXsTfAsLKORuvYm2_wFlyesHXMP-iTePSrkeJGe_bOnpvcQGtvjvQ9iYVeg0p67xNOkPxstXfbCz5yi4gowyWl4m60yQx68DXuBsY_Mr44zGzYVldHEL8xzzNV-kGJld2M" 
                  />
                </div>
                <h3 className="text-xl font-noto mb-3 text-[#2b3437] tracking-tight">01. Consultation</h3>
                <p className="text-sm text-[#586064] font-light leading-relaxed">
                  Define the aesthetic, budget, and timeline with our dedicated account managers.
                </p>
              </div>

              {/* Step 2 */}
              <div className="group">
                <div className="aspect-[3/4] bg-[#eaeff1] mb-8 relative overflow-hidden">
                  <img 
                    alt="CAD model" 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 filter grayscale hover:grayscale-0" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCjYOx0Z5jhtHbaTI6SASOfrue81b_jCznb0od88ASSHEBolN97Anxuo0mnwN7FQlOsRm5I4yq__a9dcWrOlXJIR1yQzl8cCKw5vsJ3jjiJENdEa02i6hv0ppsdvpMLeUEBRiEL2Ury3x_tYiXYEsjzr5ErMeeoKCo5nOuhe-XRQs0GKR_e5Wovy0LCB2H2pPOpxlzDxbkXddhEuhpV6cz7TPCGypFXZ2g9PMWWMWP2DgUQg2bXscuzbYZJcIlC8vDZ9CEJ1Y9_zsA" 
                  />
                </div>
                <h3 className="text-xl font-noto mb-3 text-[#2b3437] tracking-tight">02. CAD Design</h3>
                <p className="text-sm text-[#586064] font-light leading-relaxed">
                  Receive detailed 3D renderings for approval, allowing for millimeter-perfect adjustments.
                </p>
              </div>

              {/* Step 3 */}
              <div className="group">
                <div className="aspect-[3/4] bg-[#eaeff1] mb-8 relative overflow-hidden">
                  <img 
                    alt="Loose stones" 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 filter grayscale hover:grayscale-0" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCWybUXiphs-c7l2GGN05C-VoFP1jCHXWjCxud9WAz9QdkZZSDCrttv1Kut4m9JgtYRIJG94WxK8QVmji_goU71vMXNnojwJTEjfns5paV8cfqWdDBpuJQiwr0-mQHM7NeF2K9_nuFu9tmInUaOY-gJ5lSNZrLCIndCICxVYfS_v7ENemqthYJRTD4KDTAr0rxCK6ktEdpKJ4pDZKEG7v6R7alVmcv27cDy2Ip_TOcyCfrOgMiEyzu-v1ovb-ItmN6Fh0JzQv_EwiI" 
                  />
                </div>
                <h3 className="text-xl font-noto mb-3 text-[#2b3437] tracking-tight">03. Stone Selection</h3>
                <p className="text-sm text-[#586064] font-light leading-relaxed">
                  Choose from our curated inventory of GIA-certified Natural or premium Lab-Grown diamonds.
                </p>
              </div>

              {/* Step 4 */}
              <div className="group md:mt-12 lg:mt-0">
                <div className="aspect-[3/4] bg-[#eaeff1] mb-8 relative overflow-hidden">
                  <img 
                    alt="Craftsmanship" 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 filter grayscale hover:grayscale-0" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBkA0ZrsSKmWGKWWxBXkzhnfMWuQk1VT6lilnW7F2vilBTUUgY9NqZovU0rhtnVQWBxtiuns0UifYI_6LC6Ln6BGDVAz9_cmC7-wItrsSeIH8B-4rN36raUqA0xcnxGO-uJloZQxxbFqbHeWLlOqumeZ3yhqJ3bEGmAGAb452Q8xG4pfztqvoGBnPFIf6pU1Szpvf_5jE4c0LgAU6moX2SNv0ryLv9q1-gDf5wHpffSk2dHZZVjtD8M3KJ9NjQYs5GqxWL8yuuz0yM" 
                  />
                </div>
                <h3 className="text-xl font-noto mb-3 text-[#2b3437] tracking-tight">04. Craftsmanship</h3>
                <p className="text-sm text-[#586064] font-light leading-relaxed">
                  Each piece is hand-finished by our master bench jewelers in our state-of-the-art atelier.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* Case Studies / Gallery Section */}
        <section className="py-24 lg:py-32 bg-[#eaeff1]">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="text-center mb-20 lg:mb-24">
              <h2 className="text-4xl font-noto text-[#2b3437] mb-4">Portfolio of Distinction</h2>
              <p className="text-[#586064] font-light tracking-[0.2em] uppercase text-xs">
                A selection of recent bespoke commissions for our global retail partners
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[350px]">
              
              <div className="md:col-span-2 md:row-span-2 relative group overflow-hidden bg-[#dbe4e7]">
                <img 
                  alt="High jewelry necklace" 
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-transform duration-1000 scale-105 group-hover:scale-100" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAU6YWfS89CErhDJMbB-0WXvJ1MPaXQn5x3dHWHJEnoY3dOWDnEj_2674iQW7WOFkyBOmQHuh4yewdw2kHb1rHQGxKMAduqlBhpO3AQsfxnU5ExB8CtJcMyFW3xXHE_I_3VT5YsWu-5oUxMIzK711De8-Mb6o4iyiYdHq7r1DkDsVqwgN5ffGCfXMM382htJ6W0a_z2aWV-PDtalL6W6HqA5T-DOkw1y5T6lJo_iRdeIpXNaPtLloGl_YZGf0H0WLnHYeB1jCnOMKA" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8 lg:p-12">
                  <span className="text-white text-[10px] tracking-[0.3em] uppercase mb-2">Commission 092</span>
                  <h4 className="text-white font-noto text-3xl">The Verdant Heritage Necklace</h4>
                </div>
              </div>

              <div className="relative group overflow-hidden bg-[#dbe4e7]">
                <img 
                  alt="Artisanal signet" 
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-transform duration-1000 scale-105 group-hover:scale-100" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDH3kQX2Vja9P9Gj6B3sG4z_t0MgBfKOIBu84eoBnSDDtK7KolhCC5kApLXrNi-XdXDatjk54gkCy1bgMOB1wp3Q5o_-ZpSwlr1AbhGCv6o0aPqDQbT4z3PXxsfIBEli6I8fkzuF3KTRDBo6SNpvFwvoe9FBSsYIgrZ6rKHRKKzt0WsxiVLfg1-r_Z-j-CbHXckeEtdLxX8z_y3j0788W4oP2ubILn8enw6ijMuHUokpMM-XhZddb6jGekzMZt22Fijyshg2OS4b7g" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                  <h4 className="text-white font-noto text-xl">Artisanal Signet</h4>
                </div>
              </div>

              <div className="relative group overflow-hidden bg-[#dbe4e7]">
                <img 
                  alt="Earrings" 
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-transform duration-1000 scale-105 group-hover:scale-100" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfX7ailu5Xu5jlJnyh1j20XIdQX9jJRxFZobww6a7Qpk9iAT-ci5_UaVIb9qySZZlMnWk0q7hTkHoyHwnR6dE0oVlIywaf2MFF1GW7YF_sLDITtsABJPUpAQAC0a7w51_MjA5T0dMZaA6ei12LXlaPZNr81iWx8FPeUoN6ysx8cM4VlTQv6bxwlIjqcsZKFBw1g51R-UvXnI-QE_482YxJY9ERPpi4gsI8fQXaMIddm7eVbCdNqJpTFF1DL0wMu9R9jIrvEJMSoe8" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                  <h4 className="text-white font-noto text-xl">Architectural Drops</h4>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Final CTA: The "Architectural Prism" aesthetic */}
        <section className="py-32 lg:py-48 bg-[#dbe4e7] flex flex-col items-center text-center px-6 lg:px-12">
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-noto text-[#2b3437] mb-8 max-w-4xl leading-[1.1] tracking-tight">
            Crafting Legacies, One Carat at a Time.
          </h2>
          <p className="text-[#586064] font-light max-w-2xl mb-12 leading-relaxed text-lg">
            Join the world's leading retailers in providing unparalleled bespoke experiences. Let our master artisans become an extension of your brand.
          </p>
          <a href="mailto:partners@shewah.co" className="border border-[#2b3437] px-12 py-5 uppercase text-xs tracking-[0.2em] font-medium hover:bg-[#2b3437] hover:text-[#f8f9fa] transition-all duration-300">
            Request Partnership
          </a>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-[#0c0f10] w-full min-h-[300px] flex flex-col justify-center py-20 px-6 lg:px-12 space-y-12 shrink-0">
        <div className="text-xl font-noto tracking-[0.4em] font-light text-white text-center uppercase">SHEWAH</div>
        
        <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 max-w-4xl mx-auto">
          {['Privacy Policy', 'Terms of Service', 'Ethical Sourcing', 'Contact Us'].map(l => (
            <a key={l} className="text-[#9b9d9e] hover:text-[#f3fafe] transition-colors text-[10px] tracking-[0.2em] uppercase font-bold" href="#">
              {l}
            </a>
          ))}
        </div>
        
        <div className="text-[#586064] text-[10px] tracking-[0.2em] uppercase text-center mt-8 border-t border-[#2b3437] pt-8">
            © {new Date().getFullYear()} SHEWAH LUXURY B2B. ALL RIGHTS RESERVED.
        </div>
      </footer>

      {/* Font styles definition for next/font dynamically */}
      <style dangerouslySetInnerHTML={{__html: `
        .font-noto { font-family: var(--font-noto-serif), serif; }
        .font-manrope { font-family: var(--font-manrope), sans-serif; }
      `}} />
    </div>
  )
}
