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

    const res = await db.collection('shares')
      .where({ from: OPENID, status: 'replied', replySeen: _.neq(true) })
      .orderBy('repliedAt', 'desc')
      .limit(10)
      .get()
      .catch(() => null);

    const items = ((res && res.data) || []).map(s => ({
      shareId: s._id,
      replyText: s.reply ? decText({ v: s.reply, enc: s.replyEnc }) : '',
      repliedAt: s.repliedAt || 0
    }));
    return { code: 'OK', items };
  } catch (e) {
    console.error('replyCheck error', e);
    return { code: 'SYS', message: '服务器出了一会儿神，稍后再试' };
  }
};
