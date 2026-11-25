const skyUtil = require('../../utils/sky');
const { navInfo } = require('../../utils/nav');

const DRAFT_KEY = 'tonight-write-draft';

// 微信同声传译插件：语音转文字（未开通插件时静默降级，隐藏语音按钮）
let si = null;
try { si = requirePlugin('WechatSI'); } catch (e) { si = null; }

Page({
  data: {
    text: '', tag: '', canDone: false, focus: false,
    chips: ['工作', '感情', '金钱', '家庭', '未来', '说不清'],
    navTop: 88, capTop: 26, capH: 32,
    draftRestored: false,
    hasVoice: !!si, voiceOn: false, voiceLive: ''
  },
  recog: null,

  onLoad() {
    const nav = navInfo();
    const g = getApp().globalData;
    let text = (g.draft && g.draft.text) || '';
    let tag = (g.draft && g.draft.tag) || '';
    let restored = false;
    // 会话里没有草稿，就看本地持久化的（上次写一半被打断的）
    if (!text) {
      try {
        const d = wx.getStorageSync(DRAFT_KEY);
        if (d && d.text) { text = d.text; tag = d.tag || ''; restored = true; }
      } catch (e) {}
    }
    this.setData({
      navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH,
      text, tag, canDone: !!text.trim(),
      draftRestored: restored, focus: true
    });
  },

  onHide() { this.stopVoice(); },
  onUnload() { this.stopVoice(); },

  saveDraft() {
    const { text, tag } = this.data;
    try {
      if (text.trim()) wx.setStorageSync(DRAFT_KEY, { text, tag, t: Date.now() });
      else wx.removeStorageSync(DRAFT_KEY);
    } catch (e) {}
  },

  onInput(e) {
    this.setData({ text: e.detail.value, canDone: !!e.detail.value.trim(), draftRestored: false });
    this.saveDraft();
  },

  clearDraft() {
    try { wx.removeStorageSync(DRAFT_KEY); } catch (e) {}
    this.setData({ text: '', tag: '', canDone: false, draftRestored: false });
  },

  useStarter() {
    const text = skyUtil.starter();
    this.setData({ text, canDone: true, focus: true, draftRestored: false });
    this.saveDraft();
  },

  pickChip(e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ tag: this.data.tag === v ? '' : v });
    this.saveDraft();
  },

  /* ── 语音输入：轻触开始，再轻触结束（最长 60s 自动停） ── */
  toggleVoice() {
    if (!si) return;
    if (this.data.voiceOn) { this.stopVoice(); return; }
    if (!this.recog) {
      const m = si.getRecordRecognitionManager();
      m.onStart(() => this.setData({ voiceOn: true, voiceLive: '' }));
      m.onRecognize(res => this.setData({ voiceLive: (res && res.result) || '' }));
      m.onStop(res => {
        this.setData({ voiceOn: false, voiceLive: '' });
        const t = ((res && res.result) || '').trim();
        if (t) this.appendVoice(t);
      });
      m.onError(res => {
        this.setData({ voiceOn: false, voiceLive: '' });
        const msg = ((res && res.msg) || '') + ((res && res.retcode) || '');
        if (/auth|permission|deny|-30001|-30002|授权/i.test(msg)) {
          wx.showModal({
            title: '需要麦克风权限',
            content: '允许录音之后，就能直接说心事，不用打字了。',
            confirmText: '去设置', cancelText: '算了',
            success: r => { if (r.confirm) wx.openSetting(); }
          });
        } else {
          wx.showToast({ title: '没听清，再试一次', icon: 'none' });
        }
      });
      this.recog = m;
    }
    this.recog.start({ duration: 60000, lang: 'zh_CN' });
  },

  stopVoice() {
    if (this.recog && this.data.voiceOn) this.recog.stop();
  },

  // 语音结果接到原文后面：缺标点就补个逗号，尊重 2000 字上限
  appendVoice(t) {
    let text = this.data.text;
    if (text && !/[，。！？、\s]$/.test(text)) text += '，';
    text = (text + t).slice(0, 2000);
    this.setData({ text, canDone: !!text.trim(), draftRestored: false });
    this.saveDraft();
  },

  done() {
    if (!this.data.canDone) return;
    this.stopVoice();
    getApp().globalData.draft = { text: this.data.text.trim(), tag: this.data.tag };
    wx.navigateTo({ url: '/pages/echo/echo' });
  },
  goCalm() { wx.navigateTo({ url: '/pages/calm/calm' }); },
  goBack() { wx.navigateBack(); }
});
