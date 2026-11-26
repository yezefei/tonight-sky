const store = require('../../utils/store');
const cloudApi = require('../../utils/cloud');
const { navInfo } = require('../../utils/nav');

// 收星页：朋友通过分享卡片进入 pages/receive/receive?id=xxx
Page({
  data: {
    navTop: 88,
    phase: 'loading',   // loading | star | gone | error | thanked
    mine: false, kept: false,
    text: '', tag: '', replyText: '',
    reply: '', canReply: false, sending: false, toast: ''
  },
  toastTimer: null,

  onLoad(options) {
    const nav = navInfo();
    this.setData({ navTop: nav.navTop });
    this.id = options && options.id ? String(options.id) : '';
    if (!this.id) return this.setData({ phase: 'gone' });
    this.loadStar();
  },

  // 拆星链路：失败时可从页面上直接重试，不必退出去重新点分享卡片
  loadStar() {
    this.setData({ phase: 'loading' });
    if (!cloudApi.ready()) return this.setData({ phase: 'error' });

    cloudApi.call('shareOpen', { shareId: this.id })
      .then(res => {
        // 同一颗星重复打开时，别再往夜空里塞一份
        let kept = false;
        try { kept = store.load().some(x => x.shareId === this.id); } catch (e) {}
        this.setData({
          phase: 'star',
          mine: !!res.mine,
          kept,
          text: (res.payload && res.payload.text) || '',
          tag: (res.payload && res.payload.tag) || '',
          replyText: res.replyText || '',
          acked: !!res.ack
        });
      })
      .catch(e => this.setData({ phase: e && e.code === 'GONE' ? 'gone' : 'error' }));
  },

  retry() { this.loadStar(); },

  showToast(msg) {
    clearTimeout(this.toastTimer);
    this.setData({ toast: msg });
    this.toastTimer = setTimeout(() => this.setData({ toast: '' }), 3200);
  },

  // 收下这颗星：落到自己的夜空（本地）。按 shareId 去重，重复打开不会存第二颗
  keep() {
    if (this.data.kept || !this.data.text) return;
    const list = store.load();
    if (list.some(x => x.shareId === this.id)) {
      this.setData({ kept: true });
      return this.showToast('这颗星已经在你的夜空里了 ✦');
    }
    list.unshift({
      id: Date.now(), t: Date.now(), tag: this.data.tag, text: this.data.text,
      x: 8 + Math.random() * 78, y: 6 + Math.random() * 38,
      shareId: this.id, received: true
    });
    store.save(list, () => this.showToast('这台设备存不下东西了'));
    this.setData({ kept: true });
    this.showToast('它也在你的夜空里了 ✦');
  },

  onReplyInput(e) { this.setData({ reply: e.detail.value, canReply: !!e.detail.value.trim() }); },

  sendReply() {
    const text = (this.data.reply || '').trim();
    if (!text || this.data.sending || !this.data.canReply) return;
    this.setData({ sending: true });
    cloudApi.call('shareReply', { shareId: this.id, text })
      .then(() => this.setData({ sending: false, phase: 'thanked' }))
      .catch(e => {
        this.setData({ sending: false });
        this.showToast(e && e.message ? e.message : '网络不太好，稍后再试');
      });
  },

  goSky() { wx.reLaunch({ url: '/pages/sky/sky' }); }
});
