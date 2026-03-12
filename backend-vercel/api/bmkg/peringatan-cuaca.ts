import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchXml, parseNowcastRss, BMKG_NOWCAST } from "../lib/helpers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const xml = await fetchXml(BMKG_NOWCAST);
    const items = parseNowcastRss(xml);
    res.json({ success: true, data: items });
  } catch (e) {
    res.status(500).json({ success: false, error: "Gagal mengambil data peringatan cuaca" });
  }
}
