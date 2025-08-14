# 🧾 Project Snapshot

> Generated at `2025-08-14T16:19:34.828Z`

## 📁 Directory Structure (excluding node_modules, .git, dist)

```
.
├── .env
├── .gitignore
├── detail-aplikasi.md
├── package-lock.json
├── package.json
├── prisma
│   ├── database.db
│   ├── migrations
│   │   ├── 20250814071427_init
│   │   │   └── migration.sql
│   │   ├── 20250814110145_add_unique_pokok_index
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   ├── schema.prisma
│   └── seed.js
├── snapshot.js
├── snapshot.md
└── src
    ├── controllers
    │   ├── authController.js
    │   ├── dashboardController.js
    │   ├── memberController.js
    │   ├── savingsController.js
    │   ├── transactionController.js
    │   └── userController.js
    ├── middleware
    │   ├── authMiddleware.js
    │   ├── flashMiddleware.js
    │   └── roleMiddleware.js
    ├── routes.js
    ├── server.js
    ├── utils
    │   └── formatRupiah.js
    └── views
        ├── dashboard.ejs
        ├── layouts
        │   └── main.ejs
        ├── login.ejs
        ├── members.ejs
        ├── partials
        │   ├── _alerts.ejs
        │   ├── _footer.ejs
        │   ├── _head.ejs
        │   ├── _scripts.ejs
        │   ├── _sidebar.ejs
        │   └── _topbar.ejs
        ├── savings-pokok.ejs
        ├── savings-wajib
        │   ├── detail.ejs
        │   └── index.ejs
        ├── transactions.ejs
        └── users.ejs
```

## `src/controllers\authController.js`

```js
import bcrypt from 'bcrypt';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

export function showLogin(req, res) {
  if (req.session?.user) return res.redirect('/');
  res.render('login', { layout: false, error: null, email: '' });
}

export async function doLogin(req, res) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (!user || !user.isActive) return res.status(401).render('login', { layout: false, error: 'Email atau password salah', email });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).render('login', { layout: false, error: 'Email atau password salah', email });

  req.session.user = {
    id: user.id, fullName: user.fullName, email: user.email,
    roleId: user.roleId, roleName: user.role.name
  };
  const returnTo = req.session.returnTo || '/';
  delete req.session.returnTo;
  res.redirect(returnTo);
}

export function doLogout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
}
```

## `src/controllers\dashboardController.js`

```js
// src/controllers/dashboardController.js
import pkg from '@prisma/client';
import formatRupiah from '../utils/formatRupiah.js';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

export async function dashboard(req, res) {
  // helper aman untuk ambil total
  const sumAmount = (aggr) => Number(aggr?._sum?.amount ?? 0);

  const [totalAnggota, aggrWajib, aggrPokok, recentTx] = await Promise.all([
    prisma.member.count({ where: { isActive: true } }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { status: 'POSTED', category: 'WAJIB', member: { isActive: true } }
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { status: 'POSTED', category: 'POKOK', member: { isActive: true } }
    }),
    prisma.transaction.findMany({
      where: { status: 'POSTED', member: { isActive: true } },
      orderBy: { paidAt: 'desc' },
      take: 10,
      include: {
        member: { select: { memberNumber: true, fullName: true } },
        createdBy: { select: { fullName: true } }
      }
    })
  ]);

  res.render('dashboard', {
    title: 'Dashboard',
    active: 'dashboard',
    user: req.session.user,
    cards: {
      anggota: totalAnggota,
      wajib: formatRupiah(sumAmount(aggrWajib)),
      pokok: formatRupiah(sumAmount(aggrPokok))
    },
    recentTx,
    // topRows tetap seperti semula, tidak diubah
    topRows: await (async () => {
      const topAnggota = await prisma.member.findMany({
        where: { isActive: true },
        include: { balance: true },
        orderBy: [{ balance: { wajibTotal: 'desc' } }, { balance: { pokokTotal: 'desc' } }],
        take: 10
      });
      return topAnggota.map(m => ({
        memberNumber: m.memberNumber,
        fullName: m.fullName,
        wajib: formatRupiah(m.balance?.wajibTotal ?? 0),
        pokok: formatRupiah(m.balance?.pokokTotal ?? 0)
      }));
    })()
  });
}
```

## `src/controllers\memberController.js`

```js
import pkg from '@prisma/client';
import formatRupiah from '../utils/formatRupiah.js';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Helper function to set flash messages
function flash(req, data){ req.session.flash = data; }

export async function page(req, res) {
    const [membersActive, membersInactive] = await Promise.all([
        prisma.member.findMany({
            where: { isActive: true },
            include: { balance: true },
            orderBy: { fullName: 'asc' }
        }),
        prisma.member.findMany({
            where: { isActive: false },
            include: { balance: true },
            orderBy: { fullName: 'asc' }
        })
    ]);

    membersActive.forEach(m => {
        m.wajibFormatted = formatRupiah(m.balance?.wajibTotal ?? 0);
        m.pokokFormatted = formatRupiah(m.balance?.pokokTotal ?? 0);
    });
    membersInactive.forEach(m => {
        m.wajibFormatted = formatRupiah(m.balance?.wajibTotal ?? 0);
        m.pokokFormatted = formatRupiah(m.balance?.pokokTotal ?? 0);
    });

    res.render('members', {
        title: 'Anggota',
        active: 'members',
        user: req.session.user,
        members: membersActive,
        membersInactive
    });
}

export async function create(req, res) {
  const { fullName, phone, email, address } = req.body;
  try {
    const last = await prisma.member.findFirst({
      where: { memberNumber: { startsWith: 'AGT-' } },
      orderBy: { memberNumber: 'desc' }
    });
    const next = last ? parseInt(last.memberNumber.replace('AGT-', ''), 10) + 1 : 1;
    const memberNumber = `AGT-${String(next).padStart(4, '0')}`;

    await prisma.member.create({ data: { memberNumber, fullName, phone, email: email || null, address } });

    flash(req, { msg: 'Anggota berhasil ditambahkan' });
    res.redirect('/members');
  } catch (e) {
    flash(req, { err: e.message || 'Gagal menambah anggota' });
    res.redirect('/members');
  }
}

export async function update(req, res) {
  if ('memberNumber' in req.body) delete req.body.memberNumber;
  const id = Number(req.params.id);
  const { fullName, phone, email, address } = req.body;
  try {
    await prisma.member.update({ where: { id }, data: { fullName, phone, email: email || null, address } });
    flash(req, { msg: 'Anggota berhasil diupdate' });
    res.redirect('/members');
  } catch (e) {
    flash(req, { err: e.message || 'Gagal update anggota' });
    res.redirect('/members');
  }
}

export async function softDelete(req, res) {
  const id = Number(req.params.id);
  await prisma.member.update({ where: { id }, data: { isActive: false } });
  req.session.flash = { msg: 'Anggota dinonaktifkan' };
  res.redirect('/members');
}

export async function activate(req, res) {
  const id = Number(req.params.id);
  await prisma.member.update({ where: { id }, data: { isActive: true } });
  req.session.flash = { msg: 'Anggota diaktifkan kembali' };
  res.redirect('/members');
}
```

## `src/controllers\savingsController.js`

```js
import pkg from '@prisma/client';
import formatRupiah from '../utils/formatRupiah.js';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// INDEX: daftar anggota untuk Simpanan Wajib
export async function savingsWajibIndex(req, res) {
  const members = await prisma.member.findMany({
    where: { isActive: true },
    include: { balance: true },
    orderBy: { fullName: 'asc' }
  });

  const rows = members.map(m => ({
    id: m.id,
    memberNumber: m.memberNumber,
    fullName: m.fullName,
    phone: m.phone || '-',
    wajib: formatRupiah(m.balance?.wajibTotal ?? 0)
  }));

  res.render('savings-wajib/index', {
    title: 'Simpanan Wajib',
    active: 'savings-wajib',
    user: req.session.user,
    rows
  });
}

// DETAIL: transaksi wajib milik satu anggota
export async function savingsWajibDetail(req, res) {
  const memberId = Number(req.params.memberId);

  const [member, txs, sumWajib] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId } }),
    prisma.transaction.findMany({
      where: { memberId, category: 'WAJIB' },
      orderBy: [{ paidAt: 'desc' }, { code: 'desc' }],
      include: { 
        member: { select: { memberNumber: true, fullName: true } },
        createdBy: { select: { fullName: true } }
      }
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { memberId, status: 'POSTED', category: 'WAJIB' }
    })
  ]);

  if (!member) {
    return res.status(404).send('Anggota tidak ditemukan');
  }

  txs.forEach(t => { t.amountFormatted = formatRupiah(t.amount); });

  res.render('savings-wajib/detail', {
    title: `Simpanan Wajib • ${member.memberNumber} - ${member.fullName}`,
    active: 'savings-wajib',
    user: req.session.user,
    member,
    totalWajib: formatRupiah(sumWajib._sum.amount || 0),
    txs
  });
}

export async function savingsPokokPage(req, res) {
  const members = await prisma.member.findMany({
    where: { isActive: true },
    include: { balance: true },
    orderBy: { fullName: 'asc' }
  });

  const rows = members.map(m => {
    const totalPokok = Number(m.balance?.pokokTotal ?? 0);
    return {
      id: m.id,
      memberNumber: m.memberNumber,
      fullName: m.fullName,
      phone: m.phone || '-',
      pokok: formatRupiah(totalPokok),
      hasPokok: totalPokok > 0
    };
  });

  res.render('savings-pokok', {
    title: 'Simpanan Pokok',
    active: 'savings-pokok',
    user: req.session.user,
    rows
  });
}
```

## `src/controllers\transactionController.js`

```js
import pkg from '@prisma/client';
import formatRupiah from '../utils/formatRupiah.js';

const { PrismaClient, Prisma } = pkg;
const prisma = new PrismaClient();

// Helper function to set flash messages
function flash(req, { err, msg }) { req.session.flash = { err: err || null, msg: msg || null }; }

async function generateTxCode(category, paidAt) {
  const d = new Date(paidAt);
  const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const prefixCode = category === 'POKOK' ? 'TRP' : 'TRW';
  const prefix = `${prefixCode}-${yyyymmdd}-`;

  const last = await prisma.transaction.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' }
  });
  const seq = last ? parseInt(last.code.slice(-4), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export async function page(req, res) {
  const activeTab = (req.query.tab === 'pokok') ? 'pokok' : 'wajib';

  const [txWajib, txPokok, sumWajib, sumPokok, members] = await Promise.all([
    prisma.transaction.findMany({
      where: { category: 'WAJIB' },
      orderBy: [{ paidAt: 'desc' }, { code: 'desc' }],
      include: {
        member: { select: { memberNumber: true, fullName: true } },
        createdBy: { select: { fullName: true } }
      }
    }),
    prisma.transaction.findMany({
      where: { category: 'POKOK' },
      orderBy: [{ paidAt: 'desc' }, { code: 'desc' }],
      include: {
        member: { select: { memberNumber: true, fullName: true } },
        createdBy: { select: { fullName: true } }
      }
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { status: 'POSTED', category: 'WAJIB', member: { isActive: true } }
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { status: 'POSTED', category: 'POKOK', member: { isActive: true } }
    }),
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { fullName: 'asc' },
      select: { id: true, memberNumber: true, fullName: true }
    })
  ]);

  txWajib.forEach(t => { t.amountFormatted = formatRupiah(t.amount); });
  txPokok.forEach(t => { t.amountFormatted = formatRupiah(t.amount); });

  res.render('transactions', {
    title: 'Transaksi',
    active: 'transactions',
    user: req.session.user,
    activeTab,
    cards: {
      wajib: formatRupiah(sumWajib._sum.amount || 0),
      pokok: formatRupiah(sumPokok._sum.amount || 0)
    },
    txWajib, txPokok, members
  });
}

export async function create(req, res) {
  const { returnTo, memberId, category, amount, paidAt, paymentMethod, note } = req.body;

  const target = await prisma.member.findUnique({ where: { id: Number(memberId) }, select: { isActive: true, fullName: true } });
  if (!target || !target.isActive) {
    flash(req, { err: 'Anggota nonaktif — tidak dapat membuat transaksi' });
    return res.redirect('/transactions');
  }

  if (category === 'POKOK') {
    const exist = await prisma.transaction.findFirst({
      where: { memberId: Number(memberId), category: 'POKOK', status: 'POSTED' }
    });
    if (exist) {
      flash(req, { err: 'Simpanan pokok anggota ini sudah pernah diposting' });
      return res.redirect(returnTo || '/transactions');
    }
  }

  const code = await generateTxCode(category, paidAt);

  try {
    await prisma.$transaction(async (tx) => {
      const newTx = await tx.transaction.create({
        data: {
          code,
          memberId: Number(memberId),
          category,
          amount: new Prisma.Decimal(amount),
          paidAt: new Date(paidAt),
          paymentMethod,
          note,
          status: 'POSTED',
          createdById: req.session.user.id
        }
      });

      const field = category === 'WAJIB' ? 'wajibTotal' : 'pokokTotal';
      await tx.memberBalance.upsert({
        where: { memberId: Number(memberId) },
        update: { [field]: { increment: newTx.amount } },
        create: {
          memberId: Number(memberId),
          wajibTotal: category === 'WAJIB' ? newTx.amount : new Prisma.Decimal(0),
          pokokTotal: category === 'POKOK' ? newTx.amount : new Prisma.Decimal(0)
        }
      });
    });

    flash(req, { msg: 'Transaksi berhasil diposting' });
    res.redirect(returnTo || '/transactions');

  } catch (err) {
    console.error(err);
    flash(req, { err: err.message || 'Gagal membuat transaksi' });
    res.redirect('/transactions');
  }
}

export async function voidTx(req, res) {
  const code = req.params.code;
  const { voidReason, returnTo } = req.body;

  try {
    await prisma.$transaction(async (tx) => {
      const trx = await tx.transaction.findUnique({
        where: { code },
        select: { id: true, status: true, category: true, amount: true, memberId: true }
      });
      if (!trx) throw new Error('Transaksi tidak ditemukan');
      if (trx.status !== 'POSTED') throw new Error('Transaksi sudah tidak berstatus POSTED');

      await tx.transaction.update({
        where: { code },
        data: {
          status: 'VOIDED',
          voidReason: voidReason || null,
          voidedAt: new Date(),
          voidedById: req.session.user.id
        }
      });

      const field = trx.category === 'WAJIB' ? 'wajibTotal' : 'pokokTotal';

      await tx.memberBalance.upsert({
        where: { memberId: trx.memberId },
        update: {},
        create: { memberId: trx.memberId, wajibTotal: new Prisma.Decimal(0), pokokTotal: new Prisma.Decimal(0) }
      });

      await tx.memberBalance.update({
        where: { memberId: trx.memberId },
        data: { [field]: { decrement: trx.amount } }
      });

      const bal = await tx.memberBalance.findUnique({ where: { memberId: trx.memberId } });
      const wajib = new Prisma.Decimal(bal.wajibTotal);
      const pokok = new Prisma.Decimal(bal.pokokTotal);
      await tx.memberBalance.update({
        where: { memberId: trx.memberId },
        data: {
          wajibTotal: wajib.isNegative() ? new Prisma.Decimal(0) : wajib,
          pokokTotal: pokok.isNegative() ? new Prisma.Decimal(0) : pokok
        }
      });
    });

    req.session.flash = { msg: 'Transaksi berhasil di-void' };
    res.redirect(returnTo || '/transactions');
  } catch (err) {
    console.error(err);
    req.session.flash = { err: err.message || 'Gagal void transaksi' };
    res.redirect(returnTo || '/transactions');
  }
}

// --- (jika kamu sudah menambahkan tombol refresh cache) ---
export async function refreshMemberBalance(req, res) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.memberBalance.deleteMany({});
      const members = await tx.member.findMany({ select: { id: true } });
      for (const m of members) {
        const [wajib, pokok] = await Promise.all([
          tx.transaction.aggregate({ _sum: { amount: true }, where: { memberId: m.id, category: 'WAJIB', status: 'POSTED' } }),
          tx.transaction.aggregate({ _sum: { amount: true }, where: { memberId: m.id, category: 'POKOK', status: 'POSTED' } })
        ]);
        await tx.memberBalance.create({
          data: {
            memberId: m.id,
            wajibTotal: wajib._sum.amount || 0,
            pokokTotal: pokok._sum.amount || 0
          }
        });
      }
    });
    req.session.flash = { msg: 'Cache MemberBalance berhasil diperbarui' };
    res.redirect('/transactions');
  } catch (err) {
    console.error(err);
    req.session.flash = { err: err.message || 'Gagal memperbarui cache MemberBalance' };
    res.redirect('/transactions');
  }
}
```

## `src/controllers\userController.js`

```js
// src/controllers/userController.js
import bcrypt from 'bcrypt';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

// Helper function to set flash messages
function flash(req, data){ req.session.flash = data; }

export async function page(req, res) {
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }]
  });
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });

  res.render('users', {
    title: 'Users',
    active: 'users',
    user: req.session.user,
    users, roles
    // TIDAK perlu err/msg di sini — sudah disuplai via res.locals dari middleware
  });
}

export async function create(req, res) {
  const { fullName, email, password, roleId } = req.body;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { fullName, email, passwordHash, roleId: Number(roleId), isActive: true } });
    flash(req, { msg: 'User dibuat' });
  } catch (e) {
    flash(req, { err: e.message || 'Gagal membuat user' });
  }
  res.redirect('/users');
}

export async function update(req, res) {
  const id = Number(req.params.id);
  const { fullName, email, roleId } = req.body;
  try {
    await prisma.user.update({ where: { id }, data: { fullName, email, roleId: Number(roleId) } });
    flash(req, { msg: 'User diupdate' });
  } catch (e) {
    flash(req, { err: e.message || 'Gagal update user' });
  }
  res.redirect('/users');
}

export async function deactivate(req, res) {
  const id = Number(req.params.id);
  if (req.session.user.id === id) {
    flash(req, { err: 'Tidak bisa menonaktifkan diri sendiri' });
    return res.redirect('/users');
  }
  const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!target) {
    flash(req, { err: 'User tidak ditemukan' });
    return res.redirect('/users');
  }
  if (target.role.name === 'ADMIN') {
    const activeAdmins = await prisma.user.count({ where: { isActive: true, role: { name: 'ADMIN' } } });
    if (activeAdmins <= 1) {
      flash(req, { err: 'Tidak bisa menonaktifkan admin terakhir' });
      return res.redirect('/users');
    }
  }
  await prisma.user.update({ where: { id }, data: { isActive: false } });
  flash(req, { msg: 'User dinonaktifkan' });
  res.redirect('/users');
}

export async function activate(req, res) {
  const id = Number(req.params.id);
  await prisma.user.update({ where: { id }, data: { isActive: true } });
  req.session.flash = { msg: 'User diaktifkan' };
  res.redirect('/users');
}

export async function resetPassword(req, res) {
  const id = Number(req.params.id);
  const { newPassword } = req.body;
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) {
    req.session.flash = { err: 'User tidak ditemukan' };
    return res.redirect('/users');
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  req.session.flash = { msg: 'Password direset' };
  res.redirect('/users');
}
```

## `src/middleware\authMiddleware.js`

```js
export function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
}
```

## `src/middleware\flashMiddleware.js`

```js
// session-only flash
export function flashMessages(req, res, next) {
  // default kosong
  res.locals.err = null;
  res.locals.msg = null;

  // ambil dari session.flash kalau ada
  const flash = req.session?.flash;
  if (flash) {
    res.locals.err = flash.err ?? null;
    res.locals.msg = flash.msg ?? null;
    delete req.session.flash; // hapus setelah dibaca (sekali pakai)
  }

  next();
}

// helper opsional (boleh dipakai di controller)
export function setFlash(req, { err, msg }) {
  req.session.flash = { err: err || null, msg: msg || null };
}
```

## `src/middleware\roleMiddleware.js`

```js
export function requireRole(...allowed) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) return res.redirect('/login');
    if (!allowed.includes(user.roleName)) return res.status(403).send('Forbidden');
    next();
  };
}
```

## `src/routes.js`

```js
import { Router } from 'express';
import { showLogin, doLogin, doLogout } from './controllers/authController.js';
import { dashboard } from './controllers/dashboardController.js';
import { page as usersPage, create as usersCreate, update as usersUpdate, deactivate as usersDeactivate, activate as usersActivate, resetPassword as usersResetPassword } from './controllers/userController.js';
import { page as membersPage, create as membersCreate, update as membersUpdate, softDelete as membersDelete, activate as membersActivate } from './controllers/memberController.js';
import { page as txPage, create as txCreate, voidTx as txVoid, refreshMemberBalance } from './controllers/transactionController.js';
import { savingsWajibIndex, savingsWajibDetail, savingsPokokPage } from './controllers/savingsController.js';

import { requireAuth } from './middleware/authMiddleware.js';
import { requireRole } from './middleware/roleMiddleware.js';

const router = Router();

// Auth
router.get('/login', showLogin);
router.post('/login', doLogin);
router.post('/logout', doLogout);

// Dashboard (pakai partials)
router.get('/', requireAuth, dashboard);

// === User Management (ADMIN only) ===
router.get('/users', requireAuth, requireRole('ADMIN'), usersPage);
router.post('/users', requireAuth, requireRole('ADMIN'), usersCreate);
router.post('/users/:id', requireAuth, requireRole('ADMIN'), usersUpdate);
router.post('/users/:id/deactivate', requireAuth, requireRole('ADMIN'), usersDeactivate);
router.post('/users/:id/activate', requireAuth, requireRole('ADMIN'), usersActivate);
router.post('/users/:id/reset-password', requireAuth, requireRole('ADMIN'), usersResetPassword);

// Members (satu view + modal tambah/edit)
router.get('/members', requireAuth, membersPage);
router.post('/members', requireAuth, requireRole('ADMIN', 'STAFF'), membersCreate);
router.post('/members/:id', requireAuth, requireRole('ADMIN', 'STAFF'), membersUpdate);
router.post('/members/:id/delete', requireAuth, requireRole('ADMIN'), membersDelete);
router.post('/members/:id/activate', requireAuth, requireRole('ADMIN'), membersActivate);

// Transactions
router.get('/transactions', requireAuth, txPage);
router.post('/transactions', requireAuth, requireRole('ADMIN', 'STAFF'), txCreate);
router.post('/transactions/:code/void', requireAuth, requireRole('ADMIN'), txVoid);
router.post('/transactions/refresh-cache', requireAuth, requireRole('ADMIN'), refreshMemberBalance);

// Savings
router.get('/savings/wajib', requireAuth, requireRole('ADMIN', 'STAFF'), savingsWajibIndex);
router.get('/savings/wajib/:memberId', requireAuth, requireRole('ADMIN', 'STAFF'), savingsWajibDetail);
router.get('/savings/pokok', requireAuth, requireRole('ADMIN', 'STAFF'), savingsPokokPage);

export default router;
```

## `src/server.js`

```js
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import router from './routes.js';
import { flashMessages } from './middleware/flashMiddleware.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(process.cwd(), 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));
app.use(flashMessages);

app.use('/', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
```

## `src/utils\formatRupiah.js`

```js
// src/utils/formatRupiah.js
export default function formatRupiah(value) {
  if (value === null || value === undefined) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(Number(value));
}
```

## `src/views\dashboard.ejs`

```ejs
<div class="container-fluid">
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
        <h1 class="h3 mb-0 text-gray-800">Dashboard</h1>
    </div>

    <div class="row">
        <div class="col-xl-4 col-md-12 mb-4">
            <div class="card border-left-primary shadow h-100 py-2">
                <div class="card-body">
                    <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">Anggota Aktif</div>
                    <div class="h5 mb-0 font-weight-bold text-gray-800">
                        <%= cards.anggota %>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xl-4 col-md-12 mb-4">
            <div class="card border-left-success shadow h-100 py-2">
                <div class="card-body">
                    <div class="text-xs font-weight-bold text-success text-uppercase mb-1">Total Wajib</div>
                    <div class="h5 mb-0 font-weight-bold text-gray-800">
                        <%= cards.wajib %>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xl-4 col-md-12 mb-4">
            <div class="card border-left-info shadow h-100 py-2">
                <div class="card-body">
                    <div class="text-xs font-weight-bold text-info text-uppercase mb-1">Total Pokok</div>
                    <div class="h5 mb-0 font-weight-bold text-gray-800">
                        <%= cards.pokok %>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Recent transactions -->
    <div class="card shadow mb-4">
        <div class="card-header py-3">
            <h6 class="m-0 font-weight-bold text-primary">Transaksi Terbaru</h6>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-striped mb-0">
                    <thead>
                        <tr>
                            <th>Kode</th>
                            <th>Anggota</th>
                            <th>Kategori</th>
                            <th>Jumlah</th>
                            <th>Tgl Bayar</th>
                            <th>Oleh</th>
                        </tr>
                    </thead>
                    <tbody>
                        <% recentTx.forEach(tx=> { %>
                            <tr>
                                <td>
                                    <%= tx.code %>
                                </td>
                                <td>
                                    <%= tx.member.memberNumber %> - <%= tx.member.fullName %>
                                </td>
                                <td>
                                    <%= tx.category %>
                                </td>
                                <td>
                                    <%= Number(tx.amount).toLocaleString('id-ID', { style:'currency', currency:'IDR',
                                        minimumFractionDigits:0 }) %>
                                </td>
                                <td>
                                    <%= new Date(tx.paidAt).toLocaleDateString() %>
                                </td>
                                <td>
                                    <%= tx.createdBy.fullName %>
                                </td>
                            </tr>
                            <% }) %>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Top 10 Anggota -->
    <div class="card shadow mb-4">
        <div class="card-header py-3">
            <h6 class="m-0 font-weight-bold text-primary">Top 10 Anggota (Simpanan Wajib+Pokok)</h6>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-striped mb-0">
                    <thead>
                        <tr>
                            <th>Nomor</th>
                            <th>Nama</th>
                            <th>Wajib</th>
                            <th>Pokok</th>
                        </tr>
                    </thead>
                    <tbody>
                        <% topRows.forEach(r=> { %>
                            <tr>
                                <td>
                                    <%= r.memberNumber %>
                                </td>
                                <td>
                                    <%= r.fullName %>
                                </td>
                                <td>
                                    <%= r.wajib %>
                                </td>
                                <td>
                                    <%= r.pokok %>
                                </td>
                            </tr>
                            <% }) %>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

</div>
```

## `src/views\layouts\main.ejs`

```ejs
<%- include('../partials/_head') %>
<%- include('../partials/_sidebar') %>
<%- include('../partials/_topbar') %>
<%- include('../partials/_alerts') %>

<%- body %> <!-- konten halaman akan diinject di sini -->

<%- include('../partials/_footer') %>
<%- include('../partials/_scripts') %>
```

## `src/views\login.ejs`

```ejs
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Login - Koperasi</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.6.2/css/bootstrap.min.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.1.4/css/sb-admin-2.min.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.css" />
</head>
<body class="bg-gradient-primary">
  <div class="container">
    <div class="row justify-content-center">
      <div class="col-xl-5 col-lg-6 col-md-7">
        <div class="card o-hidden border-0 shadow-lg my-5">
          <div class="card-body p-0">
            <div class="p-5">
              <div class="text-center">
                <h1 class="h4 text-gray-900 mb-4">Selamat Datang!</h1>
              </div>
              <% if (error) { %><div class="alert alert-danger"><%= error %></div><% } %>
              <form class="user" method="post" action="/login">
                <div class="form-group">
                  <input type="email" class="form-control form-control-user" name="email" placeholder="Email" value="<%= email %>" required>
                </div>
                <div class="form-group">
                  <input type="password" class="form-control form-control-user" name="password" placeholder="Password" required>
                </div>
                <button class="btn btn-primary btn-user btn-block" type="submit">Masuk</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.6.2/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.1.4/js/sb-admin-2.min.js"></script>
</body>
</html>
```

## `src/views\members.ejs`

```ejs
<div class="container-fluid">
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
        <h1 class="h3 mb-0 text-gray-800">Anggota</h1>
        <button class="btn btn-primary" data-toggle="modal" data-target="#modalAdd">
            <i class="fas fa-plus"></i> Tambah
        </button>
    </div>

    <!-- TABEL ANGGOTA AKTIF (sudah ada) -->
    <div class="card shadow">
        <div class="card-body">
            <table id="tblMembers" class="table table-striped table-bordered" style="width:100%">
                <thead>
                    <tr>
                        <th>Nomor</th>
                        <th>Nama</th>
                        <th>HP</th>
                        <th>Email</th>
                        <th>WAJIB</th>
                        <th>POKOK</th>
                        <th style="width:140px;">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <% members.forEach(m=> { %>
                        <tr>
                            <td>
                                <%= m.memberNumber %>
                            </td>
                            <td>
                                <%= m.fullName %>
                            </td>
                            <td>
                                <%= m.phone || '-' %>
                            </td>
                            <td>
                                <%= m.email || '-' %>
                            </td>
                            <td>
                                <%= m.wajibFormatted %>
                            </td>
                            <td>
                                <%= m.pokokFormatted %>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-info btn-edit" data-toggle="modal"
                                    data-target="#modalEdit" data-id="<%= m.id %>"
                                    data-membernumber="<%- (m.memberNumber || '').replace(/"/g,'&quot;') %>"
                                    data-fullname="<%- (m.fullName || '' ).replace(/"/g,'&quot;') %>"
                                        data-phone="<%- (m.phone || '' ).replace(/"/g,'&quot;') %>"
                                            data-email="<%- (m.email || '' ).replace(/"/g,'&quot;') %>"
                                                data-address="<%- (m.address || '' ).replace(/"/g,'&quot;') %>"
                                                    ><i class="fas fa-edit"></i></button>

                                <form method="post" action="/members/<%= m.id %>/delete" class="d-inline"
                                    onsubmit="return confirm('Nonaktifkan anggota ini?')">
                                    <button class="btn btn-sm btn-danger"><i class="fas fa-user-slash"></i></button>
                                </form>
                            </td>
                        </tr>
                        <% }) %>
                </tbody>
            </table>
        </div>
    </div>

    <!-- ====== TABEL ANGGOTA NONAKTIF ====== -->
    <div class="card shadow mt-4">
        <div class="card-header py-3">
            <h6 class="m-0 font-weight-bold text-primary">Anggota Nonaktif</h6>
        </div>
        <div class="card-body">
            <table id="tblMembersInactive" class="table table-striped table-bordered" style="width:100%">
                <thead>
                    <tr>
                        <th>Nomor</th>
                        <th>Nama</th>
                        <th>HP</th>
                        <th>Email</th>
                        <th>WAJIB</th>
                        <th>POKOK</th>
                        <th style="width:120px;">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <% (membersInactive || []).forEach(m=> { %>
                        <tr>
                            <td>
                                <%= m.memberNumber %>
                            </td>
                            <td>
                                <%= m.fullName %>
                            </td>
                            <td>
                                <%= m.phone || '-' %>
                            </td>
                            <td>
                                <%= m.email || '-' %>
                            </td>
                            <td>
                                <%= m.wajibFormatted %>
                            </td>
                            <td>
                                <%= m.pokokFormatted %>
                            </td>
                            <td>
                                <form method="post" action="/members/<%= m.id %>/activate" class="d-inline"
                                    onsubmit="return confirm('Aktifkan kembali anggota ini?')">
                                    <button class="btn btn-sm btn-success"><i class="fas fa-user-check"></i>
                                        Aktifkan</button>
                                </form>
                            </td>
                        </tr>
                        <% }) %>
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- Modal Tambah -->
<div class="modal fade" id="modalAdd" tabindex="-1">
    <div class="modal-dialog">
        <form class="modal-content" method="post" action="/members">
            <div class="modal-header">
                <h5 class="modal-title">Tambah Anggota</h5>
                <button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>
            </div>
            <div class="modal-body">
                <div class="form-group"><label>Nama Lengkap</label><input name="fullName" class="form-control" required>
                </div>
                <div class="form-group"><label>HP</label><input name="phone" class="form-control"></div>
                <div class="form-group"><label>Email</label><input name="email" type="email" class="form-control"></div>
                <div class="form-group"><label>Alamat</label><textarea name="address" class="form-control"
                        rows="3"></textarea></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-light" data-dismiss="modal">Batal</button>
                <button class="btn btn-primary">Simpan</button>
            </div>
        </form>
    </div>
</div>

<!-- Modal Edit -->
<div class="modal fade" id="modalEdit" tabindex="-1">
    <div class="modal-dialog">
        <form id="formEdit" class="modal-content" method="post">
            <div class="modal-header">
                <h5 class="modal-title">
                    Edit Anggota
                    <small class="text-muted ml-2" id="view-memberNumber"></small>
                </h5>
                <button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>
            </div>
            <div class="modal-body">
                <div class="form-group"><label>Nama Lengkap</label><input id="e-fullName" name="fullName"
                        class="form-control" required></div>
                <div class="form-group"><label>HP</label><input id="e-phone" name="phone" class="form-control"></div>
                <div class="form-group"><label>Email</label><input id="e-email" name="email" type="email"
                        class="form-control"></div>
                <div class="form-group"><label>Alamat</label><textarea id="e-address" name="address"
                        class="form-control" rows="3"></textarea></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-light" data-dismiss="modal">Batal</button>
                <button class="btn btn-primary">Update</button>
            </div>
        </form>
    </div>
</div>

<script>
    $(function () {
        $('#tblMembers').DataTable({
            pageLength: 10,
            lengthMenu: [10, 25, 50, 100],
        });

        $('#tblMembersInactive').DataTable({
            pageLength: 10,
            lengthMenu: [10, 25, 50, 100]
        });

        // isi modal Edit dari data-attribute tombol
        $(document).on('click', '.btn-edit', function () {
            const btn = $(this);
            $('#formEdit').attr('action', '/members/' + btn.data('id'));
            $('#view-memberNumber').text(btn.data('membernumber'));
            $('#e-fullName').val(btn.data('fullname'));
            $('#e-phone').val(btn.data('phone'));
            $('#e-email').val(btn.data('email'));
            $('#e-address').val(btn.data('address'));
        });
    });
</script>
```

## `src/views\partials\_alerts.ejs`

```ejs
<% if (typeof err !== 'undefined' && err) { %>
  <div class="container-fluid pt-2">
    <div class="alert alert-danger alert-dismissible fade show" role="alert" data-autoclose="true">
      <%= err %>
      <button type="button" class="close" data-dismiss="alert" aria-label="Close">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  </div>
<% } %>

<% if (typeof msg !== 'undefined' && msg) { %>
  <div class="container-fluid pt-2">
    <div class="alert alert-success alert-dismissible fade show" role="alert" data-autoclose="true">
      <%= msg %>
      <button type="button" class="close" data-dismiss="alert" aria-label="Close">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  </div>
<% } %>

<script>
// auto-dismiss setelah 5 detik (Bootstrap 4)
(function(){
  var alerts = document.querySelectorAll('.alert[data-autoclose="true"]');
  if (!alerts || !alerts.length) return;
  setTimeout(function(){
    alerts.forEach(function(a){
      // panggil API alert Bootstrap 4
      if (typeof $ !== 'undefined' && $(a).alert) { $(a).alert('close'); }
      else { a.parentNode && a.parentNode.removeChild(a); }
    });
  }, 5000);
})();
</script>
```

## `src/views\partials\_footer.ejs`

```ejs
</div> <!-- /#content -->
  <footer class="sticky-footer bg-white">
    <div class="container my-auto">
      <div class="copyright text-center my-auto">
        <span>&copy; <%= new Date().getFullYear() %> Koperasi App</span>
      </div>
    </div>
  </footer>
</div> <!-- /#content-wrapper -->
</div> <!-- /#wrapper -->
```

## `src/views\partials\_head.ejs`

```ejs
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title || 'Koperasi App' %></title>

  <!-- Font Awesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
  <!-- Google Fonts (Nunito) -->
  <link href="https://fonts.googleapis.com/css?family=Nunito:200,300,400,700,900" rel="stylesheet">
  <!-- Bootstrap 4 -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.6.2/css/bootstrap.min.css" />
  <!-- SB Admin 2 -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.1.4/css/sb-admin-2.min.css" />
  <!-- DataTables -->
  <link rel="stylesheet" href="https://cdn.datatables.net/1.13.8/css/dataTables.bootstrap4.min.css" />
  
  <!-- Script Here!!! -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/autonumeric@4.8.1/dist/autoNumeric.min.js"></script>
</head>
<body id="page-top">
<div id="wrapper">
```

## `src/views\partials\_scripts.ejs`

```ejs
<!-- jQuery, Bootstrap, SB Admin 2 JS -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.6.2/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.1.4/js/sb-admin-2.min.js"></script>
<script src="https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"></script>
<script src="https://cdn.datatables.net/1.13.8/js/dataTables.bootstrap4.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
</body>
</html>
```

## `src/views\partials\_sidebar.ejs`

```ejs
<ul class="navbar-nav bg-gradient-primary sidebar sidebar-dark accordion" id="accordionSidebar">
  <a class="sidebar-brand d-flex align-items-center justify-content-center" href="/">
    <div class="sidebar-brand-icon rotate-n-15"><i class="fas fa-coins"></i></div>
    <div class="sidebar-brand-text mx-3">Koperasi</div>
  </a>

  <hr class="sidebar-divider my-0">

  <li class="nav-item <%= (active==='dashboard') ? 'active' : '' %>">
    <a class="nav-link" href="/"><i class="fas fa-fw fa-tachometer-alt"></i><span>Dashboard</span></a>
  </li>

  <hr class="sidebar-divider">

  <div class="sidebar-heading">Master</div>
  <% if (user?.roleName==='ADMIN' ) { %>
    <li class="nav-item <%= (active==='users') ? 'active' : '' %>">
      <a class="nav-link" href="/users"><i class="fas fa-user-shield"></i><span>Users</span></a>
    </li>
  <% } %>
    <li class="nav-item <%= (active==='members') ? 'active' : '' %>">
      <a class="nav-link" href="/members"><i class="fas fa-users"></i><span>Anggota</span></a>
    </li>

    <hr class="sidebar-divider">

    <!-- === BARU: SIMPANAN === -->
    <div class="sidebar-heading">Simpanan</div>
    <li class="nav-item <%= (active==='savings-wajib') ? 'active' : '' %>">
      <a class="nav-link" href="/savings/wajib"><i class="fas fa-piggy-bank"></i><span>Wajib</span></a>
    </li>
    <li class="nav-item <%= (active==='savings-pokok') ? 'active' : '' %>">
      <a class="nav-link" href="/savings/pokok"><i class="fas fa-coins"></i><span>Pokok</span></a>
    </li>
    <hr class="sidebar-divider">

    <!-- NEW: Transaksi -->
    <div class="sidebar-heading">Transaksi</div>
    <li class="nav-item <%= (active==='transactions') ? 'active' : '' %>">
      <a class="nav-link" href="/transactions"><i class="fas fa-exchange-alt"></i><span>Daftar Transaksi</span></a>
    </li>


    <hr class="sidebar-divider d-none d-md-block">
    <div class="text-center d-none d-md-inline">
      <button class="rounded-circle border-0" id="sidebarToggle"></button>
    </div>
</ul>
```

## `src/views\partials\_topbar.ejs`

```ejs
<div id="content-wrapper" class="d-flex flex-column">
  <div id="content">
    <nav class="navbar navbar-expand navbar-light bg-white topbar mb-4 static-top shadow">

      <!-- Sidebar Toggle (Topbar) -->
      <button id="sidebarToggleTop" class="btn btn-link d-md-none rounded-circle mr-3">
        <i class="fa fa-bars"></i>
      </button>

      <!-- Topbar Navbar -->
      <ul class="navbar-nav ml-auto">

        <!-- Nav Item - Search Dropdown (Visible Only XS) -->
        <li class="nav-item dropdown no-arrow d-sm-none">
          <a class="nav-link dropdown-toggle" href="#" id="searchDropdown" role="button" data-toggle="dropdown"
            aria-haspopup="true" aria-expanded="false">
            <i class="fas fa-search fa-fw"></i>
          </a>
          <!-- Dropdown - Messages -->
          <div class="dropdown-menu dropdown-menu-right p-3 shadow animated--grow-in" aria-labelledby="searchDropdown">
            <form class="form-inline mr-auto w-100 navbar-search">
              <div class="input-group">
                <input type="text" class="form-control bg-light border-0 small" placeholder="Search for..."
                  aria-label="Search" aria-describedby="basic-addon2">
                <div class="input-group-append">
                  <button class="btn btn-primary" type="button">
                    <i class="fas fa-search fa-sm"></i>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </li>

        <!-- Nav Item - User Information -->
        <li class="nav-item dropdown no-arrow">
          <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" data-toggle="dropdown"
            aria-haspopup="true" aria-expanded="false">
            <span class="mr-2 d-none d-lg-inline text-gray-600 small"><%= user.fullName %> (<%= user.roleName %>)</span>
            <i class="fas fa-user-circle fa-lg"></i>
          </a>
          <!-- Dropdown - User Information -->
          <div class="dropdown-menu dropdown-menu-right shadow animated--grow-in" aria-labelledby="userDropdown">
            <a class="dropdown-item" href="#">
              <i class="fas fa-user fa-sm fa-fw mr-2 text-gray-400"></i>
              Profile
            </a>
            <!-- <a class="dropdown-item" href="#">
              <i class="fas fa-cogs fa-sm fa-fw mr-2 text-gray-400"></i>
              Settings
            </a> -->
            <!-- <a class="dropdown-item" href="#">
              <i class="fas fa-list fa-sm fa-fw mr-2 text-gray-400"></i>
              Activity Log
            </a> -->
            <div class="dropdown-divider"></div>
            <form method="post" action="/logout">
              <button type="submit" class="dropdown-item text-danger">
                <i class="fas fa-sign-out-alt fa-sm fa-fw mr-2 text-gray-400"></i>
                Logout
              </button>
            </form>
          </div>
        </li>

      </ul>

    </nav>
```

## `src/views\savings-pokok.ejs`

```ejs
<div class="container-fluid">
  <div class="d-sm-flex align-items-center justify-content-between mb-4">
    <h1 class="h3 mb-0 text-gray-800">Simpanan Pokok</h1>
    <div class="text-muted small">Daftar anggota aktif beserta saldo pokok</div>
  </div>

  <div class="card shadow">
    <div class="card-body">
      <div class="table-responsive">
        <table id="tblPokokMembers" class="table table-striped table-bordered" style="width:100%">
          <thead>
            <tr>
              <th>Nomor</th>
              <th>Nama</th>
              <th>HP</th>
              <th>Saldo Pokok</th>
              <th style="width:140px;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <% (rows || []).forEach(r=> { %>
              <tr>
                <td><%= r.memberNumber %></td>
                <td><%= r.fullName %></td>
                <td><%= r.phone %></td>
                <td><%= r.pokok %></td>
                <td>
                  <% if (!r.hasPokok) { %>
                    <button class="btn btn-sm btn-primary btn-add"
                            data-toggle="modal" data-target="#modalAdd"
                            data-memberid="<%= r.id %>"
                            data-membername="<%- r.fullName.replace(/"/g,'&quot;') %>"
                            data-membernumber="<%- r.memberNumber.replace(/"/g,'&quot;') %>">
                      <i class="fas fa-plus"></i> Tambah
                    </button>
                  <% } else { %>
                    <button class="btn btn-sm btn-secondary" disabled>
                      <i class="fas fa-check"></i> Sudah Ada
                    </button>
                  <% } %>
                </td>
              </tr>
            <% }) %>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Modal Tambah Simpanan Pokok -->
<div class="modal fade" id="modalAdd" tabindex="-1">
  <div class="modal-dialog">
    <form class="modal-content" method="post" action="/transactions">
      <input type="hidden" name="returnTo" value="/savings/pokok">
      <div class="modal-header">
        <h5 class="modal-title">Tambah Simpanan Pokok — <span id="modalMemberTitle"></span></h5>
        <button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>
      </div>
      <div class="modal-body">
        <input type="hidden" name="category" value="POKOK">
        <input type="hidden" id="memberId" name="memberId" value="">

        <div class="form-group">
          <label>Jumlah</label>
          <input type="text" id="amount" name="amount" class="form-control" value="100000" required>
        </div>
        <div class="form-group">
          <label>Tgl Bayar</label>
          <input type="date" id="paidAt" name="paidAt" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Metode</label>
          <select name="paymentMethod" class="form-control">
            <option value="CASH">CASH</option>
            <option value="TRANSFER">TRANSFER</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
        <div class="form-group">
          <label>Catatan</label>
          <textarea name="note" class="form-control" rows="2"></textarea>
        </div>

        <div class="alert alert-info small mb-0">
          Simpanan pokok hanya bisa sekali per anggota. Jika sudah pernah, sistem akan menolak.
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-light" data-dismiss="modal">Batal</button>
        <button class="btn btn-primary">Simpan</button>
      </div>
    </form>
  </div>
</div>

<script>
  $(function () {
    // DataTable
    $('#tblPokokMembers').DataTable({
      pageLength: 10,
      lengthMenu: [10,25,50,100],
      order: [[1,'asc']]
    });

    // AutoNumeric untuk amount
    new AutoNumeric('#amount', {
      digitGroupSeparator: '.',
      decimalCharacter: ',',
      decimalPlaces: 0,
      unformatOnSubmit: true
    });

    // Isi modal saat klik "Tambah"
    $(document).on('click', '.btn-add', function(){
      const id = $(this).data('memberid');
      const name = $(this).data('membername');
      const number = $(this).data('membernumber');
      $('#memberId').val(id);
      $('#modalMemberTitle').text(number + ' — ' + name);

      // set default tanggal = hari ini
      const t = new Date();
      const y = t.getFullYear();
      const m = String(t.getMonth()+1).padStart(2,'0');
      const d = String(t.getDate()).padStart(2,'0');
      $('#paidAt').val(`${y}-${m}-${d}`);
    });
  });
</script>
```

## `src/views\savings-wajib\detail.ejs`

```ejs
<div class="container-fluid">
    <div class="d-sm-flex align-items-center justify-content-between mb-3">
        <div>
            <h1 class="h3 mb-0 text-gray-800">Simpanan Wajib</h1>
            <div class="small text-muted">
                <strong>
                    <%= member.memberNumber %>
                </strong> — <%= member.fullName %>
            </div>
        </div>
        <div>
            <a class="btn btn-light mr-2" href="/savings/wajib"><i class="fas fa-arrow-left"></i> Kembali</a>
            <button class="btn btn-primary" data-toggle="modal" data-target="#modalAdd">
                <i class="fas fa-plus"></i> Tambah
            </button>
        </div>
    </div>

    <div class="row">
        <div class="col-md-6 mb-3">
            <div class="card border-left-success shadow h-100 py-2">
                <div class="card-body">
                    <div class="text-xs font-weight-bold text-success text-uppercase mb-1">Total Simpanan Wajib (POSTED)
                    </div>
                    <div class="h5 mb-0 font-weight-bold text-gray-800">
                        <%= totalWajib %>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Tabel transaksi WAJIB -->
    <div class="card shadow">
        <div class="card-header py-3">
            <h6 class="m-0 font-weight-bold text-primary">Transaksi Wajib — <%= member.fullName %>
            </h6>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table id="tblTxWajib" class="table table-striped table-bordered" style="width:100%">
                    <thead>
                        <tr>
                            <th>Kode</th>
                            <th>Jumlah</th>
                            <th>Tgl Bayar</th>
                            <th>Metode</th>
                            <th>Catatan</th>
                            <th>Oleh</th>
                            <th>Status</th>
                            <th style="width:90px;">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <% txs.forEach(t=> { %>
                            <tr>
                                <td>
                                    <%= t.code %>
                                </td>
                                <td>
                                    <%= t.amountFormatted %>
                                </td>
                                <td>
                                    <%= new Date(t.paidAt).toLocaleDateString() %>
                                </td>
                                <td>
                                    <%= t.paymentMethod %>
                                </td>
                                <td>
                                    <%= t.note || '' %>
                                </td>
                                <td>
                                    <%= t.createdBy.fullName %>
                                </td>
                                <td>
                                    <% if (t.status==='POSTED' ) { %>
                                        <span class="badge badge-success">POSTED</span>
                                        <% } else { %>
                                            <span class="badge badge-secondary">VOIDED</span>
                                            <% } %>
                                </td>
                                <td>
                                    <% if (user?.roleName==='ADMIN' && t.status==='POSTED' ) { %>
                                        <button class="btn btn-sm btn-danger btn-void" data-toggle="modal"
                                            data-target="#modalVoid" data-code="<%= t.code %>">
                                            <i class="fas fa-ban"></i> Void
                                        </button>
                                        <% } else { %>
                                            <button class="btn btn-sm btn-light" disabled>-</button>
                                            <% } %>
                                </td>
                            </tr>
                            <% }) %>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- Modal Tambah Setoran Wajib -->
<div class="modal fade" id="modalAdd" tabindex="-1">
    <div class="modal-dialog">
        <form class="modal-content" method="post" action="/transactions">
            <input type="hidden" name="returnTo" value="/savings/wajib/<%= member.id %>">
            <div class="modal-header">
                <h5 class="modal-title">Tambah Setoran Wajib — <%= member.fullName %>
                </h5>
                <button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>
            </div>
            <div class="modal-body">
                <input type="hidden" name="category" value="WAJIB">
                <input type="hidden" name="memberId" value="<%= member.id %>">

                <div class="form-group">
                    <label>Jumlah</label>
                    <input type="text" id="amount" name="amount" class="form-control" value="20000" required>
                </div>
                <div class="form-group">
                    <label>Tgl Bayar</label>
                    <input type="date" id="paidAt" name="paidAt" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Metode</label>
                    <select name="paymentMethod" class="form-control">
                        <option value="CASH">CASH</option>
                        <option value="TRANSFER">TRANSFER</option>
                        <option value="OTHER">OTHER</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Catatan</label>
                    <textarea name="note" class="form-control" rows="2"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-light" data-dismiss="modal">Batal</button>
                <button class="btn btn-primary">Simpan</button>
            </div>
        </form>
    </div>
</div>

<!-- Modal Void (pakai endpoint /transactions/:code/void) -->
<div class="modal fade" id="modalVoid" tabindex="-1">
    <div class="modal-dialog">
        <form id="formVoid" class="modal-content" method="post">
            <input type="hidden" name="returnTo" value="/savings/wajib/<%= member.id %>">
            <div class="modal-header">
                <h5 class="modal-title">Void Transaksi</h5>
                <button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>
            </div>
            <div class="modal-body">
                <div class="alert alert-warning">
                    Transaksi akan dibatalkan dan saldo anggota akan disesuaikan kembali.
                </div>
                <div class="form-group">
                    <label>Alasan Void (opsional)</label>
                    <textarea name="voidReason" class="form-control" rows="3"
                        placeholder="Misal: input ganda, salah nominal, dsb."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-light" data-dismiss="modal">Batal</button>
                <button class="btn btn-danger">Konfirmasi Void</button>
            </div>
        </form>
    </div>
</div>

<script>
    $(function () {
        $('#tblTxWajib').DataTable({ pageLength: 10, lengthMenu: [10, 25, 50, 100], order: [[0, 'desc']] });
        new AutoNumeric('#amount', { digitGroupSeparator: '.', decimalCharacter: ',', decimalPlaces: 0, unformatOnSubmit: true });

        $('#modalVoid').on('show.bs.modal', function (e) {
            const code = $(e.relatedTarget).data('code');
            $('#formVoid').attr('action', '/transactions/' + code + '/void');
        });
        $('#modalAdd').on('show.bs.modal', function () {
            // set default tanggal = hari ini
            const t = new Date();
            const y = t.getFullYear();
            const m = String(t.getMonth() + 1).padStart(2, '0');
            const d = String(t.getDate()).padStart(2, '0');
            $('#paidAt').val(`${y}-${m}-${d}`);
        });
    });
</script>
```

## `src/views\savings-wajib\index.ejs`

```ejs
<div class="container-fluid">
  <div class="d-sm-flex align-items-center justify-content-between mb-4">
    <h1 class="h3 mb-0 text-gray-800">Simpanan Wajib</h1>
    <div class="text-muted small">Pilih anggota untuk melihat transaksi wajibnya</div>
  </div>

  <div class="card shadow">
    <div class="card-body">
      <div class="table-responsive">
        <table id="tblWajibMembers" class="table table-striped table-bordered" style="width:100%">
          <thead>
            <tr>
              <th>Nomor</th>
              <th>Nama</th>
              <th>HP</th>
              <th>Saldo Wajib</th>
              <th style="width:120px;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <% rows.forEach(r=> { %>
              <tr>
                <td><%= r.memberNumber %></td>
                <td><%= r.fullName %></td>
                <td><%= r.phone %></td>
                <td><%= r.wajib %></td>
                <td>
                  <a class="btn btn-sm btn-primary" href="/savings/wajib/<%= r.id %>">
                    <i class="fas fa-folder-open"></i> Lihat Transaksi
                  </a>
                </td>
              </tr>
            <% }) %>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<script>
  $(function () {
    $('#tblWajibMembers').DataTable({
      pageLength: 10,
      lengthMenu: [10,25,50,100],
      order: [[1,'asc']]
    });
  });
</script>
```

## `src/views\transactions.ejs`

```ejs
<div class="container-fluid">
  <div class="d-sm-flex align-items-center justify-content-between mb-4">
    <h1 class="h3 mb-0 text-gray-800">Daftar Transaksi</h1>
    <% if (user?.roleName==='ADMIN' ) { %>
      <form method="post" action="/transactions/refresh-cache"
        onsubmit="return confirm('Refresh saldo anggota dari transaksi?')">
        <button class="btn btn-warning"><i class="fas fa-sync-alt"></i> Refresh Cache</button>
      </form>
      <% } %>
  </div>

  <!-- Cards Total -->
  <div class="row">
    <div class="col-md-6 mb-3">
      <div class="card border-left-success shadow h-100 py-2">
        <div class="card-body">
          <div class="text-xs font-weight-bold text-success text-uppercase mb-1">Total Wajib</div>
          <div class="h5 mb-0 font-weight-bold text-gray-800">
            <%= cards.wajib %>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-6 mb-3">
      <div class="card border-left-info shadow h-100 py-2">
        <div class="card-body">
          <div class="text-xs font-weight-bold text-info text-uppercase mb-1">Total Pokok</div>
          <div class="h5 mb-0 font-weight-bold text-gray-800">
            <%= cards.pokok %>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="card shadow mb-4">
    <div class="card-header">
      <ul id="txTabs" class="nav nav-tabs card-header-tabs" role="tablist">
        <li class="nav-item">
          <a class="nav-link <%= activeTab==='wajib' ? 'active' : '' %>" id="tab-wajib" data-toggle="tab"
            href="#pane-wajib" role="tab" data-tab="wajib">Simpanan Wajib</a>
        </li>
        <li class="nav-item">
          <a class="nav-link <%= activeTab==='pokok' ? 'active' : '' %>" id="tab-pokok" data-toggle="tab"
            href="#pane-pokok" role="tab" data-tab="pokok">Simpanan Pokok</a>
        </li>
      </ul>
    </div>
    <div class="card-body tab-content">
      <div class="tab-pane fade <%= activeTab==='wajib' ? 'show active' : '' %>" id="pane-wajib" role="tabpanel">
        <div class="table-responsive">
          <table id="tblWajib" class="table table-striped table-bordered" style="width:100%">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Anggota</th>
                <th>Jumlah</th>
                <th>Tgl Bayar</th>
                <th>Metode</th>
                <th>Catatan</th>
                <th>Oleh</th>
                <th>Status</th>
                <th style="width:90px;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <% (txWajib || []).forEach(t=> { %>
                <tr>
                  <td>
                    <%= t.code %>
                  </td>
                  <td>
                    <%= t.member.memberNumber %> - <%= t.member.fullName %>
                  </td>
                  <td>
                    <%= t.amountFormatted %>
                  </td>
                  <td>
                    <%= new Date(t.paidAt).toLocaleDateString() %>
                  </td>
                  <td>
                    <%= t.paymentMethod %>
                  </td>
                  <td>
                    <%= t.note || '' %>
                  </td>
                  <td>
                    <%= t.createdBy.fullName %>
                  </td>
                  <td>
                    <% if (t.status==='POSTED' ) { %>
                      <span class="badge badge-success">POSTED</span>
                      <% } else { %>
                        <span class="badge badge-secondary">VOIDED</span>
                        <% } %>
                  </td>
                  <td>
                    <% if (user?.roleName==='ADMIN' && t.status==='POSTED' ) { %>
                      <button class="btn btn-sm btn-danger btn-void" data-toggle="modal" data-target="#modalVoid"
                        data-code="<%= t.code %>">
                        <i class="fas fa-ban"></i> Void
                      </button>
                      <% } else { %>
                        <button class="btn btn-sm btn-light" disabled>-</button>
                        <% } %>
                  </td>
                </tr>
                <% }) %>
            </tbody>
          </table>
        </div>
      </div>

      <div class="tab-pane fade <%= activeTab==='pokok' ? 'show active' : '' %>" id="pane-pokok" role="tabpanel">
        <div class="table-responsive">
          <table id="tblPokok" class="table table-striped table-bordered" style="width:100%">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Anggota</th>
                <th>Jumlah</th>
                <th>Tgl Bayar</th>
                <th>Metode</th>
                <th>Catatan</th>
                <th>Oleh</th>
                <th>Status</th>
                <th style="width:90px;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <% (txPokok || []).forEach(t=> { %>
                <tr>
                  <td>
                    <%= t.code %>
                  </td>
                  <td>
                    <%= t.member.memberNumber %> - <%= t.member.fullName %>
                  </td>
                  <td>
                    <%= t.amountFormatted %>
                  </td>
                  <td>
                    <%= new Date(t.paidAt).toLocaleDateString() %>
                  </td>
                  <td>
                    <%= t.paymentMethod %>
                  </td>
                  <td>
                    <%= t.note || '' %>
                  </td>
                  <td>
                    <%= t.createdBy.fullName %>
                  </td>
                  <td>
                    <% if (t.status==='POSTED' ) { %>
                      <span class="badge badge-success">POSTED</span>
                      <% } else { %>
                        <span class="badge badge-secondary">VOIDED</span>
                        <% } %>
                  </td>
                  <td>
                    <% if (user?.roleName==='ADMIN' && t.status==='POSTED' ) { %>
                      <button class="btn btn-sm btn-danger btn-void" data-toggle="modal" data-target="#modalVoid"
                        data-code="<%= t.code %>">
                        <i class="fas fa-ban"></i> Void
                      </button>
                      <% } else { %>
                        <button class="btn btn-sm btn-light" disabled>-</button>
                        <% } %>
                  </td>
                </tr>
                <% }) %>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modal Void -->
<div class="modal fade" id="modalVoid" tabindex="-1">
  <div class="modal-dialog">
    <form id="formVoid" class="modal-content" method="post">
      <input type="hidden" name="returnTo" value="">
      <div class="modal-header">
        <h5 class="modal-title">Void Transaksi</h5>
        <button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-warning">Transaksi akan dibatalkan dan saldo anggota akan disesuaikan kembali.</div>
        <div class="form-group"><label>Alasan Void (opsional)</label>
          <textarea name="voidReason" class="form-control" rows="3"
            placeholder="Misal: input ganda, salah nominal, dsb."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-light" data-dismiss="modal">Batal</button>
        <button class="btn btn-danger">Konfirmasi Void</button>
      </div>
    </form>
  </div>
</div>

<script>
  $(function () {
    // DataTables per tab
    var dtWajib = $('#tblWajib').DataTable({
      pageLength: 10, lengthMenu: [10, 25, 50, 100], order: [[0, 'desc']]
    });
    var dtPokok = $('#tblPokok').DataTable({
      pageLength: 10, lengthMenu: [10, 25, 50, 100], order: [[0, 'desc']]
    });

    // === util: tab aktif sekarang
    function getActiveTab() {
      var el = document.querySelector('#txTabs .nav-link.active');
      return el ? el.getAttribute('data-tab') : 'wajib';
    }

    // === set nilai returnTo ke form modal Void
    function updateReturnTo() {
      var tab = getActiveTab();
      var url = '/transactions?tab=' + tab;
      var inp = document.querySelector('#formVoid input[name="returnTo"]');
      if (inp) inp.value = url;
    }

    // Inisialisasi saat load
    updateReturnTo();

    // Update saat tab berubah (Bootstrap 4 event)
    $('#txTabs a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
      var tab = e.target.getAttribute('data-tab');

      // update URL tanpa reload (agar reload halaman tetap buka tab yang sama)
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '/transactions?tab=' + tab);
      }

      updateReturnTo();

      // perbaiki lebar kolom DataTables di tab yang baru aktif
      if (tab === 'wajib') { dtWajib.columns.adjust(); }
      if (tab === 'pokok') { dtPokok.columns.adjust(); }
    });

    // Set action form modal Void sesuai tombol yang diklik
    $('#modalVoid').on('show.bs.modal', function (e) {
      const code = $(e.relatedTarget).data('code');
      $('#formVoid').attr('action', '/transactions/' + code + '/void');

      // pastikan returnTo terkini (kalau user klik Void segera setelah ganti tab)
      updateReturnTo();
    });
  });
</script>
```

## `src/views\users.ejs`

```ejs
<div class="container-fluid">
  <div class="d-sm-flex align-items-center justify-content-between mb-4">
    <h1 class="h3 mb-0 text-gray-800">Users</h1>
    <button class="btn btn-primary" data-toggle="modal" data-target="#modalAdd">
      <i class="fas fa-user-plus"></i> Tambah
    </button>
  </div>

  <% if (err) { %><div class="alert alert-danger"><%= err %></div><% } %>
  <% if (msg) { %><div class="alert alert-success"><%= msg %></div><% } %>

  <div class="card shadow">
    <div class="card-body">
      <div class="table-responsive">
        <table id="tblUsers" class="table table-striped table-bordered" style="width:100%">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th style="width:220px;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <% users.forEach(u=> { %>
              <tr>
                <td><%= u.fullName %></td>
                <td><%= u.email %></td>
                <td><span class="badge badge-<%= u.role.name==='ADMIN'?'danger':'secondary' %>"><%= u.role.name %></span></td>
                <td>
                  <% if (u.isActive) { %>
                    <span class="badge badge-success">Aktif</span>
                  <% } else { %>
                    <span class="badge badge-secondary">Nonaktif</span>
                  <% } %>
                </td>
                <td>
                  <button class="btn btn-sm btn-info btn-edit" data-toggle="modal" data-target="#modalEdit"
                          data-id="<%= u.id %>"
                          data-name="<%- u.fullName.replace(/"/g,'&quot;') %>"
                          data-email="<%- u.email.replace(/"/g,'&quot;') %>"
                          data-roleid="<%= u.roleId %>">
                    <i class="fas fa-edit"></i> Edit
                  </button>

                  <button class="btn btn-sm btn-warning btn-reset" data-toggle="modal" data-target="#modalReset"
                          data-id="<%= u.id %>" data-name="<%- u.fullName.replace(/"/g,'&quot;') %>">
                    <i class="fas fa-key"></i> Reset
                  </button>

                  <% if (u.isActive) { %>
                    <form method="post" action="/users/<%= u.id %>/deactivate" class="d-inline"
                          onsubmit="return confirm('Nonaktifkan user ini?')">
                      <button class="btn btn-sm btn-danger" <%= (user.id===u.id)?'disabled':'' %>>
                        <i class="fas fa-user-slash"></i>
                      </button>
                    </form>
                  <% } else { %>
                    <form method="post" action="/users/<%= u.id %>/activate" class="d-inline"
                          onsubmit="return confirm('Aktifkan kembali user ini?')">
                      <button class="btn btn-sm btn-success">
                        <i class="fas fa-user-check"></i>
                      </button>
                    </form>
                  <% } %>
                </td>
              </tr>
            <% }) %>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Modal Tambah -->
<div class="modal fade" id="modalAdd" tabindex="-1">
  <div class="modal-dialog">
    <form class="modal-content" method="post" action="/users">
      <div class="modal-header">
        <h5 class="modal-title">Tambah User</h5>
        <button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label>Nama Lengkap</label><input name="fullName" class="form-control" required></div>
        <div class="form-group"><label>Email</label><input name="email" type="email" class="form-control" required></div>
        <div class="form-group"><label>Password</label><input name="password" type="password" class="form-control" required minlength="6"></div>
        <div class="form-group">
          <label>Role</label>
          <select name="roleId" class="form-control">
            <% roles.forEach(r=> { %>
              <option value="<%= r.id %>"><%= r.name %></option>
            <% }) %>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary">Simpan</button>
      </div>
    </form>
  </div>
</div>

<!-- Modal Edit -->
<div class="modal fade" id="modalEdit" tabindex="-1">
  <div class="modal-dialog">
    <form id="formEdit" class="modal-content" method="post">
      <div class="modal-header">
        <h5 class="modal-title">Edit User</h5>
        <button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label>Nama Lengkap</label><input id="e-fullName" name="fullName" class="form-control" required></div>
        <div class="form-group"><label>Email</label><input id="e-email" name="email" type="email" class="form-control" required></div>
        <div class="form-group">
          <label>Role</label>
          <select id="e-roleId" name="roleId" class="form-control">
            <% roles.forEach(r=> { %>
              <option value="<%= r.id %>"><%= r.name %></option>
            <% }) %>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary">Update</button>
      </div>
    </form>
  </div>
</div>

<!-- Modal Reset Password -->
<div class="modal fade" id="modalReset" tabindex="-1">
  <div class="modal-dialog">
    <form id="formReset" class="modal-content" method="post">
      <div class="modal-header">
        <h5 class="modal-title">Reset Password</h5>
        <button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-warning small">
          Password akan diganti untuk user: <strong id="reset-name"></strong>
        </div>
        <div class="form-group"><label>Password Baru</label>
          <input id="reset-pass" name="newPassword" type="password" class="form-control" required minlength="6">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-warning">Reset</button>
      </div>
    </form>
  </div>
</div>

<script>
  $(function(){
    $('#tblUsers').DataTable({ pageLength: 10, lengthMenu: [10,25,50,100], order: [[0,'asc']] });

    // Isi modal Edit
    $(document).on('click', '.btn-edit', function(){
      const b = $(this);
      $('#formEdit').attr('action', '/users/' + b.data('id'));
      $('#e-fullName').val(b.data('name'));
      $('#e-email').val(b.data('email'));
      $('#e-roleId').val(b.data('roleid'));
    });

    // Isi modal Reset
    $(document).on('click', '.btn-reset', function(){
      const b = $(this);
      $('#formReset').attr('action', '/users/' + b.data('id') + '/reset-password');
      $('#reset-name').text(b.data('name'));
      $('#reset-pass').val('');
    });
  });
</script>
```

## `.env`

```
DATABASE_URL="file:./database.db"
SESSION_SECRET="kopdes-mp-bojo-secret8298"

# Seed admin (opsional)
SEED_ADMIN_EMAIL="admin@koperasi.local"
SEED_ADMIN_PASSWORD="admin123"
```

## `schema.prisma`

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
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
  id                   Int          @id @default(autoincrement())
  email                String       @unique
  passwordHash         String
  fullName             String
  roleId               Int
  role                 Role         @relation(fields: [roleId], references: [id], onUpdate: Cascade, onDelete: Restrict)
  isActive             Boolean      @default(true)
  sessions             Session[]
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt

  createdTransactions  Transaction[] @relation("TxCreatedBy")
  voidedTransactions   Transaction[] @relation("TxVoidedBy")
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
  phone         String?                 // ← HAPUS @db.VarChar(30)
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
  id            Int           @id @default(autoincrement())
  code          String        @unique
  memberId      Int
  member        Member        @relation(fields: [memberId], references: [id], onDelete: Restrict)
  category      TxCategory
  amount        Decimal                         // ← HAPUS @db.Decimal(18, 2)
  paidAt        DateTime
  paymentMethod PaymentMethod @default(CASH)
  note          String?

  status        TxStatus      @default(POSTED)
  voidReason    String?
  voidedAt      DateTime?
  voidedById    Int?
  voidedBy      User?         @relation("TxVoidedBy", fields: [voidedById], references: [id])

  createdById   Int
  createdBy     User          @relation("TxCreatedBy", fields: [createdById], references: [id])

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([memberId, category, status])
  @@index([paidAt])
  @@index([createdById])
  @@index([voidedById])
}

model MemberBalance {
  memberId     Int      @id
  wajibTotal   Decimal  @default(0)            // ← HAPUS @db.Decimal(18, 2)
  pokokTotal   Decimal  @default(0)            // ← HAPUS @db.Decimal(18, 2)
  updatedAt    DateTime @updatedAt

  member       Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
}
```

## `package.json`

```json
{
  "name": "kopdes-mp-bojo",
  "version": "1.0.0",
  "type": "module",
  "main": "src/server.js",
  "scripts": {
    "dev": "nodemon src/server.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev --name init",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:seed": "node prisma/seed.js",
    "prisma:reset": "prisma migrate reset --force"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "dependencies": {
    "@prisma/client": "^6.14.0",
    "bcrypt": "^6.0.0",
    "dayjs": "^1.11.13",
    "dotenv": "^17.2.1",
    "ejs": "^3.1.10",
    "express": "^5.1.0",
    "express-ejs-layouts": "^2.5.1",
    "express-session": "^1.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.10",
    "prisma": "^6.14.0"
  }
}
```

