module.exports = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  const expected = process.env.ADMIN_KEY;

  if (!expected) {
    // If ADMIN_KEY not set, allow (dev mode)
    return next();
  }

  if (key !== expected) {
    return res.status(403).json({ message: 'Forbidden: invalid admin key' });
  }

  next();
};