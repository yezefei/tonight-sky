const { navInfo } = require('../../utils/nav');

// 晚安卡：多风格 canvas 本地生成，左右滑动选择；5 张全部可用（会员钩子保留但不再挡用户）
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
function footer(ctx, t, c1, c2, line) {
  const d = new Date(t || Date.now());
  ctx.setTextAlign('center');
  ctx.setFillStyle(c1);
  ctx.setFontSize(20);
  ctx.fillText(`${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 夜`, W / 2, H - 128);
  ctx.setFillStyle(c2);
  ctx.setFontSize(18);
  ctx.fillText(line || '说出来了，就过去了大半', W / 2, H - 76);
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

// 六角雪花：几笔交叉线，节日感但不喧宾夺主
function snowflake(ctx, x, y, r, alpha) {
  ctx.setStrokeStyle(`rgba(255,255,255,${alpha})`);
  ctx.setLineWidth(1.2);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3;
    ctx.beginPath();
    ctx.moveTo(x - r * Math.cos(a), y - r * Math.sin(a));
    ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
    ctx.stroke();
  }
}

// 星座圣诞树：不做具象插画，用金色短线和星点勾一棵树，贴「夜空/一颗星」的品牌语言
function constellationTree(ctx, cx, top) {
  const halo = ctx.createCircularGradient(cx, top - 24, 84);
  halo.addColorStop(0, 'rgba(255,215,154,.20)');
  halo.addColorStop(1, 'rgba(255,215,154,0)');
  ctx.setFillStyle(halo); ctx.fillRect(cx - 84, top - 108, 168, 168);

  const rows = [
    { y: top, n: 1, span: 0 },
    { y: top + 50, n: 2, span: 30 },
    { y: top + 100, n: 3, span: 62 },
    { y: top + 150, n: 4, span: 94 },
    { y: top + 200, n: 5, span: 126 }
  ];
  rows.forEach((row, ri) => {
    for (let i = 0; i < row.n; i++) {
      const x = cx + (row.n === 1 ? 0 : (i - (row.n - 1) / 2) * (row.span * 2 / (row.n - 1)));
      ctx.setStrokeStyle('rgba(255,215,154,.52)'); ctx.setLineWidth(1.2);
      ctx.beginPath(); ctx.moveTo(x - 9, row.y); ctx.lineTo(x + 9, row.y); ctx.stroke();
      if ((ri + i) % 2 === 0) {
        ctx.setFillStyle('rgba(255,246,227,.72)');
        ctx.beginPath(); ctx.arc(x, row.y, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    }
  });
  ctx.setStrokeStyle('rgba(255,215,154,.30)'); ctx.setLineWidth(1.2);
  ctx.beginPath();
  ctx.moveTo(cx - 6, top + 200); ctx.lineTo(cx - 11, top + 242);
  ctx.moveTo(cx + 6, top + 200); ctx.lineTo(cx + 11, top + 242);
  ctx.stroke();
  sparkle(ctx, cx, top - 30, 16, '#FFD79A');
  ctx.setStrokeStyle('rgba(255,215,154,.22)'); ctx.setLineWidth(1);
  ctx.beginPath(); ctx.moveTo(cx - 150, top + 262); ctx.lineTo(cx + 150, top + 262); ctx.stroke();
}

// 4. 圣诞节限定（会员）— 品牌深空底 + 星座圣诞树，克制不画具象插画
function paintChristmas(ctx, card) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1D2440'); bg.addColorStop(0.5, '#0D1126'); bg.addColorStop(1, '#05060E');
  ctx.setFillStyle(bg); ctx.fillRect(0, 0, W, H);
  const warm = ctx.createCircularGradient(W / 2, 250, 360);
  warm.addColorStop(0, 'rgba(255,215,154,.10)'); warm.addColorStop(1, 'rgba(255,215,154,0)');
  ctx.setFillStyle(warm); ctx.fillRect(0, 0, W, H);
  const cool = ctx.createCircularGradient(W, H, 420);
  cool.addColorStop(0, 'rgba(25,18,51,.42)'); cool.addColorStop(1, 'rgba(25,18,51,0)');
  ctx.setFillStyle(cool); ctx.fillRect(0, 0, W, H);
  stars(ctx, card.t || Date.now(), 90, H * 0.9, '238,240,247');
  snowflake(ctx, 92, 250, 7, .18);
  snowflake(ctx, 512, 420, 6, .16);

  ctx.setFillStyle('rgba(255,215,154,.62)'); ctx.setFontSize(18); ctx.setTextAlign('center');
  ctx.fillText('A   Q U I E T   C H R I S T M A S', W / 2, 94);
  constellationTree(ctx, W / 2, 150);
  ctx.setFillStyle('#FFF6E3'); ctx.setFontSize(38);
  ctx.fillText('圣 诞 节 限 定', W / 2, 490);
  if (card.tag) {
    ctx.setFillStyle('#8B90A8'); ctx.setFontSize(19);
    ctx.fillText('· ' + card.tag + ' ·', W / 2, 530);
  }
  ctx.setFillStyle('#EEF0F7'); ctx.setFontSize(30); ctx.setTextAlign('left');
  const lines = wrapLines(ctx, card.text, W - 150, 5);
  centerLines(ctx, lines, Math.max(580, 660 - lines.length * 22), 44);
  footer(ctx, card.t, '#8B90A8', '#525771', '愿今晚，安静一点');
}

// 5. 平安夜限定（会员）— 深蓝夜 + 弯月 + 安静的落款
function paintXmasEve(ctx, card) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#101A33'); bg.addColorStop(0.55, '#080D1E'); bg.addColorStop(1, '#03050C');
  ctx.setFillStyle(bg); ctx.fillRect(0, 0, W, H);
  const glow = ctx.createCircularGradient(W / 2, 250, 300);
  glow.addColorStop(0, 'rgba(246,231,193,.18)'); glow.addColorStop(1, 'rgba(246,231,193,0)');
  ctx.setFillStyle(glow); ctx.fillRect(0, 0, W, H);
  stars(ctx, card.t || Date.now(), 90, H * 0.86, '221,230,255');
  sparkle(ctx, 120, 180, 10, 'rgba(255,246,220,.8)');
  sparkle(ctx, 486, 330, 8, 'rgba(255,246,220,.7)');
  snowflake(ctx, 92, 380, 9, .28);
  snowflake(ctx, 516, 150, 8, .3);

  // 弯月：亮圆 + 同底色圆遮出月牙
  ctx.setFillStyle('#F6E7C1');
  ctx.beginPath(); ctx.arc(W / 2, 250, 70, 0, Math.PI * 2); ctx.fill();
  ctx.setFillStyle('#0C142B');
  ctx.beginPath(); ctx.arc(W / 2 + 28, 228, 64, 0, Math.PI * 2); ctx.fill();
  ctx.setStrokeStyle('rgba(246,231,193,.28)'); ctx.setLineWidth(1.5);
  ctx.beginPath(); ctx.moveTo(120, 430); ctx.lineTo(480, 430); ctx.stroke();

  ctx.setFillStyle('rgba(246,231,193,.72)'); ctx.setFontSize(18); ctx.setTextAlign('center');
  ctx.fillText('P E A C E F U L   N I G H T', W / 2, 108);
  ctx.setFillStyle('#F2E6C8'); ctx.setFontSize(24);
  ctx.fillText('平 安 夜 限 定', W / 2, 522);
  if (card.tag) {
    ctx.setFillStyle('rgba(221,230,255,.72)'); ctx.setFontSize(19);
    ctx.fillText('· ' + card.tag + ' ·', W / 2, 562);
  }
  ctx.setFillStyle('#EEF2FF'); ctx.setFontSize(30); ctx.setTextAlign('left');
  const lines = wrapLines(ctx, card.text, W - 150, 5);
  centerLines(ctx, lines, Math.max(620, 700 - lines.length * 23), 46);
  footer(ctx, card.t, 'rgba(246,231,193,.72)', 'rgba(221,230,255,.45)', '愿这一夜，平安到天亮');
}

const STYLES = [
  { id: 'night', name: '深夜蓝', free: true, paint: paintNight },
  { id: 'gold', name: '鎏金', free: true, paint: paintGold },
  { id: 'paper', name: '信纸', free: true, paint: paintPaper },
  { id: 'christmas', name: '圣诞节限定', free: true, paint: paintChristmas },
  { id: 'xmas-eve', name: '平安夜限定', free: true, paint: paintXmasEve }
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
        title: '这张是会员限定卡片',
        content: '限定卡还没开放。先用免费的三张，把今晚留住 ✦',
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
