const store = require('../../utils/store');
const skyUtil = require('../../utils/sky');
const { navInfo } = require('../../utils/nav');

const LINE_INTERVAL = 20000; // 每 20 秒换一句，不需要任何操作

Page({
  data: {
    navTop: 88, capTop: 26, capH: 32,
    bgStars: [], line: '', lineOn: false, soothe: '', sleepFade: false
  },
  timer: null,
  swapTimer: null,
  idx: 0,

  onLoad() {
    const nav = navInfo();
    const bgStars = [];
    for (let i = 0; i < 42; i++) {
      bgStars.push({
        x: Math.random() * 100, y: Math.random() * 100,
        d: (Math.random() * 11).toFixed(1),
        s: (Math.random() * 2 + 1).toFixed(1),
        o: (Math.random() * .4 + .12).toFixed(2)
      });
    }
    // 今晚写下的那件事：只在本机匹配一句回应，不上传、不请求 AI
    let soothe = '';
    try {
      const list = store.load();
      if (list.length) soothe = skyUtil.sootheFor(list[0]);
    } catch (e) {}
    this.idx = Math.floor(Math.random() * skyUtil.calmLines.length);
    this.setData({
      navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH,
      bgStars, soothe,
      line: skyUtil.calmLines[this.idx], lineOn: true
    });
  },

  onShow() {
    this.stopTimer();
    this.timer = setInterval(() => this.rotateLine(), LINE_INTERVAL);
  },
  onHide() { this.stopTimer(); },
  onUnload() { this.stopTimer(); },

  stopTimer() {
    clearInterval(this.timer); this.timer = null;
    clearTimeout(this.swapTimer); this.swapTimer = null;
  },

  // 先淡出再换字，避免文案硬切
  rotateLine() {
    this.setData({ lineOn: false });
    clearTimeout(this.swapTimer);
    this.swapTimer = setTimeout(() => {
      this.idx = (this.idx + 1) % skyUtil.calmLines.length;
      this.setData({ line: skyUtil.calmLines[this.idx], lineOn: true });
    }, 420);
  },

  sleepNow() { this.setData({ sleepFade: true }); },
  wake() { this.setData({ sleepFade: false }); },
  // 躺着突然想说点什么：不用退回首页找入口
  goWrite() { wx.navigateTo({ url: '/pages/write/write' }); },
  goBack() { wx.navigateBack(); }
});
