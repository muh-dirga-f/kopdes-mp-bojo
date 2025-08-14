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
