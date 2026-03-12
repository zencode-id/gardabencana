// Database Pengetahuan Offline (Offline Knowledge Base)
// Khusus difokuskan untuk area Pasuruan dan potensi bencana utamanya: Banjir & Puting Beliung

export interface OfflineResponse {
  keywords: string[];
  title: string;
  response: string;
}

export const OFFLINE_KB: OfflineResponse[] = [
  // 1. BANJIR PASURUAN
  {
    keywords: ["banjir", "pasuruan", "kraton", "rejoso", "air naik", "tenggelam"],
    title: "🚨 PANDUAN BANJIR PASURUAN",
    response: `PERINGATAN BANJIR AREA PASURUAN:
Saat ini Anda dalam Mode Darurat Offline. Ikuti panduan berikut:

1. RUTE EVAKUASI:
• Warga Kraton/Rejoso: Segera mengevakuasi diri ke wilayah dataran tinggi (arah Purwosari/Prigen) atau titik kumpul shelter terdekat seperti Balai Desa/Kecamatan.
• Hindari jalur pantura Kraton jika air sudah setinggi paha orang dewasa karena rawan terseret arus.

2. TINDAKAN PENTING:
• Matikan seluruh meteran listrik dari tuas MCB (Meteran PLN).
• Pindahkan dokumen penting (Kartu Keluarga, KTP, Ijazah) ke dalam plastik kedap air (ziplock/kresek).
• Siapkan Tas Siaga Bencana (Pakaian ganti, senter, makanan instan, air minum 3 hari).

3. P3K LUKA TERENDAM AIR:
• Bersihkan luka segera dengan air bersih (bukan air genangan/banjir).
• Tutup dengan kain bersih agar terhindar dari penyakit Leptospirosis.
`
  },
  
  // 2. ANGIN PUTING BELIUNG PASURUAN
  {
    keywords: ["angin", "puting", "beliung", "badai", "pohon tumbang", "atap terbang"],
    title: "🌪️ PANDUAN PUTING BELIUNG PASURUAN",
    response: `PERINGATAN ANGIN PUTING BELIUNG:
Saat ini Anda dalam Mode Darurat Offline. Ikuti panduan berikut:

1. JIKA BERADA DI DALAM RUMAH:
• Segera menjauh dari jendela, kaca, atau pintu luar.
• Berlindunglah di tengah rumah kosong/lorong kokoh, atau di bawah meja kayu yang sangat kuat.
• Lindungi kepala dan leher Anda dengan lengan, bantal, atau selimut tebal.

2. JIKA BERADA DI JALAN/KENDARAAN:
• JANGAN berlindung di bawah pohon besar, papan reklame, atau jembatan penyeberangan (rawan roboh).
• Hentikan kendaraan. Menunduklah serendah mungkin menjauhi kaca jendela.
• Jika memungkinkan, masuklah ke gedung permanen terdekat yang memiliki konstruksi beton padat.
`
  },

  // 3. P3K UMUM (PERTOLONGAN PERTAMA)
  {
    keywords: ["luka", "berdarah", "darah", "p3k", "patah tulang", "kesehatan"],
    title: "🏥 PANDUAN PERTOLONGAN PERTAMA DARURAT",
    response: `PERTOLONGAN PERTAMA DARURAT (P3K):
Saat ini Anda dalam Mode Darurat Offline.

• LUKA BERDARAH: Tekan kuat di area yang berdarah dengan kain bersih selama 10-15 menit untuk menghentikan pendarahan. Jangan angkat kain meski basah, tambahkan kain lain di atasnya.
• PATAH TULANG: Jangan pindahkan korban kecuali area tersebut sangat berbahaya. Jangan mencoba meluruskan tulang bengkok. Gunakan papan/kayu kaku untuk membidai/menyangga sebelum medis tiba.
• TERSEDAK: Lakukan tepukan kuat di area antara tulang belikat punggung, atau pelukan perut (Heimlich Maneuver).
`
  },

  // 4. KONDISI UMUM
  {
    keywords: ["halo", "tolong", "bantuan", "info", "darurat"],
    title: "🔍 MODE DARURAT",
    response: `Garda Bencana saat ini dalam Mode Offline (Tidak Ada Sinyal).
    
Ketik langsung jenis bencana atau lokasi Anda untuk panduan keselamatan.
Contoh ketik: "banjir pasuruan", "puting beliung", "luka berdarah".`
  }
];

// Fungsi pintar pencocokan kata secara Offline
export function getOfflineResponse(userInput: string): string {
  if (!userInput || userInput.trim() === "") return "";
  
  const text = userInput.toLowerCase();
  
  // Cari di database lokal
  for (const item of OFFLINE_KB) {
    // Jika ada satu saja keyword yang cocok dalam input user
    const isMatch = item.keywords.some(kw => text.includes(kw));
    if (isMatch) {
      return `**${item.title}**\n\n${item.response}`;
    }
  }

  // Fallback jika tidak dikenali
  return `Mohon maaf, Anda sedang offline dan pertanyaan Anda ("${userInput}") tidak ditemukan di panduan darurat lokal.\n\nKetik kata kunci seperti: "banjir pasuruan", "angin", atau "p3k".`;
}
