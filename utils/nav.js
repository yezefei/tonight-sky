// 自定义导航适配：状态栏高度 + 右上角胶囊按钮位置
// 页面顶部内容从 capBottom（胶囊下沿）再往下留白开始，返回键与胶囊垂直居中对齐
let cached = null;

function navInfo() {
  if (cached) return cached;
  let statusBar = 20;
  try {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    statusBar = win.statusBarHeight || 20;
  } catch (e) {}
  let capTop = statusBar + 6, capH = 32, capBottom = capTop + capH;
  try {
    const cap = wx.getMenuButtonBoundingClientRect();
    if (cap && cap.bottom) {
      capTop = cap.top;
      capH = cap.height;
      capBottom = cap.bottom;
    }
  } catch (e) {}
  cached = {
    statusBar,          // 状态栏高度 px
    capTop,             // 胶囊上沿 px（返回键用它对齐）
    capH,               // 胶囊高度 px
    navTop: capBottom + 10  // 页面正文的顶部起点 px
  };
  return cached;
}

module.exports = { navInfo };
