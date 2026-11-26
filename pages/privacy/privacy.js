// 隐私与数据：原来「我的」页平铺的同步 / 提醒 / 导出 / 清空，全部收在这里。
const { navInfo } = require('../../utils/nav');
const skyUtil = require('../../utils/sky');
const store = require('../../utils/store');
const sync = require('../../utils/sync');
const cloudApi = require('../../utils/cloud');
const config = require('../../utils/config');

Page({
  data: {
    navTop: 88, capTop: 26, capH: 32,
    syncOn: false, lastText: '同步未开启',
    notifyOn: false, notifyText: '回音提醒未开启',
    toast: ''
  },
  toastTimer: null,

  onLoad() {
    const nav = navInfo();
    this.setData({ navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH });
    this.refresh();
  },
  onUnload() { clearTimeout(this.toastTimer); },

  refresh() {
    const on = sync.enabled();
    const t = sync.lastAt();
    this.setData({
      syncOn: on,
      lastText: !on ? '同步未开启' : (t ? store.fmt(t) : '尚未同步')
    });
    this.refreshNotify();
  },

  // 模板没配好 / 用户拒绝过弹窗，都在这里说明并给出重开入口
  refreshNotify() {
    const templIds = [config.TMPL_OPENED, config.TMPL_REPLY].filter(Boolean);
    if (!templIds.length) {
      return this.setData({
        notifyOn: false,
        notifyText: '提醒还没开放，记得回来看看回音'
      });
    }
    try {
      wx.getSetting({
        withSubscriptions: true,
        success: res => {
          const main = res && res.subscriptionsSetting && res.subscriptionsSetting.mainSwitch;
          const items = (res && res.subscriptionsSetting && res.subscriptionsSetting.itemSettings) || {};
          const anyAccepted = templIds.some(id => items[id] === 'accept');
          this.setData({
            notifyOn: !!anyAccepted,
            notifyText: !main ? '微信通知已关'
              : anyAccepted ? '已开启 · 回音会提醒你'
              : '未开启 · 点右侧重开'
          });
        },
        fail: () => this.setData({ notifyOn: false, notifyText: '送星时会再问你' })
      });
    } catch (e) {
      this.setData({ notifyOn: false, notifyText: '送星时会再问你' });
    }
  },

  enableNotify() {
    const templIds = [config.TMPL_OPENED, config.TMPL_REPLY].filter(Boolean);
    if (!templIds.length) {
      return this.toast('提醒还没开放，记得回来看看回音');
    }
    wx.requestSubscribeMessage({
      tmplIds: templIds,
      success: () => this.toast('已提交，正在确认提醒状态…'),
      fail: () => this.toast('没开成，可在微信设置里打开通知'),
      complete: () => this.refreshNotify()
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
    if (!list.length) return this.toast('还没有星星可以导出');
    // 导出成人能直接读的文字，不再甩一坨 JSON 给普通用户
    const lines = ['今晚先睡 · 我的星星', `导出时间：${store.fmt(Date.now())}`, `共 ${list.length} 颗`, ''];
    list.forEach((r, i) => {
      const head = [
        String(i + 1).padStart(2, '0'),
        store.fmt(r.t || r.id),
        r.tag,
        r.emotion,
        r.intensity ? skyUtil.intensityLabel(r.intensity) : ''
      ].filter(Boolean).join(' · ');
      lines.push(head);
      lines.push(String(r.text || ''));
      if (r.done) lines.push('· 已翻篇');
      if (r.reply) lines.push(`· 收到的回音：${r.reply}`);
      if (r.sent) lines.push('· 已送给朋友');
      lines.push('');
    });
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => this.toast(`已复制 ${list.length} 颗星（可读文字）`)
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

  goBack() { wx.navigateBack(); }
});
