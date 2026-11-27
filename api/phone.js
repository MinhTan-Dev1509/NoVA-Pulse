const { redis, limit, auth, send } = require('./_lib');

const APPS = ['copilot', 'chatgpt', 'gemini', 'claude'];
const MEDIA = ['pp', 'next', 'prev', 'volup', 'voldown', 'mute'];

// GET /api/phone  -> số liệu mới nhất | POST /api/phone -> gửi lệnh (chỉ lệnh trong danh sách cho phép)
module.exports = async (req, res) => {
  const id = await auth(req, 'sess');
  if (!id) return send(res, 401, { error: 'unauthorized' });

  if (req.method === 'GET') {
    const state = await redis.get(`state:${id}`);
    return send(res, 200, { online: !!state, state });
  }
  if (req.method === 'POST') {
    if (!(await limit(req, 'cmd', 120, 60))) return send(res, 429, { error: 'Gửi lệnh quá nhanh' });
    const b = req.body || {};
    let cmd = null;
    if (b.type === 'media' && MEDIA.includes(b.action)) cmd = { type: 'media', action: b.action };
    else if (b.type === 'open' && APPS.includes(b.app)) cmd = { type: 'open', app: b.app };
    if (!cmd) return send(res, 400, { error: 'Lệnh không hợp lệ' });
    await redis.rpush(`cmd:${id}`, cmd);
    await redis.ltrim(`cmd:${id}`, -20, -1);
    await redis.expire(`cmd:${id}`, 60);
    return send(res, 200, { ok: true });
  }
  send(res, 405, { error: 'method not allowed' });
};
