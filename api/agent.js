const { redis, auth, send } = require('./_lib');

// POST /api/agent  (PC): đẩy số liệu, nhận lại các lệnh đang chờ
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const id = await auth(req, 'agent');
  if (!id) return send(res, 401, { error: 'unauthorized' });

  const s = (req.body || {}).stats || {};
  const n = (v) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(150, Math.round(v * 10) / 10)) : null);
  await redis.set(`state:${id}`, { cpu: n(s.cpu), ram: n(s.ram), gpu: n(s.gpu), tmp: n(s.tmp), ts: Date.now() }, { ex: 15 });

  const cmds = (await redis.lpop(`cmd:${id}`, 10)) || [];
  send(res, 200, { cmds });
};
