// 流星通知：好友的回音到达时，在任何页面划破夜空、坠落成一颗可点的星
// 数据源：app.globalData.pendingReply（App 切前台时 replyCheck 入队）
Component({
  data: { on: false, phase: '', starId: null },

  lifetimes: {
    attached() { this.register(); },
    detached() {
      const app = getApp();
      if (app._meteorKick === this._kick) app._meteorKick = null;
      clearTimeout(this._hideTimer);
    }
  },
  pageLifetimes: {
    // 每次所在页面回到前台，都接管「唤醒流星」的权利并检查队列
    show() { this.register(); this.tryShow(); }
  },

  methods: {
    register() {
      this._kick = this._kick || (() => this.tryShow());
      getApp()._meteorKick = this._kick;
    },
    tryShow() {
      const g = getApp().globalData;
      const q = g.pendingReply || [];
      if (!q.length || this.data.on) return;
      const starId = q.shift();
      this.setData({ on: true, phase: 'streak', starId });
    },
    onAnimEnd(e) {
      const name = e.detail && e.detail.animationName;
      if (name === 'meteorStreak') {
        this.setData({ phase: 'fall' });
      } else if (name === 'meteorFall') {
        this.setData({ phase: 'chip' });
        try { wx.vibrateShort({ type: 'light', fail: () => {} }); } catch (e) {}
        clearTimeout(this._hideTimer);
        // 15 秒没点就悄悄退场（已记入已播报，不会反复打扰）
        this._hideTimer = setTimeout(() => this.setData({ on: false, phase: '' }), 15000);
      }
    },
    openReply() {
      clearTimeout(this._hideTimer);
      const starId = this.data.starId;
      this.setData({ on: false, phase: '' });
      if (starId == null) return;
      getApp().globalData.openStarId = starId;
      wx.reLaunch({ url: '/pages/sky/sky' });
    }
  }
});
