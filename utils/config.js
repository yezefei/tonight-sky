// 全局配置
module.exports = {
  // 云开发环境 ID —— 在云开发控制台「概览」里复制（形如 tonight-xxxxxx），填好后后端即接通
  CLOUD_ENV: 'cloud1-d2gjtovvqb51ec8b3',

  // 订阅消息模板 ID（mp 后台「功能 → 订阅消息」申请）。留空则跳过订阅请求，送星链路照跑
  // 申请到之后：把 ID 填到这里，并同步填到 shareOpen / shareReply 云函数的环境变量
  // （对应 TMPL_OPENED / TMPL_REPLY），同时确认云函数 MP_STATE = developer | trial | formal
  TMPL_OPENED: '',   // 「星被打开了」通知模板，字段默认 thing1
  TMPL_REPLY: ''     // 「回音到了」通知模板，字段默认 thing1
};
