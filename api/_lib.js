const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const token = () => crypto.randomBytes(32).toString('hex');
const ip = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer /, '');
const send = (res, code, body) => res.status(code).json(body);

// Giới hạn số lần gọi theo IP (chống dò PIN)
async function limit(req, name, max, windowSec) {
  const k = `rl:${name}:${ip(req)}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  return n <= max;
}

// prefix: 'agent' (token của PC) hoặc 'sess' (token của điện thoại) -> deviceId
async function auth(req, prefix) {
  const t = bearer(req);
  if (!/^[a-f0-9]{64}$/.test(t)) return null;
  return await redis.get(`${prefix}:${t}`);
}

module.exports = { redis, token, limit, auth, send };
