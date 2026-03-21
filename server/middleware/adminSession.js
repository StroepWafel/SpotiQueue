function requireAdminSession(req, res, next) {
  if (req.session && req.session.adminAuthenticated === true) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized', authenticated: false });
}

module.exports = { requireAdminSession };
