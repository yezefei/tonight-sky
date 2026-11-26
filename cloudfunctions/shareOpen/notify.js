// 订阅消息触达（设计文档 §3.3 / §4.2 / §4.3）
// 一次授权发一条：从 subscriptions 表取一条授权记录，发完即删
// 模板 ID 走环境变量 TMPL_OPENED / TMPL_REPLY，未配置则静默跳过（先联调链路）
const cloud = require('wx-server-sdk');

async function notifySender(scene, shareId, toOpenid) {
  const tmpl = scene === 'star_opened' ? process.env.TMPL_OPENED : process.env.TMPL_REPLY;
  if (!tmpl || !toOpenid) return;
  try {
    const db = cloud.database();
    const sub = await db.collection('subscriptions')
      .where({ _openid: toOpenid, scene, shareId }).limit(1).get();
    if (!sub.data.length) return;

    // ⚠️ data 字段名必须与你在 mp 后台申请的订阅消息模板字段一致，按需改这里
    const data = scene === 'star_opened'
      ? { thing1: { value: '你送出的那颗星，被打开了。' } }
      : { thing1: { value: '你送出的那颗星，有回音了。' } };

    await cloud.openapi.subscribeMessage.send({
      touser: toOpenid,
      templateId: tmpl,
      page: 'pages/sky/sky',
      data,
      // developer / trial / formal，由云函数环境变量 MP_STATE 控制；默认 developer
      miniprogramState: process.env.MP_STATE || 'developer'
    });
    await db.collection('subscriptions').doc(sub.data[0]._id).remove();
  } catch (e) {
    console.error('notifySender error', scene, shareId, e);
  }
}

module.exports = { notifySender };
