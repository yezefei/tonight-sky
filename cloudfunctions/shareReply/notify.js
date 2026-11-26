// 与 shareOpen/notify.js 同一份逻辑
const cloud = require('wx-server-sdk');

async function notifySender(scene, shareId, toOpenid) {
  const tmpl = scene === 'star_opened' ? process.env.TMPL_OPENED : process.env.TMPL_REPLY;
  if (!tmpl || !toOpenid) return;
  try {
    const db = cloud.database();
    const sub = await db.collection('subscriptions')
      .where({ _openid: toOpenid, scene, shareId }).limit(1).get();
    if (!sub.data.length) return;

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
