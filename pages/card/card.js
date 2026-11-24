const { navInfo } = require('../../utils/nav');

// 晚安卡：canvas 本地生成，可存相册；数据从 globalData.card 传入 { text, tag, t }
const W = 600, H = 960;

Page({
  data: {
    img: '', saving: false, saved: false,
    navTop: 88, capTop: 26, capH: 32
  },

  onLoad() {
    const nav = navInfo();
    this.setData({ navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH });
    const card = getApp().globalData.card;
    if (!card || !card.text) return wx.navigateBack();
    this.card = card;
    this.render();
  },

  render() {
    const ctx = wx.createCanvasContext('cardCanvas', this);

    // 夜空背景
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1d2440');
    bg.addColorStop(0.55, '#0d1126');
    bg.addColorStop(1, '#05060e');
    ctx.setFillStyle(bg);
    ctx.fillRect(0, 0, W, H);

    // 星星（用时间戳做种子，同一张卡星位固定）
    let seed = (this.card.t || Date.now()) % 233280 || 1;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 80; i++) {
      ctx.setFillStyle(`rgba(205,211,238,${(0.12 + rnd() * 0.5).toFixed(2)})`);
      ctx.beginPath();
      ctx.arc(rnd() * W, rnd() * H * 0.82, rnd() * 1.8 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 月亮
    ctx.setFillStyle('rgba(255,241,208,.16)');
    ctx.beginPath(); ctx.arc(W - 104, 116, 42, 0, Math.PI * 2); ctx.fill();
    ctx.setFillStyle('#fff1d0');
    ctx.beginPath(); ctx.arc(W - 104, 116, 26, 0, Math.PI * 2); ctx.fill();

    // 顶部小字
    ctx.setFillStyle('#8b90a8');
    ctx.setFontSize(20);
    ctx.setTextAlign('center');
    ctx.fillText('今 晚 先 睡', W / 2, 176);

    // 标签
    if (this.card.tag) {
      ctx.setFillStyle('#b9c3ff');
      ctx.setFontSize(20);
      ctx.fillText('· ' + this.card.tag + ' ·', W / 2, 238);
    }

    // 正文（逐字量宽换行，手动居中）
    ctx.setFillStyle('#fff6e3');
    ctx.setFontSize(32);
    ctx.setTextAlign('left');
    const maxW = W - 150;
    const lines = [];
    let cur = '';
    for (const ch of String(this.card.text)) {
      if (ch === '\n') { lines.push(cur); cur = ''; }
      else if (ctx.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) lines.push(cur);
    const LH = 58;
    const shown = lines.slice(0, 11);
    if (lines.length > 11) shown[10] = shown[10].replace(/.$/, '…');
    let ty = Math.max(320, 500 - shown.length * LH / 2);
    shown.forEach((ln, i) => {
      const lw = ctx.measureText(ln).width;
      ctx.fillText(ln, (W - lw) / 2, ty + i * LH);
    });

    // 日期与落款
    const d = new Date(this.card.t || Date.now());
    ctx.setFillStyle('#8b90a8');
    ctx.setFontSize(20);
    ctx.setTextAlign('center');
    ctx.fillText(`${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 夜`, W / 2, H - 128);
    ctx.setFillStyle('#525771');
    ctx.setFontSize(18);
    ctx.fillText('说出来了，就过去了大半', W / 2, H - 76);

    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'cardCanvas',
        width: W, height: H,
        destWidth: W * 2, destHeight: H * 2,
        success: r => this.setData({ img: r.tempFilePath })
      }, this);
    });
  },

  save() {
    if (!this.data.img || this.data.saving || this.data.saved) return;
    this.setData({ saving: true });
    wx.saveImageToPhotosAlbum({
      filePath: this.data.img,
      success: () => this.setData({ saving: false, saved: true }),
      fail: err => {
        this.setData({ saving: false });
        if (err.errMsg && err.errMsg.indexOf('auth') > -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '允许「保存到相册」后，才能把卡片存下来',
            confirmText: '去设置',
            success: r => { if (r.confirm) wx.openSetting(); }
          });
        }
      }
    });
  },

  onShareAppMessage() {
    return { title: '今晚心里的事，说出来就变轻了', path: '/pages/sky/sky' };
  },

  goBack() { wx.navigateBack(); }
});
