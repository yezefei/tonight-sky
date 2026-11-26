const { navInfo } = require('../../utils/nav');
const store = require('../../utils/store');
const sync = require('../../utils/sync');
const cloudApi = require('../../utils/cloud');

Page({
  data: {
    navTop: 88, capTop: 26, capH: 32,
    syncOn: false, lastText: '同步未开启', toast: ''
  },
  toastTimer: null,

  onLoad() {
    const nav = navInfo();
    this.setData({ navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH });
    this.refresh();
  },
  onShow() { this.refresh(); },
  onUnload() { clearTimeout(this.toastTimer); },

  refresh() {
    const on = sync.enabled();
    const t = sync.lastAt();
    this.setData({
      syncOn: on,
      lastText: !on ? '同步未开启' : (t ? store.fmt(t) : '尚未同步')
    });
  },

  toast(msg) {
    clearTimeout(this.toastTimer);
    this.setData({ toast: msg });
    this.toastTimer = setTimeout(() => this.setData({ toast: '' }), 3200);
  },

  onSyncToggle(e) {
    const v = !!e.detail.value;
    if (v && !cloudApi.ready()) {
      this.setData({ syncOn: false });
      return this.toast('云开发还没接好，暂时不能同步');
    }
    sync.setEnabled(v);
    this.refresh();
    if (v) {
      this.toast('已开启，正在同步…');
      sync.sync().then(() => this.refresh());
    } else {
      this.toast('已关闭，星星只留在这台设备');
    }
  },

  syncNow() {
    if (!sync.enabled()) return this.toast('请先开启云同步');
    sync.sync().then(ok => {
      this.refresh();
      this.toast(ok ? '同步完成 ✦' : '同步失败，本地数据没丢');
    });
  },

  exportData() {
    const list = store.load();
    const payload = {
      app: '今晚先睡',
      exportedAt: new Date().toISOString(),
      stars: list
    };
    wx.setClipboardData({
      data: JSON.stringify(payload, null, 2),
      success: () => this.toast(`已复制 ${list.length} 颗星到剪贴板`)
    });
  },

  clearData() {
    wx.showModal({
      title: '清空本地数据？',
      content: '这台设备上的星星、草稿和通知记录都会被清掉，无法撤销。云端副本不会删除。',
      confirmText: '清空',
      cancelText: '再想想',
      confirmColor: '#a87f7f',
      success: r => {
        if (!r.confirm) return;
        store.clear();
        sync.setEnabled(false);
        this.refresh();
        this.toast('已清空');
      }
    });
  },

  goBack() { wx.navigateBack({ delta: 1 }); }
});
