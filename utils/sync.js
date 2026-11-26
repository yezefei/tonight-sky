// 星星云同步：本地缓存 + 云端合并，默认关闭（用户在「数据与隐私」里开启）
const store = require('./store');
const cloudApi = require('./cloud');

const ENABLED_KEY = 'tonight-sync-enabled';
const LAST_KEY = 'tonight-sync-last';
const DEBOUNCE = 1500;

function enabled() {
  try { return !!wx.getStorageSync(ENABLED_KEY); } catch (e) { return false; }
}
function setEnabled(v) {
  try {
    wx.setStorageSync(ENABLED_KEY, !!v);
    if (!v) wx.removeStorageSync(LAST_KEY);
  } catch (e) {}
}
function lastAt() {
  try { return Number(wx.getStorageSync(LAST_KEY)) || 0; } catch (e) { return 0; }
}
function canSync() { return enabled() && cloudApi.ready(); }

let timer = null;
let running = false;

// 本地变更后的防抖同步；未开启或云不可用时静默跳过
function schedule(delay) {
  if (!canSync()) return;
  clearTimeout(timer);
  timer = setTimeout(() => { sync(); }, delay == null ? DEBOUNCE : delay);
}

// 服务端已经合并过一次；这里再按 updatedAt 合并，保护「同步过程中」产生的新本地改动
function merge(local, remote) {
  const map = {};
  (local || []).forEach(r => { map[r.id] = Object.assign({}, r); });
  (remote || []).forEach(r => {
    const cur = map[r.id];
    if (!cur || (r.updatedAt || 0) >= (cur.updatedAt || 0)) {
      map[r.id] = Object.assign({}, r); // 同时间以服务端为准
    }
  });
  return Object.keys(map).map(k => map[k]).sort((a, b) => a.id - b.id);
}

function sync() {
  if (!canSync() || running) return Promise.resolve(false);
  running = true;
  clearTimeout(timer);
  return Promise.resolve()
    .then(() => {
      store.purgeOld();
      const local = store.loadAll();
      return cloudApi.call('starsSync', { stars: local });
    })
    .then(res => {
      const merged = merge(store.loadAll(), res.stars || []);
      store.replaceAll(merged);
      wx.setStorageSync(LAST_KEY, Date.now());
      const app = getApp();
      if (app && app._syncKick) app._syncKick();
      return true;
    })
    .catch(err => {
      console.warn('云同步失败（本地数据不受影响）', err);
      return false;
    })
    .then(ok => { running = false; return ok; });
}

module.exports = { enabled, setEnabled, lastAt, canSync, schedule, sync, merge };
