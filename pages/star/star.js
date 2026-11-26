// 星星详情页：从星志列表进入。查看/修改内容、翻篇、送好友、回执、存卡片、删除
const store = require('../../utils/store');
const skyUtil = require('../../utils/sky');
const { navInfo } = require('../../utils/nav');
const cloudApi = require('../../utils/cloud');
const config = require('../../utils/config');

Page({
  data: {
    navTop: 88, capTop: 26, capH: 32,
    gone: false,
    idx: '', meta: '', text: '', tag: '', mood: '', done: false,
    reply: '', sent: false, opened: false, acked: false,
    editing: false, editText: '', editTag: '', canSave: false,
    chips: ['工作', '感情', '金钱', '家庭', '未来', '说不清'],
    shareReady: false, sending: false,
    undoOn: false, toast: ''
  },
  id: null, star: null, undoTimer: null, toastTimer: null,

  onLoad(options) {
    const nav = navInfo();
    this.setData({ navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH });
    this.id = Number(options && options.id);
  },

  onShow() { this.build(); },
  onUnload() { clearTimeout(this.undoTimer); clearTimeout(this.toastTimer); },

  build() {
    const list = store.load();
    const r = list.find(x => x.id === this.id);
    if (!r) { this.setData({ gone: true }); return; }
    // 编号与星空页一致：按写下时间排序
    const seq = {};
    [...list].sort((a, b) => a.id - b.id).forEach((x, i) => { seq[x.id] = String(i + 1).padStart(2, '0'); });
    this.star = r;
    this.setData({
      gone: false,
      idx: seq[r.id] || '',
      meta: store.fmt(r.t || r.id),
      text: r.text, tag: r.tag || '', mood: skyUtil.moodText(r), done: !!r.done,
      reply: r.reply || '', sent: !!r.sent, opened: !!r.opened, acked: !!r.ack,
      shareReady: !!r.shareId
    });
    // 送出去的星：拉一次最新状态（shareOpen 会顺带在云端标记回音已读）
    if (r.shareId && cloudApi.ready() && !r.reply) {
      cloudApi.call('shareOpen', { shareId: r.shareId })
        .then(res => {
          if (res.replyText) this.saveLocal({ reply: res.replyText });
          else if (res.status === 'opened') this.saveLocal({ opened: true });
        })
        .catch(() => {});
    }
  },

  // 写本地 + 同步页面状态
  saveLocal(patch) {
    const list = store.load();
    const i = list.findIndex(x => x.id === this.id);
    if (i < 0) return;
    Object.assign(list[i], patch);
    store.save(list, () => {});
    if (this.star) Object.assign(this.star, patch);
    this.setData(patch);
  },

  toast(msg) {
    clearTimeout(this.toastTimer);
    this.setData({ toast: msg });
    this.toastTimer = setTimeout(() => this.setData({ toast: '' }), 3200);
  },

  /* ── 修改内容 ── */
  startEdit() {
    this.setData({
      editing: true,
      editText: this.data.text, editTag: this.data.tag,
      canSave: !!this.data.text.trim()
    });
  },
  onEditInput(e) {
    this.setData({ editText: e.detail.value, canSave: !!e.detail.value.trim() });
  },
  pickChip(e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ editTag: this.data.editTag === v ? '' : v });
  },
  cancelEdit() { this.setData({ editing: false }); },
  saveEdit() {
    if (!this.data.canSave) return;
    const text = this.data.editText.trim().slice(0, 2000);
    this.saveLocal({ text, tag: this.data.editTag });
    this.setData({ editing: false });
    this.toast('改好了 ✦');
  },

  /* ── 翻篇（可撤销） ── */
  turn() {
    this.saveLocal({ done: true });
    try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
    clearTimeout(this.undoTimer);
    this.setData({ undoOn: true });
    this.undoTimer = setTimeout(() => this.setData({ undoOn: false }), 5000);
  },
  undoTurn() {
    clearTimeout(this.undoTimer);
    this.saveLocal({ done: false });
    this.setData({ undoOn: false });
  },

  /* ── 送给朋友：先包星（拿 shareId），再用分享按钮送出去 ── */
  prepareShare() {
    if (!cloudApi.ready()) return this.toast('云开发还没接好，今晚先自己留着吧');
    if (this.star.shareId) return this.setData({ shareReady: true });
    if (this.data.sending) return;
    this.setData({ sending: true });
    cloudApi.call('shareCreate', { type: 'star', payload: { text: this.star.text, tag: this.star.tag || '' } })
      .then(res => {
        this.saveLocal({ sent: true, shareId: res.shareId });
        this.setData({ sending: false, shareReady: true });
        this.askSubscribe(res.shareId);
      })
      .catch(e => {
        this.setData({ sending: false });
        this.toast(e && e.message ? e.message : '网络不太好，稍后再试');
      });
  },

  // 与星空页一致：模板 ID 配好后，送星时登记「被打开 / 有回音」的一次性订阅
  askSubscribe(shareId) {
    const pairs = [[config.TMPL_OPENED, 'star_opened'], [config.TMPL_REPLY, 'reply_arrival']].filter(x => x[0]);
    if (!pairs.length) return;
    wx.requestSubscribeMessage({
      tmplIds: pairs.map(x => x[0]),
      complete: res => {
        pairs.forEach(([tmpl, scene]) => {
          if (res && res[tmpl] === 'accept') {
            cloudApi.call('notifySubscribe', { scene, shareId }).catch(() => {});
          }
        });
      }
    });
  },
  onShareAppMessage() {
    if (this.star && this.star.shareId) {
      return { title: '给你一颗今晚的星 · 只留给第一个打开的人', path: `/pages/receive/receive?id=${this.star.shareId}` };
    }
    return { title: '今晚心里的事，说出来就变轻了', path: '/pages/sky/sky' };
  },

  /* ── 回音回执：我收到了 ── */
  ack() {
    if (!this.star || !this.star.shareId || !cloudApi.ready()) return;
    cloudApi.call('shareAck', { shareId: this.star.shareId }).then(() => {
      this.saveLocal({ ack: true });
      this.setData({ acked: true });
      try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
    }).catch(() => this.toast('网络不太好，稍后再试'));
  },

  /* ── 存成卡片 ── */
  makeCard() {
    getApp().globalData.card = { text: this.data.text, tag: this.data.tag, t: this.star.t || this.star.id };
    wx.navigateTo({ url: '/pages/card/card' });
  },

  /* ── 删除 ── */
  del() {
    wx.showModal({
      title: '删除这颗星？',
      content: '删除之后，就找不回来了。',
      confirmText: '删除', cancelText: '再留留', confirmColor: '#a87f7f',
      success: r => {
        if (!r.confirm) return;
        store.save(store.load().filter(x => x.id !== this.id), () => this.toast('这台设备存不下东西了'));
        wx.navigateBack({ delta: 1 });
      }
    });
  },

  goBack() { wx.navigateBack({ delta: 1 }); }
});
