const cloud = require('wx-server-sdk');

async function checkText(text, openid) {
  try {
    await cloud.openapi.security.msgSecCheck({
      openid,
      scene: 3,
      version: 2,
      content: String(text).slice(0, 2500)
    });
    return { pass: true };
  } catch (e) {
    if (e && e.errCode === 87014) return { pass: false, code: 'RISKY' };
    console.error('msgSecCheck error', e);
    return { pass: false, code: 'CHECK_FAIL' };
  }
}

module.exports = { checkText };
