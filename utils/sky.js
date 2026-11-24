// 天文与文案工具：真实月相 / 每日引导词 / 书写引导

// 月相：返回 { halfClip, termColor, termScale } 供 CSS 渲染
function moonPhase() {
  const synodic = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14); // 2000-01-06 新月
  const p = ((((Date.now() - ref) / 86400e3) % synodic) + synodic) % synodic / synodic;
  return {
    // 渐盈亮右，渐亏亮左
    halfClip: p < 0.5 ? 'inset(0 0 0 50%)' : 'inset(0 50% 0 0)',
    termColor: (p < 0.25 || p > 0.75) ? 'rgba(42,49,96,.55)' : '#fff1d0',
    termScale: Math.abs(Math.cos(2 * Math.PI * p)).toFixed(3)
  };
}

const calmLines = [
  '不用睡着，躺着就已经是休息。', '今晚不用比昨晚更好。', '你不需要为失眠道歉。',
  '黑暗里，时间走得很慢，没关系。', '什么都不想，也是一种想。', '先照顾呼吸，再照顾心事。',
  '夜晚不是用来战胜的。', '你安静地醒着，世界安静地转。', '今天的你，已经尽力了。',
  '慢一点，夜还长，路也不赶。', '把肩膀放松，把眉头放松。', '没有人催你，包括我。',
  '睡不着的日子，也会过去。', '你在这里，就已经够了。', '夜越静，越不用说话。',
  '先让心跳慢下来，别的等明天。'
];
function calmLine() {
  const d = new Date();
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400e3);
  return calmLines[doy % calmLines.length];
}

const starters = [
  '今天最让我放不下的是……',
  '有件事，我白天一直没说出口：',
  '我以为我忘了，但它又回来了——',
  '如果现在有人愿意听，我想说……'
];
function starter() {
  return starters[Math.floor(Math.random() * starters.length)];
}

// 星回：未翻篇且超过 N 天未理会的最旧一颗星
function findRevisit(list, freshId, revisitDays) {
  const now = Date.now();
  const ms = revisitDays * 86400e3;
  return (list || [])
    .filter(r => !r.done && r.id !== freshId && now - (r.snoozed || r.t || r.id) > ms)
    .sort((a, b) => (a.snoozed || a.t || a.id) - (b.snoozed || b.t || b.id))[0] || null;
}

module.exports = { moonPhase, calmLine, starter, findRevisit };
