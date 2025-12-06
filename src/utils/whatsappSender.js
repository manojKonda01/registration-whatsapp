import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const GRAPH_BASE = "https://graph.facebook.com/v22.0";

export async function sendWhatsAppMessage(to, text) {
  try {
    const body = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text }
    };
    const url = `${GRAPH_BASE}/${process.env.PHONE_NUMBER_ID}/messages`;
    await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("sendWhatsAppMessage error", err?.response?.data || err.message);
    throw err;
  }
}
