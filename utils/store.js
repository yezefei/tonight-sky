// 夜空数据：本地存储（二期云同步替换这里即可）
const KEY = 'tonight-sky-v1';

function load() {
  try {
    const v = wx.getStorageSync(KEY);
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}

let warned = false;
function save(list, onFail) {
  try {
    wx.setStorageSync(KEY, list);
  } catch (e) {
    if (!warned) {
      warned = true;
      if (onFail) onFail();
    }
  }
}

function fmt(t) {
  const d = new Date(t);
  if (isNaN(d.getTime())) return '一个深夜';
  const p = n => String(n).padStart(2, '0');
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

module.exports = { load, save, fmt };
