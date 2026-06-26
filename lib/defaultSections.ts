export interface SectionBlock {
  id: string
  type: string
  visible: boolean
  settings: Record<string, any>
}

export const DEFAULT_HOMEPAGE_SECTIONS: SectionBlock[] = [
  {
    id: 'announcement-bar',
    type: 'announcement',
    visible: true,
    settings: {
      text: 'Free shipping on orders above ₹2000 | Ships in 24 hours',
      bgColor: '#1E3A5F',
      textColor: '#FFFFFF',
      fontSize: '11px',
      letterSpacing: 'wider',
      animation: 'marquee', // 'static' or 'marquee'
      isDismissible: false
    }
  },
  {
    id: 'header-nav',
    type: 'header',
    visible: true,
    settings: {
      logoPosition: 'left', // 'left', 'center', 'right'
      bgColor: '#FFFFFF',
      textColor: '#1C1917',
      sticky: true,
      navLinks: [
        { label: 'Home', target: '/' },
        { label: 'Shop', target: '#shop' },
        { label: 'Collections', target: '#collections' },
        { label: 'Our Story', target: '#about' }
      ]
    }
  },
  {
    id: 'hero-banner',
    type: 'hero',
    visible: true,
    settings: {
      autoplay: true,
      slides: [
        {
          image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=1600',
          title: 'FLAT ₹999',
          subtitle: 'LIMITED TIME OFFER',
          ctaText: 'SHOP NOW',
          ctaLink: '#shop',
          align: 'center', // 'left', 'center', 'right'
          valign: 'center', // 'top', 'center', 'bottom'
          overlayColor: '#000000',
          overlayOpacity: 30
        }
      ]
    }
  },
  {
    id: 'trust-signals',
    type: 'trust_bar',
    visible: true,
    settings: {
      bgColor: '#FBF7F0',
      textColor: '#1C1917',
      speed: 'normal', // 'slow', 'normal', 'fast'
      items: [
        '8L+ Happy Customers',
        'Gifts For Her @ 50% OFF',
        'Ships in 24 hours',
        'Certified Demi-Fine Jewelry'
      ]
    }
  },
  {
    id: 'featured-categories',
    type: 'category_grid',
    visible: true,
    settings: {
      title: 'SHOP BY CATEGORY',
      columns: 4,
      items: [
        { name: 'Necklaces', image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=600', category: 'necklace' },
        { name: 'Rings', image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=600', category: 'ring' },
        { name: 'Earrings', image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=600', category: 'earring' },
        { name: 'Bracelets', image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=600', category: 'bracelet' }
      ]
    }
  },
  {
    id: 'product-showcase',
    type: 'product_grid',
    visible: true,
    settings: {
      title: 'PALMONAS TOP STYLES',
      columnsDesktop: 4,
      columnsMobile: 2,
      showOriginalPrice: true,
      showDiscountBadge: true,
      showQuickView: true,
      showWishlist: true,
      cardStyle: 'minimal' // 'minimal', 'bordered', 'shadow'
    }
  },
  {
    id: 'brand-narrative',
    type: 'editorial',
    visible: true,
    settings: {
      title: 'CRAFTED FOR ELEGANCE',
      description: 'Every piece in our collection is designed to reflect the inner radiance of the modern woman. Discover our narrative of luxury, sustainability, and demi-fine craftsmanship.',
      image: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?q=80&w=800',
      imagePosition: 'right', // 'left', 'right'
      bgColor: '#F4ECDD',
      textColor: '#1C1917',
      ctaText: 'Discover Our Story',
      ctaLink: '#about'
    }
  },
  {
    id: 'brand-video',
    type: 'video',
    visible: true,
    settings: {
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-jewelry-in-a-gift-box-41589-large.mp4',
      autoplay: true,
      loop: true,
      muted: true
    }
  },
  {
    id: 'customer-testimonials',
    type: 'testimonials',
    visible: true,
    settings: {
      title: 'HEARD FROM OUR CUSTOMERS',
      bgColor: '#FFFFFF',
      reviews: [
        { author: 'Samixa S.', rating: 5, text: 'Absolutely stunning piece. The finish matches the Palmonas brand quality perfectly! Will buy again.' },
        { author: 'Neha M.', rating: 5, text: 'Beautiful packaging and quick delivery. The ring has an incredible shine.' },
        { author: 'Pooja R.', rating: 5, text: 'Perfect gift for my sister. She loved the rose gold finish.' }
      ]
    }
  },
  {
    id: 'newsletter-signup',
    type: 'newsletter',
    visible: true,
    settings: {
      title: 'JOIN THE CLUB',
      description: 'Subscribe to receive updates, access to exclusive deals, and more.',
      bgColor: '#FBF7F0',
      textColor: '#1C1917',
      buttonBg: '#1E3A5F',
      buttonText: '#FFFFFF',
      placeholder: 'Enter your email address'
    }
  },
  {
    id: 'footer-bar',
    type: 'footer',
    visible: true,
    settings: {
      bgColor: '#1C1917',
      textColor: '#FFFFFF',
      columns: [
        {
          title: 'SHOP',
          links: [
            { label: 'All Jewelry', target: '#shop' },
            { label: 'Best Sellers', target: '#shop?filter=bestseller' },
            { label: 'New Arrivals', target: '#shop?filter=new' }
          ]
        },
        {
          title: 'ABOUT',
          links: [
            { label: 'Our Story', target: '#about' },
            { label: 'Sustainability', target: '#sustainability' }
          ]
        },
        {
          title: 'HELP',
          links: [
            { label: 'Shipping & Returns', target: '#shipping' },
            { label: 'Contact Us', target: '#contact' }
          ]
        }
      ],
      copyright: '© {year} {store_name}. All rights reserved.'
    }
  }
]
