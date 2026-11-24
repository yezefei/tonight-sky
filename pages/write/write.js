const skyUtil = require('../../utils/sky');
const { navInfo } = require('../../utils/nav');

Page({
  data: {
    text: '', tag: '', canDone: false, focus: false,
    chips: ['工作', '感情', '金钱', '家庭', '未来', '说不清'],
    navTop: 88, capTop: 26, capH: 32
  },
  onLoad() {
    const nav = navInfo();
    const draft = getApp().globalData.draft || {};
    this.setData({
      navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH,
      text: draft.text || '', tag: draft.tag || '',
      canDone: !!(draft.text || '').trim(), focus: true
    });
  },
  onInput(e) {
    this.setData({ text: e.detail.value, canDone: !!e.detail.value.trim() });
  },
  useStarter() {
    const text = skyUtil.starter();
    this.setData({ text, canDone: true, focus: true });
  },
  pickChip(e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ tag: this.data.tag === v ? '' : v });
  },
  done() {
    if (!this.data.canDone) return;
    getApp().globalData.draft = { text: this.data.text.trim(), tag: this.data.tag };
    wx.navigateTo({ url: '/pages/echo/echo' });
  },
  goCalm() { wx.navigateTo({ url: '/pages/calm/calm' }); },
  goBack() { wx.navigateBack(); }
});
