// share.reply —— 接收方回复（设计文档 §4.3）
// 入: { shareId, text }
// 出: { ok: true }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const { enc } = require('./crypto');
const { checkText } = require('./util');
const { notifySender } = require('./notify');

exports.main = async (event) => {
  try {
    const id = String(event.shareId || '');
    const text = String(event.text || '').trim();
    if (!id || !text) return { code: 'BAD_PARAM', message: '参数不全' };
    if (text.length > 2000) return { code: 'BAD_PARAM', message: '太长了，分成几句说吧' };

    const { OPENID } = cloud.getWXContext();
    const doc = await db.collection('shares').doc(id).get().catch(() => null);
    if (!doc || !doc.data) return { code: 'GONE' };
    const s = doc.data;
    if (s.expireAt && s.expireAt < Date.now()) return { code: 'GONE' };
    if (s.status === 'replied') return { code: 'REPLIED', message: '这颗星已经有回音了' };

    // 1 对 1：发送方不能自己回，第一次打开的人被记为接收方，别人不能代回
    if (OPENID && s.from === OPENID) return { code: 'FORBID', message: '自己的星不用回音' };
    if (s.receiverOpenid && OPENID && s.receiverOpenid !== OPENID) {
      return { code: 'FORBID', message: '这颗星是送给别人的' };
    }

    const chk = await checkText(text, OPENID);
    if (!chk.pass) return chk.code === 'CHECK_FAIL'
      ? { code: 'CHECK_FAIL', message: '内容检测服务暂时不可用，稍后再试' }
      : { code: 'RISKY', message: '这句话里有些内容星星带不走，换种说法试试？' };

    const r = enc(text);
    await db.collection('shares').doc(id).update({
      data: {
        reply: r.v, replyEnc: r.enc, status: 'replied', repliedAt: Date.now(),
        receiverOpenid: s.receiverOpenid || OPENID || ''
      }
    });

    // 通知发送方「有回音了」（通知不带回复内容，只带入口）
    await notifySender('reply_arrival', id, s.from);
    return { code: 'OK', ok: true };
  } catch (e) {
    console.error('shareReply error', e);
    return { code: 'SYS', message: '服务器出了一会儿神，稍后再试' };
  }
};
