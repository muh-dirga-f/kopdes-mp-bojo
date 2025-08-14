export function requireRole(...allowed) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) return res.redirect('/login');
    if (!allowed.includes(user.roleName)) return res.status(403).send('Forbidden');
    next();
  };
}
