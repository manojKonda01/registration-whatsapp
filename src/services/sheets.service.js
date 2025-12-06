import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
let sheetsClient = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const jwtClient = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    key,
    SCOPES
  );
  sheetsClient = google.sheets({ version: "v4", auth: jwtClient });
  return sheetsClient;
}

export async function appendSheetRow(data) {
  try {
    const sheets = getSheetsClient();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const row = [
      new Date().toISOString(),
      data.registrationId || "",
      data.phone || "",
      data.name || "",
      data.email || "",
      data.arrivalDate || "",
      data.arrivalTime || "",
      data.departureDate || "",
      data.transport || "",
      data.attendeeNumbers || "",
      data.attendeeNames || "",
      data.volunteering || "",
      data.special || "",
      data.baptism || ""
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] }
    });
    return true;
  } catch (err) {
    console.error("appendSheetRow error", err?.response?.data || err.message);
    throw err;
  }
}
