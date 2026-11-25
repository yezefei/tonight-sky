const { navInfo } = require('../../utils/nav');

// 晚安卡：多风格 canvas 本地生成，左右滑动选择；3 张免费 + 会员卡（收费点预留）
// 数据从 globalData.card 传入 { text, tag, t }
const W = 600, H = 960;

/* ── 画布工具 ── */
function wrapLines(ctx, text, maxW, maxLines) {
  const lines = [];
  let cur = '';
  for (const ch of String(text)) {
    if (ch === '\n') { lines.push(cur); cur = ''; }
    else if (ctx.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = shown[maxLines - 1].replace(/.$/, '…');
  return shown;
}
function centerLines(ctx, lines, y, lh) {
  lines.forEach((ln, i) => {
    const lw = ctx.measureText(ln).width;
    ctx.fillText(ln, (W - lw) / 2, y + i * lh);
  });
}
// 星点（种子固定：同一张卡，哪个风格里星位都一样）
function stars(ctx, seed, n, maxY, prefix) {
  let s = seed % 233280 || 1;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) {
    ctx.setFillStyle(`rgba(${prefix},${(0.12 + rnd() * 0.5).toFixed(2)})`);
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * maxY, rnd() * 1.8 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
// 四角星（翻篇金星的形状）
function sparkle(ctx, cx, cy, r, color) {
  ctx.setFillStyle(color);
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.14, cy - r * 0.14, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * 0.14, cy + r * 0.14, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.14, cy + r * 0.14, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * 0.14, cy - r * 0.14, cx, cy - r);
  ctx.fill();
}
function footer(ctx, t, c1, c2) {
  const d = new Date(t || Date.now());
  ctx.setTextAlign('center');
  ctx.setFillStyle(c1);
  ctx.setFontSize(20);
  ctx.fillText(`${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 夜`, W / 2, H - 128);
  ctx.setFillStyle(c2);
  ctx.setFontSize(18);
  ctx.fillText('说出来了，就过去了大半', W / 2, H - 76);
}

/* ── 五种卡面 ── */
// 1. 深夜蓝（经典款）
function paintNight(ctx, card) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1d2440'); bg.addColorStop(0.55, '#0d1126'); bg.addColorStop(1, '#05060e');
  ctx.setFillStyle(bg); ctx.fillRect(0, 0, W, H);
  stars(ctx, card.t || Date.now(), 80, H * 0.82, '205,211,238');
  ctx.setFillStyle('rgba(255,241,208,.16)');
  ctx.beginPath(); ctx.arc(W - 104, 116, 42, 0, Math.PI * 2); ctx.fill();
  ctx.setFillStyle('#fff1d0');
  ctx.beginPath(); ctx.arc(W - 104, 116, 26, 0, Math.PI * 2); ctx.fill();
  ctx.setFillStyle('#8b90a8'); ctx.setFontSize(20); ctx.setTextAlign('center');
  ctx.fillText('今 晚 先 睡', W / 2, 176);
  if (card.tag) { ctx.setFillStyle('#b9c3ff'); ctx.fillText('· ' + card.tag + ' ·', W / 2, 238); }
  ctx.setFillStyle('#fff6e3'); ctx.setFontSize(32); ctx.setTextAlign('left');
  const lines = wrapLines(ctx, card.text, W - 150, 11);
  centerLines(ctx, lines, Math.max(320, 500 - lines.length * 58 / 2), 58);
  footer(ctx, card.t, '#8b90a8', '#525771');
}

// 2. 鎏金（翻篇气质）
function paintGold(ctx, card) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0C0A12'); bg.addColorStop(0.5, '#07060B'); bg.addColorStop(1, '#030205');
  ctx.setFillStyle(bg); ctx.fillRect(0, 0, W, H);
  // 注意：旧版 canvas 的径向渐变叫 createCircularGradient（单圆心）
  const glow = ctx.createCircularGradient(W / 2, 240, 280);
  glow.addColorStop(0, 'rgba(255,206,138,.22)'); glow.addColorStop(1, 'rgba(255,206,138,0)');
  ctx.setFillStyle(glow); ctx.fillRect(0, 0, W, H);
  stars(ctx, card.t || Date.now(), 60, H * 0.85, '255,220,170');
  sparkle(ctx, W / 2, 200, 26, '#FFCE8A');
  ctx.setStrokeStyle('rgba(255,206,138,.32)'); ctx.setLineWidth(1);
  ctx.beginPath(); ctx.moveTo(W / 2 - 70, 268); ctx.lineTo(W / 2 + 70, 268); ctx.stroke();
  ctx.setFillStyle('#C9A86A'); ctx.setFontSize(20); ctx.setTextAlign('center');
  ctx.fillText('今 晚 先 睡', W / 2, 320);
  if (card.tag) ctx.fillText('· ' + card.tag + ' ·', W / 2, 372);
  ctx.setFillStyle('#F2D9A4'); ctx.setFontSize(32); ctx.setTextAlign('left');
  const lines = wrapLines(ctx, card.text, W - 150, 10);
  centerLines(ctx, lines, Math.max(430, 540 - lines.length * 58 / 2), 58);
  footer(ctx, card.t, '#A08550', '#6b5a3a');
}

// 3. 信纸（奶白底，深字）
function paintPaper(ctx, card) {
  ctx.setFillStyle('#F4EFE2'); ctx.fillRect(0, 0, W, H);
  ctx.setStrokeStyle('rgba(42,46,66,.22)'); ctx.setLineWidth(2);
  ctx.strokeRect(28, 28, W - 56, H - 56);
  sparkle(ctx, W / 2, 118, 16, '#C9A86A');
  ctx.setFillStyle('#6B6F85'); ctx.setFontSize(20); ctx.setTextAlign('center');
  ctx.fillText('今 晚 先 睡', W / 2, 190);
  if (card.tag) { ctx.setFillStyle('#A8874F'); ctx.fillText('· ' + card.tag + ' ·', W / 2, 248); }
  ctx.setFillStyle('#2A2E42'); ctx.setFontSize(32); ctx.setTextAlign('left');
  const lines = wrapLines(ctx, card.text, W - 170, 10);
  centerLines(ctx, lines, Math.max(340, 510 - lines.length * 60 / 2), 60);
  footer(ctx, card.t, '#6B6F85', '#9A9EB2');
}

// 4. 极光（会员）
function paintAurora(ctx, card) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#080B1C'); bg.addColorStop(1, '#04050E');
  ctx.setFillStyle(bg); ctx.fillRect(0, 0, W, H);
  const blobs = [
    [W * 0.28, 240, 300, '139,124,255,.20'],
    [W * 0.75, 180, 260, '95,211,196,.16'],
    [W * 0.55, 330, 240, '224,139,184,.12']
  ];
  blobs.forEach(([x, y, r, c]) => {
    const g = ctx.createCircularGradient(x, y, r);
    g.addColorStop(0, `rgba(${c})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.setFillStyle(g); ctx.fillRect(0, 0, W, H);
  });
  ctx.setStrokeStyle('rgba(139,124,255,.28)'); ctx.setLineWidth(26);
  ctx.beginPath(); ctx.arc(W / 2, 720, 420, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke();
  ctx.setStrokeStyle('rgba(95,211,196,.22)'); ctx.setLineWidth(16);
  ctx.beginPath(); ctx.arc(W / 2, 760, 460, Math.PI * 1.3, Math.PI * 1.72); ctx.stroke();
  stars(ctx, card.t || Date.now(), 70, H * 0.8, '221,230,255');
  ctx.setFillStyle('rgba(221,230,255,.75)'); ctx.setFontSize(20); ctx.setTextAlign('center');
  ctx.fillText('今 晚 先 睡', W / 2, 176);
  if (card.tag) ctx.fillText('· ' + card.tag + ' ·', W / 2, 238);
  ctx.setFillStyle('#EAF0FF'); ctx.setFontSize(32); ctx.setTextAlign('left');
  const lines = wrapLines(ctx, card.text, W - 150, 10);
  centerLines(ctx, lines, Math.max(360, 540 - lines.length * 58 / 2), 58);
  footer(ctx, card.t, 'rgba(221,230,255,.6)', 'rgba(221,230,255,.35)');
}

// 5. 星轨（会员）
function paintOrbit(ctx, card) {
  const bg = ctx.createCircularGradient(W / 2, 340, 620);
  bg.addColorStop(0, '#0B1128'); bg.addColorStop(0.55, '#060913'); bg.addColorStop(1, '#030409');
  ctx.setFillStyle(bg); ctx.fillRect(0, 0, W, H);
  stars(ctx, card.t || Date.now(), 60, H * 0.85, '205,211,238');
  const cx = W / 2, cy = 340;
  [90, 150, 210].forEach(r => {
    ctx.setStrokeStyle('rgba(200,210,255,.13)'); ctx.setLineWidth(1);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  });
  const glow = ctx.createCircularGradient(cx, cy, 60);
  glow.addColorStop(0, 'rgba(255,241,208,.9)'); glow.addColorStop(1, 'rgba(255,241,208,0)');
  ctx.setFillStyle(glow); ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.fill();
  ctx.setFillStyle('#FFF1D0'); ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill();
  const a = 0.7;
  ctx.setFillStyle('#FFCE8A');
  ctx.beginPath(); ctx.arc(cx + 150 * Math.cos(a), cy + 150 * Math.sin(a), 6, 0, Math.PI * 2); ctx.fill();
  ctx.setFillStyle('rgba(169,188,255,.7)'); ctx.setFontSize(20); ctx.setTextAlign('center');
  ctx.fillText('今 晚 先 睡', W / 2, 610);
  if (card.tag) ctx.fillText('· ' + card.tag + ' ·', W / 2, 658);
  ctx.setFillStyle('#F2EDD9'); ctx.setFontSize(28); ctx.setTextAlign('left');
  const lines = wrapLines(ctx, card.text, W - 180, 3);
  centerLines(ctx, lines, 715, 48);
  footer(ctx, card.t, 'rgba(169,188,255,.55)', 'rgba(169,188,255,.3)');
}

const STYLES = [
  { id: 'night', name: '深夜蓝', free: true, paint: paintNight },
  { id: 'gold', name: '鎏金', free: true, paint: paintGold },
  { id: 'paper', name: '信纸', free: true, paint: paintPaper },
  { id: 'aurora', name: '极光', free: false, paint: paintAurora },
  { id: 'orbit', name: '星轨', free: false, paint: paintOrbit }
];

Page({
  data: {
    styles: STYLES.map(s => ({ id: s.id, name: s.name, free: s.free, img: '' })),
    cur: 0, saving: false, saved: false, vip: false,
    navTop: 88, capTop: 26, capH: 32
  },

  onLoad() {
    const nav = navInfo();
    let vip = false;
    try { vip = !!wx.getStorageSync('tonight-vip'); } catch (e) {}
    this.setData({ navTop: nav.navTop, capTop: nav.capTop, capH: nav.capH, vip });
    const card = getApp().globalData.card;
    if (!card || !card.text) return wx.navigateBack();
    this.card = card;
    this.renderAll();
  },

  // 五张卡全部预渲染，滑动零等待；单张失败不影响其他（并在 Console 留下线索）
  renderAll() {
    STYLES.forEach((s, i) => {
      const ctx = wx.createCanvasContext('cardCanvas' + i, this);
      try {
        s.paint(ctx, this.card);
      } catch (e) {
        console.error('卡面绘制失败:', s.id, e);
        return;
      }
      ctx.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: 'cardCanvas' + i,
          width: W, height: H,
          destWidth: W * 2, destHeight: H * 2,
          success: r => this.setData({ [`styles[${i}].img`]: r.tempFilePath }),
          fail: e => console.error('卡面导出失败:', s.id, e)
        }, this);
      });
    });
  },

  onSwipe(e) { this.setData({ cur: e.detail.current, saved: false }); },
  pickStyle(e) { this.setData({ cur: Number(e.currentTarget.dataset.i), saved: false }); },

  save() {
    const s = this.data.styles[this.data.cur];
    // 会员卡：可以滑到面前看，存相册时提示开通（收费点钩子）
    if (!s.free && !this.data.vip) {
      wx.showModal({
        title: '这张是会员卡片',
        content: '开通会员，所有精美卡片无限用。会员功能即将上线，先把免费的三张用漂亮 ✦',
        confirmText: '好的', showCancel: false
      });
      return;
    }
    if (!s.img || this.data.saving || this.data.saved) return;
    this.setData({ saving: true });
    wx.saveImageToPhotosAlbum({
      filePath: s.img,
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
