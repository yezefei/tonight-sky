const store = require('../../utils/store');
const skyUtil = require('../../utils/sky');
const { navInfo } = require('../../utils/nav');
const cloudApi = require('../../utils/cloud');
const config = require('../../utils/config');

const REVISIT_DAYS = 30; // 星回触发天数；调试可在 onLoad options 里传 ?revisit=0

Page({
  data: {
    bgStars: [], stars: [],
    navTop: 88, capTop: 26, capH: 32,
    orbitOn: false, orbits: [],
    greet: '夜 深 了',
    count: 0, doneCount: 0,
    banner: '', justReleased: false,
    sheetOn: false, sheet: { meta: '', text: '', done: false, reply: '', sent: false },
    shareOn: false, sending: false,
    rvOn: false, rv: { meta: '', text: '', more: [] },
    rvWrite: false, rvText: '',
    toast: ''
  },
  revisitDays: REVISIT_DAYS,
  beckonId: null, sheetId: null, rvId: null, toastTimer: null,

  onLoad(options) {
    if (options && options.revisit !== undefined) this.revisitDays = Number(options.revisit) || 0;
    const nav = navInfo();
    const h = new Date().getHours();
    this.setData({
      navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH,
      greet: (h >= 2 && h < 5) ? '这 么 晚 还 醒 着' : (h >= 23 || h < 2) ? '夜 很 深 了' : '夜 深 了'
    });
    const bgStars = [];
    for (let i = 0; i < 46; i++) {
      bgStars.push({
        x: Math.random() * 100, y: Math.random() * 64,
        d: (Math.random() * 8).toFixed(1),
        s: (Math.random() * 2.4 + 1).toFixed(1),   // 星点大小 1~3.4 px
        o: (Math.random() * .45 + .12).toFixed(2)  // 亮度
      });
    }
    this.setData({ bgStars });
  },

  onShow() { this.buildSky(); },

  buildSky() {
    const g = getApp().globalData;
    const list = store.load();
    const beckon = skyUtil.findRevisit(list, g.freshId, this.revisitDays);
    this.beckonId = beckon ? beckon.id : null;
    const stars = list.map(r => ({
      id: r.id,
      x: r.x, y: r.y,
      size: 4 + (r.text.length % 5),
      delay: r.id % 7,
      cls: (r.id === g.freshId ? 'fresh' : '')
        + (r.id === g.turningId ? ' turning' : '')
        + (r.id === this.beckonId ? ' beckon' : '')
        + (r.done ? ' gold' : (r.reply ? ' replied' : ''))
    }));
    let banner = '';
    if (beckon) {
      const days = Math.max(1, Math.floor((Date.now() - (beckon.snoozed || beckon.t || beckon.id)) / 86400e3));
      banner = `一颗 ${days} 天前的星，在等你回头看看 ✦`;
    }
    this.setData({
      stars, banner,
      count: list.length,
      doneCount: list.filter(r => r.done).length,
      justReleased: !!g.justReleased,
      orbits: this.buildOrbits(list)
    });
    if (g.turningId) setTimeout(() => { g.turningId = null; }, 2400);
  },

  // 轨道视图：星星分三层轨道绕恒星旋转
  buildOrbits(list) {
    const rings = [[], [], []];
    list.forEach((r, i) => rings[i % 3].push(r));
    const sizes = [300, 440, 580];   // 轨道直径 rpx
    const durs = [80, 110, 150];     // 每圈秒数
    return rings.map((ring, k) => ({
      size: sizes[k], duration: durs[k], dir: k % 2 ? 'reverse' : 'normal',
      stars: ring.map((r, j) => {
        const a = (j / ring.length) * 2 * Math.PI + k * 0.9;
        return {
          id: r.id,
          x: (50 + 47 * Math.cos(a)).toFixed(2),
          y: (50 + 47 * Math.sin(a)).toFixed(2),
          size: 6 + (r.text.length % 5),
          cls: (r.done ? 'gold' : '') + (r.id === this.beckonId ? ' beckon' : '')
        };
      })
    })).filter(r => r.stars.length);
  },

  openOrbit() { this.setData({ orbitOn: true }); },
  closeOrbit() { this.setData({ orbitOn: false }); },

  noop() {},

  goWrite() { wx.navigateTo({ url: '/pages/write/write' }); },
  goCalm() { wx.navigateTo({ url: '/pages/calm/calm' }); },
  dismissRelease() {
    getApp().globalData.justReleased = false;
    getApp().globalData.freshId = null;
    this.setData({ justReleased: false });
    this.buildSky();
  },

  // 放它走之后：把今晚存成卡片
  makeCard() {
    const g = getApp().globalData;
    const r = store.load().find(x => x.id === g.freshId);
    if (!r) return;
    g.card = { text: r.text, tag: r.tag, t: r.t || r.id };
    wx.navigateTo({ url: '/pages/card/card' });
  },

  // 星星详情：这颗星存成卡片
  sheetCard() {
    const r = this.sheetStar;
    if (!r) return;
    getApp().globalData.card = { text: r.text, tag: r.tag, t: r.t || r.id };
    this.closeSheets();
    wx.navigateTo({ url: '/pages/card/card' });
  },

  showToast(msg) {
    clearTimeout(this.toastTimer);
    this.setData({ toast: msg });
    this.toastTimer = setTimeout(() => this.setData({ toast: '' }), 3600);
  },

  /* ── 星星详情 ── */
  onStar(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.beckonId) return this.openRevisit();
    const r = store.load().find(x => x.id === id);
    if (!r) return;
    this.sheetId = id;
    this.sheetStar = r;
    this.setData({
      sheetOn: true,
      sheet: {
        meta: store.fmt(r.t || r.id) + (r.tag ? ' · ' + r.tag : '') + (r.reply ? ' · 收到回复' : (r.sent ? ' · 已送出，等一颗回音' : '')),
        text: r.text, done: !!r.done,
        reply: r.reply || '', sent: !!r.sent
      }
    });
  },
  closeSheets() { this.setData({ sheetOn: false, rvOn: false, rvWrite: false, shareOn: false }); this.sheetId = null; },

  /* ── 送星 ── */
  sendStar() {
    const r = this.sheetStar;
    if (!r || this.data.sending) return;
    if (!cloudApi.ready()) return this.showToast('云开发还没接好，今晚先自己留着吧');
    if (r.shareId) { this.pendingShare = r.shareId; return this.setData({ shareOn: true }); }
    this.setData({ sending: true });
    cloudApi.call('shareCreate', { type: 'star', payload: { text: r.text, tag: r.tag || '' } })
      .then(res => {
        const list = store.load();
        const i = list.findIndex(x => x.id === r.id);
        if (i > -1) { list[i].sent = true; list[i].shareId = res.shareId; store.save(list, () => {}); }
        r.shareId = res.shareId;
        this.pendingShare = res.shareId;
        this.setData({ sending: false, shareOn: true, 'sheet.sent': true });
        this.askSubscribe(res.shareId);
      })
      .catch(e => {
        this.setData({ sending: false });
        this.showToast(e && e.message ? e.message : '网络不太好，稍后再试');
      });
  },

  // 订阅「被打开了 / 有回音了」：模板配好才请求；一次授权发一条
  askSubscribe(shareId) {
    const pairs = [[config.TMPL_OPENED, 'star_opened'], [config.TMPL_REPLY, 'reply_arrival']].filter(x => x[0]);
    if (!pairs.length) return;
    wx.requestSubscribeMessage({
      tmplIds: pairs.map(x => x[0]),
      complete: res => {
        pairs.forEach(([tmpl, scene]) => {
          if (res[tmpl] === 'accept') cloudApi.call('notifySubscribe', { scene, shareId }).catch(() => {});
        });
      }
    });
  },

  // 看看回音
  checkReply() {
    const r = this.sheetStar;
    if (!r || !r.shareId) return;
    cloudApi.call('shareOpen', { shareId: r.shareId })
      .then(res => {
        if (res.replyText) {
          const list = store.load();
          const i = list.findIndex(x => x.id === r.id);
          if (i > -1) { list[i].reply = res.replyText; store.save(list, () => {}); }
          this.setData({ 'sheet.reply': res.replyText, 'sheet.meta': this.data.sheet.meta.replace(' · 已送出，等一颗回音', ' · 收到回复') });
        } else {
          this.showToast(res.mine && res.status === 'waiting' ? '还没有送到 TA 手里' : 'TA 打开了，还没回');
        }
      })
      .catch(() => this.showToast('网络不太好，稍后再试'));
  },

  // 分享：有待送出的星就送星，否则分享小程序本身
  onShareAppMessage() {
    if (this.pendingShare) {
      const id = this.pendingShare;
      this.pendingShare = null;
      this.setData({ shareOn: false });
      return { title: '给你一颗今晚的星 ✦', path: `/pages/receive/receive?id=${id}` };
    }
    return { title: '今晚心里的事，说出来就变轻了', path: '/pages/sky/sky' };
  },

  delStar() {
    store.save(store.load().filter(x => x.id !== this.sheetId), () => this.showToast('这台设备存不下东西了'));
    this.closeSheets(); this.buildSky();
  },

  turnStar() { this.doTurn(this.sheetId); },
  doTurn(id) {
    const list = store.load();
    const i = list.findIndex(x => x.id === id);
    if (i > -1) { list[i].done = true; store.save(list, () => this.showToast('这台设备存不下东西了')); }
    this.closeSheets();
    getApp().globalData.turningId = id;
    this.buildSky();
  },

  /* ── 星回 ── */
  openRevisit() {
    const list = store.load();
    const r = this.beckonId ? list.find(x => x.id === this.beckonId) : null;
    if (!r) return;
    this.rvId = r.id;
    const days = Math.max(1, Math.floor((Date.now() - (r.snoozed || r.t || r.id)) / 86400e3));
    this.setData({
      rvOn: true, rvWrite: false, rvText: '',
      rv: {
        meta: `${store.fmt(r.t || r.id)}${r.tag ? ' · ' + r.tag : ''} · ${days} 天前`,
        text: r.text,
        more: (r.more || []).map(m => ({ when: store.fmt(m.t) + ' · 又说了几句', text: m.text }))
      }
    });
  },
  rvTurn() { this.doTurn(this.rvId); },
  rvWait() {
    const list = store.load();
    const i = list.findIndex(x => x.id === this.rvId);
    if (i > -1) { list[i].snoozed = Date.now(); store.save(list, () => {}); }
    this.closeSheets(); this.buildSky();
    this.showToast('好，那就再放一会儿。');
  },
  rvMoreOpen() { this.setData({ rvWrite: true }); },
  onRvInput(e) { this.setData({ rvText: e.detail.value }); },
  rvSaveMore() {
    const v = (this.data.rvText || '').trim();
    if (!v) return;
    const list = store.load();
    const i = list.findIndex(x => x.id === this.rvId);
    if (i > -1) {
      list[i].more = list[i].more || [];
      list[i].more.push({ t: Date.now(), text: v });
      list[i].snoozed = Date.now();
      store.save(list, () => this.showToast('这台设备存不下东西了'));
      this.setData({
        rvWrite: false, rvText: '',
        'rv.more': list[i].more.map(m => ({ when: store.fmt(m.t) + ' · 又说了几句', text: m.text }))
      });
    }
    this.showToast('已经系在这颗星上了。');
  }
});
