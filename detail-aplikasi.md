# Koperasi App — Struktur Database & Tahapan Implementasi

## 1. ERD Singkat

**Relasi:**
- **User** (1) — (N) **Session**
- **Role** (1) — (N) **User**
- **Member** (1) — (N) **Transaction**
- **User** (1) — (N) **Transaction** (createdBy)
- **User** (0..1) — (N) **Transaction** (voidedBy)
- **MemberBalance** (1:1) dengan **Member** (cache total wajib & pokok)

---

## 2. `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = env("DATABASE_PROVIDER") // "sqlite" | "mysql" | "postgresql"
  url      = env("DATABASE_URL")
}

enum RoleName {
  ADMIN
  STAFF
}

enum TxCategory {
  WAJIB
  POKOK
}

enum TxStatus {
  POSTED
  VOIDED
}

enum PaymentMethod {
  CASH
  TRANSFER
  OTHER
}

model Role {
  id        Int       @id @default(autoincrement())
  name      RoleName  @unique
  users     User[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model User {
  id            Int       @id @default(autoincrement())
  email         String    @unique
  passwordHash  String
  fullName      String
  roleId        Int
  role          Role      @relation(fields: [roleId], references: [id], onUpdate: Cascade, onDelete: Restrict)
  isActive      Boolean   @default(true)
  sessions      Session[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  createdTransactions Transaction[] @relation("TxCreatedBy")
  voidedTransactions  Transaction[] @relation("TxVoidedBy")
}

model Session {
  id        String   @id
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  data      Bytes
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

model Member {
  id            Int       @id @default(autoincrement())
  memberNumber  String    @unique
  fullName      String
  phone         String?   @db.VarChar(30)
  email         String?   @unique
  address       String?
  joinDate      DateTime  @default(now())
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  transactions  Transaction[]
  balance       MemberBalance?

  @@index([fullName])
  @@index([isActive])
}

model Transaction {
  id            Int          @id @default(autoincrement())
  code          String       @unique
  memberId      Int
  member        Member       @relation(fields: [memberId], references: [id], onDelete: Restrict)
  category      TxCategory
  amount        Decimal      @db.Decimal(18,2)
  paidAt        DateTime
  paymentMethod PaymentMethod @default(CASH)
  note          String?

  status        TxStatus     @default(POSTED)
  voidReason    String?
  voidedAt      DateTime?
  voidedById    Int?
  voidedBy      User?        @relation("TxVoidedBy", fields: [voidedById], references: [id])

  createdById   Int
  createdBy     User         @relation("TxCreatedBy", fields: [createdById], references: [id])

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([memberId, category, status])
  @@index([paidAt])
  @@index([createdById])
  @@index([voidedById])
}

model MemberBalance {
  memberId     Int     @id
  wajibTotal   Decimal @db.Decimal(18,2) @default(0)
  pokokTotal   Decimal @db.Decimal(18,2) @default(0)
  updatedAt    DateTime @updatedAt

  member       Member  @relation(fields: [memberId], references: [id], onDelete: Cascade)
}
```

---

## 3. Seed Data Awal

**File:** `prisma/seed.js`

```js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const [adminRole, staffRole] = await Promise.all([
    prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } }),
    prisma.role.upsert({ where: { name: 'STAFF' }, update: {}, create: { name: 'STAFF' } }),
  ]);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@koperasi.local';
  const adminPass  = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(adminPass, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, fullName: 'Administrator', passwordHash, roleId: adminRole.id }
  });

  const m1 = await prisma.member.upsert({
    where: { memberNumber: 'AGT-0001' },
    update: {},
    create: { memberNumber: 'AGT-0001', fullName: 'Siti Rahma', phone: '0812-1111-2222', address: 'Makassar' }
  });

  const m2 = await prisma.member.upsert({
    where: { memberNumber: 'AGT-0002' },
    update: {},
    create: { memberNumber: 'AGT-0002', fullName: 'Budi Santoso', phone: '0813-3333-4444', address: 'Gowa' }
  });

  async function bumpBalance(memberId, category, delta) {
    const field = category === 'WAJIB' ? 'wajibTotal' : 'pokokTotal';
    await prisma.memberBalance.upsert({
      where: { memberId },
      update: { [field]: { increment: delta } },
      create: {
        memberId,
        wajibTotal: category === 'WAJIB' ? delta : 0,
        pokokTotal: category === 'POKOK' ? delta : 0,
      }
    });
  }

  const admin = await prisma.user.findFirst({ where: { email: adminEmail }});

  const txs = [
    { code: 'KTRX-202501-0001', memberId: m1.id, category: 'WAJIB', amount: 50000, paidAt: new Date('2025-01-05'), note: 'Januari 2025', createdById: admin.id },
    { code: 'KTRX-202501-0002', memberId: m1.id, category: 'POKOK', amount: 200000, paidAt: new Date('2025-01-05'), note: 'Setoran awal', createdById: admin.id },
    { code: 'KTRX-202502-0003', memberId: m2.id, category: 'WAJIB', amount: 50000, paidAt: new Date('2025-02-03'), note: 'Februari 2025', createdById: admin.id },
  ];

  for (const t of txs) {
    await prisma.transaction.upsert({
      where: { code: t.code },
      update: {},
      create: { ...t, amount: t.amount, paymentMethod: 'CASH', status: 'POSTED' }
    });
    await bumpBalance(t.memberId, t.category, t.amount);
  }

  console.log('Seeding selesai.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

**Script di `package.json`:**

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev --name init",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:seed": "node prisma/seed.js"
  }
}
```

---

## 4. Query Agregasi Dashboard

```js
const totalAnggota = await prisma.member.count({ where: { isActive: true }});
const totalWajib = await prisma.transaction.aggregate({
  _sum: { amount: true },
  where: { status: 'POSTED', category: 'WAJIB' }
});
const totalPokok = await prisma.transaction.aggregate({
  _sum: { amount: true },
  where: { status: 'POSTED', category: 'POKOK' }
});

const recentTx = await prisma.transaction.findMany({
  where: { status: 'POSTED' },
  orderBy: { paidAt: 'desc' },
  take: 10,
  include: {
    member: { select: { memberNumber: true, fullName: true }},
    createdBy: { select: { fullName: true }}
  }
});

const topAnggota = await prisma.member.findMany({
  take: 10,
  orderBy: [
    { balance: { wajibTotal: 'desc' }},
    { balance: { pokokTotal: 'desc' }}
  ],
  include: { balance: true }
});
```

---

## 5. Tahapan Pengerjaan

1. **Inisialisasi Project**

   * `npm init -y`
   * Install deps: `express ejs express-session bcrypt dotenv @prisma/client prisma dayjs`
   * `.env`: DB config, `SESSION_SECRET`, admin seed.
   * `schema.prisma` → `npx prisma generate` → `npx prisma migrate dev` → `npm run prisma:seed`.

2. **Middleware & Auth**

   * `authMiddleware.js` cek login.
   * `roleMiddleware.js` cek role.
   * `authController.js`: login, logout, session.

3. **CRUD Anggota**

   * Create, Read, Update, soft-delete (isActive).
   * Validasi unik `memberNumber` & `email`.

4. **Simpanan Wajib & Pokok**

   * Input transaksi, auto-generate code.
   * Update `MemberBalance`.
   * Riwayat + filter + export.

5. **Void Transaksi**

   * Hanya admin.
   * Set status `VOIDED`, rollback saldo.

6. **Dashboard & UI**

   * Tampilkan agregasi, transaksi terbaru, top anggota.

7. **Hardening**

   * Validasi input, role access, index tambahan, logging.

---

## 6. Catatan Penting

* **Indexing**: `Transaction.code`, gabungan `(memberId, category, status)`.
* **Balance Sync**: job rekonsiliasi untuk rebuild saldo.
* **Ekspor**: CSV/XLSX join transaksi dengan anggota & user.
* **Kode Transaksi**: format `KTRX-YYYYMMDD-XXXX`.
* **Session Store**: gunakan Redis atau Prisma Session Store di produksi.
