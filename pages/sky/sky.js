const store = require('../../utils/store');
const skyUtil = require('../../utils/sky');
const { navInfo } = require('../../utils/nav');
const cloudApi = require('../../utils/cloud');
const config = require('../../utils/config');

const REVISIT_DAYS = 30; // 星回触发天数；调试可在 onLoad options 里传 ?revisit=0

// 时段问候：别在白天也硬说「夜深了」。除了问候，首屏两句也跟着换，避免白天出现「睡不着」。
function sceneForHour(h) {
  if (h >= 23 || h < 2) return {
    greet: '夜 很 深 了', hero1: '睡不着，', hero2: '也没关系。',
    lead1: '今晚心里装着的事，', lead2: '说完，就把它变成星星，放在天上。'
  };
  if (h >= 2 && h < 5) return {
    greet: '这 么 晚 还 醒 着', hero1: '睡不着，', hero2: '也没关系。',
    lead1: '今晚心里装着的事，', lead2: '说完，就把它变成星星，放在天上。'
  };
  if (h >= 5 && h < 9) return {
    greet: '天 亮 了', hero1: '醒 来 了，', hero2: '慢 慢 来。',
    lead1: '心里装着的事，', lead2: '说出来，就先放在这里。'
  };
  if (h >= 9 && h < 18) return {
    greet: '白 天 也 能 慢 下 来', hero1: '心 里 有 事，', hero2: '也 没 关 系。',
    lead1: '心里装着的事，', lead2: '说出来，就先放在这里。'
  };
  return {
    greet: '天 黑 了', hero1: '睡不着，', hero2: '也没关系。',
    lead1: '今晚心里装着的事，', lead2: '说完，就把它变成星星，放在天上。'
  };
}

Page({
  data: {
    // 星空由 components/skyfield 独立绘制，不承载任何用户记录
    navTop: 88, capTop: 26, capH: 32,
    orbitOn: false, orbits: [],
    greet: '白 天 也 能 慢 下 来', hero1: '心 里 有 事，', hero2: '也 没 关 系。',
    lead1: '心里装着的事，', lead2: '说出来，就先放在这里。',
    count: 0, doneCount: 0,
    banner: '', justReleased: false, soothe: '', sleepFade: false,
    sheetOn: false, sheet: { meta: '', text: '', done: false, reply: '', sent: false },
    shareOn: false, sending: false, turnFlash: false,
    rvOn: false, rv: { meta: '', text: '', more: [] },
    rvWrite: false, rvText: '',
    rvNowOptions: skyUtil.NOW_OPTIONS, rvThen: '', rvNow: '', rvNowLabel: '',
    // 订阅模板没配好时不能让用户误以为「等回音」会被自动通知
    notifyReady: !!(config.TMPL_OPENED || config.TMPL_REPLY),
    toast: '', toastUndo: null
  },
  revisitDays: REVISIT_DAYS,
  beckonId: null, sheetId: null, rvId: null, toastTimer: null,

  onLoad(options) {
    if (options && options.revisit !== undefined) this.revisitDays = Number(options.revisit) || 0;
    const nav = navInfo();
    this.setData({ navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH, ...sceneForHour(new Date().getHours()) });
  },

  onShow() {
    // 切回页面时按当前时间再算一次问候（可能从白天跨到晚上）
    this.setData(sceneForHour(new Date().getHours()));
    // 回到今夜 tab：恢复装饰星空动画
    const sf = this.selectComponent('#skyfield');
    if (sf) sf.resume();
    // 同步自定义 tabBar 选中态（tab 页切回来只触发 onShow）
    if (typeof this.getTabBar === 'function') {
      const tb = this.getTabBar();
      if (tb) tb.setData({ selected: 0 });
    }
    this.buildSky();
    // 云同步完成后刷新夜空
    const app = getApp();
    app._syncKick = () => this.buildSky();
    // 流星落下来的星：直接替用户拆开
    const g = getApp().globalData;
    if (g.openStarId != null) {
      const id = g.openStarId;
      g.openStarId = null;
      setTimeout(() => this.openFromMeteor(id), 400);
    }
    // 从仪式页 switchTab 回今夜 tab：直接展开轨道，不先闪首页
    if (g.openOrbitFromTab || (g.justReleased && !g.autoOrbitShown)) {
      g.openOrbitFromTab = false;
      g.autoOrbitShown = true;
      this.setData({ orbitOn: true });
    }
  },

  onHide() {
    // 切走 tab / 进二级页时停帧，省电
    const sf = this.selectComponent('#skyfield');
    if (sf) sf.pause();
  },

  onUnload() {
    const app = getApp();
    if (app && app._syncKick) app._syncKick = null;
  },

  buildSky() {
    const g = getApp().globalData;
    const list = store.load();
    const beckon = skyUtil.findRevisit(list, g.freshId, this.revisitDays);
    this.beckonId = beckon ? beckon.id : null;
    let banner = '';
    if (beckon) {
      const days = Math.max(1, Math.floor((Date.now() - (beckon.snoozed || beckon.t || beckon.id)) / 86400e3));
      banner = `${days} 天前你写下的那句话，想再看看吗？✦`;
    }
    const now = new Date();
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
    const fresh = g.freshId != null ? list.find(x => x.id === g.freshId) : null;
    const released = !!g.justReleased;
    // 收尾状态换成简短标题，别再堆两行统计；常态才用时段问候
    const scene = released
      ? { hero1: '今 晚，', hero2: '先 到 这 里。', lead1: '', lead2: '' }
      : sceneForHour(now.getHours());
    this.setData({
      ...scene,
      banner,
      count: list.length,
      doneCount: list.filter(r => r.done).length,
      justReleased: released,
      soothe: released ? skyUtil.sootheFor(fresh) : '',
      dateLabel: `${now.getMonth() + 1}月${now.getDate()}日 · ${week}`,
      orbits: this.buildOrbits(list, g.freshId, g.turningId)
    });
    if (g.turningId) setTimeout(() => { g.turningId = null; }, 2400);
  },

  // 轨道视图：星星分三层轨道绕恒星旋转（深空观测台：带刻度线、轨道名、星星编号）
  buildOrbits(list, freshId, turningId) {
    const rings = [[], [], []];
    // 编号按写下时间排序：最早的心事是 01 号星
    const seq = {};
    [...list].sort((a, b) => a.id - b.id).forEach((r, i) => { seq[r.id] = String(i + 1).padStart(2, '0'); });
    list.forEach((r, i) => rings[i % 3].push(r));
    const sizes = [344, 488, 600];   // 轨道直径 rpx（外环收一点，矮屏不蹭底部计数）
    const durs = [80, 110, 150];     // 每圈秒数
    const ticks = Array.from({ length: 12 }, (_, i) => i * 30);  // 每环 12 条刻度线
    return rings.map((ring, k) => ({
      size: sizes[k], half: sizes[k] / 2, duration: durs[k], dir: k % 2 ? 'reverse' : 'normal',
      name: 'ORBIT L' + (k + 1), ticks,
      stars: ring.map((r, j) => {
        const a = (j / ring.length) * 2 * Math.PI + k * 0.9;
        return {
          id: r.id,
          x: (50 + 47 * Math.cos(a)).toFixed(2),
          y: (50 + 47 * Math.sin(a)).toFixed(2),
          idx: seq[r.id],
          size: Math.round((8 + (r.text.length % 5)) * (r.done ? 1.7 : 1)),
          beckon: r.id === this.beckonId,
          cls: (r.id === freshId ? 'fresh ' : '')
             + (r.id === turningId ? 'turning ' : '')
             + (r.done ? 'gold' : (r.reply ? 'replied' : ''))
             + (r.id === this.beckonId ? ' beckon' : '')
        };
      })
    })).filter(r => r.stars.length);
  },

  openOrbit() { this.setData({ orbitOn: true }); },
  closeOrbit() { this.setData({ orbitOn: false }); },
  // 点轨道空白处：收起星星详情浮层
  onOrbitBg() { if (this.data.sheetOn) this.closeSheets(); },

  noop() {},

  goWrite() { wx.navigateTo({ url: '/pages/write/write' }); },
  goCalm() { wx.navigateTo({ url: '/pages/calm/calm' }); },
  goSleepless() { wx.navigateTo({ url: '/pages/sleepless/sleepless' }); },
  goSettings() { wx.switchTab({ url: '/pages/settings/settings' }); },
  // 星空 tab 用 globalData 传筛选类型（switchTab 不能带 query）
  goList(e) {
    const type = e.currentTarget.dataset.type || 'worry';
    getApp().globalData.starsType = type;
    wx.switchTab({ url: '/pages/stars/stars' });
  },
  // 明确的返程出口：清掉一次性状态，回到常态首页（不渐暗）
  backToSky() {
    const g = getApp().globalData;
    g.justReleased = false;
    g.freshId = null;
    g.autoOrbitShown = false;
    g.openOrbitFromTab = false;
    this.setData({ justReleased: false, orbitOn: false, soothe: '', sleepFade: false });
    this.buildSky();
  },
  // 点底部「今夜」tab 时也算一次返程，避免被困在收尾面板
  onTabItemTap(item) {
    if (item && item.index === 0 && this.data.justReleased) this.backToSky();
  },
  dismissRelease() {
    // 轨道页的「晚安」：回常态后再盖渐暗层，慢慢把夜空交出去
    this.backToSky();
    this.setData({ sleepFade: true });
  },
  // 渐暗层：轻触任意处唤醒，不强制跳转
  wake() { this.setData({ sleepFade: false }); },

  // 交给夜空之后：把今晚存成卡片
  makeCard() {
    const g = getApp().globalData;
    const r = store.load().find(x => x.id === g.freshId);
    if (!r) return;
    g.card = { text: r.text, tag: r.tag, t: r.t || r.id };
    wx.navigateTo({ url: '/pages/card/card' });
  },

  // 交给夜空后直接送刚写下的那颗，不用再点星进详情找入口
  sendFreshStar() {
    const g = getApp().globalData;
    const r = store.load().find(x => x.id === g.freshId);
    if (!r) return this.showToast('刚才那颗星没找到，去星空里选一颗吧');
    this.sheetStar = r;
    this.setData({ sheetOn: false });
    this.sendStar();
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
    this.setData({ toast: msg, toastUndo: null });
    this.toastTimer = setTimeout(() => this.setData({ toast: '' }), 3600);
  },

  // 可撤销的 toast：「翻篇」这种重操作给一个反悔窗口
  showUndoToast(msg, undoId) {
    clearTimeout(this.toastTimer);
    this.setData({ toast: msg, toastUndo: undoId });
    this.toastTimer = setTimeout(() => this.setData({ toast: '', toastUndo: null }), 5000);
  },
  onToast() {
    const id = this.data.toastUndo;
    if (id == null) return;
    const list = store.load();
    const i = list.findIndex(x => x.id === id);
    if (i > -1) { list[i].done = false; store.save(list, () => {}); }
    clearTimeout(this.toastTimer);
    this.setData({ toast: '已撤销，它还在原来的轨道上', toastUndo: null });
    this.toastTimer = setTimeout(() => this.setData({ toast: '' }), 2200);
    this.buildSky();
  },

  /* ── 星星详情 ── */
  onStar(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.beckonId) return this.openRevisit();
    this.openStarById(id);
  },
  openStarById(id) {
    const r = store.load().find(x => x.id === id);
    if (!r) return;
    this.sheetId = id;
    this.sheetStar = r;
    const waitText = this.data.notifyReady ? ' · 已送出，等一颗回音' : ' · 已送出，记得回来看看';
    this.setData({
      sheetOn: true,
      sheet: {
        meta: store.fmt(r.t || r.id) + (r.tag ? ' · ' + r.tag : '') + (r.reply ? ' · 收到回复' : (r.sent ? (r.opened ? ' · 对方已打开，回音在路上' : waitText) : '')),
        text: r.text, done: !!r.done, demo: false,
        reply: r.reply || '', sent: !!r.sent,
        acked: !!r.ack
      }
    });
  },
  // 第一夜的示范星：让新用户先看看「一颗星」长什么样
  openDemo() {
    this.sheetId = null;
    this.sheetStar = null;
    this.setData({
      sheetOn: true,
      sheet: {
        demo: true,
        meta: '示范星 · 一个示例',
        text: '比如：「明天的汇报还没准备好，越想越睡不着。」——写下来，它就会变成一颗星，挂在你的夜空里。',
        done: false, reply: '', sent: false, acked: false
      }
    });
  },
  // 流星带回来的星：先拉一次最新回音（shareOpen 会顺带在云端标记已读），再展开详情
  openFromMeteor(id) {
    const star = store.load().find(x => x.id === id);
    if (!star) return;
    if (star.shareId && cloudApi.ready()) {
      cloudApi.call('shareOpen', { shareId: star.shareId })
        .then(res => {
          if (res.replyText) {
            const list = store.load();
            const i = list.findIndex(x => x.id === id);
            if (i > -1) { list[i].reply = res.replyText; store.save(list, () => {}); }
          }
          this.openStarById(id);
        })
        .catch(() => this.openStarById(id));
    } else {
      this.openStarById(id);
    }
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
          if (res && res[tmpl] === 'accept') cloudApi.call('notifySubscribe', { scene, shareId }).catch(() => {});
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
          this.setData({
            'sheet.reply': res.replyText,
            'sheet.meta': this.data.sheet.meta
              .replace(' · 已送出，等一颗回音', ' · 收到回复')
              .replace(' · 已送出，记得回来看看', ' · 收到回复')
          });
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
      return { title: '给你一颗今晚的星 · 只留给第一个打开的人', path: `/pages/receive/receive?id=${id}` };
    }
    return { title: '今晚心里的事，说出来就变轻了', path: '/pages/sky/sky' };
  },

  delStar() {
    // 不可逆操作，确认一次
    wx.showModal({
      title: '删除这颗星？',
      content: '删除之后，就找不回来了。',
      confirmText: '删除',
      cancelText: '再留留',
      confirmColor: '#a87f7f',
      success: r => {
        if (!r.confirm) return;
        store.save(store.load().filter(x => x.id !== this.sheetId), () => this.showToast('这台设备存不下东西了'));
        this.closeSheets(); this.buildSky();
      }
    });
  },

  turnStar() { this.doTurn(this.sheetId); },
  doTurn(id) {
    const list = store.load();
    const i = list.findIndex(x => x.id === id);
    if (i > -1) { list[i].done = true; store.save(list, () => this.showToast('这台设备存不下东西了')); }
    // 翻篇仪式：全屏金光一闪 + 星星镀金爆裂 + 轻震动
    getApp().globalData.turningId = id;
    try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
    this.setData({ turnFlash: true });
    this.closeSheets();
    this.buildSky();
    setTimeout(() => this.setData({ turnFlash: false }), 1900);
    this.showUndoToast('这颗星镀金了 ✦ · 点我撤销', id);
  },

  // 收到回音之后：告诉对方「我收到了」
  ackReply() {
    const r = this.sheetStar;
    if (!r || !r.shareId || !cloudApi.ready()) return;
    cloudApi.call('shareAck', { shareId: r.shareId }).then(() => {
      const list = store.load();
      const i = list.findIndex(x => x.id === r.id);
      if (i > -1) { list[i].ack = true; store.save(list, () => {}); }
      r.ack = true;
      this.setData({ 'sheet.acked': true });
      try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
    }).catch(() => this.showToast('网络不太好，稍后再试'));
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
      rvThen: skyUtil.moodText(r) || '那时没打分',
      rvNow: r.rvNow || '', rvNowLabel: skyUtil.nowLabel(r.rvNow),
      rv: {
        meta: `${store.fmt(r.t || r.id)}${r.tag ? ' · ' + r.tag : ''} · ${days} 天前`,
        text: r.text,
        more: (r.more || []).map(m => ({ when: store.fmt(m.t) + ' · 又说了几句', text: m.text }))
      }
    });
  },
  // 星回：记下「现在怎么样了」。这是更敏感的本地字段，不会随云同步上传
  pickRvNow(e) {
    const v = e.currentTarget.dataset.v;
    const list = store.load();
    const i = list.findIndex(x => x.id === this.rvId);
    if (i < 0) return;
    list[i].rvNow = v;
    store.save(list, () => {});
    this.setData({ rvNow: v, rvNowLabel: skyUtil.nowLabel(v) });
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
