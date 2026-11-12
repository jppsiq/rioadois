// Anexos (fotos, recibos, vouchers) guardados uma vez, por id.
const { redis, guard, body } = require('./_redis');

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  try {
    if (req.method === 'POST') {
      const { id, type, data } = body(req);
      if (!id || !data || data.length > 4_000_000) return res.status(400).json({ error: 'anexo' });
      await redis([['SET', 'rio:blob:' + id, JSON.stringify({ type, data }), 'NX']]);
      return res.status(200).json({ ok: true });
    }
    const id = req.query && req.query.id;
    const [v] = await redis([['GET', 'rio:blob:' + id]]);
    if (!v) return res.status(404).json({ error: 'nao-encontrado' });
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.status(200).send(v);
  } catch (e) {
    res.status(500).json({ error: 'falha', msg: String(e.message || e) });
  }
};
