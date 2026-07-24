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

    // (Network sniffing telah dihapus karena Dreamina me-load video galeri secara asinkron di latar belakang)

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
      console.log(`[Puppeteer] Mengklik (XPath): ${name}...`);
      await page.waitForSelector(`::-p-xpath(${xpath})`, { timeout: 15000 });
      await page.click(`::-p-xpath(${xpath})`);
      await new Promise(r => setTimeout(r, 1500));
    };

    // Fungsi helper baru untuk klik berdasarkan Teks (Jauh lebih stabil dari XPath/JSPath)
    const clickText = async (text: string) => {
      console.log(`[Puppeteer] Mengklik teks: ${text}...`);
      await page.waitForSelector(`::-p-text(${text})`, { timeout: 15000 });
      await page.click(`::-p-text(${text})`);
      await new Promise(r => setTimeout(r, 1500));
    };

    // Fungsi helper baru untuk eksekusi klik JS Path langsung di DOM
    const clickJsPath = async (selector: string, name: string) => {
      console.log(`[Puppeteer] Mengklik (JS Path): ${name}...`);
      let waitTime = 0;
      let clicked = false;
      while (waitTime < 15000) {
        clicked = await page.evaluate((sel: string) => {
          // Khusus svg/path, cari elemen button pembungkusnya atau tembak click event
          const el = document.querySelector(sel) as HTMLElement | null;
          if (el) {
            const clickable = el.closest('button') || el;
            clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            return true;
          }
          return false;
        }, selector);
        
        if (clicked) break;
        await new Promise(r => setTimeout(r, 500));
        waitTime += 500;
      }
      if (!clicked) throw new Error(`Timeout JS Path: ${name}`);
      await new Promise(r => setTimeout(r, 1500));
    };

    // 1. Klik AI Agent
    await clickJsPath("#dreamina-ui-configuration-content-wrapper > div.content-iyXFPD > div > div > div.scroll-content-b_fSc1.scroll-content > div.section-generator-rMSij5 > div > div.dimension-layout-cD09ib.default-layout-usosJ8.home-header-content-generator-qL9RPk > div > div.toolbar-tN43r_ > div.container-rRRbbS.toolbar-settings-NSjIhk > div > div > div > span > span", "AI Agent");

    // 2. Switch ke Video AI (Gunakan selector atribut ID yang dinamis karena popup number bisa berubah)
    await clickJsPath('[id^="lv-select-popup-"] > div > div > li:nth-child(3) > span > span > span.select-option-label-text-hNJvQd', "Video AI");

    // 3. Klik Referensi Omni
    await clickJsPath("#dreamina-ui-configuration-content-wrapper > div.content-iyXFPD > div > div > div.scroll-content-b_fSc1.scroll-content > div.section-generator-rMSij5 > div > div.dimension-layout-cD09ib.default-layout-usosJ8.home-header-content-generator-qL9RPk > div > div.toolbar-tN43r_ > div.container-rRRbbS.toolbar-settings-NSjIhk > div > div.feature-select-S77CVR > div > div > span > span", "Referensi Omni");

    // 4. Switch ke Multiframe
    await clickJsPath('[id^="lv-select-popup-"] > div > div > li:nth-child(3) > span > span > div > span', "Multi-frame");

    // Helper untuk menangani Pop-up Confirm
    const handleConfirmPopup = async () => {
      console.log("[Puppeteer] Menutup pop-up confirm...");
      await new Promise(r => setTimeout(r, 1500));
      await page.evaluate(() => {
        // Cari tombol yang mengandung kata Confirm
        const btns = Array.from(document.querySelectorAll('button'));
        const confirmBtn = btns.find(b => b.innerText.toLowerCase().includes('confirm'));
        if (confirmBtn) {
           confirmBtn.click();
        }
      });
      await new Promise(r => setTimeout(r, 1000));
    };

    // 5. Upload Frame 1
    console.log("[Puppeteer] Uploading Image 1...");
    const [fileChooser1] = await Promise.all([
      page.waitForFileChooser(),
      clickJsPath('[id$="-reference-upload-0"] > div', "Kotak Frame 1")
    ]);
    await fileChooser1.accept([image1Path]);
    await handleConfirmPopup();

    // 6. Upload Frame 2
    console.log("[Puppeteer] Uploading Image 2...");
    const [fileChooser2] = await Promise.all([
      page.waitForFileChooser(),
      clickJsPath('[id$="-reference-upload-3"] > svg', "Kotak Frame 2")
    ]);
    await fileChooser2.accept([image2Path]);
    await handleConfirmPopup();

    // 7. Input Prompt di 0s
    console.log("[Puppeteer] Mengisi Teks Prompt...");
    await clickJsPath('[id$="-reference-upload-2"]', "Kotak Prompt 0s");
    // Ketik prompt
    await page.keyboard.type(prompt);
    
    // Memberikan waktu ekstra 5 detik agar sistem internal Dreamina (seperti filter kata/translasi otomatis) 
    // selesai memproses prompt panjang yang baru saja kita ketik
    await new Promise(r => setTimeout(r, 5000));

    // Sebelum memencet tombol Generate, kita rekam semua URL video yang sudah ada di layar (galeri)
    const existingVideos = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(Boolean);
    });
    console.log(`[Puppeteer] Ditemukan ${existingVideos.length} video usang di layar. Mengabaikannya...`);

    // 8. Klik Generate (Eksekusi)
    await clickJsPath("#dreamina-ui-configuration-content-wrapper > div.content-iyXFPD > div > div > div.scroll-content-b_fSc1.scroll-content > div.section-generator-rMSij5 > div > div.dimension-layout-cD09ib.default-layout-usosJ8.home-header-content-generator-qL9RPk > div > div.toolbar-tN43r_ > div.toolbar-actions-Rr9TiJ > div > button > svg > g > path", "Tombol Generate");

    console.log("[Puppeteer] Sedang melakukan generate... (Delay 10 detik awal, max 300 detik)");
    
    // Jeda 10 detik sebelum mulai mengintai, agar Dreamina sempat loading dan membersihkan DOM lama
    await new Promise(r => setTimeout(r, 10000));
    
    // Polling DOM for a NEW video tag
    let waitTime = 10;
    while (waitTime < 300) {
      // Cari video BARU yang muncul setelah generate (yang src-nya tidak ada di existingVideos)
      // ATAU cari di dalam wrapper spesifik dreamina-video-player
      const newVideoUrl = await page.evaluate((oldVids: string[]) => {
        // Prioritas Utama: Cari di dalam wrapper khusus video baru (sesuai masukan JS Path)
        const primaryVid = document.querySelector('[id^="dreamina-video-player-"] > video') as HTMLVideoElement;
        if (primaryVid && primaryVid.src && primaryVid.src.startsWith('http') && !oldVids.includes(primaryVid.src)) {
          return primaryVid.src;
        }

        // Fallback: Cari sembarang video yang URL-nya baru
        const vids = Array.from(document.querySelectorAll('video'));
        const newVid = vids.find(v => v.src && v.src.startsWith('http') && !oldVids.includes(v.src));
        return newVid ? newVid.src : null;
      }, existingVideos);
      
      if (newVideoUrl) {
        console.log("✅ Video BARU berhasil di-generate dan ditemukan di DOM!", newVideoUrl);
        return newVideoUrl;
      }
      
      await new Promise(r => setTimeout(r, 1000));
      waitTime++;
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
