const store = require('../../utils/store');
const { navInfo } = require('../../utils/nav');

Page({
  data: {
    text: '', tag: '',
    releasing: false, cardOpacity: 1,
    ghost: { show: false, left: 0, top: 0, width: 0, transform: 'none', opacity: 1, blur: 0 },
    navTop: 88
  },
  onLoad() {
    const nav = navInfo();
    const draft = getApp().globalData.draft || { text: '', tag: '' };
    if (!draft.text) return wx.navigateBack();
    this.setData({ navTop: nav.navTop, text: draft.text, tag: draft.tag });
  },
  release() {
    if (this.data.releasing) return;
    this.setData({ releasing: true });

    // 先落库：星星的诞生不依赖动画
    const list = store.load();
    const id = Date.now();
    list.unshift({
      id, t: id, tag: this.data.tag, text: this.data.text,
      x: 8 + Math.random() * 78, y: 6 + Math.random() * 38
    });
    store.save(list, () => {});
    const g = getApp().globalData;
    g.freshId = id; g.justReleased = true; g.draft = { text: '', tag: '' };
    try { wx.removeStorageSync('tonight-write-draft'); } catch (e) {}

    // 释放动画：文字化作光点飞向夜空
    wx.createSelectorQuery().select('#quoteCard').boundingClientRect(rect => {
      if (!rect) return this.land(600);
      let win = { windowWidth: 375 };
      try { win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); } catch (e) {}
      const dx = win.windowWidth / 2 - (rect.left + rect.width / 2);
      const dy = -rect.top - 40;
      this.setData({ ghost: { show: true, left: rect.left, top: rect.top, width: rect.width, transform: 'none', opacity: 1, blur: 0 } });
      setTimeout(() => {
        this.setData({
          'ghost.transform': `translate(${dx}px, ${dy}px) scale(.02)`,
          'ghost.opacity': 1, 'ghost.blur': 3
        });
      }, 50);
      this.setData({ cardOpacity: 0 });
      this.land(2050);
    }).exec();
  },
  land(delay) {
    // 页面栈：星空 → 书写 → 放它走，退两层直接落回星空，由星空页展示「它已经到天上了」
    setTimeout(() => wx.navigateBack({ delta: 2 }), delay);
  },
  goBack() { wx.navigateBack(); }
});
