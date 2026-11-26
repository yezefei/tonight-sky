// 星志列表：按类型（心事/有回音/已翻篇）列出星星，支持删除、点卡片回星空定位
const store = require('../../utils/store');
const skyUtil = require('../../utils/sky');
const { navInfo } = require('../../utils/nav');

const TYPES = {
  all: {
    eyebrow: 'STAR LOG · ALL',
    title: '星 空',
    hint: '这片夜空里的所有星',
    empty: '夜空还空着。\n写下来的心事，都会变成星住进来。'
  },
  worry: {
    eyebrow: 'STAR LOG · IN ORBIT',
    title: '心 事',
    hint: '还在轨道上运行的心事',
    empty: '这一片轨道还空着。\n心里有事的时候，写下来，就会变成星。'
  },
  replied: {
    eyebrow: 'STAR LOG · ECHOED',
    title: '有 回 音',
    hint: '朋友回过音的星',
    empty: '还没有回音落回来。\n把一颗星送给朋友，再等一等。'
  },
  gold: {
    eyebrow: 'STAR LOG · TURNED GOLD',
    title: '已 翻 篇',
    hint: '镀了金、已经翻篇的星',
    empty: '还没有翻篇的星。\n翻开一颗星，对它说：这件事，翻篇了。'
  }
};

const PAGE = 15; // 每批渲染的卡片数：首屏轻快，滑到底再续下一批

// 纯本地统计：不上传、不进云同步
function statRange(list, from) {
  const items = (list || []).filter(r => (r.t || r.id) >= from);
  const counts = {};
  items.forEach(r => { if (r.tag) counts[r.tag] = (counts[r.tag] || 0) + 1; });
  const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || '';
  // 只陈述「写过几天」，不计算平均强度：情绪不打分
  const days = {};
  items.forEach(r => {
    const d = new Date(r.t || r.id);
    days[`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`] = 1;
  });
  return { count: items.length, top, days: Object.keys(days).length };
}

Page({
  data: {
    navTop: 88, capTop: 26, capH: 32,
    type: 'worry', meta: TYPES.worry,
    types: [
      { key: 'all', label: '全部' },
      { key: 'worry', label: '心事' },
      { key: 'replied', label: '有回音' },
      { key: 'gold', label: '已翻篇' }
    ],
    items: [], count: 0, hasMore: false,
    tags: [], tag: '',
    review: { week: { count: 0, top: '', days: 0 }, month: { count: 0, top: '', days: 0 } }
  },

  onLoad(options) {
    const nav = navInfo();
    let type = TYPES[options && options.type] ? options.type : 'worry';
    // 从今夜 tab 的图例切过来时，switchTab 不能带 query，走 globalData
    const fromHome = getApp().globalData.starsType;
    if (fromHome && TYPES[fromHome]) {
      type = fromHome;
      getApp().globalData.starsType = '';
    }
    this.setData({
      navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH,
      type, meta: TYPES[type]
    });
  },

  onShow() {
    // 同步自定义 tabBar 选中态
    if (typeof this.getTabBar === 'function') {
      const tb = this.getTabBar();
      if (tb) tb.setData({ selected: 1 });
    }
    this.build();
    // 列表页不会触发 App.onShow：自己拉一次回音，拿到后立刻重建，
    // 避免「明明收到回音，有回音列表却还是 0 颗」。
    const app = getApp();
    if (app && app.checkReplies) {
      app.checkReplies().then(() => { if (!this._unloaded) this.build(); });
    }
  },
  onUnload() { this._unloaded = true; },

  build() {
    const list = store.load();
    const d = new Date();
    const review = {
      week: statRange(list, Date.now() - 7 * 86400e3),
      month: statRange(list, new Date(d.getFullYear(), d.getMonth(), 1).getTime())
    };
    // 编号与星空页一致：按写下时间排序，最早的星是 01 号
    const seq = {};
    [...list].sort((a, b) => a.id - b.id).forEach((r, i) => { seq[r.id] = String(i + 1).padStart(2, '0'); });
    const pick = {
      all: () => true,
      worry: r => !r.done && !r.reply,
      // 翻过篇的星收到回音也要能找到：不再因为 done 把有回音的星过滤掉
      replied: r => !!r.reply,
      gold: r => !!r.done
    }[this.data.type];
    const all = list.filter(pick).sort((a, b) => b.id - a.id).map(r => {
      const d = new Date(r.t || r.id);
      const ok = !isNaN(d.getTime());
      return {
        id: r.id,
        idx: seq[r.id],
        text: r.text,
        tag: r.tag || '',
        mood: skyUtil.moodText(r),
        cls: r.done ? 'gold' : (r.reply ? 'replied' : 'worry'),
        meta: store.fmt(r.t || r.id) + (r.tag ? ' · ' + r.tag : ''),
        reply: r.reply || '',
        sent: !!r.sent,
        done: !!r.done,
        month: ok ? `${d.getFullYear()} 年 ${d.getMonth() + 1} 月` : '更 早'
      };
    });
    // 这一类型里出现过的标签，作为筛选器（按首次出现排序）
    const tags = [];
    all.forEach(it => { if (it.tag && tags.indexOf(it.tag) < 0) tags.push(it.tag); });
    this._allRaw = all;
    this.setData({ tags, review });
    this.applyFilter();
  },

  // 标签筛选 + 月份分组 + 分页
  applyFilter() {
    const tag = this.data.tag;
    const raw = this._allRaw || [];
    const filtered = (tag ? raw.filter(x => x.tag === tag) : raw).map(it => ({ ...it }));
    let last = '';
    filtered.forEach(it => {
      if (it.month !== last) { it.group = it.month; last = it.month; }
    });
    this._all = filtered;
    this.setData({
      items: filtered.slice(0, PAGE),
      count: filtered.length,
      hasMore: filtered.length > PAGE
    });
  },

  // 顶部类型页签：星空 tab 内直接切换，不必回今夜 tab
  pickType(e) {
    const v = e.currentTarget.dataset.v;
    if (!TYPES[v] || v === this.data.type) return;
    this.setData({ type: v, meta: TYPES[v], tag: '' });
    this.build();
  },

  pickTag(e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ tag: this.data.tag === v ? '' : v });
    this.applyFilter();
  },

  // 滑到底：续上下一批（100 条也只是一次次 15 张地展开）
  onReachBottom() {
    const all = this._all || [];
    const cur = this.data.items.length;
    if (cur >= all.length) return;
    const next = all.slice(0, cur + PAGE);
    this.setData({ items: next, hasMore: next.length < all.length });
  },

  goBack() { wx.navigateBack({ delta: 1 }); },

  // 点卡片：进入这颗星的详情页（弹窗只留给恒星环绕页）
  openStar(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/star/star?id=${id}` });
  },

  // 删除：本地删掉，星空页 onShow 重建时自动联动
  delStar(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这颗星？',
      content: '删除之后，就找不回来了。',
      confirmText: '删除',
      cancelText: '再留留',
      confirmColor: '#a87f7f',
      success: r => {
        if (!r.confirm) return;
        store.save(store.load().filter(x => x.id !== id), () => {});
        try { wx.vibrateShort({ type: 'light', fail: () => {} }); } catch (e) {}
        this.build();
      }
    });
  },

  noop() {}
});
