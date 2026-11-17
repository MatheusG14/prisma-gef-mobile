/**
 * GET /api/status — saúde da camada Vercel + sondagem do backend Render (/api/health).
 * 200 = frontend e backend OK; 503 = backend ausente/indisponível.
 */
module.exports = async function status(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const base = String(process.env.PRISMA_BACKEND_URL || '').trim().replace(/\/$/, '');
  const out = { ok: false, vercel: true, backendConfigured: Boolean(base), backend: null };
  if (!base) { res.statusCode = 503; return res.end(JSON.stringify(out)); }
  try {
    const r = await fetch(base + '/api/health', { signal: AbortSignal.timeout(10000) });
    out.backend = { status: r.status };
    try { const j = await r.json(); out.backend.databaseOk = j.databaseOk; out.backend.schemaVersion = j.schemaVersion; } catch (_) {}
    out.ok = r.ok;
    res.statusCode = r.ok ? 200 : 503;
  } catch (e) {
    out.backend = { error: 'inacessível' };
    res.statusCode = 503;
  }
  res.end(JSON.stringify(out));
};
