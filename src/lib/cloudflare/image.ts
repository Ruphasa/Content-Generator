import fs from 'fs';
import path from 'path';

export async function generateImageFromCloudflare(prompt: string, outputPath: string): Promise<boolean> {
  const url = process.env.CLOUDFLARE_IMAGE_API_URL;
  const apiKey = process.env.CLOUDFLARE_IMAGE_API_KEY;

  if (!url || !apiKey || url.includes('ganti-dengan')) {
    console.warn("⚠️ CLOUDFLARE_IMAGE_API_URL atau KEY belum dikonfigurasi.");
    return false;
  }

  try {
    console.log(`[Cloudflare-Image] Generating image for prompt: "${prompt.substring(0, 50)}..."`);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare API Error: ${response.status} ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Pastikan direktori ada
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Simpan file
    fs.writeFileSync(outputPath, buffer);
    console.log(`[Cloudflare-Image] Berhasil menyimpan gambar ke: ${outputPath}`);
    
    return true;
  } catch (error: any) {
    console.error("[Cloudflare-Image] Gagal membuat gambar:", error.message);
    return false;
  }
}
