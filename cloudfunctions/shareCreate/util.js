// 共享小工具：短 ID + 内容安全检测
const cloud = require('wx-server-sdk');

// Crockford base32（去掉易混淆字符 i/l/o/u）
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
function shortId(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * 32)];
  return s;
}

// 微信内容安全检测（文本）。返回 { pass } 或 { pass:false, code }
async function checkText(text, openid) {
  try {
    await cloud.openapi.security.msgSecCheck({
      openid,
      scene: 3,               // 社交场景
      version: 2,
      content: String(text).slice(0, 2500)
    });
    return { pass: true };
  } catch (e) {
    if (e && e.errCode === 87014) return { pass: false, code: 'RISKY' }; // 命中违规
    console.error('msgSecCheck error', e);
    return { pass: false, code: 'CHECK_FAIL' }; // 接口异常，宁拦不放
  }
}

module.exports = { shortId, checkText };
