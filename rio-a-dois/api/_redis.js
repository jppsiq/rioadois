// Acesso ao Redis (Upstash, pelo Marketplace do Vercel) via REST, sem dependências.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmds) {
  const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

// Confere o código da viagem e a configuração do banco. Devolve true se pode seguir.
function guard(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) { res.status(500).json({ error: 'banco', msg: 'Banco de dados não conectado ao projeto.' }); return false; }
  if (!process.env.TRIP_KEY) { res.status(500).json({ error: 'chave', msg: 'Falta a variável TRIP_KEY no projeto.' }); return false; }
  const k = req.headers['x-trip-key'] || '';
  if (k !== process.env.TRIP_KEY) { res.status(401).json({ error: 'codigo', msg: 'Código da viagem incorreto.' }); return false; }
  return true;
}
function body(req) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }

module.exports = { redis, guard, body };
