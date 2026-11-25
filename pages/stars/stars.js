// 星志列表：按类型（心事/有回音/已翻篇）列出星星，支持删除、点卡片回星空定位
const store = require('../../utils/store');
const { navInfo } = require('../../utils/nav');

const TYPES = {
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

Page({
  data: {
    navTop: 88, capTop: 26, capH: 32,
    type: 'worry', meta: TYPES.worry,
    items: [], count: 0, hasMore: false
  },

  onLoad(options) {
    const nav = navInfo();
    const type = TYPES[options && options.type] ? options.type : 'worry';
    this.setData({
      navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH,
      type, meta: TYPES[type]
    });
  },

  onShow() { this.build(); },

  build() {
    const list = store.load();
    // 编号与星空页一致：按写下时间排序，最早的星是 01 号
    const seq = {};
    [...list].sort((a, b) => a.id - b.id).forEach((r, i) => { seq[r.id] = String(i + 1).padStart(2, '0'); });
    const pick = {
      worry: r => !r.done && !r.reply,
      replied: r => !r.done && !!r.reply,
      gold: r => !!r.done
    }[this.data.type];
    const all = list.filter(pick).sort((a, b) => b.id - a.id).map(r => {
      const d = new Date(r.t || r.id);
      const ok = !isNaN(d.getTime());
      return {
        id: r.id,
        idx: seq[r.id],
        text: r.text,
        meta: store.fmt(r.t || r.id) + (r.tag ? ' · ' + r.tag : ''),
        reply: r.reply || '',
        sent: !!r.sent,
        done: !!r.done,
        month: ok ? `${d.getFullYear()} 年 ${d.getMonth() + 1} 月` : '更 早'
      };
    });
    // 月份分组：每组第一张卡片带 group 字段，渲染成分组标题
    let last = '';
    all.forEach(it => { if (it.month !== last) { it.group = it.month; last = it.month; } });
    this._all = all;
    this.setData({
      items: all.slice(0, PAGE),
      count: all.length,
      hasMore: all.length > PAGE
    });
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

  // 点卡片：回到星空，直接展开这颗星
  openStar(e) {
    const id = e.currentTarget.dataset.id;
    getApp().globalData.openStarId = id;
    wx.navigateBack({ delta: 1 });
  },

  // 熄灭（删除）：本地删掉，星空页 onShow 重建时自动联动
  delStar(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '让这颗星熄灭？',
      content: '熄灭之后，就找不回来了。',
      confirmText: '熄灭',
      cancelText: '再留留',
      confirmColor: '#a87f7f',
      success: r => {
        if (!r.confirm) return;
        store.save(store.load().filter(x => x.id !== id), () => {});
        wx.vibrateShort({ type: 'light' }).catch(() => {});
        this.build();
      }
    });
  },

  noop() {}
});
