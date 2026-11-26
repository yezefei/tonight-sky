// 「我的」tab：只放常规的个人内容与入口。同步 / 导出 / 清空 / 提醒已收进「隐私与数据」。
const { navInfo } = require('../../utils/nav');
const store = require('../../utils/store');

function dayKey(t) {
  const d = new Date(t || 0);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

Page({
  data: {
    navTop: 88, capTop: 26, capH: 32,
    total: 0, goldCount: 0, repliedCount: 0, monthDays: 0
  },

  onLoad() {
    const nav = navInfo();
    this.setData({ navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH });
    this.refresh();
  },

  onShow() {
    // 同步自定义 tabBar 选中态
    if (typeof this.getTabBar === 'function') {
      const tb = this.getTabBar();
      if (tb) tb.setData({ selected: 2 });
    }
    this.refresh();
  },

  refresh() {
    const list = store.load();
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
    const days = {};
    list.forEach(r => {
      const k = dayKey(r.t || r.id);
      if (k && k.indexOf(prefix) === 0) days[k] = 1;
    });
    this.setData({
      total: list.length,
      goldCount: list.filter(r => r.done).length,
      repliedCount: list.filter(r => r.reply).length,
      monthDays: Object.keys(days).length
    });
  },

  goCalendar() { wx.navigateTo({ url: '/pages/calendar/calendar' }); },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); }
});
