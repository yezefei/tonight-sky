// share.create —— 生成送星/晚安卡分享（设计文档 §4.1）
// 入: { type: 'star'|'card', payload: { text?|style+lineIdx? } }
// 出: { shareId, path }  path = pages/receive/receive?id=xxx
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const { enc } = require('./crypto');
const { checkText, shortId } = require('./util');

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const { type } = event;
    const payload = event.payload || {};
    if (!['star', 'card'].includes(type)) return { code: 'BAD_PARAM', message: 'type 不合法' };
    if (payload.text && String(payload.text).length > 2000) {
      return { code: 'BAD_PARAM', message: '太长了，分成几句说吧' };
    }

    // 内容安全（红线）：文本先过审再入库
    if (payload.text) {
      const chk = await checkText(payload.text, OPENID);
      if (!chk.pass) return chk.code === 'CHECK_FAIL'
        ? { code: 'CHECK_FAIL', message: '内容检测服务暂时不可用，稍后再试' }
        : { code: 'RISKY', message: '这句话里有些内容星星带不走，换种说法试试？' };
    }

    // 加密后入库
    if (payload.text) {
      const r = enc(payload.text);
      payload.text = r.v; payload.enc = r.enc;
    }

    const now = Date.now();
    // 8 位短 ID，撞库重试最多 5 次
    for (let i = 0; i < 5; i++) {
      const id = shortId(8);
      try {
        await db.collection('shares').add({
          data: {
            _id: id, type, from: OPENID, payload,
            reply: '', status: 'waiting', receiverOpenid: '',
            openedAt: 0, repliedAt: 0,
            createdAt: now, expireAt: now + 30 * 86400e3
          }
        });
        return { code: 'OK', shareId: id, path: `pages/receive/receive?id=${id}` };
      } catch (e) {
        if (i === 4) throw e; // 连续撞库，放弃
      }
    }
  } catch (e) {
    console.error('shareCreate error', e);
    return { code: 'SYS', message: '服务器出了一会儿神，稍后再试' };
  }
};
