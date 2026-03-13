// ─── Shared helpers for all Vercel API functions ────────────────────────────
import { DATA_PASURUAN } from "./data-pasuruan";

export const BMKG_BASE = "https://data.bmkg.go.id/DataMKG/TEWS";
export const BMKG_NOWCAST = "https://www.bmkg.go.id/alerts/nowcast/id";
export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_AUDIO_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
export const PETABENCANA_API = "https://data.petabencana.id";

export interface NowcastItem {
  title: string;
  description: string;
  pubDate: string;
}

export interface ShelterData {
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

// ─── Fetch helpers ───────────────────────────────────────────────────────────

export async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Garda Bencana/1.0" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Garda Bencana/1.0" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.text();
}

export function parseNowcastRss(xml: string): NowcastItem[] {
  const items: NowcastItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
    const description = itemXml.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "";
    const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
    items.push({
      title: title.trim(),
      description: description.trim(),
      pubDate: pubDate.trim(),
    });
  }
  return items;
}

// ─── BMKG data fetchers (for Groq context) ──────────────────────────────────

export async function getLatestEarthquake(): Promise<string> {
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

export async function getRecentEarthquakes(): Promise<string> {
  const data = await fetchJson(`${BMKG_BASE}/gempaterkini.json`);
  const list = data.Infogempa.gempa;
  let result = "Daftar Gempa M 5.0+ Terkini (BMKG):\n\n";
  list.slice(0, 5).forEach((g: any, i: number) => {
    result += `${i + 1}. M${g.Magnitude} - ${g.Wilayah}\n`;
    result += `   ${g.Tanggal}, ${g.Jam}\n`;
    result += `   Kedalaman: ${g.Kedalaman}\n`;
    if (g.Potensi) result += `   ${g.Potensi}\n`;
    result += "\n";
  });
  return result;
}

export async function getFeltEarthquakes(): Promise<string> {
  const data = await fetchJson(`${BMKG_BASE}/gempadirasakan.json`);
  const list = data.Infogempa.gempa;
  let result = "Daftar Gempa Dirasakan Terkini (BMKG):\n\n";
  list.slice(0, 5).forEach((g: any, i: number) => {
    result += `${i + 1}. M${g.Magnitude} - ${g.Wilayah}\n`;
    result += `   ${g.Tanggal}, ${g.Jam}\n`;
    result += `   Kedalaman: ${g.Kedalaman}\n`;
    if (g.Dirasakan) result += `   Dirasakan: ${g.Dirasakan}\n`;
    result += "\n";
  });
  return result;
}

export async function getWeatherWarnings(): Promise<string> {
  const xml = await fetchXml(BMKG_NOWCAST);
  const items = parseNowcastRss(xml);
  if (items.length === 0) {
    return "Saat ini tidak ada peringatan dini cuaca aktif dari BMKG.\n\nKondisi cuaca relatif aman di seluruh wilayah Indonesia.";
  }
  let result = "Peringatan Dini Cuaca Aktif (BMKG):\n\n";
  items.slice(0, 5).forEach((item, i) => {
    result += `${i + 1}. ${item.title}\n`;
    const shortDesc =
      item.description.length > 250
        ? item.description.slice(0, 250) + "..."
        : item.description;
    result += `   ${shortDesc}\n\n`;
  });
  result += "Sumber: BMKG - Badan Meteorologi, Klimatologi, dan Geofisika";
  return result;
}

export async function getAllBmkgContext(): Promise<string> {
  const [latest, recent, felt, warnings] = await Promise.all([
    getLatestEarthquake().catch(() => "Data gempa terbaru tidak tersedia."),
    getRecentEarthquakes().catch(() => "Data gempa terkini tidak tersedia."),
    getFeltEarthquakes().catch(() => "Data gempa dirasakan tidak tersedia."),
    getWeatherWarnings().catch(() => "Data peringatan cuaca tidak tersedia."),
  ]);
  return `${latest}\n---\n${recent}\n---\n${felt}\n---\n${warnings}`;
}

// ─── Groq AI Chat ────────────────────────────────────────────────────────────

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

Berikut adalah Basis Pengetahuan khusus untuk wilayah Pasuruan:
${DATA_PASURUAN}

Berikut adalah data real-time dari BMKG yang bisa kamu gunakan untuk menjawab pertanyaan:
`;

export async function chatWithGroq(
  userMessage: string,
  conversationHistory: { role: string; content: string }[]
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

export async function transcribeAudio(fileBuffer: Uint8Array | Buffer): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: "audio/m4a" });
    
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
  }
}

export async function generateFallbackReply(message: string): Promise<string> {
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
      if (
        lower.includes("terkini") ||
        lower.includes("daftar") ||
        lower.includes("list")
      ) {
        return recent + "\nSumber: BMKG (data real-time)";
      }
      return latest + "\n---\n\n" + recent + "\nSumber: BMKG (data real-time)";
    } catch {
      return "Maaf, tidak dapat mengambil data gempa dari BMKG saat ini. Silakan coba lagi nanti.\n\nUntuk info gempa terkini, kunjungi: https://www.bmkg.go.id/";
    }
  }

  if (
    lower.includes("cuaca") ||
    lower.includes("weather") ||
    lower.includes("hujan") ||
    lower.includes("peringatan")
  ) {
    try {
      return await getWeatherWarnings();
    } catch {
      return "Maaf, tidak dapat mengambil data peringatan cuaca dari BMKG saat ini.";
    }
  }

  if (
    lower.includes("p3k") ||
    lower.includes("luka") ||
    lower.includes("pertolongan") ||
    lower.includes("first aid") ||
    lower.includes("medis")
  ) {
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

  if (
    lower.includes("shelter") ||
    lower.includes("posko") ||
    lower.includes("evakuasi") ||
    lower.includes("pengungsian") ||
    lower.includes("mengungsi")
  ) {
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

  if (
    lower.includes("nomor") ||
    lower.includes("darurat") ||
    lower.includes("emergency") ||
    lower.includes("telepon") ||
    lower.includes("hubungi")
  ) {
    return `Nomor Darurat Penting Indonesia:

- 112 : Darurat Umum
- 119 : Ambulans
- 113 : Pemadam Kebakaran
- 115 : SAR / Basarnas
- 177 : BPBD
- 110 : Polisi
- 021-6546315 : BMKG`;
  }

  if (
    lower.includes("pasuruan") ||
    lower.includes("kraton") ||
    lower.includes("rejoso") ||
    lower.includes("winongan") ||
    lower.includes("bangil") ||
    lower.includes("purwodadi") ||
    lower.includes("tambakrejo") ||
    lower.includes("kedunglarangan") ||
    lower.includes("welang") ||
    lower.includes("pantura")
  ) {
    return DATA_PASURUAN;
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

// ─── Shelter helpers ─────────────────────────────────────────────────────────

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

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function generateShelters(userLat: number, userLng: number): ShelterData[] {
  const seed = Math.floor(userLat * 100) + Math.floor(userLng * 100);
  const shelters: ShelterData[] = [];

  SHELTER_TEMPLATES.forEach((template, i) => {
    const angle = ((seed + i * 37) % 360) * (Math.PI / 180);
    const dist = 0.005 + ((seed + i * 53) % 100) / 2500;
    const lat = userLat + Math.cos(angle) * dist;
    const lng = userLng + Math.sin(angle) * dist;

    const distKm = haversineDistance(userLat, userLng, lat, lng);
    const capacities = ["Kapasitas Tersedia", "Kapasitas Tersedia", "Kapasitas Terbatas", "Kapasitas Tersedia", "Hampir Penuh"];
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
