const { CLOUD_ENV } = require('./utils/config');
const cloudApi = require('./utils/cloud');
const store = require('./utils/store');

App({
  globalData: {
    draft: { text: '', tag: '' },  // 书写页 → 回应页
    freshId: null,                  // 刚放上去的星（诞生动画）
    justReleased: false,            // 是否刚完成「放它走」
    turningId: null,                // 翻篇仪式中的星
    card: null,                     // 晚安卡数据（pages/card 读取）
    pendingReply: [],               // 未播报的回音（星的本地 id 队列，流星组件消费）
    openStarId: null                // 流星点开后，星空页要直接展开的那颗星
  },
  onLaunch() {
    // 云开发：环境 ID 在 utils/config.js 配置，未配置时全部本地功能不受影响
    if (wx.cloud && CLOUD_ENV) {
      wx.cloud.init({ env: CLOUD_ENV, traceUser: true });
    }
    this.checkReplies();
  },
  onShow() { this.checkReplies(); },

  // 拉取好友回音：写进本地星记录，未播报过的交给流星组件
  checkReplies() {
    if (!cloudApi.ready()) return;
    cloudApi.call('replyCheck').then(res => {
      const items = res.items || [];
      if (!items.length) return;
      const announced = new Set(wx.getStorageSync('tonight-reply-announced') || []);
      const list = store.load();
      let changed = false;
      const fresh = [];
      items.forEach(it => {
        const star = list.find(x => x.shareId === it.shareId);
        if (!star) return;
        if (it.replyText && star.reply !== it.replyText) { star.reply = it.replyText; changed = true; }
        if (!announced.has(it.shareId)) {
          announced.add(it.shareId);
          fresh.push(star.id);
        }
      });
      if (changed) store.save(list, () => {});
      wx.setStorageSync('tonight-reply-announced', [...announced]);
      if (fresh.length) {
        this.globalData.pendingReply = (this.globalData.pendingReply || []).concat(fresh);
        // 当前页面的流星组件注册了唤醒钩子；没注册就等下次页面 show 时自查
        if (this._meteorKick) this._meteorKick();
      }
    }).catch(() => {});
  }
});
