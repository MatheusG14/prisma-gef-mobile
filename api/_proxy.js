// Proxy serverless da Vercel para o backend Prisma hospedado com disco persistente.
// Configure PRISMA_BACKEND_URL com a URL HTTPS do serviço Render (sem barra final).
module.exports = async function proxyPrismaApi(req, res) {
  const base = String(process.env.PRISMA_BACKEND_URL || '').trim().replace(/\/$/, '');
  if (!base) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({
      ok: false,
      error: 'Backend Prisma não configurado.',
      instruction: 'Defina PRISMA_BACKEND_URL nas variáveis de ambiente da Vercel.'
    }));
  }

  const path = req.url || '/api';
  const target = base + path;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (!value || ['host', 'connection', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  headers.set('x-forwarded-host', req.headers.host || '');
  headers.set('x-forwarded-proto', 'https');

  let body;
  if (!['GET', 'HEAD'].includes(String(req.method || 'GET').toUpperCase())) {
    if (Buffer.isBuffer(req.body)) body = req.body;
    else if (typeof req.body === 'string') body = req.body;
    else if (req.body !== undefined) {
      body = JSON.stringify(req.body);
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    } else if (req.rawBody) body = req.rawBody;
  }

  try {
    const upstream = await fetch(target, {
      method: req.method || 'GET', headers, body,
      redirect: 'manual', signal: AbortSignal.timeout(25000)
    });
    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (['transfer-encoding', 'content-encoding', 'content-length', 'connection'].includes(key.toLowerCase())) return;
      res.setHeader(key, value);
    });
    // Preserva cookies de sessão emitidos pelo backend.
    if (typeof upstream.headers.getSetCookie === 'function') {
      const cookies = upstream.headers.getSetCookie();
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
    }
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Length', String(payload.length));
    return res.end(payload);
  } catch (error) {
    console.error('[Prisma API proxy]', error);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({
      ok: false,
      error: 'Não foi possível conectar ao backend Prisma.',
      detail: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error)
    }));
  }
};
