import './globals.css'
import SessionProvider from '@/components/SessionProvider'
import AppShell from '@/components/AppShell'
import Script from 'next/script'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shewah B2B Admin',
  description: 'B2B operations management for Shewah Jewelry — LGD rings, Surat',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Tag Manager - Base Script */}
        <Script
          id="gtm-base"
          strategy="beforeInteractive"
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
          strategy="beforeInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=AW-18068366696"
        />
        <Script
          id="gtag-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'AW-18068366696');
`,
          }}
        />

        <title>Shewah B2B Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Pinterest Tag Base Code */}
        <Script
          id="pintrk-init"
          strategy="beforeInteractive"
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
          strategy="beforeInteractive"
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
          strategy="beforeInteractive"
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
      </head>
      <body>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-TPKRMF93"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}

        <SessionProvider>
          <AppShell>
            {children}
          </AppShell>
        </SessionProvider>
      </body>
    </html>
  )
}
