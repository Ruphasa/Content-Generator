'use server';

import { DNAData, AssetFolder, VisualGuideData } from '@/components/ClientLayout';
import { getSpreadsheetData } from '@/lib/google/sheets';
import { downloadFiles } from '@/lib/google/drive';

async function syncDNAForm(spreadsheetId: string): Promise<{ success: boolean; message: string; dnaData: Partial<DNAData> }> {
  try {
    const sheetData = await getSpreadsheetData(spreadsheetId, 'BrandProfile');

    if (sheetData.length === 0) {
      return { success: false, message: 'Sheet BrandProfile kosong atau tidak ditemukan', dnaData: {} };
    }

    const dnaData: Partial<DNAData> = {};

    // Parse vertically (Key-Value)
    for (const row of sheetData) {
      if (row.length < 2) continue;
      
      const key = String(row[0]).trim().toLowerCase();
      const value = String(row[1]).trim();
      const normalizedKey = key.replace(/\s+/g, '');

      switch (normalizedKey) {
        case 'brandname': dnaData.brandName = value; break;
        case 'tagline': dnaData.tagline = value; break;
        case 'brandoverview': dnaData.brandOverview = value; break;
        case 'visi': dnaData.visi = value; break;
        case 'misi': dnaData.misi = value; break;
        case 'targetaudience': dnaData.targetAudience = value; break;
        case 'keyvocabulary': dnaData.keyVocabulary = value; break;
        case 'bannedcontent': dnaData.bannedContent = value; break;
        case 'standardcta': dnaData.standardCTA = value; break;
        case 'tone': 
        case 'toneofvoice': dnaData.tone = value; break;
        case 'visualstyle': dnaData.visualStyle = value; break;
        case 'hashtagstyle': 
        case 'hashtags': {
          const hashtags = value.match(/#[a-zA-Z0-9_]+/g);
          if (hashtags) {
            dnaData.hashtagStyle = hashtags.join(' ');
          } else {
            dnaData.hashtagStyle = value;
          }
          break;
        }
        case 'typography':
        case 'font': {
          const primaryFontMatch = value.match(/Primary\s*Font\s*:\s*([a-zA-Z\s]+)/i);
          if (primaryFontMatch) {
            dnaData.primaryFont = primaryFontMatch[1].split('atau')[0].trim();
          }
          const secondaryFontMatch = value.match(/Secondary\s*Font\s*:\s*([a-zA-Z\s]+)/i);
          if (secondaryFontMatch) {
            dnaData.secondaryFont = secondaryFontMatch[1].split('atau')[0].trim();
          }
          break;
        }
        case 'brandcolors':
        case 'primarycolor': {
          const hexMatches = value.match(/#[a-fA-F0-9]{3,6}/g);
          if (hexMatches && hexMatches.length > 0) {
            dnaData.primaryColor = hexMatches[0];
            if (hexMatches.length > 1) {
              dnaData.secondaryColor = hexMatches[1];
            }
          }
          break;
        }
        case 'secondarycolor': {
          const hexMatch = value.match(/#[a-fA-F0-9]{3,6}/);
          if (hexMatch) dnaData.secondaryColor = hexMatch[0];
          break;
        }
      }
    }

    return { success: true, message: 'Brand DNA berhasil disinkronkan!', dnaData };
  } catch (error: unknown) {
    console.error('Error syncing DNA form:', error);
    return { success: false, message: (error as Error).message || 'Gagal menyinkronkan Brand DNA', dnaData: {} };
  }
}

async function syncVisualGuide(spreadsheetId: string): Promise<{ success: boolean; message: string; visualGuide: Partial<VisualGuideData> }> {
  try {
    const sheetData = await getSpreadsheetData(spreadsheetId, 'VisualGuideline');

    if (sheetData.length === 0) {
      return { success: false, message: 'Sheet VisualGuideline kosong atau tidak ditemukan', visualGuide: {} };
    }

    // Always read from row index 1 (ignoring messy headers) if available
    let row = sheetData[0];
    if (sheetData.length > 1) {
      row = sheetData[1];
    }
    
    const visualGuide: Partial<VisualGuideData> = {
      konten: (row[0] as string) || '',
      referensi: (row[1] as string) || '',
      goal: (row[2] as string) || '',
      videoStyle: (row[3] as string) || '',
      sound: (row[4] as string) || '',
      caption: (row[5] as string) || '',
      visualFocus: (row[6] as string) || '',
      hook: (row[7] as string) || '',
      validasi: [row[8] as string, row[9] as string].filter(Boolean).join('\n').trim(),
      insight: [row[10] as string, row[11] as string].filter(Boolean).join('\n').trim(),
      actionCta: (row[12] as string) || '',
    };

    return { success: true, message: 'Visual Guide berhasil disinkronkan!', visualGuide };
  } catch (error: unknown) {
    console.error('Error syncing Visual Guide:', error);
    return { success: false, message: (error as Error).message || 'Gagal menyinkronkan Visual Guide', visualGuide: {} };
  }
}

async function syncAssets(spreadsheetId: string): Promise<{ success: boolean; message: string; folders: AssetFolder[] }> {
  try {
    const sheetData = await getSpreadsheetData(spreadsheetId, 'Assets');

    if (sheetData.length === 0) {
      return { success: false, message: 'Sheet Assets kosong atau tidak ditemukan', folders: [] };
    }

    const folders: AssetFolder[] = [];

    // Skip header if it exists
    const startIndex = (sheetData.length > 0 && String(sheetData[0][0]).toLowerCase().includes('folder')) ? 1 : 0;

    const folderMap = new Map<string, { url: string; filename?: string }[]>();

    for (let i = startIndex; i < sheetData.length; i++) {
      const row = sheetData[i];
      
      const folderName = String(row[0]).trim() || `Folder Unnamed`;
      const keterangan = row[2] ? String(row[2]).trim() : (row[1] ? String(row[1]).trim() : undefined);
      
      // Explicitly read Column D (row[3]) for Link Download
      let url = row[3] ? String(row[3]).trim() : '';
      if (!url) continue;
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }

      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, []);
      }
      folderMap.get(folderName)!.push({ url, filename: keterangan });
    }

    for (const [folderName, tasks] of Array.from(folderMap.entries())) {
      if (tasks.length > 0) {
        folders.push({
          id: `folder-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: folderName,
          files: [],
          remoteUrls: tasks
        });
      }
    }

    return { success: true, message: `Berhasil menyinkronkan ${folders.length} folder dengan ${folders.reduce((acc, f) => acc + f.files.length, 0)} aset!`, folders };
  } catch (error: unknown) {
    console.error('Error syncing assets:', error);
    return { success: false, message: (error as Error).message || 'Gagal menyinkronkan Assets', folders: [] };
  }
}

export async function syncAll(spreadsheetId: string) {
  try {
    const [dnaResult, visualResult, assetsResult] = await Promise.all([
      syncDNAForm(spreadsheetId),
      syncVisualGuide(spreadsheetId),
      syncAssets(spreadsheetId)
    ]);

    const isSuccess = dnaResult.success || visualResult.success || assetsResult.success;
    
    if (!isSuccess) {
       return { 
         success: false, 
         message: 'Gagal menyinkronkan seluruh data. Pastikan Spreadsheet ID benar dan format sesuai.',
         data: null
       };
    }

    let message = 'Berhasil menyinkronkan data: ';
    const successParts = [];
    if (dnaResult.success) successParts.push('Brand DNA');
    if (visualResult.success) successParts.push('Visual Guide');
    if (assetsResult.success) successParts.push('Assets');
    message += successParts.join(', ');

    return {
      success: true,
      message,
      data: {
        dnaData: dnaResult.dnaData,
        visualGuide: visualResult.visualGuide,
        folders: assetsResult.folders
      }
    };

  } catch (error: unknown) {
    console.error('Error in syncAll:', error);
    return { 
      success: false, 
      message: (error as Error).message || 'Gagal melakukan sinkronisasi global',
      data: null
    };
  }
}
