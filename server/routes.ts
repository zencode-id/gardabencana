import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const BMKG_BASE = "https://data.bmkg.go.id/DataMKG/TEWS";
const BMKG_NOWCAST = "https://www.bmkg.go.id/alerts/nowcast/id";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

interface BmkgGempa {
  Tanggal: string;
  Jam: string;
  DateTime: string;
  Coordinates: string;
  Lintang: string;
  Bujur: string;
  Magnitude: string;
  Kedalaman: string;
  Wilayah: string;
  Potensi?: string;
  Dirasakan?: string;
  Shakemap?: string;
}

interface NowcastItem {
  title: string;
  description: string;
  pubDate: string;
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "SiagaBot/1.0" },
  });
  if (!res.ok) throw new Error(`BMKG API error: ${res.status}`);
  return res.json();
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "SiagaBot/1.0" },
  });
  if (!res.ok) throw new Error(`BMKG API error: ${res.status}`);
  return res.text();
}

function parseNowcastRss(xml: string): NowcastItem[] {
  const items: NowcastItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
    const description = itemXml.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "";
    const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
    items.push({ title: title.trim(), description: description.trim(), pubDate: pubDate.trim() });
  }
  return items;
}

function formatGempaData(gempa: BmkgGempa): string {
  let text = `Magnitudo: ${gempa.Magnitude} SR\n`;
  text += `Lokasi: ${gempa.Wilayah}\n`;
  text += `Kedalaman: ${gempa.Kedalaman}\n`;
  text += `Waktu: ${gempa.Tanggal}, ${gempa.Jam}\n`;
  text += `Koordinat: ${gempa.Lintang}, ${gempa.Bujur}\n`;
  if (gempa.Potensi) text += `Potensi: ${gempa.Potensi}\n`;
  if (gempa.Dirasakan) text += `Dirasakan: ${gempa.Dirasakan}\n`;
  return text;
}

async function getLatestEarthquake(): Promise<string> {
  try {
    const data = await fetchJson(`${BMKG_BASE}/autogempa.json`);
    const gempa = data.Infogempa.gempa;
    let result = "Gempa Terbaru (Data Real-time BMKG):\n\n";
    result += formatGempaData(gempa);
    return result;
  } catch (e) {
    return "Maaf, tidak dapat mengambil data gempa terbaru dari BMKG saat ini.";
  }
}

async function getRecentEarthquakes(): Promise<string> {
  try {
    const data = await fetchJson(`${BMKG_BASE}/gempaterkini.json`);
    const list: BmkgGempa[] = data.Infogempa.gempa;
    let result = "Daftar 15 Gempa M 5.0+ Terkini (BMKG):\n\n";
    list.slice(0, 5).forEach((g, i) => {
      result += `${i + 1}. M${g.Magnitude} - ${g.Wilayah}\n`;
      result += `   ${g.Tanggal}, ${g.Jam} | ${g.Kedalaman}\n`;
      result += `   ${g.Potensi || ""}\n\n`;
    });
    return result;
  } catch (e) {
    return "Maaf, tidak dapat mengambil data gempa terkini dari BMKG saat ini.";
  }
}

async function getFeltEarthquakes(): Promise<string> {
  try {
    const data = await fetchJson(`${BMKG_BASE}/gempadirasakan.json`);
    const list: BmkgGempa[] = data.Infogempa.gempa;
    let result = "Daftar Gempa Dirasakan Terkini (BMKG):\n\n";
    list.slice(0, 5).forEach((g, i) => {
      result += `${i + 1}. M${g.Magnitude} - ${g.Wilayah}\n`;
      result += `   ${g.Tanggal}, ${g.Jam} | ${g.Kedalaman}\n`;
      result += `   Dirasakan: ${g.Dirasakan || "-"}\n\n`;
    });
    return result;
  } catch (e) {
    return "Maaf, tidak dapat mengambil data gempa dirasakan dari BMKG saat ini.";
  }
}

async function getWeatherWarnings(): Promise<string> {
  try {
    const xml = await fetchXml(BMKG_NOWCAST);
    const items = parseNowcastRss(xml);
    if (items.length === 0) {
      return "Tidak ada peringatan dini cuaca aktif saat ini (BMKG).";
    }
    let result = "Peringatan Dini Cuaca Aktif (BMKG):\n\n";
    items.slice(0, 5).forEach((item, i) => {
      result += `${i + 1}. ${item.title}\n`;
      const shortDesc = item.description.length > 200
        ? item.description.slice(0, 200) + "..."
        : item.description;
      result += `   ${shortDesc}\n\n`;
    });
    return result;
  } catch (e) {
    return "Maaf, tidak dapat mengambil data peringatan dini cuaca dari BMKG saat ini.";
  }
}

async function getAllBmkgContext(): Promise<string> {
  const [latest, recent, felt, warnings] = await Promise.all([
    getLatestEarthquake(),
    getRecentEarthquakes(),
    getFeltEarthquakes(),
    getWeatherWarnings(),
  ]);
  return `${latest}\n---\n${recent}\n---\n${felt}\n---\n${warnings}`;
}

const SYSTEM_PROMPT = `Kamu adalah SiagaBot, asisten darurat bencana Indonesia yang bertugas memberikan informasi kebencanaan yang akurat dan membantu masyarakat dalam situasi darurat.

Peran dan kemampuanmu:
1. Memberikan informasi gempa bumi real-time dari BMKG
2. Memberikan peringatan dini cuaca dari BMKG
3. Memberikan panduan pertolongan pertama (P3K)
4. Membantu mencari shelter/posko pengungsian
5. Memberikan panduan evakuasi untuk berbagai jenis bencana (gempa, tsunami, banjir, kebakaran, longsor)
6. Memberikan nomor darurat penting

Aturan:
- Selalu gunakan bahasa Indonesia yang jelas dan mudah dipahami
- Prioritaskan keselamatan dalam setiap saran
- Jika ada data BMKG yang tersedia, gunakan data tersebut untuk menjawab
- Cantumkan sumber data dari BMKG jika menggunakan data resmi
- Berikan instruksi yang ringkas dan jelas, terutama dalam situasi darurat
- Untuk informasi shelter, berikan saran umum karena data shelter spesifik memerlukan koordinasi dengan BPBD setempat
- Nomor darurat penting: 112 (Darurat Umum), 119 (Ambulans), 113 (Pemadam), 115 (SAR), BPBD: 177

Berikut adalah data real-time dari BMKG yang bisa kamu gunakan untuk menjawab pertanyaan:
`;

async function chatWithGroq(
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return "Error: GROQ_API_KEY belum dikonfigurasi.";
  }

  try {
    const bmkgData = await getAllBmkgContext();
    const systemMessage = SYSTEM_PROMPT + bmkgData;

    const messages = [
      { role: "system", content: systemMessage },
      ...conversationHistory.slice(-10),
      { role: "user", content: userMessage },
    ];

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Groq API error:", res.status, errText);
      return "Maaf, terjadi kesalahan saat menghubungi AI. Silakan coba lagi.";
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Maaf, tidak ada respons dari AI.";
  } catch (e) {
    console.error("Groq chat error:", e);
    return "Maaf, terjadi kesalahan koneksi. Silakan coba lagi.";
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/bmkg/gempa-terbaru", async (_req: Request, res: Response) => {
    try {
      const data = await fetchJson(`${BMKG_BASE}/autogempa.json`);
      res.json({ success: true, data: data.Infogempa.gempa });
    } catch (e) {
      res.status(500).json({ success: false, error: "Gagal mengambil data gempa" });
    }
  });

  app.get("/api/bmkg/gempa-terkini", async (_req: Request, res: Response) => {
    try {
      const data = await fetchJson(`${BMKG_BASE}/gempaterkini.json`);
      res.json({ success: true, data: data.Infogempa.gempa });
    } catch (e) {
      res.status(500).json({ success: false, error: "Gagal mengambil data gempa terkini" });
    }
  });

  app.get("/api/bmkg/gempa-dirasakan", async (_req: Request, res: Response) => {
    try {
      const data = await fetchJson(`${BMKG_BASE}/gempadirasakan.json`);
      res.json({ success: true, data: data.Infogempa.gempa });
    } catch (e) {
      res.status(500).json({ success: false, error: "Gagal mengambil data gempa dirasakan" });
    }
  });

  app.get("/api/bmkg/peringatan-cuaca", async (_req: Request, res: Response) => {
    try {
      const xml = await fetchXml(BMKG_NOWCAST);
      const items = parseNowcastRss(xml);
      res.json({ success: true, data: items });
    } catch (e) {
      res.status(500).json({ success: false, error: "Gagal mengambil data peringatan cuaca" });
    }
  });

  app.post("/api/chat", async (req: Request, res: Response) => {
    const { message, history } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Pesan tidak boleh kosong" });
    }

    const conversationHistory = Array.isArray(history) ? history : [];
    const reply = await chatWithGroq(message, conversationHistory);
    res.json({ reply });
  });

  const httpServer = createServer(app);
  return httpServer;
}
