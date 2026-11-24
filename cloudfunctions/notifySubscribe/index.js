// notify.subscribe —— 登记一次订阅消息授权（设计文档 §4.4）
// 入: { scene: 'reply_arrival'|'star_opened'|'revisit', shareId? }
// 出: { ok: true }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const scene = String(event.scene || '');
    if (!['reply_arrival', 'star_opened', 'revisit'].includes(scene)) {
      return { code: 'BAD_PARAM', message: 'scene 不合法' };
    }
    await db.collection('subscriptions').add({
      data: { _openid: OPENID, scene, shareId: String(event.shareId || ''), createdAt: Date.now() }
    });
    return { code: 'OK', ok: true };
  } catch (e) {
    console.error('notifySubscribe error', e);
    return { code: 'SYS', message: '服务器出了一会儿神，稍后再试' };
  }
};
