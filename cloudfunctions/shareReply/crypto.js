// 与 shareCreate/crypto.js 同一份逻辑：密钥 CONTENT_KEY 在环境变量
const crypto = require('crypto');
const KEY = process.env.CONTENT_KEY || '';

function keyBuf() { return crypto.createHash('sha256').update(KEY).digest(); }

function enc(text) {
  if (!KEY || !text) return { v: text || '', enc: false };
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keyBuf(), iv);
  const data = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return { v: Buffer.concat([iv, c.getAuthTag(), data]).toString('base64'), enc: true };
}

module.exports = { enc };
