/* 学鹭伴学 · 纯静态演示后端
 * 用 fetch 拦截层在浏览器里复现 server.mjs 的只读接口与关键写接口。
 * 数据来自 demo-data.json（由源站真实响应导出，手机号已脱敏）。
 * 所有写操作只作用于内存，刷新即还原；不发任何网络请求。
 */
import {handleExam, handleGaokao} from './demo-model.js';

const DEMO_PHONE = '13800000000';
const DEMO_PHONE_2 = '13800000001';
const REAL_FETCH = window.fetch.bind(window);
const DATA_URL = new URL('./demo-data.json', import.meta.url).href;

let DB = null;
let ready = null;

const clone = v => structuredClone(v);

function boot() {
  if (ready) return ready;
  ready = REAL_FETCH(DATA_URL)
    .then(r => r.json())
    .then(raw => {
      const services = raw['/api/services'] || [];
      // 固定时段演示排期：与服务端 serviceSlots 同口径
      const TUTOR_SLOTS = [...new Set(services.filter(s => s.type === 'tutor')
        .flatMap(s => [...(s.calendar?.slots || [])]))];
      DB = {
        raw,
        services,
        institutions: raw['/api/institutions'] || [],
        merchants: raw['/api/merchants'] || [],
        content: raw['/api/content'] || {},
        profile: clone(raw['/api/profile'] || {}),
        orders: clone(raw['/api/orders'] || []),
        feedback: [],
        applications: [],
        serviceExtra: raw.__serviceExtra || {},
        favorites: [],
        demands: [],
        providerOrders: [],
        commissions: [],
        verification: [],
        TUTOR_SLOTS,
      };
      return DB;
    });
  return ready;
}

/* ---------------- 工具 ---------------- */
const WEEKDAY_LABEL = {0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六'};
const WEEKDAYS = {'周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 0};
const WEEKDAY_PREFIX = /^(周[一二三四五六日])\s*/;
const PHONE = /^1\d{10}$/;
const RELATIONS = ['父亲', '母亲', '祖父', '祖母', '外祖父', '外祖母', '其他监护人'];
const GENDERS = ['男', '女', '未填写'];
const PERIODS = null;

const weekdayOf = d => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
};
const validDate = d => {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split('-').map(Number);
  if (m < 1 || m > 12 || day < 1 || day > 31) return false;
  const t = new Date(Date.UTC(y, m - 1, day));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === day;
};
const slotWeekday = slot => {
  const m = WEEKDAY_PREFIX.exec(typeof slot === 'string' ? slot : '');
  return m ? m[1] : null;
};
const cnToday = () => {
  const now = new Date(Date.now() + 8 * 3600e3);
  return now.toISOString().slice(0, 10);
};
const clean = (v, max = 100) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const optClean = (obj, key, max) => {
  if (!Object.hasOwn(obj, key)) return undefined;
  if (obj[key] === undefined || obj[key] === null || obj[key] === '') return undefined;
  if (typeof obj[key] !== 'string') return undefined;
  return obj[key].trim().slice(0, max);
};
const fail = (message, status = 400) => { throw {__demoError: true, message, status}; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'demo-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

const serviceSlots = (s, db) =>
  Array.isArray(s?.calendar?.slots) ? s.calendar.slots
    : (s?.type === 'tutor' ? [...db.TUTOR_SLOTS] : []);
const findService = (db, id) => db.services.find(s => s.id === id);
const isActiveOrder = o => ['paid', 'completed'].includes(o.status);
const orderSessions = o => {
  if (Array.isArray(o.sessions) && o.sessions.length) {
    return o.sessions.filter(x => x && typeof x.date === 'string' && typeof x.slot === 'string');
  }
  if (o.type === 'tutor' && o.slot) return [{date: typeof o.date === 'string' ? o.date : '', slot: o.slot}];
  return [];
};
const findPackage = (s, id) => (Array.isArray(s.packages) ? s.packages : []).find(p => p.id === id);

/* ---------------- 响应封装 ---------------- */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'},
  });
}

/* ---------------- 校验（对齐 server.mjs） ---------------- */
function validateExtra(db, s, b) {
  const out = {};
  const guardian = optClean(b, 'guardian', 30);
  if (guardian !== undefined) out.guardian = guardian;
  const relation = optClean(b, 'relation', 20);
  if (relation !== undefined) { if (!RELATIONS.includes(relation)) fail('请选择有效的监护人关系'); out.relation = relation; }
  const phone = optClean(b, 'guardianPhone', 20);
  if (phone !== undefined) { if (!PHONE.test(phone)) fail('监护人手机号格式不正确'); out.guardianPhone = phone; }
  if (b.age !== undefined && b.age !== null && b.age !== '') {
    const n = Number(b.age);
    if (!Number.isInteger(n) || n < 1 || n > 99) fail('学员年龄须为 1–99 的整数');
    out.age = n;
  }
  const gender = optClean(b, 'gender', 10);
  if (gender !== undefined) { if (!GENDERS.includes(gender)) fail('请选择有效的性别'); out.gender = gender; }
  const address = optClean(b, 'address', 200);
  if (address !== undefined) out.address = address;

  if (s.type === 'bus') {
    const detail = s.busDetail || {};
    const stops = Array.isArray(detail.stops) ? detail.stops : [];
    const start = optClean(b, 'startPoint', 100);
    if (start !== undefined) { if (!stops.includes(start)) fail('请选择有效的上车站点'); out.startPoint = start; }
    const end = optClean(b, 'endPoint', 100);
    if (end !== undefined) { if (!stops.includes(end)) fail('请选择有效的下车站点'); out.endPoint = end; }
    const period = optClean(b, 'period', 10);
    if (period !== undefined) {
      const allowed = s.busDetail?.period || s.period || [];
      if (!allowed.includes(period)) fail('该线路不支持所选订购周期');
      out.period = period;
    }
  }
  return out;
}

function validateSessions(db, s, input) {
  if (!Array.isArray(input)) fail('预约时段须为数组');
  if (input.length < 1) fail('请至少选择 1 个预约时段');
  if (input.length > 20) fail('一次最多预约 20 个时段');
  const available = serviceSlots(s, db);
  const today = cnToday();
  const seen = new Set();
  return input.map((raw, index) => {
    const at = '第 ' + (index + 1) + ' 个预约时段';
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(at + '格式不正确');
    for (const key of Object.keys(raw)) if (!['date', 'slot'].includes(key)) fail(at + '不支持字段：' + key);
    const date = typeof raw.date === 'string' ? raw.date.trim() : '';
    const slot = typeof raw.slot === 'string' ? raw.slot : '';
    if (!validDate(date)) fail(at + '的日期格式应为 YYYY-MM-DD 且真实存在');
    if (date < today) fail(at + '的日期已过，请选择今天或之后的日期');
    if (!slot) fail(at + '缺少时段');
    if (!available.includes(slot)) fail('请选择有效的预约时段');
    const weekday = slotWeekday(slot);
    if (!weekday) fail('该时段未配置星期，暂不支持按日期预约：' + slot);
    if (WEEKDAYS[weekday] !== weekdayOf(date)) {
      fail(at + '的日期 ' + date + ' 是' + WEEKDAY_LABEL[weekdayOf(date)] + '，与时段「' + slot + '」不一致');
    }
    const key = date + '|' + slot;
    if (seen.has(key)) fail(at + '与前面的时段重复');
    seen.add(key);
    // 已支付/已完成订单占用的时段不可再约
    for (const o of db.orders) {
      if (o.serviceId !== s.id || !isActiveOrder(o)) continue;
      for (const item of orderSessions(o)) if (item.date === date && item.slot === slot) fail('该时段已被预约');
    }
    return {date, slot};
  });
}

/* ---------------- 路由 ---------------- */
async function route(path, search, method, body) {
  const db = await boot();
  const url = new URL(path + search, 'https://demo.local');

  /* exam / gaokao：浏览器内复用真实模型 */
  if (path.startsWith('/api/exam/') || path.startsWith('/api/gaokao/')) {
    if (method !== 'GET') return json({error: '此功能仅支持只读查询'}, 405);
    try {
      const result = path.startsWith('/api/gaokao/') ? handleGaokao(url) : handleExam(url);
      return json(result, 200);
    } catch (e) {
      return json({error: e.message || '接口错误'}, e.status || 400);
    }
  }

  if (path === '/api/health') return json({ok: true, mode: 'static-demo', city: '哈尔滨', authRequired: false});
  if (path === '/api/auth/me') {
    return json({authenticated: false, user: null, application: null, institutionId: null});
  }
  if (path === '/api/auth/login') return json({error: '演示站不支持登录'}, 401);
  if (path === '/api/auth/register') return json({error: '演示站不支持注册'}, 401);
  if (path === '/api/auth/logout') return json({ok: true});

  if (path === '/api/services' && method === 'GET') {
    const type = clean(url.searchParams.get('type') || '', 10);
    const list = db.services.map(s => withExtras(db, s));
    return json(type ? list.filter(s => s.type === type) : list);
  }

  if (path === '/api/institutions' && method === 'GET') return json(db.institutions);
  if (path === '/api/merchants' && method === 'GET') return json(db.merchants);
  if (path === '/api/content' && method === 'GET') return json(db.content);
  if (path === '/api/profile' && method === 'GET') return json(profileView(db));
  if (path === '/api/profile' && method === 'POST') {
    const b = body || {};
    for (const key of ['name', 'phone', 'address', 'note']) {
      if (b[key] !== undefined) db.profile[key] = clean(b[key], key === 'note' ? 200 : 120);
    }
    return json(profileView(db));
  }

  if (path === '/api/learning/resources' && method === 'GET') {
    const raw = db.raw['/api/learning/resources'] || {};
    return json({...raw, items: []});
  }

  if (path === '/api/orders' && method === 'GET') return json(db.orders);
  if (path === '/api/orders' && method === 'POST') {
    const b = body || {};
    const s = findService(db, b.serviceId);
    if (!s) return json({error: '服务不存在'}, 404);
    const student = clean(b.student, 30), phone = clean(b.phone, 20), slot = clean(b.slot, 60);
    if (!student || !PHONE.test(phone)) return json({error: '请填写学生姓名和有效的 11 位手机号'}, 400);
    const multi = b.sessions !== undefined;
    if (multi && s.type !== 'tutor') return json({error: '仅家教服务支持按日期多时段预约'}, 400);
    if (multi && b.slot !== undefined) return json({error: '多时段预约请通过 sessions 提交时段，不要同时传 slot'}, 400);
    let sessions = null;
    if (multi) {
      try { sessions = validateSessions(db, s, b.sessions); }
      catch (e) { return json({error: e.message}, e.status || 400); }
    }
    if (!multi && s.type === 'tutor') {
      const slots = serviceSlots(s, db);
      if (!slots.includes(slot)) return json({error: '请选择有效的预约时段'}, 400);
    }
    let extra = {};
    try { extra = validateExtra(db, s, b); }
    catch (e) { return json({error: e.message}, e.status || 400); }

    let chosen = null;
    const packageId = b.packageId === undefined || b.packageId === null || b.packageId === '' ? '' : clean(b.packageId, 64);
    if (packageId) {
      if (s.type !== 'course') return json({error: '仅课程服务支持选择套餐'}, 400);
      chosen = findPackage(s, packageId);
      if (!chosen) return json({error: '套餐不存在或已下架'}, 404);
    }
    const o = {
      id: uid(), number: 'ED' + Date.now(), serviceId: s.id, title: s.title, type: s.type,
      student, phone, slot: s.type === 'tutor' && !multi ? slot : '',
      amount: chosen ? chosen.price : s.price, status: 'pending',
      createdAt: new Date().toISOString(), ...extra,
    };
    if (chosen) {
      o.packageId = chosen.id;
      o.packageSnapshot = {id: chosen.id, name: chosen.name, price: chosen.price,
        lessons: chosen.lessons, description: chosen.description,
        ...(chosen.videoUrl ? {videoUrl: chosen.videoUrl} : {})};
      o.amount = Math.round(chosen.price * 100) / 100;
    }
    if (multi) {
      o.dateStatus = 'scheduled';
      o.sessions = sessions.map(x => ({date: x.date, slot: x.slot}));
      o.hours = o.sessions.length;
      o.unitPrice = s.price;
      o.amount = Math.round(s.price * o.sessions.length * 100) / 100;
    }
    db.orders.unshift(o);
    return json(o, 201);
  }

  const orderAction = path.match(/^\/api\/orders\/([^/]+)\/(pay|complete|cancel)$/);
  if (orderAction && method === 'POST') {
    const o = db.orders.find(x => x.id === orderAction[1]);
    if (!o) return json({error: '订单不存在'}, 404);
    const action = orderAction[2];
    if (action === 'pay' && o.status !== 'pending') return json({error: '订单状态不允许支付'}, 409);
    if (action === 'pay') { o.status = 'paid'; o.paidAt = new Date().toISOString(); }
    if (action === 'complete') {
      if (o.status !== 'paid') return json({error: '订单状态不允许核销'}, 409);
      o.status = 'completed'; o.completedAt = new Date().toISOString();
      o.fulfillmentStatus = 'completed';
      if (!o.code) o.code = Math.random().toString(16).slice(2, 10).toUpperCase();
    }
    if (action === 'cancel') {
      if (o.status !== 'pending') return json({error: '订单状态不允许取消'}, 409);
      o.status = 'cancelled'; o.cancelledAt = new Date().toISOString();
    }
    return json(o);
  }

  const review = path.match(/^\/api\/orders\/([^/]+)\/review$/);
  if (review && method === 'POST') {
    const o = db.orders.find(x => x.id === review[1]);
    if (!o) return json({error: '订单不存在'}, 404);
    return json({ok: true, orderId: o.id, rating: Number(body?.rating) || 5});
  }

  const availability = path.match(/^\/api\/services\/([^/]+)\/availability$/);
  if (availability && method === 'GET') {
    const s = findService(db, decodeURIComponent(availability[1]));
    if (!s) return json({error: '服务不存在'}, 404);
    if (s.type !== 'tutor') return json({error: '仅家教服务支持按日期查询可约时段'}, 400);
    const date = clean(url.searchParams.get('date') || '', 10);
    if (!date) return json({error: '请提供查询日期 date=YYYY-MM-DD'}, 400);
    if (!validDate(date)) return json({error: '日期格式应为 YYYY-MM-DD 且真实存在'}, 400);
    const weekday = WEEKDAY_LABEL[weekdayOf(date)];
    const taken = new Set();
    for (const o of db.orders) {
      if (o.serviceId !== s.id || !isActiveOrder(o)) continue;
      for (const item of orderSessions(o)) if (item.date === date) taken.add(item.slot);
    }
    const list = serviceSlots(s, db).filter(slot => slotWeekday(slot) === weekday);
    return json({date, slots: list.map(slot => ({slot, available: !taken.has(slot)}))});
  }

  const svc = path.match(/^\/api\/services\/([^/]+)\/(verification|reviews)$/);
  if (svc && method === 'GET') {
    const id = decodeURIComponent(svc[1]);
    if (!findService(db, id)) return json({error: '服务不存在'}, 404);
    const extra = db.serviceExtra[id] || {};
    if (svc[2] === 'verification') return json(extra.verification || {items: {}});
    return json(extra.reviews || {summary: {count: 0, averageRating: 0}, items: []});
  }

  if (path === '/api/applications' && method === 'GET') return json(db.applications);
  if (path === '/api/applications' && method === 'POST') {
    const b = body || {};
    const name = clean(b.name, 60), phone = clean(b.phone, 20);
    if (!name || !PHONE.test(phone) || !['机构', '家教', '校车'].includes(b.type)) {
      return json({error: '请完整填写入驻信息'}, 400);
    }
    const item = {
      id: uid(), name, phone, type: b.type, status: 'pending',
      createdAt: new Date().toISOString(), demo: true,
    };
    db.applications.unshift(item);
    return json(item, 201);
  }
  const approve = path.match(/^\/api\/applications\/([^/]+)\/approve$/);
  if (approve && method === 'POST') {
    const a = db.applications.find(x => x.id === approve[1]);
    if (!a) return json({error: '申请不存在'}, 404);
    a.status = 'approved';
    return json(a);
  }

  if (path === '/api/feedback' && method === 'GET') {
    const status = url.searchParams.get('status');
    return json(status ? db.feedback.filter(f => f.status === status) : db.feedback);
  }
  if (path === '/api/feedback' && method === 'POST') {
    const b = body || {};
    const allowed = new Set(['category', 'content', 'contact', 'orderNumber', 'rating']);
    for (const key of Object.keys(b)) if (!allowed.has(key)) return json({error: '不支持的字段：' + key}, 400);
    const categories = ['课程', '家教', '校车', '订单', '账号', '其他'];
    const category = b.category === undefined ? '其他' : clean(b.category, 10);
    if (!categories.includes(category)) return json({error: '请选择有效的反馈类型'}, 400);
    const text = clean(b.content, 500);
    if (text.length < 5) return json({error: '反馈内容请填写 5–500 字'}, 400);
    const item = {
      id: uid(), category, content: text, contact: clean(b.contact, 60),
      orderNumber: clean(b.orderNumber, 30),
      rating: Number.isInteger(Number(b.rating)) && b.rating !== '' && b.rating !== undefined ? Number(b.rating) : null,
      contactName: db.profile.name || '', status: 'pending', reply: '',
      createdAt: new Date().toISOString(), demo: true,
    };
    db.feedback.unshift(item);
    return json(item, 201);
  }

  if (path === '/api/location/reverse' && method === 'POST') {
    return json({error: '演示站未配置高德 Key，请手动选择城市'}, 503);
  }
  if (path === '/api/assistant/chat' && method === 'POST') {
    return json({error: '演示站未启用平台 AI', source: 'local', code: 'NO_KEY'}, 503);
  }
  if (path === '/api/media/videos' && method === 'POST') {
    return json({error: '演示站不支持视频上传'}, 403);
  }

  // 个人信息相关页面：无账号态统一回空集合，页面正常渲染
  for (const p of ['/api/demands', '/api/favorites', '/api/provider/orders', '/api/commissions', '/api/verification']) {
    if (path === p) return json([]);
  }

  if (path === '/api/companion-profile') return json({items: []});

  return json({error: '接口不存在（静态演示）'}, 404);
}

function profileView(db) {
  return {
    ...db.profile,
    orders: db.orders.length,
    feedback: db.feedback.length,
  };
}

function withExtras(db, s) {
  const extra = db.serviceExtra[s.id];
  if (!extra) return s;
  return s;
}

/* ---------------- 安装拦截 ---------------- */
function parseBody(init) {
  if (!init || !init.body) return undefined;
  if (typeof init.body === 'string') {
    try { return JSON.parse(init.body); } catch { return undefined; }
  }
  return undefined;
}

window.fetch = async function demoFetch(input, init) {
  const raw = typeof input === 'string' ? input : (input instanceof URL ? input.href : input?.url);
  if (!raw) return REAL_FETCH(input, init);
  let url;
  try { url = new URL(raw, location.href); } catch { return REAL_FETCH(input, init); }

  const isApi = url.pathname.includes('/api/');
  if (!isApi) return REAL_FETCH(input, init);

  const method = String(init?.method || input?.method || 'GET').toUpperCase();
  let pathname = url.pathname;
  // 支持 /education/api 前缀（与源站前端 base 逻辑一致）
  const eduIdx = pathname.indexOf('/education/api');
  if (eduIdx >= 0) pathname = pathname.slice(eduIdx).replace('/education/api', '/api');

  try {
    return await route(pathname, url.search, method, parseBody(init));
  } catch (e) {
    if (e && e.__demoError) return json({error: e.message}, e.status || 400);
    console.error('[demo-api]', pathname, e);
    return json({error: '演示接口异常：' + (e?.message || e)}, 500);
  }
};

/* ---------------- 游客放行 ----------------
 * 源站有两处会弹登录框：
 *  1) requireAccount() 派发 xuelu-login-request（roles.js 监听后弹登录）；
 *  2) 选身份时 roles.js 的 routeRole：只有 sessionStorage['xuelu-guest-role'] 已等于该身份
 *     才走游客分支，否则调 login.ensure() 弹窗。
 * 静态演示站没有账号体系，这里两条都直接放行：捕获阶段拦事件 + 预置游客身份。
 * 写操作仍只落内存，不涉及任何真实账号。
 */
window.addEventListener('xuelu-login-request', e => {
  e.preventDefault();
  e.stopImmediatePropagation();
  try { e.detail?.resolve?.(true); } catch {}
}, true);

// 身份选择：用户点哪个身份，就先把它写成游客身份，roles.js 随后直接走游客分支
document.addEventListener('click', e => {
  const btn = e.target?.closest?.('[data-role]');
  if (!btn) return;
  try { sessionStorage.setItem('xuelu-guest-role', btn.dataset.role); } catch {}
}, true);

/* 表单提交放行：源站 roles.js 在 document 捕获阶段拦下这几个表单并要求登录。
 * 演示站没有账号体系，提交瞬间临时摘掉游客会话让它早退，
 * 随后前端自己的提交处理（bubble 阶段）照常执行，提交完立刻恢复。
 */
const DEMO_SUBMIT_FORMS = new Set([
  'join-form', 'booking-form', 'profile-form', 'feedback-form',
  'institution-profile-form', 'institution-course-form', 'service-form',
]);
window.addEventListener('submit', e => {
  const id = e.target?.id;
  if (!id || !DEMO_SUBMIT_FORMS.has(id)) return;
  const saved = sessionStorage.getItem('xuelu-guest-role');
  if (!saved) return;
  sessionStorage.removeItem('xuelu-guest-role');
  setTimeout(() => {
    try { sessionStorage.setItem('xuelu-guest-role', saved); } catch {}
  }, 0);
}, true);

// 首次访问还没有身份时，预置家长游客身份，避免任何路径落到登录框
try {
  if (!sessionStorage.getItem('xuelu-guest-role')) {
    localStorage.setItem('xuelu-visitor-role', localStorage.getItem('xuelu-visitor-role') || 'parent');
    sessionStorage.setItem('xuelu-guest-role', localStorage.getItem('xuelu-visitor-role') || 'parent');
  }
} catch {}

// 提前把数据读进来，首屏少一次等待
boot();
