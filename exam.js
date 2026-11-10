/* 考公 / 考研 / 考编（全部为模拟数据）前端模块。

   数据来自服务端 /api/exam/*，本模块只负责呈现与交互：
     · 三个标签页：考公（gwy）/ 考研（ky）/ 考编（sb）
     · 列表（筛选 / 排序 / 分页）
     · 详情（近十年折线图 + 报考条件 + 历年数据）
     · 冲稳保匹配
     · 报考清单（可拖动排序，存本机 localStorage）

   页面是同步渲染的：page() 只返回 HTML，异步数据在后台取到后再调外部传入的
   render() 重绘。所有请求都带 seq 序号与 loading 标志，避免 render → page →
   render 递归，也避免旧响应覆盖新筛选。page() 在任何情况下都返回字符串。*/

const ALL = '全部';
const LIST_KEY = 'xuelu-exam-list-v1';
const LIST_MAX = 60;

const FALLBACK_KINDS = {
 gwy: {key: 'gwy', label: '考公', sub: '公务员考试（国考 / 省考）', fullScore: 200, lineLabel: '进面线', unitLabel: '招录单位', quotaLabel: '招录人数', applicantLabel: '报名人数', itemLabel: '岗位'},
 ky: {key: 'ky', label: '考研', sub: '硕士研究生招生', fullScore: 500, lineLabel: '复试线', unitLabel: '招生院校', quotaLabel: '拟招人数', applicantLabel: '报考人数', itemLabel: '专业'},
 sb: {key: 'sb', label: '考编', sub: '事业单位公开招聘', fullScore: 100, lineLabel: '笔试合格线', unitLabel: '招聘单位', quotaLabel: '招聘人数', applicantLabel: '报名人数', itemLabel: '岗位'}
};

export function createExam({esc, toast, api, render, storageScope=()=> 'visitor'}) {
 const S = {
  meta: null, metaLoading: false, metaError: '',
  kind: 'gwy',
  view: 'list',
  f: {q: '', region: ALL, category: ALL, examType: ALL, education: ALL, sort: 'line'},
  page: 1, size: 12,
  list: null, listLoading: false, listError: '', listSeq: 0,
  item: null, detail: null, detailLoading: false, detailError: '', detailSeq: 0,
  match: {open: true, score: '', region: '', education: ALL, major: '', category: ALL, political: false, result: null, loading: false, error: '', seq: 0},
   plan: {items: [], loaded: false, scope: null},
  res: {seed: 0, data: null, kind: null, loadedSeed: -1, loading: false, error: '', seq: 0}
 };

 /* ---------------- 小工具 ---------------- */
 const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
 const fmtScore = v => num(v) === null ? '—' : (Math.round(num(v) * 10) / 10).toFixed(1);
 const fmtInt = v => num(v) === null ? '—' : String(Math.round(num(v)));
 const fmtRatio = v => num(v) === null ? '—' : (Math.round(num(v) * 10) / 10).toFixed(1);
 const clampPct = v => Math.max(0, Math.min(100, num(v) ?? 0));
 const heatClass = h => {
  const s = String(h || '');
  if (s.includes('非常') || s.includes('激烈')) return 'hot';
  if (s.includes('较高')) return 'warm';
  if (s.includes('中等')) return 'mid';
  return 'cool';
 };

 function kindMeta() {
  const kinds = S.meta?.kinds || [];
  return kinds.find(k => k.key === S.kind) || FALLBACK_KINDS[S.kind] || FALLBACK_KINDS.gwy;
 }
 function yearNow() {
  const years = S.meta?.years || [];
  return years.length ? Math.max(...years) : 2025;
 }

 function skeleton(text) {
  return `<div class="ex-skeleton" aria-live="polite"><span class="ex-spinner" aria-hidden="true"></span><span>${esc(text)}</span></div>`;
 }
 function errorBox(text, retryAttr) {
  return `<div class="ex-error"><strong>加载失败</strong><p>${esc(text || '请稍后重试')}</p>${retryAttr ? `<button class="secondary" ${retryAttr}>重试</button>` : ''}</div>`;
 }
 function emptyBox(text) { return `<div class="empty">${esc(text)}</div>`; }

 /* ---------------- 取数 ---------------- */
 function ensureMeta() {
  if (S.meta || S.metaLoading || S.metaError) return;
  S.metaLoading = true;
  api('/exam/meta').then(meta => {
   S.meta = meta; S.metaLoading = false;
   const kinds = (meta.kinds || []).map(k => k.key);
   if (kinds.length && !kinds.includes(S.kind)) S.kind = kinds[0];
   render();
  }).catch(error => {
   S.metaLoading = false;
   S.metaError = error?.message || '考试基础数据加载失败';
   render();
  });
 }

 function ensureList() {
  if (S.list || S.listLoading || S.listError) return;
  loadList();
 }

 function listQuery() {
  const f = S.f, q = new URLSearchParams();
  q.set('region', f.region === ALL ? '' : f.region);
  q.set('category', f.category === ALL ? '' : f.category);
  q.set('examType', f.examType === ALL ? '' : f.examType);
  q.set('education', f.education === ALL ? '' : f.education);
  q.set('q', String(f.q || '').trim());
  q.set('sort', f.sort);
  q.set('page', String(S.page));
  q.set('size', String(S.size));
  q.set('year', String(yearNow()));
  return `/exam/${encodeURIComponent(S.kind)}/items?${q.toString()}`;
 }

 function loadList() {
  const seq = ++S.listSeq;
  S.listLoading = true; S.listError = '';
  api(listQuery()).then(data => {
   if (seq !== S.listSeq) return;
   S.list = data; S.listLoading = false;
   if (num(data.page) && data.page !== S.page) S.page = num(data.page);
   render();
  }).catch(error => {
   if (seq !== S.listSeq) return;
   S.listLoading = false;
   S.listError = error?.message || '列表加载失败';
   render();
  });
 }

 function loadDetail(id) {
  const seq = ++S.detailSeq;
  S.detailLoading = true; S.detailError = '';
  api(`/exam/${encodeURIComponent(S.kind)}/items/${encodeURIComponent(id)}`).then(data => {
   if (seq !== S.detailSeq) return;
   S.detail = data; S.detailLoading = false;
   render();
  }).catch(error => {
   if (seq !== S.detailSeq) return;
   S.detailLoading = false;
   S.detailError = error?.message || '详情加载失败';
   render();
  });
 }

 function switchKind(key) {
  const kinds = (S.meta?.kinds || []).map(k => k.key);
  if (!key || key === S.kind) return;
  if (kinds.length && !kinds.includes(key)) return;
  S.kind = key;
  S.view = 'list'; S.item = null; S.detail = null; S.detailError = '';
  // 类别 / 考试类型随 kind 变化，切页时一起重置
  S.f.category = ALL; S.f.examType = ALL;
  S.f.region = ALL; S.f.education = ALL; S.f.q = '';
  S.page = 1; S.list = null; S.listError = ''; S.listSeq++;
   S.match.result = null; S.match.error = '';
   S.match.seq++; S.match.loading=false; S.match.score='';
   S.detailSeq++; S.detailLoading=false;
   S.res.seq++; S.res.loading=false; S.res.data=null; S.res.error='';
  loadList();
  render();
 }

 /* ---------------- 通用控件 ---------------- */
 function selectField(name, label, values, current, all, filterAttr = true) {
  const options = (all ? [all] : []).concat(values || []);
  const attr = filterAttr ? ` data-ex-filter="${name}"` : '';
  return `<label class="ex-field">${esc(label)}<select${attr} name="${esc(name)}">${options.map(v => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;
 }

 function tabs() {
  const meta = S.meta || {};
  const kinds = meta.kinds || Object.values(FALLBACK_KINDS);
  return `<div class="ex-tabs" role="tablist">${kinds.map(k => `
   <button type="button" role="tab" aria-selected="${k.key === S.kind}" class="ex-tab ${k.key === S.kind ? 'active' : ''}" data-ex-kind="${esc(k.key)}">
    <span class="ex-tab-label">${esc(k.label)}</span>
    <span class="ex-tab-sub">${esc(k.sub || '')}</span>
    <span class="ex-tab-count">${meta.counts?.[k.key] ?? '—'} 个${esc(k.itemLabel || '')}</span>
   </button>`).join('')}</div>`;
 }

 function filterBar() {
  const meta = S.meta || {};
  return `<form id="ex-filter-form" class="ex-filters">
   <div class="ex-filter-row">
    <label class="ex-field ex-keyword">关键词<input id="ex-q" name="q" type="search" value="${esc(S.f.q)}" maxlength="40" placeholder="单位 / 岗位 / 专业" autocomplete="off"></label>
    ${selectField('region', '地区', meta.regions || [], S.f.region, ALL)}
    ${selectField('category', '类别', (meta.categories || {})[S.kind] || [], S.f.category, ALL)}
    ${selectField('examType', '考试类型', (meta.examTypes || {})[S.kind] || [], S.f.examType, ALL)}
    ${selectField('education', '学历要求', meta.educations || [], S.f.education, ALL)}
    <label class="ex-field">排序<select data-ex-filter="sort" name="sort">${[['line', '线从高到低'], ['line-asc', '线从低到高'], ['ratio', '竞争比从高到低'], ['ratio-asc', '竞争比从低到高'], ['quota', '招录人数'], ['org', '单位名称']].map(([v, t]) => `<option value="${v}" ${S.f.sort === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <button class="primary ex-apply" type="submit">筛选</button>
   </div>
  </form>`;
 }

 function itemCard(u) {
  const k = kindMeta();
  return `<button type="button" class="ex-card" data-ex-item="${esc(u.id)}">
   <span class="ex-card-head"><span class="ex-org">${esc(u.org || '')}</span><span class="ex-heat ex-heat-${heatClass(u.heat)}">${esc(u.heat || '—')}</span></span>
   <span class="ex-title">${esc(u.title || '')}</span>
   <span class="ex-meta">${esc(u.region || '')} · ${esc(u.city || '')} · ${esc(u.category || '')}</span>
   <span class="ex-badges"><span class="ex-type">${esc(u.examType || '')}</span><span class="ex-req">学历 ${esc(u.requirements?.education || '—')}</span></span>
   <span class="ex-nums"><span>${esc(k.lineLabel)} <b>${fmtScore(u.line)}</b></span><span>竞争比 <b>${fmtRatio(u.ratio)} : 1</b></span><span>${esc(k.quotaLabel)} ${fmtInt(u.quota)}</span></span>
  </button>`;
 }

 function pager() {
  const list = S.list;
  if (!list) return '';
  const page = num(list.page) || 1, pages = num(list.pages) || 1;
  return `<div class="ex-pager">
   <button class="secondary" data-ex-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← 上一页</button>
   <span class="ex-pager-info">第 ${page} / ${pages} 页 · 共 ${fmtInt(list.total)} 条</span>
   <button class="secondary" data-ex-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>下一页 →</button>
  </div>`;
 }

 /* ---------------- 报考清单（本机持久化） ---------------- */
 function loadPlan() {
  try {
    const raw = (typeof localStorage !== 'undefined' && localStorage) ? localStorage.getItem(LIST_KEY+':'+storageScope()) : '';
   const arr = raw ? JSON.parse(raw) : [];
   S.plan.items = Array.isArray(arr) ? arr.filter(row => row && row.id && (row.org || row.title)).slice(0, LIST_MAX) : [];
  } catch (_) { S.plan.items = []; }
 }
 function savePlan() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem(LIST_KEY+':'+storageScope(), JSON.stringify(S.plan.items));
  } catch (_) {}
 }

 function findInMatch(id) {
  const buckets = S.match.result?.buckets || {};
  return [...(buckets.chong || []), ...(buckets.wen || []), ...(buckets.bao || [])].find(x => x.id === id) || null;
 }

 function addToPlan(id) {
  const item = findInMatch(id) || (S.list?.items || []).find(x => x.id === id);
  if (!item) { toast('找不到这条记录'); return; }
  if (S.plan.items.some(row => row.id === item.id)) { toast('这条已经在清单里了'); return; }
  if (S.plan.items.length >= LIST_MAX) { toast(`清单最多 ${LIST_MAX} 条`); return; }
  S.plan.items.push({
   id: item.id, org: item.org, title: item.title, line: item.line, diff: item.diff,
   probability: item.probability, ratio: item.ratio, region: item.region, city: item.city,
   category: item.category, examType: item.examType, kind: item.kind || S.kind
  });
  savePlan();
  toast('已加入清单，共 ' + S.plan.items.length + ' 条');
  render();
 }

 function movePlan(index, dir) {
  const items = S.plan.items, j = index + dir;
  if (!Number.isInteger(index) || index < 0 || index >= items.length || j < 0 || j >= items.length) return;
  const tmp = items[index]; items[index] = items[j]; items[j] = tmp;
  savePlan(); render();
 }

 function movePlanTo(from, to) {
  const items = S.plan.items;
  if (!Number.isInteger(from) || !Number.isInteger(to)) return;
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return;
  const moved = items.splice(from, 1)[0];
  items.splice(to, 0, moved);
  savePlan(); render();
 }

 function removePlan(index) {
  if (!Number.isInteger(index) || index < 0 || index >= S.plan.items.length) return;
  S.plan.items.splice(index, 1); savePlan(); render();
 }

 // HTML5 拖拽要真实 DOM 事件：page() 渲染完用 setTimeout 挂上去；触屏端用上下箭头
 let dragFrom = null;
 function setupPlanDrag() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const list = document.getElementById('ex-plan-list');
  if (!list || !list.querySelectorAll) return;
  const rows = list.querySelectorAll('[data-ex-plan-row]');
  if (!rows || typeof rows.forEach !== 'function') return;
  rows.forEach(row => {
   row.addEventListener('dragstart', event => {
    dragFrom = Number(row.getAttribute('data-ex-plan-row'));
    row.classList.add('ex-dragging');
    if (event.dataTransfer) {
     event.dataTransfer.effectAllowed = 'move';
     try { event.dataTransfer.setData('text/plain', String(dragFrom)); } catch (_) {}
    }
   });
   row.addEventListener('dragend', () => { row.classList.remove('ex-dragging'); dragFrom = null; });
   row.addEventListener('dragover', event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; });
   row.addEventListener('drop', event => {
    event.preventDefault();
    const to = Number(row.getAttribute('data-ex-plan-row'));
    if (dragFrom === null || Number.isNaN(to)) return;
    const from = dragFrom; dragFrom = null;
    movePlanTo(from, to);
   });
  });
 }

 function planPanel() {
  const items = S.plan.items || [];
  return `<section class="site-panel ex-plan">
   <div class="ex-plan-head">
    <div><h3>报考清单</h3><p class="muted">模拟规划：拖动行或点箭头调整顺序，行序就是目标顺序</p></div>
    <div class="ex-plan-actions">
     <span class="ex-plan-count">已填 ${items.length} / ${LIST_MAX}</span>
     ${items.length ? '<button class="secondary" data-ex-plan-clear>清空</button>' : ''}
    </div>
   </div>
   ${items.length ? `<ol class="ex-plan-list" id="ex-plan-list">${items.map((it, index) => {
    const prob = num(it.probability), diff = num(it.diff);
    return `<li class="ex-plan-row" draggable="true" data-ex-plan-row="${index}">
     <span class="ex-plan-grip" aria-hidden="true">⠿</span>
     <span class="ex-plan-order">${index + 1}</span>
     <span class="ex-plan-item"><button type="button" class="ex-plan-name" data-ex-item="${esc(it.id)}">${esc(it.org || '')}</button><small>${esc(it.title || '')} · ${esc(it.region || '')}${it.city && it.city !== it.region ? ' ' + esc(it.city) : ''}</small></span>
     <span class="ex-plan-line">线 <b>${fmtScore(it.line)}</b></span>
     <span class="ex-plan-diff ${diff !== null && diff < 0 ? 'neg' : 'pos'}">${diff === null ? '—' : (diff > 0 ? '+' : '') + fmtScore(diff)}</span>
     <span class="ex-plan-prob">可能性 <b>${prob === null ? '—' : Math.round(prob) + '%'}</b></span>
     <span class="ex-plan-ops">
      <button type="button" class="secondary" data-ex-plan-up="${index}" ${index === 0 ? 'disabled' : ''} aria-label="上移">↑</button>
      <button type="button" class="secondary" data-ex-plan-down="${index}" ${index === items.length - 1 ? 'disabled' : ''} aria-label="下移">↓</button>
      <button type="button" class="secondary" data-ex-plan-del="${index}" aria-label="从清单移除">×</button>
     </span>
    </li>`;
   }).join('')}</ol>
   <p class="ex-plan-tip muted">清单只保存在这台电脑的浏览器里，不上传服务器。匹配结果里点「加入清单」即可添加。</p>`
   : '<p class="ex-plan-empty muted">清单还是空的。先在上面做一次「冲稳保匹配」，再点结果卡片上的「加入清单」。</p>'}
  </section>`;
 }

 /* ---------------- 冲稳保匹配 ---------------- */
 function runMatch(values) {
  const k = kindMeta();
  const scoreText = String(values.score ?? S.match.score ?? '').trim();
  const score = Number(scoreText);
  const m = S.match;
  m.score = scoreText;
  m.education = values.education || m.education || ALL;
  m.major = values.major !== undefined ? String(values.major || '') : m.major;
  m.region = values.region || m.region || ALL;
  m.category = values.category || m.category || ALL;
   m.political = !!values.political;
  m.error = ''; m.result = null;
  if (!scoreText || !Number.isFinite(score) || score <= 0) {
   m.error = '请输入有效的分数';
   m.loading = false;
   render();
   return;
  }
  const seq = ++m.seq;
  m.loading = true; m.open = true;
  render();
  const q = new URLSearchParams();
  q.set('score', String(score));
  if (m.region && m.region !== ALL) q.set('region', m.region);
  if (m.education && m.education !== ALL) q.set('education', m.education);
  if (m.major) q.set('major', m.major);
  if (m.category && m.category !== ALL) q.set('category', m.category);
  q.set('political', m.political ? '中共党员' : '');
  q.set('limit', '10');
  q.set('year', String(yearNow()));
  api(`/exam/${encodeURIComponent(S.kind)}/match?${q.toString()}`).then(result => {
   if (seq !== m.seq) return;
   m.result = result; m.loading = false;
   render();
  }).catch(error => {
   if (seq !== m.seq) return;
   m.loading = false;
   m.error = error?.message || '匹配失败';
   render();
  });
 }

 function matchCard(u) {
  const prob = num(u.probability), diff = num(u.diff);
  return `<div class="ex-match-card">
   <button type="button" class="ex-match-main" data-ex-item="${esc(u.id)}">
    <span class="ex-org">${esc(u.org || '')}</span>
    <span class="ex-title">${esc(u.title || '')}</span>
    <span class="ex-nums"><span>线 <b>${fmtScore(u.line)}</b></span><span class="ex-diff ${diff !== null && diff < 0 ? 'neg' : 'pos'}">分差 ${diff === null ? '—' : (diff > 0 ? '+' : '') + fmtScore(diff)}</span></span>
    <span class="ex-prob"><i style="width:${clampPct(prob)}%"></i></span>
    <span class="ex-prob-text"><b>${prob === null ? '—' : Math.round(prob) + '%'}</b><span>匹配度</span></span>
   </button>
   <button type="button" class="secondary ex-add" data-ex-add="${esc(u.id)}">加入清单</button>
  </div>`;
 }

 function matchResults(result) {
  const buckets = result.buckets || {}, counts = result.counts || {};
  const defs = [['chong', '冲', '分数略低于历年线'], ['wen', '稳', '分数与历年线接近'], ['bao', '保', '分数明显高于历年线']];
  const empty = defs.every(([key]) => (buckets[key] || []).length === 0);
  if (empty) return emptyBox('这个分数没有匹配到条目，可以换个分数、地区或放宽学历要求再试。');
  return `<div class="ex-buckets">${defs.map(([key, label, hint]) => {
   const items = buckets[key] || [], count = num(counts[key]) ?? items.length;
   return `<div class="ex-bucket ex-bucket-${key}">
    <div class="ex-bucket-head"><strong>${label}</strong><span class="muted">${count} 条</span></div>
    <p class="ex-bucket-hint">${hint}</p>
    ${items.length ? items.map(matchCard).join('') : emptyBox(`没有${label}一档的条目`)}
    ${count > items.length ? `<p class="ex-bucket-more muted">共 ${count} 条，此处显示前 ${items.length} 条</p>` : ''}
   </div>`;
  }).join('')}</div>`;
 }

 function matchPanel() {
  const k = kindMeta(), m = S.match, meta = S.meta || {};
  return `<section class="site-panel ex-match">
   <div class="ex-match-head">
    <div><h3>${esc(k.label)}匹配 · 冲稳保</h3><p class="muted">按「我的分数 − 该${esc(k.itemLabel)}的${esc(k.lineLabel)}」估算匹配度，满分 ${fmtInt(k.fullScore)} 分，仅供演示</p></div>
    <button class="secondary" data-ex-match-toggle>${m.open ? '收起' : '展开'}</button>
   </div>
   ${m.open ? `<form id="ex-match-form" class="ex-match-form">
    <label class="ex-field">我的分数<input name="score" type="number" inputmode="numeric" min="1" max="${fmtInt(k.fullScore)}" step="0.5" value="${esc(m.score)}" placeholder="如 ${k.key === 'ky' ? 360 : k.key === 'sb' ? 75 : 140}"></label>
    ${selectField('education', '学历', meta.educations || [], m.education, ALL, false)}
    <label class="ex-field">专业（可留空）<input name="major" type="text" maxlength="40" value="${esc(m.major)}" placeholder="如 法学"></label>
    ${selectField('region', '地区', meta.regions || [], m.region, ALL, false)}
    ${selectField('category', '类别', (meta.categories || {})[S.kind] || [], m.category, ALL, false)}
    <label class="ex-field ex-check"><input type="checkbox" name="political" value="中共党员" ${m.political ? 'checked' : ''}> 仅看中共党员</label>
    <button class="primary" type="submit" data-ex-match>开始匹配</button>
   </form>
   <p class="ex-tip muted">冲：分数略低于历年线；稳：与历年线接近；保：分数明显高于历年线。${esc(k.label)}满分 ${fmtInt(k.fullScore)} 分。</p>
   ${m.loading ? skeleton('正在计算冲稳保…') : ''}
   ${m.error ? `<div class="ex-match-error">${esc(m.error)}</div>` : ''}
   ${!m.loading && !m.error && m.result ? matchResults(m.result) : ''}`
   : `<p class="muted ex-match-fold">展开后可按分数查看冲刺、稳妥与保底${esc(k.itemLabel)}。</p>`}
  </section>`;
 }

 /* ---------------- 折线图（线 + 竞争比，双轴） ---------------- */
 function chart(d) {
  const series = (d.series || []).filter(p => num(p.line) !== null).sort((a, b) => a.year - b.year);
  if (series.length < 2) return '<p class="muted">历年数据不足，暂无法绘制趋势图。</p>';
  const nat = (d.nationalSeries || []).filter(p => num(p.line) !== null).sort((a, b) => a.year - b.year);
  const W = 640, H = 240, P = {l: 52, r: 58, t: 26, b: 32};
  const years = series.map(p => p.year);
  const innerW = W - P.l - P.r, innerH = H - P.t - P.b;
  const xOf = year => {
   const i = years.indexOf(year);
   return P.l + (years.length > 1 ? innerW * (i / (years.length - 1)) : innerW / 2);
  };
  const span = vals => {
   const nums = vals.filter(v => num(v) !== null).map(v => num(v));
   if (!nums.length) return [0, 1];
   let min = Math.min(...nums), max = Math.max(...nums);
   if (!(max > min)) { min -= 1; max += 1; }
   const pad = (max - min) * 0.15;
   return [min - pad, max + pad];
  };
  const [lmin, lmax] = span(series.map(p => num(p.line)).concat(nat.map(p => num(p.line))));
  const ratioVals = series.map(p => num(p.ratio));
  const hasRatio = ratioVals.some(v => v !== null);
  const [rmin, rmax] = hasRatio ? span(ratioVals) : [0, 1];
  const yLine = v => P.t + innerH * (1 - (num(v) - lmin) / (lmax - lmin));
  const yRatio = v => P.t + innerH * (1 - (num(v) - rmin) / (rmax - rmin));
  const safe = n => Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;

  const grid = [0, 0.5, 1].map(t => {
   const yy = P.t + innerH * t;
   const lv = lmax - (lmax - lmin) * t;
   const rv = hasRatio ? rmax - (rmax - rmin) * t : null;
   return `<line x1="${P.l}" y1="${safe(yy)}" x2="${W - P.r}" y2="${safe(yy)}" class="ex-grid-line"/>`
    + `<text x="${P.l - 8}" y="${safe(yy + 4)}" class="ex-axis" text-anchor="end">${lv.toFixed(0)}</text>`
    + (hasRatio ? `<text x="${W - P.r + 8}" y="${safe(yy + 4)}" class="ex-axis" text-anchor="start">${rv.toFixed(0)}</text>` : '');
  }).join('');
  const ticks = years.map(year => `<text x="${safe(xOf(year))}" y="${H - 8}" class="ex-axis" text-anchor="middle">${year}</text>`).join('');
  const linePts = series.map(p => `${safe(xOf(p.year))},${safe(yLine(p.line))}`).join(' ');
  const ratioPts = series.filter(p => num(p.ratio) !== null).map(p => `${safe(xOf(p.year))},${safe(yRatio(p.ratio))}`).join(' ');
  const natPts = nat.filter(p => years.includes(p.year)).map(p => `${safe(xOf(p.year))},${safe(yLine(p.line))}`).join(' ');
  const marks = (() => {
   const withLine = series.filter(p => num(p.line) !== null);
   if (!withLine.length) return '';
   const top = withLine.reduce((a, b) => num(b.line) > num(a.line) ? b : a);
   const low = withLine.reduce((a, b) => num(b.line) < num(a.line) ? b : a);
   return [top, low].map(p => `<circle cx="${safe(xOf(p.year))}" cy="${safe(yLine(p.line))}" r="4.5" class="ex-mark"/>`
    + `<text x="${safe(xOf(p.year))}" y="${safe(yLine(p.line) - 10)}" class="ex-mark-text" text-anchor="middle">${p.year}</text>`).join('');
  })();

  return `<div class="ex-chart">
   <div class="ex-chart-legend">
    <span class="ex-legend ex-legend-line">${esc(d.lineLabel || '参考分数线')}</span>
    ${hasRatio ? '<span class="ex-legend ex-legend-ratio">竞争比</span>' : ''}
    ${nat.length ? '<span class="ex-legend ex-legend-nat">国家线</span>' : ''}
   </div>
   <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="历年参考分数线与竞争比趋势" preserveAspectRatio="xMidYMid meet">
    ${grid}
    ${nat.length ? `<polyline class="ex-line ex-line-nat" points="${natPts}"/>` : ''}
    ${hasRatio ? `<polyline class="ex-line ex-line-ratio" points="${ratioPts}"/>` : ''}
    <polyline class="ex-line ex-line-main" points="${linePts}"/>
    ${marks}
    ${ticks}
   </svg>
   ${hasRatio ? '<p class="ex-chart-note muted">左轴为分数，右轴为竞争比（报名人数 ÷ 招录人数）。</p>' : ''}
  </div>`;
 }

 function chartSummary(d) {
  const series = (d.series || []).filter(p => num(p.line) !== null).sort((a, b) => a.year - b.year);
  if (series.length < 2) return '';
  const first = series[0], last = series[series.length - 1];
  const delta = num(last.line) - num(first.line);
  const dir = delta > 0 ? '上涨' : delta < 0 ? '下降' : '基本持平';
  const ratioFirst = num(first.ratio), ratioLast = num(last.ratio);
  const ratioText = ratioFirst !== null && ratioLast !== null
   ? `，竞争比从 ${fmtRatio(ratioFirst)} : 1 ${ratioLast >= ratioFirst ? '升到' : '降到'} ${fmtRatio(ratioLast)} : 1`
   : '';
  return `<p class="ex-chart-summary">${esc(String(first.year))}–${esc(String(last.year))} 年${esc(d.lineLabel || '参考分数线')}从 ${fmtScore(first.line)} 变到 ${fmtScore(last.line)}，${dir} ${fmtScore(Math.abs(delta))} 分${ratioText}。</p>`;
 }

 /* ---------------- 详情 ---------------- */
 function requirementsTable(d) {
  const r = d.requirements || {};
  const rows = [
   ['学历要求', r.education],
   ['专业要求', r.major],
   ['政治面貌', r.political],
   ['基层工作经历', r.experience],
   ['其他证书', r.certificate || '不限'],
   ['是否仅限应届', r.freshOnly ? '仅限应届毕业生' : '不限']
  ];
  return `<div class="ex-table-wrap"><table class="ex-table">
   <thead><tr><th>报考条件</th><th>要求</th></tr></thead>
   <tbody>${rows.map(([label, value]) => `<tr><th>${esc(label)}</th><td>${esc(value || '—')}</td></tr>`).join('')}</tbody>
  </table></div>`;
 }

 function yearlyTable(d) {
  const series = (d.series || []).slice().sort((a, b) => b.year - a.year);
  if (!series.length) return '';
  return `<div class="ex-table-wrap"><table class="ex-table">
   <thead><tr><th>年份</th><th>${esc(d.lineLabel || '参考分数线')}</th><th>竞争比</th><th>${esc(d.applicantLabel || '报名人数')}</th><th>${esc(d.quotaLabel || '招录人数')}</th></tr></thead>
   <tbody>${series.map(p => `<tr><td>${esc(String(p.year))}</td><td><b>${fmtScore(p.line)}</b></td><td>${fmtRatio(p.ratio)} : 1</td><td>${fmtInt(p.applicants)}</td><td>${fmtInt(p.quota)}</td></tr>`).join('')}</tbody>
  </table></div>`;
 }

 function detailView() {
  const back = '<button class="secondary ex-back" data-ex-back>← 返回列表</button>';
  if (S.detailError) return back + errorBox(S.detailError, 'data-ex-dretry');
  const d = S.detail;
  if (!d || S.detailLoading) return back + skeleton('正在加载详情…');
  const k = kindMeta();
  return `${back}
   <div class="ex-detail-head">
    <div>
     <div class="ex-detail-org">${esc(d.org || '')}</div>
     <h2 class="ex-detail-title">${esc(d.title || '')}</h2>
     <div class="ex-badges">
      <span class="ex-type">${esc(d.examType || '')}</span>
      <span class="ex-tag">${esc(d.category || '')}</span>
      <span class="ex-tag">${esc(d.region || '')}${d.city ? ' · ' + esc(d.city) : ''}</span>
      <span class="ex-heat ex-heat-${heatClass(d.heat)}">${esc(d.heat || '—')}</span>
     </div>
    </div>
   </div>
   <div class="ex-stats">
    <div class="ex-stat ex-stat-main"><span class="ex-stat-label">${esc(d.lineLabel || k.lineLabel)}</span><span class="ex-stat-value">${fmtScore(d.line)}</span><span class="ex-stat-hint">${esc(String(d.year))} 年 · 满分 ${fmtInt(d.fullScore)}</span></div>
    <div class="ex-stat"><span class="ex-stat-label">竞争比</span><span class="ex-stat-value">${fmtRatio(d.ratio)}<small> : 1</small></span><span class="ex-stat-hint">${esc(d.applicantLabel || '报名人数')} ÷ ${esc(d.quotaLabel || '招录人数')}</span></div>
    <div class="ex-stat"><span class="ex-stat-label">${esc(d.quotaLabel || '招录人数')}</span><span class="ex-stat-value">${fmtInt(d.quota)}</span><span class="ex-stat-hint">${esc(d.unitLabel || '')}</span></div>
    <div class="ex-stat"><span class="ex-stat-label">${esc(d.applicantLabel || '报名人数')}</span><span class="ex-stat-value">${fmtInt(d.applicants)}</span><span class="ex-stat-hint">${esc(String(d.year))} 年</span></div>
   </div>
   ${d.nationalLine !== null && d.nationalLine !== undefined ? `<p class="ex-national">当年国家线 <b>${fmtScore(d.nationalLine)}</b> 分，本条${esc(d.lineLabel || '线')}高出国家线 <b>${fmtScore(num(d.line) - num(d.nationalLine))}</b> 分（模拟数据）。</p>` : ''}
   <section class="site-panel"><h3>近十年趋势</h3>${chart(d)}${chartSummary(d)}</section>
   <section class="site-panel"><h3>报考条件</h3>${requirementsTable(d)}</section>
   <section class="site-panel"><h3>历年数据</h3>${yearlyTable(d)}</section>
   <p class="ex-disclaimer">${esc(d.disclaimer || '全部数据均为模拟生成，仅用于功能演示。')}</p>`;
 }

 /* ---------------- 备考机构 / 课程 / 图书推荐 ---------------- */
 function ensureResources() {
  const res = S.res;
  if (!S.meta) return;
   if (res.loading || res.error) return;
  if (res.data && res.kind === S.kind && res.loadedSeed === res.seed) return;
   const seq = ++res.seq,requestKind=S.kind;
  res.loading = true; res.error = '';
  api(`/exam/resources?kind=${encodeURIComponent(S.kind)}&seed=${res.seed}`).then(data => {
   if (seq !== res.seq) return;
    res.data = data; res.kind = requestKind; res.loadedSeed = res.seed; res.loading = false;
   render();
  }).catch(error => {
   if (seq !== res.seq) return;
   res.loading = false; res.error = error?.message || '推荐内容加载失败';
   render();
  });
 }

 // 换一批：改 seed 重新取，排序会变
 function reseed() {
  S.res.seed = (S.res.seed + 1) % 1000;
  S.res.data = null; S.res.loading = false; S.res.error = '';
  render();
  ensureResources();
 }

 function orgCard(o) {
  return `<article class="ex-org">
   <div class="ex-org-head"><strong>${esc(o.name)}</strong><span class="ex-rating">★ ${fmtScore(o.rating)}</span></div>
   <p class="ex-org-meta">${esc(o.city)} · ${esc(o.focus)}</p>
   <p class="ex-org-intro">${esc(o.intro)}</p>
   <div class="ex-tags">${(o.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>
   <p class="ex-org-stat">${fmtInt(o.students)} 名学员 · ${fmtInt(o.courses)} 门课程</p>
  </article>`;
 }

 function courseCard(c) {
  return `<article class="ex-course">
   <div class="ex-course-head"><strong>${esc(c.name)}</strong><span class="ex-price">¥${fmtInt(c.price)}</span></div>
   <p class="ex-course-meta">${esc(c.org)} · ${esc(c.mode)} · ${fmtInt(c.hours)} 课时 · ${esc(c.level)}</p>
   <div class="ex-course-foot"><span class="ex-rating">★ ${fmtScore(c.rating)}</span><span class="muted">${fmtInt(c.enrolled)} 人在学</span></div>
   <button class="secondary ex-consult" type="button" data-ex-consult="${esc(c.id)}">模拟咨询</button>
  </article>`;
 }

 function bookCard(b) {
  return `<article class="ex-book">
   <div class="ex-book-head"><strong>${esc(b.title)}</strong><span class="ex-price">¥${fmtInt(b.price)}</span></div>
   <p class="ex-book-meta">${esc(b.author)} · ${esc(b.press)}</p>
   <div class="ex-tags">${(b.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>
   <div class="ex-course-foot"><span class="ex-rating">★ ${fmtScore(b.rating)}</span><span class="muted">已售 ${fmtInt(b.sold)}</span></div>
  </article>`;
 }

 function resourceSection() {
  const res = S.res, k = kindMeta();
  const head = `<div class="ex-res-head">
    <div><h3>备考机构与课程</h3><div class="muted">按「${esc(k.label)}」方向推荐 · 全部为模拟内容</div></div>
    <button class="secondary" type="button" data-ex-reseed ${res.loading ? 'disabled' : ''}>换一批</button>
   </div>`;
  if (res.error) {
   return `<section class="site-panel ex-res">${head}<p class="ex-res-note">${esc(res.error)} <button class="secondary" type="button" data-ex-resretry>重试</button></p></section>`;
  }
  if (!res.data || res.kind !== S.kind) {
   return `<section class="site-panel ex-res">${head}<p class="ex-res-note">正在加载机构、课程与图书推荐…</p></section>`;
  }
  return `<section class="site-panel ex-res">${head}
   <h4 class="ex-res-title">机构推荐</h4>
   <div class="ex-res-orgs">${(res.data.orgs || []).map(orgCard).join('')}</div>
   <h4 class="ex-res-title">课程推荐</h4>
   <div class="ex-res-courses">${(res.data.courses || []).map(courseCard).join('')}</div>
   <h4 class="ex-res-title">资料与图书推荐</h4>
   <div class="ex-res-books">${(res.data.books || []).map(bookCard).join('')}</div>
   <p class="ex-res-note">${esc(res.data.disclaimer || '')}</p>
  </section>`;
 }

 /* ---------------- 列表页 ---------------- */
 function listView() {
  const k = kindMeta();
  const list = S.list;
  let body;
  if (S.listError) body = errorBox(S.listError, 'data-ex-retry');
  else if (!list || S.listLoading) body = skeleton(S.listLoading ? '正在加载列表…' : '正在准备数据…');
  else if (!list.items || !list.items.length) body = emptyBox('没有符合条件的条目，试试放宽地区、类别或学历筛选。');
  else body = `<div class="ex-grid">${list.items.map(itemCard).join('')}</div>${pager()}`;
  const total = list ? fmtInt(list.total) : '—';
  return `<div class="section-head"><div><h2>考公考研 · ${esc(k.label)}</h2><div class="muted">模拟数据 · 共 ${total} 个${esc(k.itemLabel)}，含 ${esc(String(yearNow()))} 年数据</div></div></div>
   ${tabs()}
   ${matchPanel()}${planPanel()}
   ${filterBar()}
   <div class="ex-result-bar">${list ? `参考 ${esc(String(list.year ?? yearNow()))} 年数据，共 ${fmtInt(list.total)} 个${esc(k.itemLabel)}` : `按条件筛选${esc(k.itemLabel)}`}</div>
   ${body}
   ${resourceSection()}
   <p class="ex-disclaimer">全部单位、岗位、参考分数线与竞争比均为模拟数据，仅供功能演示，不作为升学依据。</p>`;
 }

 /* ---------------- 对外 ---------------- */
 function pageBody() {
   if (!S.plan.loaded || S.plan.scope!==storageScope()) { loadPlan(); S.plan.loaded = true; S.plan.scope=storageScope(); }
  if (S.metaError) return errorBox(S.metaError, 'data-ex-mretry');
  ensureMeta();
  if (S.view === 'detail' && S.item) return detailView();
  if (S.meta) { ensureList(); ensureResources(); }
  return listView();
 }

 function page() {
  const html = pageBody();
  if (typeof setTimeout === 'function') setTimeout(setupPlanDrag, 0);
  return html;
 }

 function applyFilters(data) {
  const f = S.f;
  if (data.q !== undefined) f.q = String(data.q || '').slice(0, 40);
  if (data.region !== undefined) f.region = data.region || ALL;
  if (data.category !== undefined) f.category = data.category || ALL;
  if (data.examType !== undefined) f.examType = data.examType || ALL;
  if (data.education !== undefined) f.education = data.education || ALL;
  if (data.sort) f.sort = data.sort;
  S.page = 1; S.list = null; S.listError = ''; S.listSeq++;
  loadList();
  render();
 }

  function openDetail(id) {
   const saved=S.plan.items.find(row=>row.id===id);
   if(saved?.kind&&saved.kind!==S.kind)switchKind(saved.kind);
  S.view = 'detail';
  S.item = {id};
  S.detail = null; S.detailError = '';
  loadDetail(id);
  render();
 }

 function click(b) {
  if (b.dataset.exKind) { switchKind(b.dataset.exKind); return; }
  if (b.dataset.exItem) { openDetail(b.dataset.exItem); return; }
  if (b.hasAttribute('data-ex-back')) { S.view = 'list'; S.item = null; S.detail = null; render(); return; }
  if (b.dataset.exPage) {
   const target = Number(b.dataset.exPage);
   if (!Number.isInteger(target) || target < 1) return;
   const pages = num(S.list?.pages) || 1;
   if (target > pages) return;
   S.page = target; S.list = null; S.listError = ''; S.listSeq++;
   loadList(); render();
   return;
  }
  if (b.hasAttribute('data-ex-retry')) { S.listError = ''; S.list = null; loadList(); render(); return; }
  if (b.hasAttribute('data-ex-mretry')) { S.metaError = ''; ensureMeta(); render(); return; }
  if (b.hasAttribute('data-ex-dretry') && S.item) { S.detailError = ''; loadDetail(S.item.id); render(); return; }
  if (b.hasAttribute('data-ex-match-toggle')) { S.match.open = !S.match.open; render(); return; }
  if (b.dataset.exAdd) { addToPlan(b.dataset.exAdd); return; }
  if (b.dataset.exPlanUp) { movePlan(Number(b.dataset.exPlanUp), -1); return; }
  if (b.dataset.exPlanDown) { movePlan(Number(b.dataset.exPlanDown), 1); return; }
  if (b.dataset.exPlanDel) { removePlan(Number(b.dataset.exPlanDel)); return; }
  if (b.hasAttribute('data-ex-plan-clear')) { S.plan.items = []; savePlan(); toast('清单已清空'); render(); return; }
  if (b.hasAttribute('data-ex-reseed')) { reseed(); return; }
  if (b.hasAttribute('data-ex-resretry')) { S.res.error = ''; S.res.loading = false; ensureResources(); render(); return; }
   if (b.dataset.exConsult) { toast('模拟咨询：未提交或保存意向，不会联系机构'); return; }
  // 其余按钮（导航等）在目标页里也会被路由进来，这里必须安静地 no-op
 }

 function change(el) {
  const field = el?.dataset?.exFilter;
  if (!field) return false;
  const f = S.f;
  if (field === 'sort') f.sort = el.value || 'line';
  else if (field in f) f[field] = el.value || ALL;
  else return false;
  S.page = 1; S.list = null; S.listError = ''; S.listSeq++;
  loadList();
  render();
  return true;
 }

 function submit(form, data) {
  if (!form || !form.id) return false;
  if (form.id === 'ex-filter-form') { applyFilters(data || {}); return true; }
  if (form.id === 'ex-match-form') { runMatch(data || {}); return true; }
  return false;
 }

 return {page, click, change, submit};
}
