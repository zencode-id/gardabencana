import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchJson, BMKG_BASE } from "../lib/helpers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const data = await fetchJson(`${BMKG_BASE}/autogempa.json`);
    res.json({ success: true, data: data.Infogempa.gempa });
  } catch (e) {
    res.status(500).json({ success: false, error: "Gagal mengambil data gempa" });
  }
}
