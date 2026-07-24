import { chromium } from 'playwright';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const sessionId = process.env.DREAMINA_SESSION_ID?.replace('sg-', '')?.replace('us-', '');
  if (!sessionId) return console.error("❌ DREAMINA_SESSION_ID not found.");

  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext();
  await context.addCookies([{
    name: 'sessionid',
    value: sessionId,
    domain: '.capcut.com',
    path: '/',
    secure: true,
    httpOnly: true
  }]);

  const page = await context.newPage();
  console.log("🌐 Membuka Dreamina AI Tool Home...");
  await page.goto('https://dreamina.capcut.com/ai-tool/home');
  
  console.log("✅ Halaman terbuka. Playwright Inspector akan muncul.");
  console.log("Silakan klik 'Record' (jika belum), lalu klik tombol 'X' (Tutup) pada pop-up 2.");
  console.log("Salin locator dari Playwright Inspector dan berikan kepadaku.");
  
  await page.pause(); // Membuka Playwright Inspector
}
run();
