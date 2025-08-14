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