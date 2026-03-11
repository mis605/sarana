# Panduan Migrasi ke GitHub Pages

## Masalah Kamera di HP (OOM Crash)
Penyebab utama aplikasi sering reload/crash saat membidik foto di HP modern adalah karena **batasan memori (Out Of Memory / OOM) pada browser mobile**. Kamera HP (seperti 48MP/108MP) memakan memori puluhan Megabyte hanya untuk 1 foto. Ketika web-app mencoba mengolahnya (untuk kompresi), RAM HP penuh dan memaksa browser menutup tab.

**Solusinya:** Mengganti upload foto dari "Aplikasi Kamera Pihak Ketiga" dengan **WebRTC Video Canvas langsung di web-app (tanpa aplikasi kamera luar)**. Resolusi dikunci di (1280x960), yang hanya memakan memori <2MB per foto, secara dramatis menghilangkan efek crash dan prosesnya pun akan instan.

---

## 🚀 Langkah 1: Setup Backend Google Apps Script (GAS) Baru

1. Buka project Google Apps Script (GAS) laporan Anda.
2. Buat file script baru (misal: `api.gs`) lalu **salin seluruh isi dari file `code_github.gs`** ke file tersebut.
   *(Perbedaan utama: Code lama merender file .html dengan `google.script.run`, Code baru (`code_github.gs`) mengubah GAS murni menjadi API Rest JSON untuk di-fetch dari Github).*
3. Tekan klik **Deploy > New Deployment**.
4. Pilih **Web App**.
   * Execute as: **Me**.
   * Who has access: **Anyone**.
5. Klik **Deploy**.
6. **⚠️ PENTING:** Salin url web app yang ter-generate (akhiran `.../exec`). Kita akan memasukkan URL itu ke Frontend.

## 🚀 Langkah 2: Setup Frontend GitHub Pages

1. Buat **Repository Baru** di GitHub Anda, contonya: `ceklist-fasilitas`.
2. Upload file `index_github.html` yang telah saya buatkan, dan ubah namanya menjadi **`index.html`** di repositori GitHub Anda.
3. Edit baris 214 pada file `index.html` GitHub tersebut, ubah tulisan `'MASUKKAN_URL_WEB_APP_GAS_ANDA_DI_SINI'` menjadi **URL Web App (exec) dari tahap ke-1 di atas**.
4. Simpan perubahan kode (Commit changes).
5. Pada GitHub, Masuk ke menu **Settings** repositori Anda, pilih **Pages** (di bagian kiri bawah).
6. Di bagian *Build and deployment* (Source), pastikan branch yang dipilih adalah **main** (lalu root `/`). Klik **Save**.
7. Tunggu ± 1 menit, GitHub Pages akan memberikan Anda URL halaman publik gratis yang sangat cepat. App Anda telah online!

## ✨ Fitur Kamera Baru (Lancar di Mobile)
Pada HTML versi Web App / GitHub ini, saya membuang metode `<input type="file" capture>` sama sekali. Sekarang ketika Anda menekan klik tombol **Ambil Foto**, Anda tidak akan diarahkan ke aplikasi kamera bawaan yang berat, namun preview kamera akan muncul di **Modal layaknya Pop-up Transparan langsung di Website**! Ini anti-crash dan super cepat.
