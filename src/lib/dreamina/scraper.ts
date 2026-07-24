import path from 'path';

let isStealthRegistered = false;

export async function generateVideoFromImages(
  image1Path: string, 
  image2Path: string, 
  prompt: string,
  debug: boolean = false
): Promise<string | null> {
  let browser = null;
  
  try {
    // Gunakan eval("require") untuk mem-bypass Webpack Next.js 
    // agar terhindar dari error 'utils.typeOf is not a function'
    const req = eval('require');
    const puppeteer = req('puppeteer-extra');
    const StealthPlugin = req('puppeteer-extra-plugin-stealth');
    
    if (!isStealthRegistered) {
      puppeteer.use(StealthPlugin());
      isStealthRegistered = true;
    }
    const sessionId = process.env.DREAMINA_SESSION_ID?.replace('sg-', '')?.replace('us-', '');
    if (!sessionId) {
      throw new Error("DREAMINA_SESSION_ID tidak ditemukan.");
    }

    console.log("[Puppeteer] Menjalankan Chrome...");
    browser = await puppeteer.launch({
      headless: false, // WAJIB false karena ByteDance WAF memblokir mode headless!
      defaultViewport: null, 
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--start-maximized',
        '--window-position=-32000,-32000' // Lempar jendela ke luar layar agar tidak mengganggu
      ]
    });

    const page = await browser.newPage();
    
    // Set cookie
    await page.setCookie({
      name: 'sessionid',
      value: sessionId,
      domain: '.capcut.com',
      path: '/',
      secure: true,
      httpOnly: true
    });

    // We will intercept responses to catch the MP4 URL
    let foundVideoUrl: string | null = null;
    page.on('response', async (res) => {
      const url = res.url();
      // Look for the generated video URL in the network traffic
      if (
        (url.includes('.mp4') || (url.includes('tos-') && url.includes('video'))) && 
        !url.includes('static/media') && 
        !url.includes('showcase-modal')
      ) {
        if (!foundVideoUrl) {
          console.log("[Puppeteer] 🎥 Ditemukan URL Video Utama:", url);
          foundVideoUrl = url;
        }
      }
    });

    console.log("[Puppeteer] Membuka Dreamina Canvas...");
    await page.goto('https://dreamina.capcut.com/ai-tool/home', { waitUntil: 'networkidle2' });
    
    console.log("[Puppeteer] Menunggu halaman stabil sebelum mengecek pop-up...");
    await new Promise(r => setTimeout(r, 4000)); // Wajib tunggu React memuat pop-up

    console.log("[Puppeteer] Menutup pop-up pengumuman menggunakan XPath absolut...");
    // Memberikan waktu agar pop-up benar-benar dirender
    await new Promise(r => setTimeout(r, 4000));
    
    // Pop-up 1
    try {
      // Kita hapus /svg/g/path di ujungnya agar yang diklik adalah induk <button> nya (jauh lebih aman)
      const popup1 = "/html/body/div[6]/div[2]/div/div[2]/div/button";
      await page.waitForSelector(`::-p-xpath(${popup1})`, { timeout: 3000 });
      await page.click(`::-p-xpath(${popup1})`);
      console.log("[Puppeteer] ✅ Pop-up 1 berhasil ditutup!");
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.log("[Puppeteer] ℹ️ Pop-up 1 tidak ada.");
    }

    // Pop-up 2
    try {
      console.log("[Puppeteer] Menunggu sesaat untuk memancing Pop-up 2 (jika ada)...");
      await new Promise(r => setTimeout(r, 3000)); 
      
      await page.evaluate(() => {
        // Menggunakan selector class yang lebih kuat, fallback ke selector penuh milik user
        const btn = document.querySelector('.lv-modal-wrapper .lv-modal-content svg') || 
                    document.querySelector('.modal-wrap-Ywsnxx svg') ||
                    document.querySelector('body > div:nth-child(75) > div.lv-modal-wrapper.lv-modal-wrapper-align-center.modal-wrap-Ywsnxx > div > div:nth-child(2) > div.lv-modal-content > div > div > svg');
        
        if (btn) {
          // Dispatch event click lebih aman untuk SVG
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
      });
      
      console.log("[Puppeteer] ✅ Usaha tutup Pop-up 2 dieksekusi!");
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.log("[Puppeteer] ℹ️ Pop-up 2 tidak ada atau gagal ditutup.");
    }
    
    const clickXpath = async (xpath: string, name: string) => {
      console.log(`[Puppeteer] Mengklik: ${name}...`);
      await page.waitForSelector(`::-p-xpath(${xpath})`, { timeout: 15000 });
      await page.click(`::-p-xpath(${xpath})`);
      await new Promise(r => setTimeout(r, 1500));
    };

    // 1. Klik AI Agent
    await clickXpath("/html/body/div[1]/div[1]/div/div/div/div[2]/div/div[1]/div/div/div[1]/div[1]/div/div[3]/div/div[2]/div[1]/div[1]/div/div/span/span", "AI Agent");

    // 2. Switch ke Video AI
    await clickXpath("/html/body/div[3]/span/div/div[2]/div/div/li[3]/span/span", "Video AI");

    // 3. Klik Referensi Omni
    await clickXpath("/html/body/div[1]/div[1]/div/div/div/div[2]/div/div[1]/div/div/div[1]/div[1]/div/div[3]/div/div[2]/div[1]/div[1]/div[3]/div/div/span/span", "Referensi Omni");

    // 4. Switch ke Multiframe
    await clickXpath("/html/body/div[3]/span/div/div/div/div/li[3]/span/span/div/span", "Multi-frame");

    // 5. Upload Frame 1
    console.log("[Puppeteer] Uploading Image 1...");
    const frame1Xpath = "/html/body/div[1]/div[1]/div/div/div/div[2]/div/div[1]/div/div/div[1]/div[1]/div/div[3]/div/div[1]/div[1]/div/div[2]/div/div/div/div";
    const [fileChooser1] = await Promise.all([
      page.waitForFileChooser(),
      page.click(`::-p-xpath(${frame1Xpath})`),
    ]);
    await fileChooser1.accept([image1Path]);
    await new Promise(r => setTimeout(r, 2000));

    // 6. Upload Frame 2
    console.log("[Puppeteer] Uploading Image 2...");
    const frame2Xpath = "/html/body/div[1]/div[1]/div/div/div/div[2]/div/div[1]/div/div/div[1]/div[1]/div/div[3]/div/div[1]/div[1]/div/div[2]/div/div[4]/div/div";
    const [fileChooser2] = await Promise.all([
      page.waitForFileChooser(),
      page.click(`::-p-xpath(${frame2Xpath})`),
    ]);
    await fileChooser2.accept([image2Path]);
    await new Promise(r => setTimeout(r, 2000));

    // 7. Input Prompt di 0s
    console.log("[Puppeteer] Mengisi Teks Prompt...");
    const promptAreaXpath = "/html/body/div[1]/div[1]/div/div/div/div[2]/div/div[1]/div/div/div[1]/div[1]/div/div[3]/div/div[1]/div[1]/div/div[2]/div/div[1]/div/div";
    await clickXpath(promptAreaXpath, "Kotak Prompt 0s");
    
    // Ketik prompt
    await page.keyboard.type(prompt);
    await new Promise(r => setTimeout(r, 500));

    // 8. Klik Generate (Eksekusi)
    // Menghindari klik path SVG, kita ambil button parent-nya dengan naik satu level XPath atau menghapus /svg/g/path
    const executeXpath = "/html/body/div[1]/div[1]/div/div/div/div[2]/div/div[1]/div/div/div[1]/div[1]/div/div[3]/div/div[2]/div[2]/div/button";
    await clickXpath(executeXpath, "Tombol Generate");

    console.log("[Puppeteer] Sedang melakukan generate... (Menunggu maksimal 300 detik)");
    
    // Polling DOM for a video tag OR wait for the network request `foundVideoUrl` to populate
    let waitTime = 0;
    while (waitTime < 300) {
      if (foundVideoUrl) {
        console.log("✅ Video berhasil di-generate!");
        return foundVideoUrl;
      }
      
      // Fallback fallback: Cari tag video di DOM
      const videoSrc = await page.evaluate(() => {
        const vid = document.querySelector('video');
        return vid ? vid.src : null;
      });
      
      if (videoSrc && videoSrc.startsWith('http')) {
        console.log("✅ Video berhasil ditemukan di DOM!");
        return videoSrc;
      }

      await new Promise(r => setTimeout(r, 1000));
      waitTime += 1;
      
      if (waitTime % 10 === 0) console.log(`[Puppeteer] Menunggu... ${waitTime} detik`);
    }

    console.error("[Puppeteer] Timeout: Video tidak ditemukan setelah 300 detik.");
    return null;

  } catch (error: any) {
    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages.length > 0) {
          const page = pages[pages.length - 1];
          const errorPath = path.join(process.cwd(), 'public', 'generations', 'temp', `error_${Date.now()}.png`);
          await page.screenshot({ path: errorPath, fullPage: true });
          console.log(`[Puppeteer] SCREENSHOT ERROR TERSIMPAN DI: ${errorPath}`);
        }
      } catch (ssErr) {
        console.error("[Puppeteer] Gagal mengambil screenshot error:", ssErr);
      }
    }
    console.error("[Puppeteer] Error selama eksekusi:", error.message);
    return null;
  } finally {
    if (browser && !debug) {
      await browser.close();
    }
  }
}
