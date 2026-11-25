// share.ack —— 发送方收到回音后，回一个「我收到了」（设计文档 §4 回音闭环）
// 入: { shareId }
// 出: { ok: true }；仅分享的所有者可回执，仅 replied 状态可回执（幂等）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const id = String(event.shareId || '');
    if (!id) return { code: 'BAD_PARAM', message: '缺 shareId' };

    const doc = await db.collection('shares').doc(id).get().catch(() => null);
    if (!doc || !doc.data) return { code: 'GONE' };
    const s = doc.data;

    const { OPENID } = cloud.getWXContext();
    if (!OPENID || s.from !== OPENID) return { code: 'FORBID', message: '这不是你的星' };
    if (s.status !== 'replied') return { code: 'BAD_STATE', message: '还没有回音可以收' };
    if (s.ack) return { code: 'OK', ok: true };

    await db.collection('shares').doc(id).update({
      data: { ack: true, ackAt: Date.now() }
    });
    return { code: 'OK', ok: true };
  } catch (e) {
    console.error('shareAck error', e);
    return { code: 'SYS', message: '服务器出了一会儿神，稍后再试' };
  }
};
