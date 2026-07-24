import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

export async function getGoogleSheetsClient() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable not found');
  }

  let creds;
  try {
    creds = JSON.parse(credentials);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  return sheets;
}

export async function getSpreadsheetData(
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  try {
    const sheets = await getGoogleSheetsClient();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:Z`, 
    });

    return response.data.values || [];
  } catch (error: any) {
    console.error('Error fetching spreadsheet data:', error.message);
    throw new Error(`Gagal mengambil data dari sheet ${sheetName}: ${error.message}`);
  }
}
