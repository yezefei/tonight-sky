// stars.sync —— 星星云同步（设计文档 §4.6）
// 入: { stars: [{ id, updatedAt, deletedAt?, text, tag, ... }] }
// 出: { code: 'OK', stars: [...] }；以 id 为主键、updatedAt 新者胜，删除用墓碑保留 30 天
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const { enc, dec } = require('./crypto');
const SIMPLE_FIELDS = ['tag', 'x', 'y', 'done', 'sent', 'shareId', 'opened', 'ack', 'snoozed', 'received'];
const MAX_STARS = 1000;
const TOMBSTONE_TTL = 30 * 86400e3;

function encField(v) { return v ? enc(String(v)) : { v: '', enc: false }; }
function decField(v) { return v && v.v !== undefined ? dec(v) : (v || ''); }
function encMore(more) {
  return (Array.isArray(more) ? more : []).map(m => ({
    t: Number(m.t) || 0,
    text: encField(m.text)
  }));
}
function decMore(more) {
  return (Array.isArray(more) ? more : []).map(m => ({
    t: m.t || 0,
    text: decField(m.text)
  }));
}

function toDoc(s, openid) {
  const id = Number(s && s.id);
  if (!isFinite(id)) return null;
  const doc = {
    _openid: openid,
    id,
    updatedAt: Number(s.updatedAt) || Number(s.t) || id || 0
  };
  if (s.deletedAt) doc.deletedAt = Number(s.deletedAt);
  SIMPLE_FIELDS.forEach(k => { if (s[k] !== undefined) doc[k] = s[k]; });
  doc.text = encField(s.text);
  doc.reply = encField(s.reply);
  doc.more = encMore(s.more);
  return doc;
}

function toClient(d) {
  const o = Object.assign({}, d);
  delete o._openid;
  o.text = decField(d.text);
  o.reply = decField(d.reply);
  o.more = decMore(d.more);
  return o;
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return { code: 'FORBID', message: '请先登录' };

    const incoming = Array.isArray(event.stars) ? event.stars.slice(0, MAX_STARS) : [];
    const docs = incoming.map(s => toDoc(s, OPENID)).filter(Boolean);

    if (docs.length) {
      const ids = docs.map(d => d.id);
      const existRes = await db.collection('stars')
        .where({ _openid: OPENID, id: _.in(ids) })
        .limit(MAX_STARS).get().catch(() => ({ data: [] }));
      const existMap = {};
      (existRes.data || []).forEach(d => { existMap[d.id] = d; });

      for (const doc of docs) {
        const old = existMap[doc.id];
        if (old && (Number(old.updatedAt) || 0) > doc.updatedAt) continue; // 服务端更新，丢弃旧版本
        const data = Object.assign({}, doc);
        delete data._openid;
        delete data.id;
        if (old) {
          await db.collection('stars').doc(old._id).update({ data });
        } else {
          await db.collection('stars').add({ data: doc });
        }
      }
    }

    // 墓碑满 30 天物理删除
    await db.collection('stars')
      .where({ _openid: OPENID, deletedAt: _.lt(Date.now() - TOMBSTONE_TTL) })
      .remove().catch(() => {});

    const all = await db.collection('stars')
      .where({ _openid: OPENID })
      .limit(MAX_STARS).get().catch(() => ({ data: [] }));

    return { code: 'OK', stars: (all.data || []).map(toClient) };
  } catch (e) {
    console.error('starsSync error', e);
    return { code: 'SYS', message: '同步暂时不可用，本地数据已保留' };
  }
};
