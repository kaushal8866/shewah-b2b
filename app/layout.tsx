import './globals.css'
import type { Metadata } from 'next'
import SessionProvider from '@/components/SessionProvider'
import { CartProvider } from '@/components/d2c/CartContext'
import { WishlistProvider } from '@/lib/wishlistStore'
import AppShell from '@/components/AppShell'
import Script from 'next/script'
import { headers } from 'next/headers'
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://shewah.co'),
  title: {
    default: 'SHEWAH | High Jewellery Atelier & Certified Diamonds',
    template: '%s | SHEWAH',
  },
  description: 'Handcrafted fine jewellery made to order in solid 18K gold and certified diamonds.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'SHEWAH | High Jewellery Atelier & Certified Diamonds',
    description: 'Handcrafted fine jewellery made to order in solid 18K gold and certified diamonds.',
    url: 'https://shewah.co',
    siteName: 'SHEWAH',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SHEWAH | High Jewellery Atelier & Certified Diamonds',
    description: 'Handcrafted fine jewellery made to order in solid 18K gold and certified diamonds.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isEditorial = headers().get('x-is-editorial') === '1'

  return (
    <html lang="en">
      <head>
        {/* Preconnect and load verified Bijoux typography: Sorts Mill Goudy (headings) & Montserrat (body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Sorts+Mill+Goudy:ital@0;1&display=swap"
          rel="stylesheet"
        />
        {!isEditorial && (
          <>
            {/* Google Tag Manager - Base Script */}
            <Script
              id="gtm-base"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TPKRMF93');
`,
          }}
        />

        {/* Google Tag (gtag.js) - Google Ads AW-18068366696 */}
        <Script
          id="gtag-src"
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=AW-18068366696"
        />
        <Script
          id="gtag-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'AW-18068366696');
`,
          }}
        />

        {/* Pinterest Tag Base Code */}
        <Script
          id="pintrk-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
!function(e){if(!window.pintrk){window.pintrk = function () {
window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
  n=window.pintrk;n.queue=[],n.version="3.0";var
  t=document.createElement("script");t.async=!0,t.src=e;var
  r=document.getElementsByTagName("script")[0];
  r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load', '2612734305070');
pintrk('page');
`,
          }}
        />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            alt=""
            src="https://ct.pinterest.com/v3/?event=init&tid=2612734305070&noscript=1"
          />
        </noscript>
        {/* Microsoft Clarity Tag */}
        <Script
          id="ms-clarity-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "xr0qwz63wd");
`,
          }}
        />
        {/* Meta Pixel Base Code */}
        <Script
          id="meta-pixel-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1809742277070832');
fbq('track', 'PageView');
`,
          }}
        />
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                alt=""
                src="https://www.facebook.com/tr?id=1809742277070832&ev=PageView&noscript=1"
              />
            </noscript>
          </>
        )}
      </head>
      <body>
        {!isEditorial && (
          /* Google Tag Manager (noscript) */
          <noscript>
            <iframe
              src="https://www.googletagmanager.com/ns.html?id=GTM-TPKRMF93"
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}

        <SessionProvider>
          <CartProvider>
            <WishlistProvider>
              <AppShell>
                {children}
              </AppShell>
            </WishlistProvider>
          </CartProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
