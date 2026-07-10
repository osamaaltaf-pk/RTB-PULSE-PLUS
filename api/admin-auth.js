const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({
      ok: false,
      error: 'Server not configured: set ADMIN_PASSWORD in your Vercel project env vars.'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const password = String((body && body.password) || '');

  const a = Buffer.from(password);
  const b = Buffer.from(String(adminPassword));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (ok) return res.status(200).json({ ok: true });
  return res.status(401).json({ ok: false, error: 'Incorrect password.' });
};
