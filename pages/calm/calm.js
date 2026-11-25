const { navInfo } = require('../../utils/nav');

Page({
  data: {
    breath: 'out', breathTxt: '', count: '', round: 0, spinning: false,
    finished: false,
    ticks: Array.from({ length: 24 }, (_, i) => ({ deg: i * 15, lg: i % 6 === 0 })),
    navTop: 88, capTop: 26, capH: 32
  },
  timer: null,
  countTimer: null,
  MAX_ROUND: 5,   // 五轮呼吸是一场完整的仪式，之后温柔收尾
  onLoad() {
    const nav = navInfo();
    this.setData({ navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH });
  },
  onShow() {
    // 重置光点动画（摘掉 class 再戴上），保证光点位置和呼吸阶段严格同步
    this.setData({ spinning: false, finished: false, round: 0 });
    setTimeout(() => this.setData({ spinning: true }), 40);
    this.startBreath();
  },
  onHide() { this.stopBreath(); },
  onUnload() { this.stopBreath(); },

  startBreath() {
    this.stopBreath();
    const runPhase = (breath, txt, secs, next) => {
      let left = secs;
      const show = () => this.setData({ breath, breathTxt: txt, count: String(left).padStart(2, '0') });
      show();
      wx.vibrateShort({ type: 'light' }).catch(() => {});
      this.countTimer = setInterval(() => { left--; if (left >= 1) show(); }, 1000);
      this.timer = setTimeout(() => { clearInterval(this.countTimer); next(); }, secs * 1000);
    };
    const cycle = () => {
      this.setData({ round: (this.data.round || 0) + 1 });
      runPhase('in', '吸 ——', 4, () => runPhase('out', '呼 —— ——', 6, () => {
        if (this.data.round >= this.MAX_ROUND) this.finish();
        else cycle();
      }));
    };
    cycle();
  },

  // 五轮之后：光点停下，仪式收尾
  finish() {
    clearTimeout(this.timer);
    clearInterval(this.countTimer);
    this.setData({ finished: true, spinning: false, breath: 'out', breathTxt: '', count: '' });
    wx.vibrateShort({ type: 'medium' }).catch(() => {});
  },

  restart() {
    this.setData({ finished: false, round: 0, spinning: false });
    setTimeout(() => this.setData({ spinning: true }), 40);
    this.startBreath();
  },

  stopBreath() {
    clearTimeout(this.timer);
    clearInterval(this.countTimer);
    this.setData({ breath: 'out', breathTxt: '', count: '' });
  },
  goBack() { wx.navigateBack(); }
});
