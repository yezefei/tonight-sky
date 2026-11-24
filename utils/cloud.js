// 云函数调用封装：统一 Promise 化 + 错误形状
const { CLOUD_ENV } = require('./config');

function ready() {
  return !!(wx.cloud && CLOUD_ENV);
}

// call('shareCreate', { type, payload }) → resolve(data) / reject({ code, message })
function call(name, data) {
  return new Promise((resolve, reject) => {
    if (!ready()) return reject({ code: 'NO_CLOUD', message: '云开发未配置' });
    wx.cloud.callFunction({
      name, data,
      success: res => {
        const r = res.result || {};
        if (r.code && r.code !== 'OK') reject(r);
        else resolve(r);
      },
      fail: err => reject({ code: 'NET', message: '网络不太好，稍后再试', raw: err })
    });
  });
}

module.exports = { ready, call };
