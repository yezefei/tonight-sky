// reply.check —— 发送方拉取「未读回音」列表（App 切前台时调用）
// 入: 无（从上下文取 OPENID）
// 出: { items: [{ shareId, replyText, repliedAt }] }，仅返回 replySeen != true 的
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const { decText } = require('./crypto');

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return { code: 'OK', items: [] };

    // 机会式清理：前台轮询时顺手删掉自己名下已过期的分享（每次最多 20 条）
    await db.collection('shares')
      .where({ from: OPENID, expireAt: _.lt(Date.now()) })
      .limit(20).remove().catch(() => {});

    const res = await db.collection('shares')
      .where({ from: OPENID, status: 'replied', replySeen: _.neq(true) })
      .orderBy('repliedAt', 'desc')
      .limit(10)
      .get()
      .catch(() => null);

    const items = ((res && res.data) || []).map(s => {
      // 单条解密失败（比如环境变量没配）不拖垮整个列表：先放出去，内容置空
      let replyText = '';
      try {
        replyText = s.reply ? decText({ v: s.reply, enc: s.replyEnc }) : '';
      } catch (e) {
        console.error('replyCheck decrypt fail', s._id, e);
      }
      return { shareId: s._id, replyText, repliedAt: s.repliedAt || 0 };
    });

    // 顺带带出「对方已打开、还没回」的分享：让发送方看到「回音在路上」
    const openedRes = await db.collection('shares')
      .where({ from: OPENID, status: 'opened' })
      .orderBy('openedAt', 'desc')
      .limit(20)
      .get()
      .catch(() => null);
    ((openedRes && openedRes.data) || []).forEach(s => {
      items.push({ shareId: s._id, opened: true, openedAt: s.openedAt || 0 });
    });

    return { code: 'OK', items };
  } catch (e) {
    console.error('replyCheck error', e);
    return { code: 'SYS', message: '服务器出了一会儿神，稍后再试' };
  }
};
