// 首页装饰星空：银河光带 / 星云 / 三层闪烁星点 / 十字星芒 / 随机流星。
// 这里不读取任何用户记录——用户写下的星只出现在「恒星轨道」视图里。

const TWO_PI = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

function rgba(hex, a) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

Component({
  data: {},

  lifetimes: {
    attached() {
      this._frame = 0;
      this._stars = [];
      this._nebulas = [];
      this._meteors = [];
      this._nextMeteor = 0;
      this._running = false;
      this._rafId = null;
      this._onHide = () => this.pause();
      this._onShow = () => this.resume();
      wx.onAppHide(this._onHide);
      wx.onAppShow(this._onShow);
      this._setup();
    },
    detached() {
      this.pause();
      if (wx.offAppHide) wx.offAppHide(this._onHide);
      if (wx.offAppShow) wx.offAppShow(this._onShow);
    }
  },

  methods: {
    // 页面切到后台 / 切走 tab 时停帧，省电
    pause() {
      this._running = false;
      if (this._rafId != null) {
        if (this._canvas && this._canvas.cancelAnimationFrame) this._canvas.cancelAnimationFrame(this._rafId);
        else clearTimeout(this._rafId);
        this._rafId = null;
      }
    },
    resume() {
      if (!this._canvas || this._running) return;
      this._running = true;
      this._tick();
    },

    _setup() {
      wx.createSelectorQuery().in(this).select('#sky-field')
        .fields({ node: true, size: true })
        .exec((res) => {
          const node = res && res[0] && res[0].node;
          if (!node) return;
          const ctx = node.getContext('2d');
          if (!ctx) return;
          const dpr = wx.getSystemInfoSync().pixelRatio || 1;
          const w = res[0].width || 375;
          const h = res[0].height || 700;
          node.width = Math.round(w * dpr);
          node.height = Math.round(h * dpr);
          ctx.scale(dpr, dpr);
          this._canvas = node;
          this._ctx = ctx;
          this._w = w;
          this._h = h;
          this._seed();
          this.resume();
        });
    },

    _seed() {
      const w = this._w, h = this._h;
      const palette = ['#ffffff', '#fff4dd', '#cfe0ff', '#ffd9a8', '#d9ccff'];
      const n = Math.min(240, Math.max(140, Math.round(w * h / 2200)));
      const stars = [];
      for (let i = 0; i < n; i++) {
        const r = rand(0.35, 1.7);
        stars.push({
          x: rand(-8, w + 8),
          // 幂次分布：星点向屏幕上半部聚拢，顶部最密
          y: h * Math.pow(Math.random(), 1.7) * 0.96,
          r: r,
          bright: rand(0.28, 1),
          phase: rand(0, TWO_PI),
          speed: rand(0.35, 1.15),
          drift: rand(0.004, 0.014),
          color: palette[Math.floor(Math.random() * palette.length)],
          tier: r > 1.35 ? 2 : (r > 0.78 ? 1 : 0)
        });
      }
      // 银河尘埃：沿一条倾斜的窄带密集排布
      const ang = -0.34;
      for (let i = 0; i < Math.round(n * 0.55); i++) {
        const u = rand(-w * 0.9, w * 0.9);
        const v = rand(-h * 0.075, h * 0.075);
        stars.push({
          x: w * 0.5 + u * Math.cos(ang) - v * Math.sin(ang),
          y: h * 0.23 + u * Math.sin(ang) + v * Math.cos(ang),
          r: rand(0.3, 0.9),
          bright: rand(0.12, 0.42),
          phase: rand(0, TWO_PI),
          speed: rand(0.5, 1.6),
          drift: rand(0.002, 0.008),
          color: palette[Math.floor(Math.random() * palette.length)],
          tier: 0
        });
      }
      // 挑 6 颗亮星做呼吸式明暗：周期约 5 秒，像夜空自己在慢慢呼吸
      const brightOnes = stars.filter(s => s.tier === 2);
      for (let i = 0; i < Math.min(6, brightOnes.length); i++) {
        const pick = brightOnes.splice(Math.floor(Math.random() * brightOnes.length), 1)[0];
        pick.breath = true;
      }
      this._stars = stars;
      this._nebulas = [
        { x: 0.18, y: 0.12, r: 0.46, c: '94,116,224', a: 0.075, phase: 0.4, dx: 0.07, dy: 0.05 },
        { x: 0.82, y: 0.20, r: 0.52, c: '150,102,214', a: 0.055, phase: 2.1, dx: 0.05, dy: 0.07 },
        { x: 0.52, y: 0.05, r: 0.40, c: '86,164,214', a: 0.050, phase: 3.6, dx: 0.06, dy: 0.04 }
      ];
      this._nextMeteor = 2 + Math.random() * 3;
    },

    // 两帧画一次，稳定在 30fps：够顺滑，也不至于让手机发烫
    _tick() {
      if (!this._running) return;
      this._frame++;
      if (this._frame % 2 === 0) this._draw(Date.now() / 1000);
      const self = this;
      const cb = function () { self._tick(); };
      if (this._canvas.requestAnimationFrame) this._rafId = this._canvas.requestAnimationFrame(cb);
      else this._rafId = setTimeout(cb, 33);
    },

    _draw(t) {
      const ctx = this._ctx;
      if (!ctx) return;
      const w = this._w, h = this._h;
      ctx.clearRect(0, 0, w, h);

      // 1) 银河：旋转的柔光带，极缓慢呼吸
      ctx.save();
      ctx.translate(w * 0.5, h * 0.23);
      ctx.rotate(-0.34);
      const bandH = h * 0.22;
      const band = ctx.createLinearGradient(0, -bandH, 0, bandH);
      const pulse = 0.055 + 0.018 * Math.sin(t * 0.35);
      band.addColorStop(0, 'rgba(120,140,230,0)');
      band.addColorStop(0.30, 'rgba(120,140,230,' + (pulse * 0.32) + ')');
      band.addColorStop(0.50, 'rgba(205,215,255,' + pulse + ')');
      band.addColorStop(0.70, 'rgba(120,140,230,' + (pulse * 0.32) + ')');
      band.addColorStop(1, 'rgba(120,140,230,0)');
      ctx.fillStyle = band;
      ctx.fillRect(-w, -bandH, w * 2, bandH * 2);
      ctx.restore();

      // 2) 星云：大片低透明度色雾，缓慢漂移
      this._nebulas.forEach((n) => {
        const x = n.x * w + Math.sin(t * n.dx + n.phase) * w * 0.08;
        const y = n.y * h + Math.cos(t * n.dy + n.phase) * h * 0.06;
        const r = n.r * w;
        const a = n.a * (0.78 + 0.22 * Math.sin(t * 0.22 + n.phase));
        const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
        gg.addColorStop(0, 'rgba(' + n.c + ',' + a + ')');
        gg.addColorStop(0.55, 'rgba(' + n.c + ',' + (a * 0.28) + ')');
        gg.addColorStop(1, 'rgba(' + n.c + ',0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TWO_PI); ctx.fill();
      });

      // 3) 星点：三层闪烁，最亮的一批带光晕；几颗星做呼吸式明暗
      this._stars.forEach((s) => {
        let a;
        if (s.breath) {
          const b = 0.5 + 0.5 * Math.sin(t * 1.2 + s.phase);
          a = 0.08 + 0.92 * b * b;
        } else {
          const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
          a = Math.min(1, s.bright * (0.45 + 0.55 * tw));
        }
        const x = s.x + Math.sin(t * s.drift + s.phase) * 4;
        const y = s.y + Math.cos(t * s.drift * 0.8 + s.phase) * 3;
        if (s.tier === 2) {
          const gr = s.r * 8;
          const gg = ctx.createRadialGradient(x, y, 0, x, y, gr);
          gg.addColorStop(0, rgba(s.color, a * 0.42));
          gg.addColorStop(0.35, rgba(s.color, a * 0.14));
          gg.addColorStop(1, rgba(s.color, 0));
          ctx.fillStyle = gg;
          ctx.beginPath(); ctx.arc(x, y, gr, 0, TWO_PI); ctx.fill();
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, TWO_PI); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // 4) 流星：每 9~16 秒三颗成组，斜划过夜空
      if (t > this._nextMeteor) {
        for (let i = 0; i < 3; i++) {
          this._meteors.push({
            born: t,
            life: rand(0.9, 1.5),
            x0: rand(w * 0.25, w * 1.05),
            y0: rand(-h * 0.08, h * 0.30),
            dx: -rand(w * 0.25, w * 0.55),
            dy: rand(h * 0.20, h * 0.45),
            width: rand(0.9, 1.9)
          });
        }
        this._nextMeteor = t + rand(9, 16);
      }
      for (let i = this._meteors.length - 1; i >= 0; i--) {
        const m = this._meteors[i];
        const p = (t - m.born) / m.life;
        if (p >= 1) { this._meteors.splice(i, 1); continue; }
        const hx = m.x0 + m.dx * p;
        const hy = m.y0 + m.dy * p;
        const tx = hx - m.dx * 0.22;
        const ty = hy - m.dy * 0.22;
        const fade = Math.sin(Math.PI * Math.min(1, p * 1.2)) * (1 - p * 0.5);
        const lg = ctx.createLinearGradient(tx, ty, hx, hy);
        lg.addColorStop(0, 'rgba(190,215,255,0)');
        lg.addColorStop(0.6, 'rgba(190,215,255,' + (0.28 * fade) + ')');
        lg.addColorStop(1, 'rgba(255,255,255,' + (0.95 * fade) + ')');
        ctx.strokeStyle = lg;
        ctx.lineWidth = m.width;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        const hr = m.width * 7;
        const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
        hg.addColorStop(0, 'rgba(255,255,255,' + (0.6 * fade) + ')');
        hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TWO_PI); ctx.fill();
      }
    }
  }
});
