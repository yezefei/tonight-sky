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
    intensities: skyUtil.INTENSITIES, emotions: skyUtil.EMOTIONS.slice(),
    intensity: '', emotion: '',
    navTop: 88, capTop: 26, capH: 32,
    draftRestored: false, showTags: false,
    hasVoice: !!si, voiceOn: false, voiceLive: '', voiceErr: ''
  },
  recog: null,
  voiceStartTimer: null,

  onLoad() {
    const nav = navInfo();
    const g = getApp().globalData;
    let text = (g.draft && g.draft.text) || '';
    let tag = (g.draft && g.draft.tag) || '';
    let intensity = (g.draft && g.draft.intensity) || '';
    let emotion = (g.draft && g.draft.emotion) || '';
    let restored = false;
    // 会话里没有草稿，就看本地持久化的（上次写一半被打断的）
    if (!text) {
      try {
        const d = wx.getStorageSync(DRAFT_KEY);
        if (d && d.text) {
          text = d.text; tag = d.tag || '';
          intensity = d.intensity || ''; emotion = d.emotion || '';
          restored = true;
        }
      } catch (e) {}
    }
    this.setData({
      navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH,
      text, tag, intensity, emotion, canDone: !!text.trim(),
      draftRestored: restored, focus: true,
      showTags: !!(tag || intensity || emotion)
    });
  },

  toggleOptional() { this.setData({ showTags: !this.data.showTags }); },

  onHide() { this.stopVoice(); },
  onUnload() { this.stopVoice(); },

  saveDraft() {
    const { text, tag, intensity, emotion } = this.data;
    try {
      if (text.trim()) wx.setStorageSync(DRAFT_KEY, { text, tag, intensity, emotion, t: Date.now() });
      else wx.removeStorageSync(DRAFT_KEY);
    } catch (e) {}
  },

  onInput(e) {
    this.setData({ text: e.detail.value, canDone: !!e.detail.value.trim(), draftRestored: false });
    this.saveDraft();
  },

  clearDraft() {
    try { wx.removeStorageSync(DRAFT_KEY); } catch (e) {}
    this.setData({ text: '', tag: '', intensity: '', emotion: '', canDone: false, draftRestored: false, showTags: false });
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

  pickIntensity(e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ intensity: this.data.intensity === v ? '' : v });
    this.saveDraft();
  },

  pickEmotion(e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ emotion: this.data.emotion === v ? '' : v });
    this.saveDraft();
  },

  /* ── 语音输入：轻触开始，再轻触结束（最长 60s 自动停） ── */
  // 同声传译插件（WechatSI 0.3.5）官方注册方式是「属性赋值」：
  //   manager.onStop = fn
  // 之前先判断类型、遇到函数就改成 manager.onStop(fn) 的兼容写法，在部分基础库上
  // 只是调用了一个同名函数，并没有真正注册回调 —— 表现就是按钮点了没反应。
  // 这里改为赋值优先，只有赋值没生效时才退回函数调用式。
  bindVoice(m, name, fn) {
    if (!m) return;
    try { m[name] = fn; } catch (e) {}
    if (m[name] !== fn && typeof m[name] === 'function') {
      try { m[name](fn); } catch (e) {}
    }
  },

  // 先确认麦克风权限。插件内部虽然会拉授权，但用户之前点过「拒绝」后
  // 它只会静默失败，所以这里自己先查一次，并给出明确的重新开启入口。
  ensureRecordAuth() {
    return new Promise(resolve => {
      try {
        wx.getSetting({
          success: res => {
            const s = res && res.authSetting && res.authSetting['scope.record'];
            if (s === true) return resolve(true);
            if (s === false) {
              return wx.showModal({
                title: '需要麦克风权限',
                content: '允许录音之后，就能直接说心事，不用打字了。',
                confirmText: '去设置', cancelText: '算了',
                success: r => {
                  if (!r.confirm) return resolve(false);
                  wx.openSetting({
                    success: rr => resolve(!!(rr && rr.authSetting && rr.authSetting['scope.record'])),
                    fail: () => resolve(false)
                  });
                }
              });
            }
            // 还没问过：主动申请，别等插件内部悄悄失败
            wx.authorize({
              scope: 'scope.record',
              success: () => resolve(true),
              fail: () => resolve(false)
            });
          },
          fail: () => resolve(true) // 读不到设置就交给插件自己处理
        });
      } catch (e) { resolve(true); }
    });
  },

  toggleVoice() {
    if (!si) return;
    if (this._voiceActive || this.data.voiceOn) { this.stopVoice(); return; }
    this.ensureRecordAuth().then(ok => {
      if (!ok) {
        this.setData({ voiceErr: '麦克风权限没打开，开一下才能说话' });
        return;
      }
      this.startVoice();
    });
  },

  startVoice() {
    if (!this.recog) {
      const m = si.getRecordRecognitionManager();
      this._voiceLiveText = '';
      this.bindVoice(m, 'onStart', () => {
        this._voiceActive = true;
        this._voiceLiveText = '';
        this.setData({ voiceOn: true, voiceLive: '', voiceErr: '' });
      });
      this.bindVoice(m, 'onRecognize', res => {
        this._voiceLiveText = (res && res.result) || '';
        this.setData({ voiceLive: this._voiceLiveText, voiceErr: '' });
      });
      this.bindVoice(m, 'onStop', res => {
        this._voiceActive = false;
        // 少数机型最终 result 为空，兜底用最后一次流式识别结果
        const t = (((res && res.result) || this._voiceLiveText) || '').trim();
        this.setData({ voiceOn: false, voiceLive: '', voiceErr: '' });
        if (t) this.appendVoice(t);
        else this.setData({ voiceErr: '没听清，再说一次试试' });
      });
      this.bindVoice(m, 'onError', res => {
        this._voiceActive = false;
        this.setData({ voiceOn: false, voiceLive: '' });
        const msg = ((res && (res.msg || res.errMsg)) || '') + ' ' + ((res && res.retcode) || '');
        if (/auth|permission|deny|-30001|-30002|授权/i.test(msg)) {
          this.setData({ voiceErr: '麦克风权限被拒绝了，去设置里打开' });
          wx.showModal({
            title: '需要麦克风权限',
            content: '允许录音之后，就能直接说心事，不用打字了。',
            confirmText: '去设置', cancelText: '算了',
            success: r => { if (r.confirm) wx.openSetting(); }
          });
        } else {
          this.setData({ voiceErr: '语音没启动（' + msg.trim() + '），先打字吧' });
        }
      });
      this.recog = m;
    }
    this.setData({ voiceErr: '' });
    try {
      // 乐观置位：有些基础库不回调 onStart，但录音其实已经开始了
      this._voiceActive = true;
      this.setData({ voiceOn: true });
      this.recog.start({ duration: 60000, lang: 'zh_CN' });
      // 5 秒还没任何识别结果，给个可诊断的提示，而不是一直"正在听"
      clearTimeout(this.voiceStartTimer);
      this.voiceStartTimer = setTimeout(() => {
        if (this._voiceActive && !this._voiceLiveText) {
          this.setData({ voiceErr: '还没听到声音，检查一下麦克风或再说一次' });
        }
      }, 5000);
    } catch (e) {
      this._voiceActive = false;
      this.setData({ voiceOn: false, voiceLive: '', voiceErr: '语音暂时不可用，先打字吧' });
    }
  },

  stopVoice() {
    if (this.recog && (this._voiceActive || this.data.voiceOn)) {
      clearTimeout(this.voiceStartTimer);
      this._voiceActive = false;
      try { this.recog.stop(); } catch (e) {
        this.setData({ voiceOn: false, voiceLive: '' });
      }
    }
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
    getApp().globalData.draft = {
      text: this.data.text.trim(), tag: this.data.tag,
      intensity: this.data.intensity, emotion: this.data.emotion
    };
    wx.navigateTo({ url: '/pages/echo/echo' });
  },
  goCalm() { wx.navigateTo({ url: '/pages/calm/calm' }); },
  goBack() { wx.navigateBack(); }
});
