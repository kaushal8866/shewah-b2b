const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const outputDir = '/Users/kaushalmalaviya/.gemini/antigravity/brain/8ce33f14-dea9-4a95-bc7a-6649dc50bf20/screenshots';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const baseUrl = 'https://shewah.co';

const desktopPages = [
  { name: '01_desktop_homepage', path: '/' },
  { name: '02_desktop_jewellery_all', path: '/jewellery' },
  { name: '03_desktop_jewellery_rings', path: '/jewellery?category=rings' },
  { name: '04_desktop_pdp_ring', path: '/jewellery/the-antwerp-solitaire-ring' },
  { name: '05_desktop_pdp_necklace', path: '/jewellery/the-tulip-cut-diamond-necklace' },
  { name: '06_desktop_ring_size_guide', path: '/ring-size-guide' },
  { name: '07_desktop_bespoke', path: '/bespoke' },
  { name: '08_desktop_craftsmanship', path: '/craftsmanship' },
  { name: '09_desktop_diamonds', path: '/diamonds' },
  { name: '10_desktop_shipping', path: '/shipping' },
  { name: '11_desktop_returns', path: '/returns' },
  { name: '12_desktop_warranty', path: '/warranty' },
  { name: '13_desktop_cart_empty', path: '/cart' },
  { name: '16_desktop_checkout', path: '/checkout' },
];

const mobilePages = [
  { name: '17_mobile_homepage', path: '/' },
  { name: '19_mobile_jewellery_catalog', path: '/jewellery' },
  { name: '20_mobile_pdp_ring', path: '/jewellery/the-antwerp-solitaire-ring' },
  { name: '21_mobile_ring_size_guide', path: '/ring-size-guide' },
  { name: '23_mobile_checkout', path: '/checkout' },
];

(async () => {
  console.log('Starting screenshot capture of all D2C pages...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // 1. Desktop captures
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  for (const item of desktopPages) {
    try {
      console.log(`Capturing Desktop: ${item.name} (${item.path})`);
      await page.goto(`${baseUrl}${item.path}`, { waitUntil: 'networkidle2', timeout: 35000 });
      await new Promise((r) => setTimeout(r, 1000));
      await page.screenshot({
        path: path.join(outputDir, `${item.name}.png`),
        fullPage: false,
      });
    } catch (err) {
      console.error(`Error capturing ${item.name}:`, err.message);
    }
  }

  // Desktop interactive: Add item to cart and capture cart page & drawer
  try {
    console.log('Capturing Desktop: Cart Drawer and Populated Cart');
    await page.goto(`${baseUrl}/jewellery/the-antwerp-solitaire-ring`, { waitUntil: 'networkidle2', timeout: 35000 });
    await new Promise((r) => setTimeout(r, 1500));
    
    // Click "Add to Shopping Bag"
    const addBtn = await page.$('button::-p-text(Add to Shopping Bag)') || await page.$('button[class*="bg-[#2A241B]"]');
    if (addBtn) {
      await addBtn.click();
      await new Promise((r) => setTimeout(r, 2000));
      await page.screenshot({
        path: path.join(outputDir, '15_desktop_cart_drawer.png'),
        fullPage: false,
      });
      console.log('Captured 15_desktop_cart_drawer.png');
    }

    // Now visit /cart populated
    await page.goto(`${baseUrl}/cart`, { waitUntil: 'networkidle2', timeout: 35000 });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({
      path: path.join(outputDir, '14_desktop_cart_with_item.png'),
      fullPage: false,
    });
    console.log('Captured 14_desktop_cart_with_item.png');
  } catch (err) {
    console.error('Error capturing cart states:', err.message);
  }

  // 2. Mobile captures (390 x 844)
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  for (const item of mobilePages) {
    try {
      console.log(`Capturing Mobile: ${item.name} (${item.path})`);
      await mobilePage.goto(`${baseUrl}${item.path}`, { waitUntil: 'networkidle2', timeout: 35000 });
      await new Promise((r) => setTimeout(r, 1000));
      await mobilePage.screenshot({
        path: path.join(outputDir, `${item.name}.png`),
        fullPage: false,
      });
    } catch (err) {
      console.error(`Error capturing mobile ${item.name}:`, err.message);
    }
  }

  // Mobile interactive: Drawer open
  try {
    console.log('Capturing Mobile: Navigation Drawer Open');
    await mobilePage.goto(`${baseUrl}/jewellery`, { waitUntil: 'networkidle2', timeout: 35000 });
    await new Promise((r) => setTimeout(r, 1000));
    // Click hamburger button
    const menuBtn = await mobilePage.$('button[aria-label="Open menu"]');
    if (menuBtn) {
      await menuBtn.click();
      await new Promise((r) => setTimeout(r, 1000));
      await mobilePage.screenshot({
        path: path.join(outputDir, '18_mobile_nav_drawer_open.png'),
        fullPage: false,
      });
      console.log('Captured 18_mobile_nav_drawer_open.png');
    }
  } catch (err) {
    console.error('Error capturing mobile nav drawer:', err.message);
  }

  // Mobile interactive: Cart drawer open
  try {
    console.log('Capturing Mobile: Cart Drawer Open');
    await mobilePage.goto(`${baseUrl}/jewellery/the-antwerp-solitaire-ring`, { waitUntil: 'networkidle2', timeout: 35000 });
    await new Promise((r) => setTimeout(r, 1000));
    const addBtnMobile = await mobilePage.$('button::-p-text(Add to Shopping Bag)') || await mobilePage.$('button[class*="bg-[#2A241B]"]');
    if (addBtnMobile) {
      await addBtnMobile.click();
      await new Promise((r) => setTimeout(r, 1500));
      await mobilePage.screenshot({
        path: path.join(outputDir, '22_mobile_cart_drawer.png'),
        fullPage: false,
      });
      console.log('Captured 22_mobile_cart_drawer.png');
    }
  } catch (err) {
    console.error('Error capturing mobile cart drawer:', err.message);
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
})();
