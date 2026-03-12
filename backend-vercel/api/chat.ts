import type { VercelRequest, VercelResponse } from "@vercel/node";
import { chatWithGroq, generateFallbackReply } from "./lib/helpers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, history } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Pesan tidak boleh kosong" });
  }

  const conversationHistory = Array.isArray(history) ? history : [];

  // Coba pakai Groq AI dulu (GROQ_API_KEY dari Vercel env vars)
  const aiReply = await chatWithGroq(message, conversationHistory);
  if (aiReply) {
    return res.json({ reply: aiReply });
  }

  // Fallback ke rule-based reply jika Groq tidak tersedia
  const fallbackReply = await generateFallbackReply(message);
  res.json({ reply: fallbackReply });
}
