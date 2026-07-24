# Venturo Pro - Spreadsheet Sync Walkthrough

## 📊 Overview

The Spreadsheet Sync feature allows you to quickly populate your Brand DNA, Visual Guides, and Assets from a Google Sheets file with just one click. This eliminates manual data entry and ensures consistency across your content creation.

## 🔧 Setup Instructions

### 1. Google Cloud Project Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable these APIs:
   - **Google Sheets API**
   - **Google Drive API**

### 2. Create Service Account

1. Navigate to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Name it (e.g., "venturo-spreadsheet-api")
4. Click **Create and Continue**
5. Click **Done** (no permissions needed yet)

### 3. Generate Credentials

1. Click on your service account email
2. Navigate to **Keys** > **Add Key** > **Create new key**
3. Select **JSON** format
4. Download and save the file as `clean-avatar-476113-j3-9b345434f178.json` in your project root
5. Add the JSON content to `.env.local` as `GOOGLE_SERVICE_ACCOUNT_KEY`

### 4. Share Spreadsheet

1. Create a Google Sheet with the following structure:
   
   **Sheet 1: BrandProfile** (Row 2 = data)
   ```
   brandName, tagline, brandOverview, visi, misi, 
   targetAudience, keyVocabulary, bannedContent, 
   standardCTA, tone, visualStyle, primaryColor, 
   secondaryColor, hashtagStyle
   ```

   **Sheet 2: VisualGuideline** (Row 2 = data)
   ```
   konten, referensi, goal, videoStyle, sound,
   caption, visualFocus, hook, validasi, 
   insight, actionCta
   ```

   **Sheet 3: Assets** (Row 1 = headers)
   ```
   Folder1, fileURL1, fileURL2, ...
   Folder2, fileURL3, fileURL4, ...
   ```

2. Share the spreadsheet with your service account email:
   - **Share** the sheet
   - Enter your service account email (found in the JSON key)
   - Give **Editor** access
   - Click **Send**

### 5. Environment Configuration

Add this to `.env.local`:

```env
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----","client_email":"your-email@project-id.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"...","universe_domain":"googleapis.com"}
```

## 🚀 How to Use

### Sync Brand DNA

1. Navigate to **Business DNA** > **Brand Overview** tab
2. Click the **refresh icon** (🔄) in the top right of the Brand Name section
3. Enter your Spreadsheet ID (e.g., `1BxiMVs0XRA5nFMdKvBdBZjGMUUqptbfsTDSRqnj6mcI`)
4. Click **Sync DNA**

The following fields will be auto-filled:
- Brand Name
- Tagline
- Brand Overview
- Visi
- Misi
- Target Audience
- Key Vocabulary
- Banned Content
- Standard CTA
- Tone
- Visual Style
- Primary Color
- Secondary Color
- Hashtag Style

### Sync Visual Guide

1. Navigate to **Visual Guide** tab
2. Click the **refresh icon** (🔄) in the top right
3. Enter your Spreadsheet ID
4. Click **Sync Visual Guide**

The following fields will be auto-filled:
- Konten
- Referensi
- Goal
- Video Style
- Sound
- Caption
- Visual Focus
- Hook
- Validasi
- Insight
- Action (CTA)

### Sync Assets

1. Navigate to **Assets** tab
2. Click the **refresh icon** (🔄) in the top right
3. Enter your Spreadsheet ID
4. Click **Sync Assets**

The system will:
- Read the **Assets** sheet
- Extract folder names from Column 1
- Download files from the remaining columns
- Create folders with downloaded files
- Display the synced folders in the Assets page

## 📝 Spreadsheet Format Examples

### BrandProfile Sheet

| brandName | tagline | brandOverview | visi | misi | targetAudience | keyVocabulary | bannedContent | standardCTA | tone | visualStyle | primaryColor | secondaryColor | hashtagStyle |
|-----------|---------|---------------|------|------|----------------|---------------|---------------|-------------|------|-------------|--------------|----------------|---------------|
| Venturo Pro | Unlock Your Potential | Premium brand delivering excellence | To become the leading... | Through innovation... | Professionals | Premium, Quality, Excellence | No generic stock photos | Link in Bio | Professional, Bold, Modern | Cinematic, High-end | #009BAD | #FFFFFF | #VenturoPro |

### VisualGuideline Sheet

| konten | referensi | goal | videoStyle | sound | caption | visualFocus | hook | validasi | insight | actionCta |
|--------|-----------|------|------------|-------|---------|-------------|------|----------|---------|-----------|
| Product demo video | https://example.com/refs | Awareness | Cinematic, Clean | Upbeat corporate | Check us out! | Product shot | "Meet our new..." | Close-up of product | "Experience..." | "Click link to buy!" |

### Assets Sheet

| Folder Name | File URL 1 | File URL 2 | File URL 3 |
|-------------|------------|------------|------------|
| Product Images | https://drive.google.com/uc?export=download&id=1abc... | https://drive.google.com/uc?export=download&id=2def... | https://drive.google.com/uc?export=download&id=3ghi... |
| Logos | https://drive.google.com/uc?export=download&id=4jkl... | | |
| Social Media | https://drive.google.com/uc?export=download&id=5mno... | https://drive.google.com/uc?export=download&id=6pqr... | |

## ⚠️ Important Notes

1. **Spreadsheet ID Format:**
   - Extract from URL: `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`
   - The ID is between `/d/` and `/edit`

2. **File URLs:**
   - Must be direct download links or Google Drive URLs with `uc?export=download`
   - Files must be publicly accessible or shareable with your service account

3. **Column Mapping:**
   - BrandProfile: Row 2 columns map to DNA fields in order
   - VisualGuideline: Row 2 columns map to VisualGuide fields in order
   - Assets: Column 1 = folder name, rest = file URLs

4. **Security:**
   - Never commit your service account key to Git
   - Keep the JSON file secured and never share it
   - Only share spreadsheets with the service account email

## 🔍 Troubleshooting

### Error: "GOOGLE_SERVICE_ACCOUNT_KEY environment variable not found"
- Make sure you've added the JSON to `.env.local`

### Error: "Spreadsheet ID kosong atau tidak ditemukan"
- Check that you've entered the correct Spreadsheet ID
- Verify the spreadsheet is shared with your service account email

### Error: "Gagal mengambil data dari sheet BrandProfile"
- Check that the sheet name matches exactly (case-sensitive)
- Verify that Row 2 contains data

### Files Not Downloading
- Check that file URLs are valid and accessible
- Ensure files are not password-protected or require login
- Verify the service account has access to the files

## 📞 Support

If you encounter issues:
1. Check the browser console for detailed error messages
2. Verify all permissions in Google Cloud Console
3. Ensure spreadsheet sharing is set correctly
4. Check that the service account key is correctly formatted

---

**Last Updated:** 2026-07-20
