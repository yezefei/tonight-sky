const { navInfo } = require('../../utils/nav');

Page({
  data: {
    breath: 'out', breathTxt: '', count: '', round: 0, spinning: false,
    ticks: Array.from({ length: 24 }, (_, i) => ({ deg: i * 15, lg: i % 6 === 0 })),
    navTop: 88, capTop: 26, capH: 32
  },
  timer: null,
  countTimer: null,
  onLoad() {
    const nav = navInfo();
    this.setData({ navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH });
  },
  onShow() {
    // 重置光点动画（摘掉 class 再戴上），保证光点位置和呼吸阶段严格同步
    this.setData({ spinning: false });
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
      runPhase('in', '吸 ——', 4, () => runPhase('out', '呼 —— ——', 6, cycle));
    };
    cycle();
  },
  stopBreath() {
    clearTimeout(this.timer);
    clearInterval(this.countTimer);
    this.setData({ breath: 'out', breathTxt: '', count: '' });
  },
  goBack() { wx.navigateBack(); }
});
