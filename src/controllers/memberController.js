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