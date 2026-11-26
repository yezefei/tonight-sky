// 心情日历：按本机记录回看每天写过什么。
// 设计约束：不做打卡、不做连续天数、不评价情绪好坏；颜色只映射用户自己选过的心情词。
const { navInfo } = require('../../utils/nav');
const store = require('../../utils/store');

const WEEK = ['一', '二', '三', '四', '五', '六', '日'];
const BRIGHT = { '平静': 1, '开心': 1, '兴奋': 1, '安心': 1 };
const COOL = { '累': 1, '烦': 1, '委屈': 1, '失望': 1, '空': 1 };

function pad(n) { return String(n).padStart(2, '0'); }
function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function timeOf(r) {
  const d = new Date(r.t || r.id || 0);
  return isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function moodClass(items) {
  // 一天可能写多条；取第一条有心情词的记录作为这一天的颜色，只作回看提示
  for (let i = 0; i < items.length; i++) {
    const e = items[i].emotion;
    if (BRIGHT[e]) return 'warm';
    if (COOL[e]) return 'cool';
  }
  return 'plain';
}

function topCount(map, limit) {
  return Object.keys(map)
    .map(k => ({ name: k, n: map[k] }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'zh'))
    .slice(0, limit);
}

Page({
  data: {
    navTop: 88, capTop: 26, capH: 32,
    year: 0, month: 0, label: '',
    week: WEEK, days: [],
    canNext: false,
    monthDays: 0, monthStars: 0, moodStats: [], tagStats: [],
    selectedKey: '', selectedLabel: '', selectedItems: []
  },

  onLoad() {
    const nav = navInfo();
    const now = new Date();
    this.setData({
      navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH,
      year: now.getFullYear(), month: now.getMonth() + 1
    });
    this.build();
  },

  onShow() { this.build(); },

  build() {
    const { year, month } = this.data;
    const list = store.load();

    // 按本机日期归组；t / id 都可能是历史时间戳
    const byDay = {};
    const moodMap = {};
    const tagMap = {};
    let monthStars = 0;
    list.forEach(r => {
      const d = new Date(r.t || r.id || 0);
      if (isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() + 1 !== month) return;
      const key = dayKey(d);
      (byDay[key] = byDay[key] || []).push(r);
      monthStars++;
      if (r.emotion) moodMap[r.emotion] = (moodMap[r.emotion] || 0) + 1;
      if (r.tag) tagMap[r.tag] = (tagMap[r.tag] || 0) + 1;
    });

    // 周一开头的固定网格；多出的格子留空，不显示别的月份，避免误读
    const first = new Date(year, month - 1, 1);
    const offset = (first.getDay() + 6) % 7;
    const total = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push({ blank: true, key: 'b' + i });
    for (let n = 1; n <= total; n++) {
      const d = new Date(year, month - 1, n);
      const key = dayKey(d);
      const items = byDay[key] || [];
      const isToday = key === dayKey(new Date());
      cells.push({
        key,
        blank: false,
        day: n,
        count: items.length,
        cls: (items.length ? moodClass(items) : '') + (isToday ? ' today' : '')
      });
    }

    const moodStats = topCount(moodMap, 3).map(x => Object.assign(x, {
      pct: Math.round(x.n / Math.max(1, monthStars) * 100)
    }));
    const tagStats = topCount(tagMap, 3);
    const now = new Date();
    const canNext = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);

    this.setData({
      label: `${year} 年 ${month} 月`,
      days: cells,
      canNext,
      monthDays: Object.keys(byDay).length,
      monthStars,
      moodStats,
      tagStats
    });

    // 选中日期在切月后失效时，清掉详情
    if (this.data.selectedKey && !byDay[this.data.selectedKey]) {
      this.setData({ selectedKey: '', selectedLabel: '', selectedItems: [] });
    }
  },

  prevMonth() {
    let y = this.data.year, m = this.data.month - 1;
    if (m < 1) { y--; m = 12; }
    this.setData({ year: y, month: m, selectedKey: '', selectedLabel: '', selectedItems: [] });
    this.build();
  },

  nextMonth() {
    if (!this.data.canNext) return;
    let y = this.data.year, m = this.data.month + 1;
    if (m > 12) { y++; m = 1; }
    this.setData({ year: y, month: m, selectedKey: '', selectedLabel: '', selectedItems: [] });
    this.build();
  },

  selectDay(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const list = store.load().filter(r => {
      const d = new Date(r.t || r.id || 0);
      return !isNaN(d.getTime()) && dayKey(d) === key;
    }).sort((a, b) => (a.t || a.id) - (b.t || b.id));
    const d = new Date(key + 'T00:00:00');
    this.setData({
      selectedKey: key,
      selectedLabel: isNaN(d.getTime()) ? key : `${d.getMonth() + 1} 月 ${d.getDate()} 日`,
      selectedItems: list.map(r => ({
        id: r.id,
        time: timeOf(r),
        tag: r.tag || '',
        emotion: r.emotion || '',
        intensity: r.intensity || '',
        text: (r.text || '').length > 80 ? (r.text || '').slice(0, 80) + '…' : (r.text || ''),
        done: !!r.done
      }))
    });
  },

  openStar(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/star/star?id=${id}` });
  },

  goBack() { wx.navigateBack(); }
});
