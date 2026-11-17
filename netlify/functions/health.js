/**
 * Netlify Function — health check
 * Substitui GET /api/health do server.js no deploy estático.
 * Não usa SQLite nem disco gravável.
 */
exports.handler = async function health() {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({
      ok: true,
      service: 'prisma-gef',
      mode: 'netlify-functions',
      persistence: 'firebase-firestore',
      time: new Date().toISOString()
    })
  };
};
