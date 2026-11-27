const crypto = require('crypto');
const { redis, token, limit, auth, send } = require('./_lib');

// POST /api/pair?action=register | pin | claim
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const action = req.query.action;
  const body = req.body || {};

  // PC đăng ký lần đầu
  if (action === 'register') {
    if (!(await limit(req, 'reg', 5, 3600))) return send(res, 429, { error: 'Quá nhiều lần đăng ký' });
    const deviceId = 'd' + crypto.randomBytes(8).toString('hex');
    const agentToken = token();
    const name = String(body.name || 'PC').slice(0, 40);
    await redis.set(`agent:${agentToken}`, deviceId);
    await redis.set(`name:${deviceId}`, name);
    return send(res, 200, { deviceId, agentToken, name });
  }

  // PC xin mã PIN (6 số, dùng 1 lần, hết hạn sau 10 phút)
  if (action === 'pin') {
    const deviceId = await auth(req, 'agent');
    if (!deviceId) return send(res, 401, { error: 'unauthorized' });
    if (!(await limit(req, 'pin', 20, 3600))) return send(res, 429, { error: 'Xin PIN quá nhiều' });
    for (let i = 0; i < 5; i++) {
      const pin = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      if (await redis.set(`pin:${pin}`, deviceId, { nx: true, ex: 600 })) return send(res, 200, { pin, ttl: 600 });
    }
    return send(res, 503, { error: 'Thử lại' });
  }

  // Điện thoại nhập PIN -> nhận session token (30 ngày)
  if (action === 'claim') {
    if (!(await limit(req, 'claim', 10, 600))) return send(res, 429, { error: 'Thử quá nhiều lần, đợi 10 phút' });
    const pin = String(body.pin || '');
    if (!/^\d{6}$/.test(pin)) return send(res, 400, { error: 'PIN không hợp lệ' });
    const deviceId = await redis.getdel(`pin:${pin}`);
    if (!deviceId) return send(res, 404, { error: 'PIN sai hoặc đã hết hạn' });
    const sessionToken = token();
    await redis.set(`sess:${sessionToken}`, deviceId, { ex: 60 * 60 * 24 * 30 });
    return send(res, 200, { sessionToken, name: (await redis.get(`name:${deviceId}`)) || 'PC' });
  }

  send(res, 400, { error: 'unknown action' });
};
