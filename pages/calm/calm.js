const skyUtil = require('../../utils/sky');
const { navInfo } = require('../../utils/nav');

Page({
  data: { line: '', breath: 'out', breathTxt: '', navTop: 88, capTop: 26, capH: 32 },
  timer: null,
  onLoad() {
    const nav = navInfo();
    this.setData({ line: skyUtil.calmLine(), navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH });
  },
  onShow() { this.startBreath(); },
  onHide() { this.stopBreath(); },
  onUnload() { this.stopBreath(); },
  startBreath() {
    const cycle = () => {
      this.setData({ breath: 'in', breathTxt: '吸 ——' });
      this.timer = setTimeout(() => {
        this.setData({ breath: 'out', breathTxt: '呼 —— ——' });
        this.timer = setTimeout(cycle, 6000);
      }, 4000);
    };
    cycle();
  },
  stopBreath() {
    clearTimeout(this.timer);
    this.setData({ breath: 'out', breathTxt: '' });
  },
  goBack() { wx.navigateBack(); }
});
