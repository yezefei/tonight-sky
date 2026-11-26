// share.open —— 接收方打开分享（设计文档 §4.2）
// 入: { shareId }
// 出: { type, payload, status }；不存在/过期 → { code: 'GONE' }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const { decText } = require('./crypto');
const { notifySender } = require('./notify');

exports.main = async (event) => {
  try {
    const id = String(event.shareId || '');
    if (!id) return { code: 'BAD_PARAM', message: '缺 shareId' };

    const doc = await db.collection('shares').doc(id).get().catch(() => null);
    if (!doc || !doc.data) return { code: 'GONE' };
    const s = doc.data;
    if (s.expireAt && s.expireAt < Date.now()) {
      db.collection('shares').doc(id).remove().catch(() => {});
      return { code: 'GONE' };
    }

    // 发送者自己打开：只看内容/回音，不触发状态流转和通知
    const { OPENID } = cloud.getWXContext();
    const mine = OPENID && s.from === OPENID;

    // 发送方看到了回音：标记已读（replyCheck 不再下发，幂等、不阻塞返回）
    if (mine && s.status === 'replied' && !s.replySeen) {
      db.collection('shares').doc(id).update({ data: { replySeen: true } }).catch(() => {});
    }

    // 原子流转 waiting → opened（只生效一次，且仅接收方触发）
    let effStatus = s.status;
    if (!mine && s.status === 'waiting') {
      await db.collection('shares').where({ _id: id, status: 'waiting' })
        .update({ data: { status: 'opened', openedAt: Date.now(), receiverOpenid: OPENID || '' } });
      effStatus = 'opened';
      // 发送方订阅过「被打开了」就通知（通知不带内容，只带入口）
      await notifySender('star_opened', id, s.from);
    }

    return {
      code: 'OK',
      mine: !!mine,
      type: s.type,
      status: effStatus,
      payload: {
        text: s.payload && s.payload.text
          ? decText({ v: s.payload.text, enc: s.payload.enc })
          : '',
        tag: s.payload && s.payload.tag,
        style: s.payload && s.payload.style,
        lineIdx: s.payload && s.payload.lineIdx
      },
      replyText: s.reply ? decText({ v: s.reply, enc: s.replyEnc }) : '',
      ack: !!s.ack,
      createdAt: s.createdAt
    };
  } catch (e) {
    console.error('shareOpen error', e);
    return { code: 'SYS', message: '服务器出了一会儿神，稍后再试' };
  }
};
