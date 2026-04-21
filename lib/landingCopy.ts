// Single source of truth for every word and number on the public landing
// page. Keep components dumb and edit copy here — no need to touch JSX
// for a typo fix or a stat refresh.

export const BRAND = {
  name: 'Shewah',
  tagline: 'Diamond jewellery, the way Indian retailers actually want it.',
  primaryColor: '#1E3A5F',
  whatsappE164: '919876543210',   // operator-editable; used for the floating WA button
  contactEmail: 'partners@shewah.com',
}

export const HERO = {
  eyebrow: 'For independent jewellers & growing chains',
  headline: 'Stock the diamond pieces your customers ask for — without the import drama.',
  subhead:
    'Shewah is the back-office your store doesn\'t have. Live catalog, transparent gold + labour costs, real-time order tracking on WhatsApp, and a Ready-to-Ship marketplace when you need a piece tomorrow.',
  primaryCta: 'Become a Shewah partner',
  secondaryCta: 'See how it works',
  trustLine: 'No joining fee · No exclusivity · WhatsApp-first onboarding',
}

export const STATS = [
  { value: '12,000+', label: 'Pieces shipped to partners' },
  { value: '180+',     label: 'Karigars on our network'   },
  { value: '64',       label: 'Cities served' },
  { value: '< 1 day',  label: 'Lead-to-call time' },
]

export const VALUE_PROPS = [
  {
    title: 'A live catalog you can show right at the counter',
    body:
      'Browse hundreds of diamond and gold designs with photos, weights, and a price quoted at TODAY\'s 24K rate. Shortlist on your phone, share with the customer over WhatsApp, place the order in seconds.',
  },
  {
    title: 'Honest pricing, broken down line by line',
    body:
      'Every quote shows the gold cost (at 24kt-pure rate, the way the trade actually works), the karigar\'s labour, the diamond cost, and our margin. No hidden multipliers, no "billing weight" games.',
  },
  {
    title: 'Custom design without losing a week',
    body:
      'Send a brief or a reference photo. Our CAD team turns around renders in 48 hours. Approve on WhatsApp, and we manufacture, QC and ship — with a tracking link your customer can open.',
  },
  {
    title: 'Ready-to-Ship for the urgent customer',
    body:
      'When a customer wants a piece tomorrow, browse cancelled-but-finished inventory and bid for the ones that fit. Pay the agreed price, we ship. No making-time, no excuses.',
  },
  {
    title: 'WhatsApp-native, not yet-another-portal',
    body:
      'Order updates, dispatch alerts, payment reminders, even CAD approvals — all on the WhatsApp number you already use. Your phone is the dashboard.',
  },
  {
    title: 'A partner team that picks up the phone',
    body:
      'You\'re assigned a real human who knows your store, your karigar relationships, your customers\' tastes. Not a ticket queue — a name and a number.',
  },
]

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Tell us about your store',
    body: 'Share your basics on the form below. Your assigned partner manager will WhatsApp you within one business day.',
  },
  {
    step: '02',
    title: 'Get onboarded in a 20-minute call',
    body: 'We understand your customer profile, set your trade pricing, and unlock catalog + Ready-to-Ship access on your phone.',
  },
  {
    step: '03',
    title: 'Place your first order',
    body: 'Pick from the catalog, request a custom CAD, or bid on a Ready-to-Ship piece. Pay an advance, the rest on dispatch.',
  },
  {
    step: '04',
    title: 'Track it on WhatsApp until your customer holds it',
    body: 'Production updates, photos at QC, and a tracking link the moment we hand it to the courier — all on WhatsApp.',
  },
]

export const FAQ = [
  {
    q: 'Is there a joining fee or a monthly subscription?',
    a: 'No. There is no joining fee, no annual fee, no subscription. You pay only for the orders you place, at the trade price quoted upfront.',
  },
  {
    q: 'Do I have to commit to exclusivity or volume?',
    a: 'No. Shewah is non-exclusive — you keep your existing vendors and customer relationships. Order one piece a month or fifty; we don\'t set a floor or a ceiling.',
  },
  {
    q: 'What payment terms do you offer?',
    a: 'Standard terms are a 25% advance to start production, balance on dispatch (we share the tracking number). For Ready-to-Ship pieces, payment is on confirmation. Custom terms can be discussed once you\'ve completed a few orders.',
  },
  {
    q: 'How long do orders take?',
    a: 'Catalog orders typically dispatch in 7–10 working days. Custom CAD orders take 14–21 working days end-to-end (CAD approval + production + QC). Ready-to-Ship inventory dispatches the next working day after payment.',
  },
  {
    q: 'Which cities do you serve?',
    a: 'We currently ship to retailers across India through insured express courier. If your city has a pin code, we can deliver to you.',
  },
  {
    q: 'What if my customer wants to return or modify a piece?',
    a: 'Manufacturing defects are reworked or replaced free of cost. Customer-driven changes (size, design tweaks) are quoted on a case-by-case basis at our karigar\'s labour rate — no surprise markups.',
  },
  {
    q: 'How do I see prices and place orders day-to-day?',
    a: 'Once onboarded, you log in to a private portal on your phone or laptop. Catalog, your orders, payment ledger, and CAD requests all live there. Notifications come on WhatsApp on the number you sign up with.',
  },
  {
    q: 'I\'m not ready to sign up yet — can I still see the catalog?',
    a: 'Yes. After we speak, we can share a view-only design showcase link. Browse, shortlist, and come back when you\'re ready to order.',
  },
]

export const TESTIMONIALS = [
  // Real quotes will replace these — the structure is in place so a single
  // edit ships them to the page.
  {
    quote:
      'The 24kt-pure pricing is the first time someone in this trade has been straight with me about gold costs. I quote the customer with confidence now.',
    name: 'A Shewah retail partner',
    location: 'Surat, Gujarat',
  },
  {
    quote:
      'Ready-to-Ship saved a wedding-season order for me. Customer wanted a pair of earrings the next day — I bid, paid, and they shipped that evening.',
    name: 'A Shewah retail partner',
    location: 'Indore, Madhya Pradesh',
  },
]

export const VOLUME_OPTIONS = [
  { value: '',       label: 'Select your monthly volume' },
  { value: '<5',     label: 'Under 5 pieces / month' },
  { value: '5-20',   label: '5–20 pieces / month' },
  { value: '20-50',  label: '20–50 pieces / month' },
  { value: '50+',    label: '50+ pieces / month' },
]

export const SEO = {
  title: 'Shewah — Diamond jewellery wholesale & manufacturing for Indian retailers',
  description:
    'Stock diamond jewellery with transparent pricing, custom CAD in 48 hours, Ready-to-Ship inventory, and WhatsApp-native order tracking. Become a Shewah partner — no joining fee, no exclusivity.',
  ogImageAlt: 'Shewah — diamond jewellery wholesale & manufacturing partner for Indian retailers',
}
