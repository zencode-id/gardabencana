import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import path from "node:path";
import multer from "multer";
import fs from "node:fs";

const upload = multer({ dest: "uploads/" });
const GROQ_AUDIO_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

const BMKG_BASE = "https://data.bmkg.go.id/DataMKG/TEWS";
const BMKG_NOWCAST = "https://www.bmkg.go.id/alerts/nowcast/id";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const PETABENCANA_API = "https://data.petabencana.id";

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

async function transcribeAudio(filePath: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: "audio/m4a" });
    
    formData.append("file", blob, "recording.m4a");
    formData.append("model", "whisper-large-v3");
    formData.append("language", "id");

    const res = await fetch(GROQ_AUDIO_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Groq Whisper error:", res.status, errText);
      return null;
    }

    const data = await res.json();
    return data.text || null;
  } catch (e) {
    console.error("Transcription error:", e);
    return null;
  } finally {
    // Bersihkan file sementara
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
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

interface ShelterData {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distance: string;
  distanceKm: number;
  capacity: string;
  facilities: string;
}

const SHELTER_TEMPLATES = [
  { name: "Posko Utama Balai Kota", type: "Balai Kota", facilities: "Fasilitas Medis, Dapur Umum, Air Bersih" },
  { name: "Gedung Olahraga (GOR)", type: "GOR", facilities: "Lapangan Luas, Toilet, Air Bersih" },
  { name: "Masjid Agung", type: "Tempat Ibadah", facilities: "Toilet, Air Bersih, Ruang Terbuka" },
  { name: "SD Negeri 01", type: "Sekolah", facilities: "Ruang Kelas, Toilet, Lapangan" },
  { name: "Stadion Mini", type: "Stadion", facilities: "Lapangan Luas, Toilet, Parkir" },
  { name: "Kantor Kelurahan", type: "Kelurahan", facilities: "Ruang Pertemuan, Toilet" },
  { name: "SMP Negeri 02", type: "Sekolah", facilities: "Ruang Kelas, Aula, Toilet" },
  { name: "Gereja Bethel", type: "Tempat Ibadah", facilities: "Aula, Toilet, Dapur" },
  { name: "Posko BPBD", type: "BPBD", facilities: "Fasilitas Medis, Logistik, Komunikasi" },
  { name: "Lapangan Merdeka", type: "Lapangan", facilities: "Area Terbuka, Parkir Luas" },
  { name: "Puskesmas Kecamatan", type: "Kesehatan", facilities: "Fasilitas Medis, Obat-obatan" },
  { name: "GOR Kecamatan", type: "GOR", facilities: "Lapangan Indoor, Toilet, Air Bersih" },
];

function generateShelters(userLat: number, userLng: number): ShelterData[] {
  const seed = Math.floor(userLat * 100) + Math.floor(userLng * 100);
  const shelters: ShelterData[] = [];

  SHELTER_TEMPLATES.forEach((template, i) => {
    const angle = ((seed + i * 37) % 360) * (Math.PI / 180);
    const dist = 0.005 + ((seed + i * 53) % 100) / 2500;
    const lat = userLat + Math.cos(angle) * dist;
    const lng = userLng + Math.sin(angle) * dist;

    const distKm = haversineDistance(userLat, userLng, lat, lng);
    const capacities: string[] = ["Kapasitas Tersedia", "Kapasitas Tersedia", "Kapasitas Terbatas", "Kapasitas Tersedia", "Hampir Penuh"];
    const capacity = capacities[(seed + i * 17) % capacities.length];

    shelters.push({
      id: `shelter-${i}`,
      name: template.name,
      type: template.type,
      lat,
      lng,
      distance: distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`,
      distanceKm: distKm,
      capacity,
      facilities: template.facilities,
    });
  });

  shelters.sort((a, b) => a.distanceKm - b.distanceKm);
  return shelters;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/bmkg/gempa-terbaru", async (_req: Request, res: Response) => {
    try {
      const data = await fetchJson(`${BMKG_BASE}/autogempa.json`);
      res.json({ success: true, data: data.Infogempa.gempa });
    } catch {
      res.status(500).json({ success: false, error: "Gagal mengambil data gempa" });
    }
  });

  app.get("/api/bmkg/gempa-terkini", async (_req: Request, res: Response) => {
    try {
      const data = await fetchJson(`${BMKG_BASE}/gempaterkini.json`);
      res.json({ success: true, data: data.Infogempa.gempa });
    } catch {
      res.status(500).json({ success: false, error: "Gagal mengambil data gempa terkini" });
    }
  });

  app.get("/api/bmkg/gempa-dirasakan", async (_req: Request, res: Response) => {
    try {
      const data = await fetchJson(`${BMKG_BASE}/gempadirasakan.json`);
      res.json({ success: true, data: data.Infogempa.gempa });
    } catch {
      res.status(500).json({ success: false, error: "Gagal mengambil data gempa dirasakan" });
    }
  });

  app.get("/api/bmkg/peringatan-cuaca", async (_req: Request, res: Response) => {
    try {
      const xml = await fetchXml(BMKG_NOWCAST);
      const items = parseNowcastRss(xml);
      res.json({ success: true, data: items });
    } catch {
      res.status(500).json({ success: false, error: "Gagal mengambil data peringatan cuaca" });
    }
  });

  app.get("/api/disasters/reports", async (req: Request, res: Response) => {
    try {
      const disaster = req.query.disaster as string || "";
      const admin = req.query.admin as string || "";
      const timeperiod = req.query.timeperiod as string || "604800";

      let url = `${PETABENCANA_API}/reports?geoformat=geojson&timeperiod=${timeperiod}`;
      if (disaster) url += `&disaster=${disaster}`;
      if (admin) url += `&admin=${admin}`;

      const apiRes = await fetch(url, {
        headers: { "User-Agent": "GardaBencana/1.0" },
      });
      if (!apiRes.ok) throw new Error(`PetaBencana API error: ${apiRes.status}`);
      const data = await apiRes.json();

      const features = data.result?.features || [];
      const reports = features.map((f: any) => {
        const p = f.properties;
        const coords = f.geometry?.coordinates || [0, 0];
        const disasterLabels: Record<string, string> = {
          flood: "Banjir",
          earthquake: "Gempabumi",
          fire: "Kebakaran Hutan",
          haze: "Kabut Asap",
          wind: "Angin Kencang",
          volcano: "Gunung Api",
        };
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
  });

  app.get("/api/shelters/nearby", (req: Request, res: Response) => {
    const lat = parseFloat(req.query.lat as string) || -6.2;
    const lng = parseFloat(req.query.lng as string) || 106.8;
    const shelters = generateShelters(lat, lng);
    res.json({ success: true, data: shelters });
  });

  app.get("/shelter-map", (_req: Request, res: Response) => {
    res.sendFile(path.join(process.cwd(), "server/templates/shelter-map.html"));
  });

  app.get("/disaster-map", (_req: Request, res: Response) => {
    res.sendFile(path.join(process.cwd(), "server/templates/disaster-map.html"));
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

  app.post("/api/voice/transcribe", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Tidak ada file audio" });
      }

      const text = await transcribeAudio(req.file.path);
      if (!text) {
        return res.status(500).json({ success: false, error: "Gagal mentranskripsi audio" });
      }

      res.json({ success: true, text });
    } catch (e) {
      console.error("Transcribe API error:", e);
      res.status(500).json({ success: false, error: "Terjadi kesalahan sistem" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
