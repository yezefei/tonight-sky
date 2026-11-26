const { navInfo } = require('../../utils/nav');

// 4-7-8 呼吸：鼻吸 4 秒 → 屏息 7 秒 → 口呼 8 秒。
// 屏息提示强调「不用憋狠了」，避免用户为了凑秒数硬撑。
const PHASES = [
  { key: 'in', label: '吸 气', en: 'INHALE', secs: 4, hint: '用鼻子，慢慢吸气', color: '#8FC9B8' },
  { key: 'hold', label: '屏 息', en: 'HOLD', secs: 7, hint: '轻轻停住，别憋太用力', color: '#B9D6C8' },
  { key: 'out', label: '呼 气', en: 'EXHALE', secs: 8, hint: '用嘴巴，缓缓呼气', color: '#79B8AA' }
];

Page({
  data: {
    breath: '', breathTxt: '', breathEn: '', phaseHint: '',
    count: '', round: 0, finished: false, sleepFade: false, endless: false,
    paused: false,
    navTop: 88, capTop: 26, capH: 32, ringSize: 250
  },
  timer: null,
  countTimer: null,
  ringTimer: null,
  fadeTimer: null,
  phaseStart: 0,
  phaseMs: 0,
  phaseRemain: 0,
  curPhase: null,
  curNext: null,
  pausedRemain: 0,
  MAX_ROUND: 5, // 一轮 19 秒，五轮正好一场温柔的收尾

  onLoad() {
    const nav = navInfo();
    let ringSize = 250;
    try {
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      ringSize = Math.round((win.windowWidth || 375) * 500 / 750);
    } catch (e) {}
    this.setData({ navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH, ringSize });
  },

  onShow() {
    this.clearFade();
    this.resetSession(false);
    this.startBreath();
  },

  onHide() { this.clearFade(); this.stopBreath(); },
  onUnload() { this.clearFade(); this.stopBreath(); },

  resetSession(endless) {
    this.stopBreath();
    this.setData({
      breath: '', breathTxt: '', breathEn: '', phaseHint: '', count: '',
      round: 0, finished: false, sleepFade: false, endless: !!endless, paused: false
    });
    this.curPhase = null;
    this.curNext = null;
    this.drawRing(0, PHASES[0].color);
  },

  startBreath() {
    this.stopBreath();
    const runCycle = (i) => {
      if (i < PHASES.length) {
        this.runPhase(PHASES[i], () => runCycle(i + 1));
        return;
      }
      if (!this.data.endless && this.data.round >= this.MAX_ROUND) {
        this.finish();
        return;
      }
      this.nextCycle();
    };
    this._runCycle = runCycle;
    this.nextCycle();
  },

  nextCycle() {
    this.setData({ round: (this.data.round || 0) + 1 });
    if (this._runCycle) this._runCycle(0);
  },

  // 运行一个呼吸阶段；remainMs 用于暂停后从剩余时间续接
  runPhase(phase, next, remainMs) {
    this.stopTimers();
    const phaseMs = remainMs != null && remainMs > 0 ? remainMs : phase.secs * 1000;
    const elapsed = phase.secs * 1000 - phaseMs;
    let left = Math.max(1, Math.ceil(phaseMs / 1000));
    this.curPhase = phase;
    this.curNext = next;
    this.phaseStart = Date.now() - elapsed;
    this.phaseMs = phase.secs * 1000;
    this.phaseRemain = phaseMs;
    this.setData({
      breath: phase.key, breathTxt: phase.label, breathEn: phase.en,
      phaseHint: phase.hint, count: String(left).padStart(2, '0'), paused: false
    });
    this.drawRing(Math.min(1, Math.max(0.003, elapsed / this.phaseMs)), phase.color);

    this.countTimer = setInterval(() => {
      left--;
      if (left >= 1) this.setData({ count: String(left).padStart(2, '0') });
    }, 1000);
    this.ringTimer = setInterval(() => {
      this.drawRing(Math.min(1, (Date.now() - this.phaseStart) / this.phaseMs), phase.color);
    }, 80);
    this.timer = setTimeout(() => {
      this.stopTimers();
      next();
    }, phaseMs);
    if (elapsed < 10) { try { wx.vibrateShort({ type: 'light', fail: () => {} }); } catch (e) {} }
  },

  stopTimers() {
    clearTimeout(this.timer);
    clearInterval(this.countTimer);
    clearInterval(this.ringTimer);
    this.timer = null;
    this.countTimer = null;
    this.ringTimer = null;
  },

  // 暂停 / 继续：冻结当前阶段计时，恢复时从剩余时间续接
  togglePause() {
    if (this.data.finished) return;
    if (this.data.paused) {
      const phase = this.curPhase;
      const next = this.curNext;
      if (!phase || !next) return;
      this.runPhase(phase, next, this.pausedRemain);
      wx.showToast({ title: '继续', icon: 'none', duration: 600 });
      return;
    }
    if (!this.timer) return;
    this.pausedRemain = Math.max(200, this.phaseRemain - (Date.now() - this.phaseStart));
    this.stopTimers();
    this.setData({ paused: true, phaseHint: '停一下，呼吸照你自己的节奏' });
  },

  // 圆环进度：0 起于正上方，顺时针走满当前阶段
  drawRing(progress, color) {
    try {
      const ctx = wx.createCanvasContext ? wx.createCanvasContext('breathRing', this) : null;
      if (!ctx) return;
      const size = this.data.ringSize || 250;
      const c = size / 2;
      const r = size / 2 - 10;
      const p = Math.max(0, Math.min(1, progress || 0));
      ctx.clearRect(0, 0, size, size);
      ctx.setLineWidth(3);
      ctx.setStrokeStyle('rgba(180, 210, 202, .22)');
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
      if (p > 0) {
        ctx.setLineWidth(6);
        ctx.setLineCap('round');
        ctx.setStrokeStyle(color || PHASES[0].color);
        ctx.beginPath();
        ctx.arc(c, c, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p, false);
        ctx.stroke();
      }
      ctx.draw();
    } catch (e) {}
  },

  // 五轮之后：光球停下，仪式收尾
  finish() {
    clearTimeout(this.timer);
    clearInterval(this.countTimer);
    clearInterval(this.ringTimer);
    this.timer = null;
    this.countTimer = null;
    this.ringTimer = null;
    this.setData({
      finished: true, breath: '', breathTxt: '', breathEn: '',
      phaseHint: '', count: '', paused: false
    });
    try { wx.vibrateShort({ type: 'medium', fail: () => {} }); } catch (e) {}
    // 呼吸结束稍停一会儿再渐暗，把「今晚先睡」这句话真正做完
    this.fadeTimer = setTimeout(() => this.setData({ sleepFade: true }), 2200);
  },

  clearFade() { clearTimeout(this.fadeTimer); this.fadeTimer = null; },
  sleepNow() { this.clearFade(); this.setData({ sleepFade: true }); },
  wake() { this.setData({ sleepFade: false }); },
  goSleepless() { wx.navigateTo({ url: '/pages/sleepless/sleepless' }); },

  // 五轮之后继续陪着：不再自动收尾，直到用户自己停下
  toggleEndless() {
    if (this.data.finished) return this.startEndless();
    if (this.data.paused) this.togglePause(); // 暂停中切模式：先恢复当前阶段
    const next = !this.data.endless;
    this.setData({ endless: next });
    if (!next && this.data.round >= this.MAX_ROUND) {
      this.finish();
    } else {
      wx.showToast({ title: next ? '好，我陪着你，不用数轮数' : '回到五轮', icon: 'none' });
    }
  },

  startEndless() {
    this.clearFade();
    this.resetSession(true);
    this.startBreath();
  },

  restart() {
    this.clearFade();
    this.resetSession(false);
    this.startBreath();
  },

  stopBreath() {
    this.stopTimers();
    this.setData({ breath: '', breathTxt: '', breathEn: '', phaseHint: '', count: '', paused: false });
    this.drawRing(0, PHASES[0].color);
  },

  goBack() { wx.navigateBack(); }
});
