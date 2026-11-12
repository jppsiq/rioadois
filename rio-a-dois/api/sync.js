// Sincronização dos registros (gastos, notas, presentes, status...): vale a versão mais nova.
const { redis, guard, body } = require('./_redis');

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const now = Date.now();
    let accepted = 0;
    if (req.method === 'POST') {
      const incoming = (body(req).records || []).filter(r => r && typeof r.id === 'string' && r.t).slice(0, 400);
      if (incoming.length) {
        const [existing] = await redis([['HMGET', 'rio:recs', ...incoming.map(r => r.id)]]);
        const cmds = [];
        incoming.forEach((r, i) => {
          const e = existing[i] ? JSON.parse(existing[i]) : null;
          if (!e || (r.atualizado_em || '') > (e.atualizado_em || '')) {
            cmds.push(['HSET', 'rio:recs', r.id, JSON.stringify(r)], ['ZADD', 'rio:idx', String(now), r.id]);
            accepted++;
          }
        });
        if (cmds.length) await redis(cmds);
      }
    }
    const since = Number((req.query && req.query.since) || 0);
    const [ids] = await redis([['ZRANGEBYSCORE', 'rio:idx', '(' + since, '+inf']]);
    let records = [];
    if (ids.length) {
      const [vals] = await redis([['HMGET', 'rio:recs', ...ids]]);
      records = vals.filter(Boolean).map(v => JSON.parse(v));
    }
    res.status(200).json({ now, accepted, records });
  } catch (e) {
    res.status(500).json({ error: 'falha', msg: String(e.message || e) });
  }
};
