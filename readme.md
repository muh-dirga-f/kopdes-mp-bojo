# 📦 Koperasi App

Aplikasi manajemen simpanan **wajib** dan **pokok** untuk koperasi desa.  
Dibangun dengan **Node.js**, **Express**, **Prisma ORM**, **EJS**, dan **SQLite**.

---

## 🚀 Fitur Utama
- **Login & Logout** dengan session
- **Dashboard** ringkasan anggota & simpanan
- **Manajemen User** (Admin)
- **Manajemen Anggota** (Tambah, Edit, Nonaktifkan/Aktifkan)
- **Manajemen Transaksi** (Simpanan Wajib & Pokok, Void, Refresh Saldo)
- **Laporan Simpanan Wajib & Pokok** per anggota

---

## 📂 Struktur Direktori
(Lihat `Project Snapshot` untuk detail lengkap)

```

.
├── src/              # Kode aplikasi utama
├── prisma/           # Schema & migrasi database
└── .env              # Konfigurasi environment

````

---

## 🛠️ Persiapan & Instalasi

### 1️⃣ Clone repository
```bash
git clone https://github.com/muh-dirga-f/kopdes-mp-bojo
cd kopdes-mp-bojo
````

### 2️⃣ Install dependencies

```bash
npm install
```

### 3️⃣ Konfigurasi `.env`

Buat file `.env` di root folder, contoh:

```env
DATABASE_URL="file:./database.db"
SESSION_SECRET="rahasia-anda"

# Opsional untuk seed admin
SEED_ADMIN_EMAIL="admin@koperasi.local"
SEED_ADMIN_PASSWORD="admin123"
```

### 4️⃣ Inisialisasi Database

```bash
npx prisma migrate dev --name init
npm run prisma:seed   # Membuat role dan admin default (opsional)
```

---

## ▶️ Menjalankan Aplikasi

### Mode Production

```bash
npm run start
```

### Mode Development

```bash
npm run dev
```

Aplikasi akan berjalan di:
[http://localhost:3000](http://localhost:3000)

---

## 🔑 Akun Admin Default

Jika menggunakan `prisma/seed.js`:

* **Email**: `admin@koperasi.local`
* **Password**: `admin123`

---

## 📌 Hak Akses

| Role  | Akses                                                                 |
| ----- | --------------------------------------------------------------------- |
| ADMIN | Semua fitur (User, Anggota, Transaksi, Void, Refresh Saldo, dll.)     |
| STAFF | Anggota, Transaksi (tanpa akses manajemen user & void simpanan pokok) |

---

## 📜 Script NPM

| Perintah                  | Deskripsi                             |
| ------------------------- | ------------------------------------- |
| `npm run start`           | Menjalankan server                    |
| `npm run dev`             | Menjalankan server dengan **nodemon** |
| `npm run prisma:generate` | Generate Prisma Client                |
| `npm run prisma:migrate`  | Membuat migrasi baru                  |
| `npm run prisma:deploy`   | Deploy migrasi ke database            |
| `npm run prisma:seed`     | Seed data awal (role, admin)          |
| `npm run prisma:reset`    | Reset database (hapus semua data)     |

---

## 🖼️ Tampilan

* Dashboard: Ringkasan simpanan & transaksi terbaru
* DataTables untuk daftar anggota, transaksi, dan user
* Modal form untuk tambah/edit data
* Alert sukses/gagal otomatis hilang

---

## 📌 Catatan

* Database default: **SQLite** (`prisma/database.db`)
* Bisa diganti ke **PostgreSQL/MySQL** dengan ubah `DATABASE_URL` di `.env`
* Pastikan `SESSION_SECRET` di `.env` diganti untuk keamanan

---