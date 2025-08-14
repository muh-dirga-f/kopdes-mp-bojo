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
