const { CLOUD_ENV } = require('./utils/config');

App({
  globalData: {
    draft: { text: '', tag: '' },  // 书写页 → 回应页
    freshId: null,                  // 刚放上去的星（诞生动画）
    justReleased: false,            // 是否刚完成「放它走」
    turningId: null,                // 翻篇仪式中的星
    card: null                      // 晚安卡数据（pages/card 读取）
  },
  onLaunch() {
    // 云开发：环境 ID 在 utils/config.js 配置，未配置时全部本地功能不受影响
    if (wx.cloud && CLOUD_ENV) {
      wx.cloud.init({ env: CLOUD_ENV, traceUser: true });
    }
  }
});
