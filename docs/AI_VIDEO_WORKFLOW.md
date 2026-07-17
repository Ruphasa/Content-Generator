# Konsep Workflow AI Video Generation

Dokumen ini memetakan alur kerja (workflow) untuk fitur **AI Video Generation** secara garis besar. Workflow ini dirancang untuk bekerja secara otonom dari awal hingga akhir, mengubah kumpulan bahan mentah menjadi video final yang menarik dan siap tayang.

---

## 🚀 Alur Kerja Utama

Proses pembuatan video dibagi menjadi 5 tahap utama yang berjalan secara berurutan:

### 1. Tahap Persiapan Bahan (Pre-Processing)
- **Pengumpulan Aset:** Sistem secara otomatis mengunduh bahan baku berupa potongan-potongan video mentah (*raw footages*) dari sumber penyimpanan yang disediakan.
- **Standardisasi:** Agar hasil akhir rapi, semua video mentah tersebut disamakan resolusinya menjadi format video vertikal dan *frame rate* yang standar.
- **Unggah ke AI:** Setelah seragam, setiap klip video diunggah ke sistem otak AI (*Large Multimodal Model*) agar AI bisa "menonton" dan memahami isi masing-masing klip secara utuh.

### 2. Tahap Penyutradaraan (AI Video Editor)
- **Pemberian Konteks:** Sistem memberikan instruksi ke AI berupa profil *brand* dan tujuan/pesan utama (*brief*) dari video yang ingin dibuat.
- **Analisis & Blueprint:** AI bertindak sebagai Sutradara dan Editor. Setelah menganalisis konteks dan menonton semua klip, AI menyusun sebuah **Rencana Dasar (Blueprint)** yang berisi:
  - **Naskah Narasi (*Voice Over Script*):** Teks murni yang akan dibacakan untuk menjadi narasi video.
  - **Karakter Musik (*BGM Prompt*):** Deskripsi jenis musik latar yang paling cocok dengan nuansa video (misalnya: *upbeat, corporate, calm*).
  - **Urutan Klip (*Visual Sequence*):** Pemilihan dan pengurutan adegan-adegan terbaik dari *raw footages* mentah untuk dipadukan. AI akan menyusun klip lebih panjang dari perkiraan, agar tidak kekurangan bahan di tahap akhir.

### 3. Tahap Produksi Audio (AI Voice & Music)
Berdasarkan *Blueprint* yang dihasilkan pada tahap penyutradaraan, sistem mulai memproduksi elemen suara:
- **Narasi Suara (TTS):** Naskah narasi diubah menjadi suara manusia yang natural. Sistem ini meniru karakteristik suara dari rekaman contoh (*voice cloning*) agar selalu sesuai dengan identitas *brand*.
- **Musik Latar (BGM):** Sistem AI lainnya memproduksi musik instrumen yang sepenuhnya baru, bebas hak cipta, sesuai dengan deskripsi nuansa yang diminta oleh Sutradara AI.

### 4. Tahap Pembuatan Subtitle
- Suara narasi yang sudah diproduksi kemudian didengarkan kembali oleh sistem *Speech-to-Text* (ASR).
- Sistem ini secara presisi mencatat teks dan waktu pengucapannya untuk menghasilkan berkas *Subtitle* yang akurat, sehingga penonton tetap bisa menangkap pesan video meskipun tanpa menyalakan suara (*mute*).

### 5. Tahap Perakitan Akhir (Audio-Driven Stitching)
Ini adalah tahap perakitan di mana visual dan audio disinkronkan agar presisi:
- **Pengukuran Durasi:** Sistem mengukur durasi pasti dari suara narasi (VO) yang dihasilkan di Tahap 3.
- **Penyusunan Visual:** Sistem merangkai klip-klip video secara berurutan berdasarkan *Blueprint*.
- **Pemotongan Otomatis (*Truncate*):** Saat total durasi rangkaian klip sudah sama persis dengan durasi narasi, sistem akan **memotong** klip terakhir dan membuang sisa klip lainnya. Ini memastikan video tidak kepanjangan dan berakhir tepat bersamaan dengan selesainya narasi.
- **Mixing & Render:** 
  - Visual video disatukan dengan musik latar (BGM) dan suara narasi (VO). 
  - Volume musik latar diatur secara proporsional agar tidak menutupi suara narator.
  - *Subtitle* dicetak langsung ke dalam video (*hardsub*).
- **Hasil Akhir:** Sebuah file video siap tayang!

---

Dengan *workflow* ini, peran manusia hanya ada pada tahap penentuan *brief* dan penyediaan *footage* mentah. Sisa proses penyutradaraan, pengisian suara, penciptaan musik, dan *editing* semuanya diselesaikan oleh kolaborasi berbagai agen AI.
