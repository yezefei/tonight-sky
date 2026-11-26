// 心事/回复的服务端加密（AES-256-GCM，设计文档 §6.2）
// 密钥放云函数环境变量 CONTENT_KEY；未配置时直接报错（fail closed），不再明文落库
const crypto = require('crypto');
const KEY = process.env.CONTENT_KEY || '';

function keyBuf() {
  if (!KEY) throw new Error('CONTENT_KEY 未配置：请在云函数环境变量中设置后再部署');
  return crypto.createHash('sha256').update(KEY).digest();
}

function enc(text) {
  if (!text) return { v: '', enc: false };
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keyBuf(), iv);
  const data = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return { v: Buffer.concat([iv, tag, data]).toString('base64'), enc: true };
}

function dec(payload) {
  if (!payload) return '';
  // 兼容历史明文记录；新写入一律加密
  if (!payload.enc) return payload.v || '';
  const buf = Buffer.from(payload.v, 'base64');
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), data = buf.subarray(28);
  const d = crypto.createDecipheriv('aes-256-gcm', keyBuf(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

// 兼容不同云函数里的旧别名：历史代码用 decText 解密，实际就是 dec
module.exports = { enc, dec, decText: dec };
