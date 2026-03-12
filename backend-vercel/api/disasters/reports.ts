import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PETABENCANA_API } from "../lib/helpers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const disaster = (req.query.disaster as string) || "";
    const admin = (req.query.admin as string) || "";
    const timeperiod = (req.query.timeperiod as string) || "604800";

    let url = `${PETABENCANA_API}/reports?geoformat=geojson&timeperiod=${timeperiod}`;
    if (disaster) url += `&disaster=${disaster}`;
    if (admin) url += `&admin=${admin}`;

    const apiRes = await fetch(url, {
      headers: { "User-Agent": "GardaBencana/1.0" },
    });
    if (!apiRes.ok) throw new Error(`PetaBencana API error: ${apiRes.status}`);
    const data = await apiRes.json();

    const features = data.result?.features || [];
    const disasterLabels: Record<string, string> = {
      flood: "Banjir",
      earthquake: "Gempabumi",
      fire: "Kebakaran Hutan",
      haze: "Kabut Asap",
      wind: "Angin Kencang",
      volcano: "Gunung Api",
    };

    const reports = features.map((f: any) => {
      const p = f.properties;
      const coords = f.geometry?.coordinates || [0, 0];
      return {
        id: p.pkey,
        type: p.disaster_type,
        typeLabel: disasterLabels[p.disaster_type] || p.disaster_type,
        text: p.text || "",
        title: p.title || "",
        imageUrl: p.image_url || null,
        source: p.source,
        status: p.status,
        createdAt: p.created_at,
        lng: coords[0],
        lat: coords[1],
        city: p.tags?.city || "",
        regionCode: p.tags?.region_code || "",
        floodDepth: p.report_data?.flood_depth || null,
      };
    });

    res.json({ success: true, data: reports });
  } catch (e) {
    console.error("PetaBencana error:", e);
    res.status(500).json({ success: false, error: "Gagal mengambil data bencana" });
  }
}
