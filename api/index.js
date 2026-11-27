export default async function handler(req, res) {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing ?url=');

  let u;
  try {
    u = new URL(target);
    if (!/^https?:$/.test(u.protocol)) throw new Error();
  } catch {
    return res.status(400).send('Invalid url');
  }

  try {
    const r = await fetch(u.href, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
        'Referer': u.origin + '/',
      },
    });

    const ct = r.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (ct.includes('text/html')) {
      let html = await r.text();
      const base = `<base href="${r.url}">`;
      html = /<head[^>]*>/i.test(html)
        ? html.replace(/<head[^>]*>/i, (m) => m + base)
        : base + html;
      return res.status(r.status).send(html);
    }

    const buf = Buffer.from(await r.arrayBuffer());
    return res.status(r.status).send(buf);
  } catch (e) {
    return res.status(502).send('Fetch error: ' + e.message);
  }
}
