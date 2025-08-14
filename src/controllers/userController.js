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