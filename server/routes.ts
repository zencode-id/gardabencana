import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const BMKG_BASE = "https://data.bmkg.go.id/DataMKG/TEWS";
const BMKG_NOWCAST = "https://www.bmkg.go.id/alerts/nowcast/id";

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

function getP3kGuide(): string {
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

Nomor Darurat:
- Ambulans: 119
- Darurat Umum: 112
- PMI: 021-7992325`;
}

function getShelterGuide(): string {
  return `Panduan Mencari Shelter/Posko Pengungsian:

Langkah-langkah:
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

Barang yang harus dibawa:
- Dokumen penting (KTP, KK, ijazah)
- Obat-obatan pribadi
- Makanan & air minum
- Pakaian ganti
- Senter & baterai cadangan
- Charger HP

Kontak Penting:
- BPBD: 177
- Basarnas/SAR: 115
- Darurat: 112
- Ambulans: 119`;
}

function getBanjirGuide(): string {
  return `Panduan Menghadapi Banjir:

Sebelum Banjir:
1. Pantau peringatan cuaca BMKG
2. Siapkan tas darurat
3. Pindahkan barang berharga ke tempat tinggi
4. Catat nomor darurat penting

Saat Banjir:
1. Matikan listrik jika air mulai naik
2. Evakuasi ke tempat yang lebih tinggi
3. Jangan berjalan di arus air yang deras
4. Jauhi tiang listrik dan kabel
5. Hubungi BPBD: 177 atau 112

Setelah Banjir:
- Bersihkan rumah dari lumpur
- Periksa instalasi listrik sebelum menyalakan
- Buang makanan yang terendam
- Waspada penyakit pasca banjir

Nomor Darurat: 112 | BPBD: 177`;
}

function getKebakaranGuide(): string {
  return `Panduan Saat Kebakaran:

Tindakan Segera:
1. Segera keluar dari bangunan
2. Merunduk jika ada asap tebal
3. Jangan gunakan lift
4. Tutup hidung dengan kain basah
5. Jangan membuka pintu yang terasa panas
6. Hubungi 113 (Pemadam Kebakaran)

Jika Terjebak:
- Tutup celah pintu dengan kain basah
- Beri sinyal dari jendela
- Tunggu bantuan pemadam
- Jangan panik

Pencegahan:
- Periksa instalasi listrik secara berkala
- Sediakan APAR (alat pemadam)
- Jangan tinggalkan kompor menyala

Nomor Darurat:
- Pemadam: 113
- Darurat: 112
- Ambulans: 119`;
}

function getTsunamiGuide(): string {
  return `Panduan Evakuasi Tsunami:

Tanda-tanda Tsunami:
- Gempa kuat di pesisir
- Air laut surut drastis
- Suara gemuruh dari laut

Tindakan:
1. Segera evakuasi ke dataran tinggi (>30 meter)
2. Jauhi pantai dan sungai
3. Jangan menunggu peringatan resmi jika merasakan gempa kuat
4. Ikuti rambu evakuasi tsunami
5. Jangan kembali sampai ada pemberitahuan aman

Setelah Tsunami:
- Tunggu pengumuman resmi BMKG
- Waspadai gelombang susulan
- Hindari bangunan yang rusak

Kontak Penting:
- BMKG: 021-6546315
- Darurat: 112
- SAR/Basarnas: 115`;
}

function getLongsorGuide(): string {
  return `Panduan Menghadapi Tanah Longsor:

Tanda-tanda Longsor:
- Hujan deras berkepanjangan
- Retakan di tanah/dinding
- Air tanah keruh mendadak
- Suara gemuruh dari lereng

Tindakan:
1. Segera evakuasi dari lereng
2. Jauhi tebing dan jurang
3. Hindari aliran sungai dekat lereng
4. Hubungi BPBD: 177

Pencegahan:
- Jangan bangun rumah di lereng curam
- Buat drainase yang baik
- Tanam pohon di lereng
- Pantau kondisi cuaca

Nomor Darurat: 112 | BPBD: 177 | SAR: 115`;
}

async function generateSmartReply(message: string): Promise<string> {
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
    } catch (e) {
      return "Maaf, tidak dapat mengambil data gempa dari BMKG saat ini. Silakan coba lagi nanti.\n\nUntuk info gempa terkini, kunjungi: https://www.bmkg.go.id/";
    }
  }

  if (lower.includes("cuaca") || lower.includes("weather") || lower.includes("hujan") || lower.includes("peringatan")) {
    try {
      return await getWeatherWarnings();
    } catch (e) {
      return "Maaf, tidak dapat mengambil data peringatan cuaca dari BMKG saat ini. Silakan coba lagi nanti.";
    }
  }

  if (lower.includes("p3k") || lower.includes("luka") || lower.includes("pertolongan") || lower.includes("first aid") || lower.includes("medis")) {
    return getP3kGuide();
  }

  if (lower.includes("shelter") || lower.includes("posko") || lower.includes("evakuasi") || lower.includes("pengungsian") || lower.includes("mengungsi")) {
    return getShelterGuide();
  }

  if (lower.includes("banjir") || lower.includes("flood")) {
    return getBanjirGuide();
  }

  if (lower.includes("kebakaran") || lower.includes("fire")) {
    return getKebakaranGuide();
  }

  if (lower.includes("tsunami")) {
    return getTsunamiGuide();
  }

  if (lower.includes("longsor") || lower.includes("landslide")) {
    return getLongsorGuide();
  }

  if (lower.includes("halo") || lower.includes("hai") || lower.includes("hi") || lower.includes("hello") || lower.includes("selamat")) {
    return `Halo! Saya Garda Bencana, siap membantu Anda dengan informasi kebencanaan.

Saya bisa membantu dengan:
- Info gempa terkini (data real-time BMKG)
- Peringatan dini cuaca (BMKG)
- Panduan P3K / pertolongan pertama
- Lokasi shelter / posko pengungsian
- Panduan banjir, kebakaran, tsunami, longsor

Silakan ketik pertanyaan atau gunakan tombol aksi cepat di bawah.`;
  }

  if (lower.includes("nomor") || lower.includes("darurat") || lower.includes("emergency") || lower.includes("telepon") || lower.includes("hubungi")) {
    return `Nomor Darurat Penting Indonesia:

- 112 : Darurat Umum (Polisi, Ambulans, Pemadam)
- 119 : Ambulans / Gawat Darurat Medis
- 113 : Pemadam Kebakaran
- 115 : SAR / Basarnas
- 177 : BPBD (Badan Penanggulangan Bencana)
- 110 : Polisi
- 021-6546315 : BMKG

Hotline Khusus:
- PMI: 021-7992325
- PLN: 123
- Pertamina: 135

Simpan nomor-nomor ini di kontak HP Anda untuk keadaan darurat.`;
  }

  try {
    const [latest, warnings] = await Promise.all([
      getLatestEarthquake().catch(() => ""),
      getWeatherWarnings().catch(() => ""),
    ]);

    let reply = `Terima kasih atas pertanyaan Anda. Berikut informasi terkini:\n\n`;
    if (latest) reply += latest + "\n";
    if (warnings) reply += "---\n\n" + warnings + "\n";
    reply += `\nAnda juga bisa bertanya tentang:
- Info gempa (data real-time BMKG)
- Peringatan cuaca
- Panduan P3K
- Shelter/posko pengungsian
- Panduan banjir, kebakaran, tsunami, longsor
- Nomor darurat

Sumber data: BMKG`;
    return reply;
  } catch {
    return `Saya Garda Bencana, siap membantu Anda.

Silakan tanyakan tentang:
- Info gempa terkini
- Peringatan cuaca
- Panduan P3K
- Cari shelter/posko
- Panduan bencana (banjir, kebakaran, tsunami, longsor)
- Nomor darurat

Nomor Darurat: 112 (Umum) | 119 (Ambulans) | 113 (Pemadam) | 177 (BPBD)`;
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
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Pesan tidak boleh kosong" });
    }

    const reply = await generateSmartReply(message);
    res.json({ reply });
  });

  const httpServer = createServer(app);
  return httpServer;
}
