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
