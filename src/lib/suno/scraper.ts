import path from 'path';
import { chromium } from 'playwright';

export async function generateSunoAudio(
  prompt: string,
  tags?: string,
  title?: string,
  debug: boolean = false
): Promise<string | null> {
  let browser = null;
  
  try {
    const rawCookie = process.env.SUNO_COOKIE || process.env.COOKIE;
    if (!rawCookie) {
      throw new Error("SUNO_COOKIE / COOKIE tidak ditemukan di env.");
    }

    console.log("[Suno Scraper] Menjalankan Chrome (Playwright)...");
    browser = await chromium.launch({
      headless: false, // WAJIB false
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--window-position=-32000,-32000'
      ]
    });

    // Parse cookie (naive parsing)
    const cookiesArray = rawCookie.split(';').map(c => {
      const parts = c.split('=');
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      return {
        name,
        value,
        domain: '.suno.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax' as const
      };
    }).filter(c => c.name.length > 0);
    
    const context = await browser.newContext();
    await context.addCookies(cookiesArray);
    
    const page = await context.newPage();

    // Siapkan promise untuk menangkap intercept response generate
    const generateResponsePromise = page.waitForResponse(
      (response: any) => response.url().includes('/api/generate/') && response.status() === 200,
      { timeout: 90000 }
    );

    console.log("[Suno Scraper] Membuka Suno Create...");
    await page.goto('https://suno.com/create', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Tunggu agar UI stabil
    await page.waitForTimeout(4000);

    // 1. Click Advanced Toggle
    console.log("[Suno Scraper] Menekan tab Advanced...");
    try {
      await page.getByRole('tab', { name: 'Advanced' }).click({ timeout: 10000 });
      await page.waitForTimeout(1000);
    } catch(e) {
      console.log("Tab Advanced gagal di-klik atau sudah aktif.");
    }

    // 2. Lyrics
    console.log("[Suno Scraper] Mengisi Lyrics...");
    try {
      const lyricsBox = page.getByRole('textbox', { name: 'Lyrics editor' });
      await lyricsBox.getByRole('paragraph').click();
      await lyricsBox.fill(prompt);
      await page.waitForTimeout(500);
    } catch(e) {
      console.log("Gagal mengisi Lyrics:", e);
    }

    // Close "Got it" tooltip/popup if it appears
    try {
      await page.getByRole('button', { name: 'Got it' }).click({ timeout: 2000 });
      await page.waitForTimeout(500);
    } catch(e) {}

    // 3. Style (Tags)
    if (tags) {
      console.log("[Suno Scraper] Mengisi Style...");
      try {
        // Tadi di codegen terbaca sebagai "bassoon, modern techno, trip". 
        // Ini adalah placeholder dinamis, jadi kita pakai XPath atau locator textarea kedua
        // Dalam DOM Suno, Lyrics editor itu div contenteditable, sedangkan Style itu textarea asli.
        const textareas = await page.locator('textarea').all();
        // Biasanya textarea Style adalah yang pertama karena lyrics bukan textarea murni
        if (textareas.length > 0) {
          const styleBox = textareas[0];
          await styleBox.click();
          await styleBox.fill(tags);
          await page.waitForTimeout(500);
        }
      } catch(e) {
        console.log("Gagal mengisi Style:", e);
      }
    }

    // 4. Title
    if (title) {
      console.log("[Suno Scraper] Mengisi Title...");
      try {
        const titleBox = page.getByRole('textbox', { name: 'Song Title (Optional)' });
        await titleBox.click();
        await titleBox.fill(title);
        await page.waitForTimeout(500);
      } catch(e) {
        console.log("Gagal mengisi Title:", e);
      }
    }

    // 5. Create button (menggunakan JSPath manual seperti yang Anda sediakan dengan .last)
    console.log("[Suno Scraper] Menekan tombol Create...");
    const createBtnSelector = '#base-ui-_r_4c_';
    let clickedCreate = false;
    try {
      const btn = await page.locator(createBtnSelector);
      if (await btn.count() > 0) {
        await btn.click();
        clickedCreate = true;
      }
    } catch(e) {}
    
    if (!clickedCreate) {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const createBtns = buttons.filter(b => b.innerText.includes('Create'));
        if (createBtns.length > 0) {
          const lastBtn = createBtns[createBtns.length - 1];
          lastBtn.click();
        }
      });
    }

    console.log("[Suno Scraper] Mengecek kemunculan Captcha (Turnstile)...");
    try {
      // Cari iframe Cloudflare Turnstile
      const turnstileFrame = page.frameLocator('iframe[src*="challenges.cloudflare.com"], iframe[title*="Cloudflare"]');
      const cb = turnstileFrame.locator('.cb-tc, input[type="checkbox"]').first();
      // Tunggu maksimal 10 detik barangkali captcha muncul perlahan
      await cb.waitFor({ state: 'visible', timeout: 10000 });
      console.log("[Suno Scraper] Captcha terdeteksi! Mengklik checkbox...");
      // Tambahkan sedikit delay random meniru manusia
      await page.waitForTimeout(500 + Math.random() * 1000);
      await cb.click();
      console.log("[Suno Scraper] Captcha di-klik, menunggu penyelesaian...");
      await page.waitForTimeout(4000);
    } catch(e) {
      console.log("[Suno Scraper] Tidak ada captcha yang menahan (atau berhasil lolos otomatis).");
    }

    console.log("[Suno Scraper] Menunggu response /api/generate/...");
    const generateResponse = await generateResponsePromise;
    const generateData = await generateResponse.json();
    
    const clips = generateData.clips;
    if (!clips || clips.length === 0) {
      throw new Error("No clips returned from generation API.");
    }
    
    const clipId = clips[0].id;
    console.log(`[Suno Scraper] Generate sukses! Clip ID: ${clipId}. Menunggu rendering audio (polling)...`);

    // Poll the feed API to get the audio_url (status: complete)
    let audioUrl = null;
    let pollCount = 0;
    while (pollCount < 60) {
      await page.waitForTimeout(5000);
      pollCount++;
      
      const feedRes = await page.evaluate(async (cId) => {
        const res = await fetch(`https://studio-api.prod.suno.com/api/feed/?ids=${cId}`);
        return await res.json();
      }, clipId);

      if (feedRes && feedRes.length > 0) {
        const track = feedRes[0];
        if (track.status === 'complete' && track.audio_url) {
          audioUrl = track.audio_url;
          break;
        } else if (track.status === 'error') {
          throw new Error("Audio generation failed on Suno side.");
        }
      }
      console.log(`[Suno Scraper] Polling ke-${pollCount}... (Status belum complete)`);
    }

    if (!audioUrl) {
      throw new Error("Timeout waiting for audio URL.");
    }

    console.log(`[Suno Scraper] Berhasil mendapatkan Audio URL: ${audioUrl}`);
    return audioUrl;

  } catch (error) {
    console.error("[Suno Scraper] Error:", error);
    if (debug && browser) {
      try {
        const contexts = browser.contexts();
        if (contexts.length > 0) {
          const pages = contexts[0].pages();
          if (pages.length > 0) {
            await pages[0].screenshot({ path: path.join(process.cwd(), 'public', `suno_error_${Date.now()}.png`), fullPage: true });
          }
        }
      } catch(e) {}
    }
    return null;
  } finally {
    if (browser) {
      console.log("[Suno Scraper] Menutup browser.");
      await browser.close().catch(() => {});
    }
  }
}
