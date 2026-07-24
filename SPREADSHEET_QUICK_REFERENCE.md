# Spreadsheet Sync - Quick Reference

## 📋 Spreadsheet Structure

### BrandProfile Sheet
Row 2 columns → DNA fields (in order)
```
brandName | tagline | brandOverview | visi | misi | 
targetAudience | keyVocabulary | bannedContent | standardCTA | tone | 
visualStyle | primaryColor | secondaryColor | hashtagStyle
```

### VisualGuideline Sheet
Row 2 columns → Visual Guide fields (in order)
```
konten | referensi | goal | videoStyle | sound | 
caption | visualFocus | hook | validasi | insight | 
actionCta
```

### Assets Sheet
Column 1 = folder name, rest = file URLs
```
FolderName | fileURL1 | fileURL2 | fileURL3 | ...
```

## 🚀 Usage Flow

1. **Open App** → Navigate to DNA/Visual Guide/Assets tab
2. **Click Refresh Icon** (🔄) in top right header
3. **Enter Spreadsheet ID** → Format: `1BxiMVs0XRA5nFMdKvBdBZjGMUUqptbfsTDSRqnj6mcI`
4. **Click Sync** → Data auto-fills
5. **Review** → Verify data in fields

## 📝 Spreadsheet ID Format

URL: `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`

Extract the ID between `/d/` and `/edit`

Example:
- URL: `https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjGMUUqptbfsTDSRqnj6mcI/edit`
- ID: `1BxiMVs0XRA5nFMdKvBdBZjGMUUqptbfsTDSRqnj6mcI`

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Key not found | Add `GOOGLE_SERVICE_ACCOUNT_KEY` to `.env.local` |
| Sheet not found | Check sheet name matches exactly (case-sensitive) |
| Empty fields | Verify Row 2 contains data |
| Files not downloading | Check URLs are valid and accessible |
| Permission denied | Share spreadsheet with service account email |

## ⚡ Commands

```bash
# Install dependencies
bun install googleapis

# Start dev server
bun dev

# Sync DNA
# 1. Go to Brand Overview tab
# 2. Click refresh icon (🔄)
# 3. Enter Spreadsheet ID
# 4. Click "Sync DNA"

# Sync Visual Guide
# 1. Go to Visual Guide tab
# 2. Click refresh icon (🔄)
# 3. Enter Spreadsheet ID
# 4. Click "Sync Visual Guide"

# Sync Assets
# 1. Go to Assets tab
# 2. Click refresh icon (🔄)
# 3. Enter Spreadsheet ID
# 4. Click "Sync Assets"
```

## 🔐 Security

- ✅ Service account key stored in `.env.local` (gitignored)
- ✅ No credentials in frontend code
- ✅ Spreadsheet shared only with service account
- ✅ Actions run server-side for security

## 📊 Field Limits

- Brand DNA: 14 fields from spreadsheet
- Visual Guide: 11 fields from spreadsheet
- Assets: Unlimited folders, unlimited files per folder

## 🎯 Tips

1. Use the same Spreadsheet ID for all sync operations
2. Keep spreadsheet rows in order (Row 2 for data)
3. Ensure file URLs are valid download links
4. Share spreadsheet with service account before using
5. Test sync with small data first, then scale up
