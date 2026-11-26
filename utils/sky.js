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

// 交给夜空之后：按今晚写了什么，给一句贴着内容的回应。
// 纯本地规则：文字不外传、不接 AI；只在用户自己的设备上读刚写下的心事。
const sootheRules = [
  // 正向先判断，且优先于「想念 / 想起」类规则，避免把开心回忆误读成难过
  { re: /开心|高兴|兴奋|惊喜|顺利|通过|成功了|做到了|喜欢|被爱|幸福|温暖|美好|感动|笑了|被夸|收到好消息/, line: '这份开心，今晚先替你收好。' },
  { re: /加班|汇报|被裁|失业|领导|同事|项目|工作|deadline/i, unless: /想起|回忆/, line: '今天已经够久了，剩下的交给明天。' },
  {
    re: /分手|失恋|孤独|想念|想他|想她|一个人|吵架|冷战/,
    unless: /开心|高兴|幸福|温暖|美好|感动|笑了|被爱|想起|回忆/,
    line: '想念一个人，不丢人。今晚先抱抱自己。'
  },
  { re: /钱|房租|贷款|账单|欠|工资|存款/, unless: /想起|回忆/, line: '钱的事明天再算，今晚你先睡。' },
  { re: /爸妈|父母|家里|家人|孩子|妈妈|爸爸/, unless: /想起|回忆/, line: '家人的事，先放到夜空里。你今天已经撑住了。' },
  { re: /焦虑|担心|睡不着|失眠|紧张|害怕|压力/, line: '担心不会在夜里变少，但你可以先躺下来。' },
  { re: /委屈|难过|哭|心碎|失望|累|疲惫|撑不住/, line: '你已经撑了很久了，今晚可以卸下来。' },
  { re: /未来|以后|迷茫|选择|决定|不确定/, unless: /想起|回忆/, line: '还没到来的事，不用今晚就回答。' },
  // 只是回忆，不预设是想念或难过（放在情绪规则之后，真正难过的仍会被前面接住）
  { re: /想起|回忆|以前|那天/, line: '想起来的，就先放在这里。' }
];
const sootheByTag = {
  工作: '今天已经够久了，剩下的交给明天。',
  感情: '想念一个人，不丢人。今晚先抱抱自己。',
  金钱: '钱的事明天再算，今晚你先睡。',
  家庭: '家人的事，先放到夜空里。你今天已经撑住了。',
  未来: '还没到来的事，不用今晚就回答。',
  说不清: '说不清也没关系，你已经写下来了。'
};
function sootheFor(star) {
  if (!star) return '';
  const text = String(star.text || '');
  const tag = String(star.tag || '');
  for (let i = 0; i < sootheRules.length; i++) {
    const rule = sootheRules[i];
    if (rule.re.test(text) && !(rule.unless && rule.unless.test(text))) return rule.line;
  }
  return sootheByTag[tag] || '写下来就好，剩下的交给夜色。';
}

// 情绪强度与情绪维度：仅本机使用，不随云同步上传
// key 沿用旧值，保证已有本地草稿/星志无需迁移；label 改为中性表达，
// 不预设用户写的一定是难过的事，开心、兴奋、失望等同样适用。
const INTENSITIES = [
  { key: 'ok', label: '淡淡', value: 1 },
  { key: 'some', label: '比较明显', value: 2 },
  { key: 'heavy', label: '很强烈', value: 3 }
];
const EMOTIONS = ['平静', '开心', '兴奋', '安心', '累', '烦', '委屈', '失望', '空'];
const NOW_OPTIONS = [
  { key: 'better', label: '淡了些' },
  { key: 'same', label: '还是那样' },
  { key: 'hard', label: '更强烈' }
];
const intensityLabels = { ok: '淡淡', some: '比较明显', heavy: '很强烈' };
const nowLabels = { better: '淡了些', same: '还是那样', hard: '更强烈' };
function intensityLabel(k) { return intensityLabels[k] || ''; }
function intensityValue(k) {
  const item = INTENSITIES.filter(x => x.key === k)[0];
  return item ? item.value : 0;
}
function nowLabel(k) { return nowLabels[k] || ''; }
function moodText(star) {
  if (!star) return '';
  return [intensityLabel(star.intensity), star.emotion || ''].filter(Boolean).join(' · ');
}

const starters = [
  '今晚，我最想记下的是……',
  '有件事，我白天一直没说出口：',
  '今天有个瞬间，我突然想记下来——',
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

module.exports = {
  moonPhase, calmLine, calmLines, sootheFor, starter, findRevisit,
  INTENSITIES, EMOTIONS, NOW_OPTIONS, intensityLabel, intensityValue, nowLabel, moodText
};
