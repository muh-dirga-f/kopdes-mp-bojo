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

