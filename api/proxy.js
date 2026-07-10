module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ __proxyError: 'Method not allowed' });
  }

  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ __proxyError: 'Missing url parameter' });
  }

  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ __proxyError: 'Invalid url' });
  }

  if (target.protocol !== 'https:') {
    return res.status(400).json({ __proxyError: 'Only https URLs are allowed' });
  }

  // Allowlist of hosts this proxy is permitted to reach — prevents the
  // endpoint from being abused as an open proxy / SSRF vector.
  // Add more hosts (comma-separated) via the PROXY_ALLOWED_HOSTS env var
  // if you ever add routes on a different domain than rtb.moja.cloud.
  const allowedHosts = (process.env.PROXY_ALLOWED_HOSTS || 'rtb.moja.cloud')
    .split(',')
    .map(h => h.trim())
    .filter(Boolean);

  if (!allowedHosts.includes(target.hostname)) {
    return res.status(403).json({
      __proxyError: `Host "${target.hostname}" is not in the allowed list. Add it to PROXY_ALLOWED_HOSTS in Vercel env vars if this is expected.`
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const upstream = await fetch(target.toString(), { signal: controller.signal });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    res.status(200).json(data);
  } catch (e) {
    const message = e.name === 'AbortError' ? 'Upstream request timed out after 15s' : e.message;
    res.status(502).json({ __proxyError: message });
  } finally {
    clearTimeout(timeout);
  }
};
