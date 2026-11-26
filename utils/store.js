// 夜空数据：本地存储 + 云同步所需元数据（updatedAt / deletedAt 墓碑）
const KEY = 'tonight-sky-v1';
const TOMBSTONE_TTL = 30 * 86400e3;

function rawAll() {
  try {
    const v = wx.getStorageSync(KEY);
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}

// 对外：全部记录（含墓碑），兼容历史数据缺 updatedAt 的情况
function loadAll() {
  return rawAll().map(r => Object.assign({}, r, {
    updatedAt: r.updatedAt || r.t || r.id || 0
  }));
}

// 对外：UI 只关心活着的星星
function load() {
  return loadAll().filter(r => !r.deletedAt);
}

let warned = false;
function writeRaw(list, onFail) {
  try {
    wx.setStorageSync(KEY, list);
  } catch (e) {
    if (!warned) {
      warned = true;
      if (onFail) onFail();
    }
  }
}

// 比较时忽略同步元数据，避免无意义地刷新 updatedAt
function fingerprint(r) {
  const o = {};
  Object.keys(r || {}).filter(k => k !== 'updatedAt' && k !== 'deletedAt').sort()
    .forEach(k => { o[k] = r[k]; });
  return JSON.stringify(o);
}

// 页面照常传「活着的星星列表」进来；这里自动补 updatedAt 并把删掉的记成墓碑
function save(list, onFail) {
  const prev = loadAll();
  const prevMap = {};
  prev.forEach(x => { prevMap[x.id] = x; });
  const now = Date.now();

  const next = (list || []).map(r => {
    const p = prevMap[r.id];
    const out = Object.assign({}, r);
    out.updatedAt = (!p || fingerprint(p) !== fingerprint(r))
      ? now
      : (p.updatedAt || r.updatedAt || r.t || r.id || now);
    delete out.deletedAt;
    return out;
  });

  const liveIds = {};
  next.forEach(x => { liveIds[x.id] = true; });
  prev.forEach(p => {
    if (p.deletedAt) {
      next.push(p); // 已有墓碑继续保留，等同步后统一过期清理
    } else if (!liveIds[p.id]) {
      next.push({ id: p.id, updatedAt: now, deletedAt: now });
    }
  });

  writeRaw(next, onFail);
  scheduleSync();
}

// 云同步合并结果直接落库，不再触发同步（避免回环）
function replaceAll(all) {
  const map = {};
  (all || []).forEach(r => {
    const cur = map[r.id];
    if (!cur || (r.updatedAt || 0) >= (cur.updatedAt || 0)) map[r.id] = r;
  });
  writeRaw(Object.keys(map).map(k => map[k]).sort((a, b) => a.id - b.id));
}

function purgeOld() {
  const cutoff = Date.now() - TOMBSTONE_TTL;
  writeRaw(rawAll().filter(r => !r.deletedAt || r.deletedAt > cutoff));
}

function clear() {
  try {
    [
      KEY,
      'tonight-write-draft',
      'tonight-reply-announced',
      'tonight-vip',
      'tonight-sync-enabled',
      'tonight-sync-last'
    ].forEach(k => wx.removeStorageSync(k));
  } catch (e) {}
}

// 延迟触发同步：放在这里让所有页面现有 store.save 调用自动具备同步能力
function scheduleSync() {
  try { require('./sync').schedule(); } catch (e) {}
}

function fmt(t) {
  const d = new Date(t);
  if (isNaN(d.getTime())) return '一个深夜';
  const p = n => String(n).padStart(2, '0');
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

module.exports = { load, loadAll, save, replaceAll, purgeOld, clear, fmt };
