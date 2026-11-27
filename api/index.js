const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const FLARE = process.env.FLARESOLVERR_URL || 'http://161.97.175.212:8191/v1';

function injectBase(html, url) {
  const base = `<base href="${url}">`;
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => m + base)
    : base + html;
}

async function viaFlare(url) {
  const r = await fetch(FLARE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'request.get', url, maxTimeout: 45000 }),
  });
  const j = await r.json();
  if (j.status !== 'ok') throw new Error(j.message || 'FlareSolverr failed');
  return j.solution; // { url, status, response, userAgent, cookies, headers }
}

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

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // 1) محاولة مباشرة
    const r = await fetch(u.href, {
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
        Referer: u.origin + '/',
      },
    });

    const blocked = [403, 429, 503].includes(r.status);

    // 2) إذا انحظر وفيه FlareSolverr، نمرر الطلب عليه
    if (blocked && FLARE) {
      const s = await viaFlare(u.href);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(s.status || 200).send(injectBase(s.response, s.url || u.href));
    }

    const ct = r.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', ct);

    if (ct.includes('text/html')) {
      const html = await r.text();
      return res.status(r.status).send(injectBase(html, r.url));
    }

    return res.status(r.status).send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    return res.status(502).send('Fetch error: ' + e.message);
  }
}
