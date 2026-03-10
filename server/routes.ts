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
    headers: { "User-Agent": "Garda Bencana/1.0" },
  });
  if (!res.ok) throw new Error(`BMKG API error: ${res.status}`);
  return res.json();
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Garda Bencana/1.0" },
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

async function getLatestEarthquake(): Promise<string> {
  const data = await fetchJson(`${BMKG_BASE}/autogempa.json`);
  const g = data.Infogempa.gempa;
  let result = "Data Gempa Terbaru (Real-time BMKG):\n\n";
  result += `Magnitudo: ${g.Magnitude} SR\n`;
  result += `Lokasi: ${g.Wilayah}\n`;
  result += `Kedalaman: ${g.Kedalaman}\n`;
  result += `Waktu: ${g.Tanggal}, ${g.Jam}\n`;
  result += `Koordinat: ${g.Lintang}, ${g.Bujur}\n`;
  if (g.Potensi) result += `Status: ${g.Potensi}\n`;
  if (g.Dirasakan) result += `Dirasakan: ${g.Dirasakan}\n`;
  return result;
}

async function getRecentEarthquakes(): Promise<string> {
  const data = await fetchJson(`${BMKG_BASE}/gempaterkini.json`);
  const list: BmkgGempa[] = data.Infogempa.gempa;
  let result = "Daftar Gempa M 5.0+ Terkini (BMKG):\n\n";
  list.slice(0, 5).forEach((g, i) => {
    result += `${i + 1}. M${g.Magnitude} - ${g.Wilayah}\n`;
    result += `   ${g.Tanggal}, ${g.Jam}\n`;
    result += `   Kedalaman: ${g.Kedalaman}\n`;
    if (g.Potensi) result += `   ${g.Potensi}\n`;
    result += "\n";
  });
  return result;
}

async function getFeltEarthquakes(): Promise<string> {
  const data = await fetchJson(`${BMKG_BASE}/gempadirasakan.json`);
  const list: BmkgGempa[] = data.Infogempa.gempa;
  let result = "Daftar Gempa Dirasakan Terkini (BMKG):\n\n";
  list.slice(0, 5).forEach((g, i) => {
    result += `${i + 1}. M${g.Magnitude} - ${g.Wilayah}\n`;
    result += `   ${g.Tanggal}, ${g.Jam}\n`;
    result += `   Kedalaman: ${g.Kedalaman}\n`;
    if (g.Dirasakan) result += `   Dirasakan: ${g.Dirasakan}\n`;
    result += "\n";
  });
  return result;
}

async function getWeatherWarnings(): Promise<string> {
  const xml = await fetchXml(BMKG_NOWCAST);
  const items = parseNowcastRss(xml);
  if (items.length === 0) {
    return "Saat ini tidak ada peringatan dini cuaca aktif dari BMKG.\n\nKondisi cuaca relatif aman di seluruh wilayah Indonesia.";
  }
  let result = "Peringatan Dini Cuaca Aktif (BMKG):\n\n";
  items.slice(0, 5).forEach((item, i) => {
    result += `${i + 1}. ${item.title}\n`;
    const shortDesc = item.description.length > 250
      ? item.description.slice(0, 250) + "..."
      : item.description;
    result += `   ${shortDesc}\n\n`;
  });
  result += "Sumber: BMKG - Badan Meteorologi, Klimatologi, dan Geofisika";
  return result;
}

async function getAllBmkgContext(): Promise<string> {
  const [latest, recent, felt, warnings] = await Promise.all([
    getLatestEarthquake().catch(() => "Data gempa terbaru tidak tersedia."),
    getRecentEarthquakes().catch(() => "Data gempa terkini tidak tersedia."),
    getFeltEarthquakes().catch(() => "Data gempa dirasakan tidak tersedia."),
    getWeatherWarnings().catch(() => "Data peringatan cuaca tidak tersedia."),
  ]);
  return `${latest}\n---\n${recent}\n---\n${felt}\n---\n${warnings}`;
}

const SYSTEM_PROMPT = `Kamu adalah Garda Bencana, asisten darurat bencana Indonesia yang bertugas memberikan informasi kebencanaan yang akurat dan membantu masyarakat dalam situasi darurat.

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
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

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
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error("Groq chat error:", e);
    return null;
  }
}

async function generateFallbackReply(message: string): Promise<string> {
  const lower = message.toLowerCase();

  if (lower.includes("gempa") || lower.includes("earthquake")) {
    try {
      const [latest, recent, felt] = await Promise.all([
        getLatestEarthquake(),
        getRecentEarthquakes(),
        getFeltEarthquakes(),
      ]);
      if (lower.includes("dirasakan") || lower.includes("felt")) {
        return felt + "\nSumber: BMKG (data real-time)";
      }
      if (lower.includes("terkini") || lower.includes("daftar") || lower.includes("list")) {
        return recent + "\nSumber: BMKG (data real-time)";
      }
      return latest + "\n---\n\n" + recent + "\nSumber: BMKG (data real-time)";
    } catch {
      return "Maaf, tidak dapat mengambil data gempa dari BMKG saat ini. Silakan coba lagi nanti.\n\nUntuk info gempa terkini, kunjungi: https://www.bmkg.go.id/";
    }
  }

  if (lower.includes("cuaca") || lower.includes("weather") || lower.includes("hujan") || lower.includes("peringatan")) {
    try {
      return await getWeatherWarnings();
    } catch {
      return "Maaf, tidak dapat mengambil data peringatan cuaca dari BMKG saat ini.";
    }
  }

  if (lower.includes("p3k") || lower.includes("luka") || lower.includes("pertolongan") || lower.includes("first aid") || lower.includes("medis")) {
    return `Panduan Pertolongan Pertama (P3K):

Luka Ringan:
1. Bersihkan luka dengan air mengalir
2. Oleskan antiseptik (Betadine/Povidone)
3. Tutup dengan perban steril

Patah Tulang:
1. Jangan menggerakkan bagian yang patah
2. Stabilkan dengan bidai/splint
3. Kompres es untuk kurangi bengkak
4. Segera bawa ke RS

Luka Bakar:
1. Siram air dingin mengalir 10-20 menit
2. Jangan pecahkan lepuhan
3. Tutup dengan kain bersih

CPR (Resusitasi Jantung Paru):
1. Pastikan area aman
2. Cek kesadaran korban
3. Hubungi 119 segera
4. Tekan dada 30x, napas buatan 2x
5. Ulangi hingga bantuan datang

Nomor Darurat: 119 (Ambulans) | 112 (Darurat Umum)`;
  }

  if (lower.includes("shelter") || lower.includes("posko") || lower.includes("evakuasi") || lower.includes("pengungsian") || lower.includes("mengungsi")) {
    return `Panduan Mencari Shelter/Posko Pengungsian:

1. Hubungi BPBD setempat: 177
2. Hubungi Darurat Umum: 112
3. Cek informasi posko di RT/RW setempat
4. Pantau media sosial resmi BPBD provinsi/kabupaten

Lokasi umum shelter darurat:
- Balai Desa / Kelurahan
- GOR / Gedung Olahraga
- Sekolah (SD, SMP, SMA)
- Masjid / Gereja / Tempat Ibadah
- Lapangan terbuka (untuk gempa)

Kontak Penting: BPBD: 177 | SAR: 115 | Darurat: 112`;
  }

  if (lower.includes("nomor") || lower.includes("darurat") || lower.includes("emergency") || lower.includes("telepon") || lower.includes("hubungi")) {
    return `Nomor Darurat Penting Indonesia:

- 112 : Darurat Umum
- 119 : Ambulans
- 113 : Pemadam Kebakaran
- 115 : SAR / Basarnas
- 177 : BPBD
- 110 : Polisi
- 021-6546315 : BMKG`;
  }

  return `Saya Garda Bencana, siap membantu Anda.

Silakan tanyakan tentang:
- Info gempa terkini (data BMKG)
- Peringatan cuaca
- Panduan P3K
- Cari shelter/posko
- Panduan bencana (banjir, kebakaran, tsunami, longsor)
- Nomor darurat

Nomor Darurat: 112 (Umum) | 119 (Ambulans) | 113 (Pemadam) | 177 (BPBD)`;
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

    const aiReply = await chatWithGroq(message, conversationHistory);
    if (aiReply) {
      return res.json({ reply: aiReply });
    }

    const fallbackReply = await generateFallbackReply(message);
    res.json({ reply: fallbackReply });
  });

  const httpServer = createServer(app);
  return httpServer;
}
