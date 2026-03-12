import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateShelters } from "../lib/helpers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const lat = parseFloat(req.query.lat as string) || -6.2;
  const lng = parseFloat(req.query.lng as string) || 106.8;
  const shelters = generateShelters(lat, lng);
  res.json({ success: true, data: shelters });
}
