/* 家庭维护工作台 · 主脚本快照
 * 本文件由 page_v9/index.html 内的 <script> 块抽出，仅为便于阅读，改它不生效。
 */

(function () {
'use strict';

/* ================= 配置 ================= */
/* ⚠️ 部署前必须替换：把下面 7 个值换成你自己空间里的数据表 ID。
   最小可跑集合就是这 7 张表，其余为扩展模块（见 docs/数据模型.md）。 */
var DB = {
  MAINT: 'YOUR_MAINT_DB_ID', LOG: 'YOUR_LOG_DB_ID',
  FEE: 'YOUR_FEE_DB_ID', FES: 'YOUR_FES_DB_ID',
  DLY: 'YOUR_DLY_DB_ID', TSK: 'YOUR_TSK_DB_ID',
  REG: 'YOUR_REG_DB_ID'
};
var MF = {
  NAME: '维护项', DEV: '所属设备', ROOM: '房间', CAT: '类别', ACT: '维护动作',
  CYCLE: '周期天数', LAST: '上次维护日期', URL: '说明书链接', IMG: '说明书图片',
  NOTE: '备注', MODEL: '耗材型号', STOCK: '备件库存', PRICE: '耗材单价'
};
var USER_KEY = 'wb_home_maint_user';
var DAY = 86400000;
var MODEL_PRESET = [
  'CR2032 纽扣电池', 'CR2450 纽扣电池', 'AAA 碱性电池', 'AA 碱性电池',
  '扫地机器人 尘袋', '扫地机器人 尘盒滤网', '扫地机器人 边刷', '扫地机器人 主刷', '扫地机器人 拖布',
  '地板清洁液', '猫厕所 除臭块', '猫厕所 三防垫',
  '饮水机 专用滤芯', '喂食器 干燥剂',
  '新风机 初效滤网', '新风机 中效滤网',
  '净水机 复合滤芯', '净水机 纳滤膜滤芯',
  '洗衣机 筒清洁剂', '洗衣机 排水过滤器'
];
var FALLBACK_OPTS = {
  '所属设备': ['洗衣机', '烘干机', '新风机', '人体传感器（客卫）', '人体传感器（厨房）', '人在传感器（客厅）', '扫地机器人', '饮水机', '喂食器', '猫厕所', '净水机', '其他'],
  '房间': ['客厅', '厨房', '客卫', '主卫', '主卧', '客卧', '书房'],
  '类别': ['米家电器', '宠物设备', '清洁设备', '厨房电器', '卫浴电器', '其他'],
  '维护动作': ['清洗', '更换滤网', '更换耗材', '更换电池', '深度保养', '其他']
};

var db = (window.__SMART_PAGE__ && window.__SMART_PAGE__.database) || null;
var $ = function (id) { return document.getElementById(id); };

/* ================= 工具 ================= */
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function toast(msg) {
  var t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.classList.add('on'); }, 10);
  setTimeout(function () {
    t.classList.remove('on');
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
  }, 2200);
}
function pad(n) { return (n < 10 ? '0' : '') + n; }
function todayStart() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function parseDay(v) {
  if (!v) return null;
  var p = String(v).slice(0, 10).split('-');
  if (p.length !== 3) return null;
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  return isNaN(d.getTime()) ? null : d;
}
function fmtD(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function fmtDT(d) { return fmtD(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function daysLeft(d) { if (!d) return null; return Math.round((d.getTime() - todayStart().getTime()) / DAY); }
function numOf(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    var x = (v.amount !== undefined) ? v.amount : v.value;
    if (x === null || x === undefined || x === '') return null;
    var m = Number(x); return isNaN(m) ? null : m;
  }
  var n = Number(v); return isNaN(n) ? null : n;
}
function docLink(r) {
  var u = r && r[MF.URL];
  if (!u) return '';
  if (typeof u === 'string') return u;
  if (Object.prototype.toString.call(u) === '[object Array]') u = u[0];
  if (!u || typeof u !== 'object') return '';
  return u.link || u.url || '';
}
function user() { try { return localStorage.getItem(USER_KEY) || ''; } catch (e) { return ''; } }
function saveUser(n) { try { localStorage.setItem(USER_KEY, n); } catch (e) {} }
function pill(left) {
  if (left === null) return '<span class="pill b-gray">未定</span>';
  if (left < 0) return '<span class="pill b-red">已过 ' + (-left) + ' 天</span>';
  if (left <= 30) return '<span class="pill b-amber">' + left + ' 天后</span>';
  return '<span class="pill b-gray">' + left + ' 天后</span>';
}
function recOf(res) { return (res && res.result) ? res.result : res; }

function qAll(dbId, startCursor, acc, guard) {
  acc = acc || []; guard = guard || 0;
  if (guard > 100) return Promise.resolve(acc);
  return db.query({ databaseId: dbId, pageSize: 200, startCursor: startCursor }).then(function (r) {
    acc = acc.concat(r.results || []);
    var next = r.nextCursor;
    if (r.hasMore && next && next !== startCursor && (r.results || []).length) {
      return qAll(dbId, next, acc, guard + 1);
    }
    return acc;
  });
}

/* ================= Store ================= */
var Store = {
  rows: {}, loaded: {},
  load: function (dbId) {
    var self = this;
    return qAll(dbId).then(function (rows) {
      self.rows[dbId] = rows; self.loaded[dbId] = 1;
      return rows;
    });
  },
  get: function (dbId) { return this.rows[dbId] || []; },
  loadAll: function () {
    var self = this;
    var ids = [DB.MAINT, DB.LOG, DB.FEE, DB.FES, DB.DLY, DB.TSK, DB.REG];
    return Promise.all(ids.map(function (id) {
      return self.load(id).catch(function (e) { console.error('[store] 加载失败 ' + id, e); });
    }));
  }
};

/* ================= 通用组件 ================= */
var sheetCb = {};
function openSheet(title, bodyHTML, btns) {
  $('shTitle').textContent = title;
  $('shBody').innerHTML = bodyHTML;
  var f = $('shFoot');
  f.innerHTML = '';
  sheetCb = {};
  (btns || []).forEach(function (b, i) {
    var el = document.createElement('button');
    el.className = 'btn ' + (b.cls || 'gho');
    el.type = 'button';
    el.textContent = b.label;
    sheetCb['b' + i] = b.cb;
    el.setAttribute('data-sb', 'b' + i);
    f.appendChild(el);
  });
  f.style.display = (btns && btns.length) ? '' : 'none';
  $('mask').classList.add('on');
  $('sheet').classList.add('on');
}
function closeSheet() {
  $('mask').classList.remove('on');
  $('sheet').classList.remove('on');
  $('confirm').classList.remove('on');
}
var confirmCb = null;
function confirmBox(msg, cb) {
  $('cfTx').textContent = msg;
  confirmCb = cb;
  $('mask').classList.add('on');
  $('confirm').classList.add('on');
}

/* 声明式表单 */
function formHTML(fields, values) {
  values = values || {};
  var html = '';
  fields.forEach(function (f) {
    var v = values[f.key];
    html += '<div class="field' + (f.half ? ' half' : '') + '"><label>' + esc(f.label) + (f.req ? ' <span class="req">*</span>' : '') + '</label>';
    if (f.type === 'select') {
      html += '<select id="ff_' + f.key + '">';
      (f.options || []).forEach(function (o) {
        html += '<option value="' + esc(o) + '"' + (String(v || f.def || '') === o ? ' selected' : '') + '>' + esc(o) + '</option>';
      });
      html += '</select>';
    } else if (f.type === 'datalist') {
      html += '<input id="ff_' + f.key + '" list="dl_' + f.key + '" value="' + esc(v || '') + '" placeholder="' + esc(f.ph || '') + '" type="text">';
      html += '<datalist id="dl_' + f.key + '">';
      (f.options || []).forEach(function (o) { html += '<option value="' + esc(o) + '">'; });
      html += '</datalist>';
    } else if (f.type === 'number' || f.type === 'currency') {
      html += '<input id="ff_' + f.key + '" inputmode="decimal" type="number" step="any" value="' + (v === null || v === undefined ? '' : esc(v)) + '" placeholder="' + esc(f.ph || '') + '">';
    } else if (f.type === 'date') {
      html += '<input id="ff_' + f.key + '" type="date" value="' + esc(v ? String(v).slice(0, 10) : '') + '">';
    } else {
      html += '<input id="ff_' + f.key + '" type="text" value="' + esc(v || '') + '" placeholder="' + esc(f.ph || '') + '">';
    }
    if (f.hint) html += '<div class="hint">' + esc(f.hint) + '</div>';
    html += '</div>';
  });
  return html;
}
function formProps(fields) {
  var props = {}, ok = true;
  fields.forEach(function (f) {
    var el = $('ff_' + f.key);
    if (!el) return;
    var v = (el.value || '').trim();
    if (f.req && !v) { ok = false; el.style.borderColor = 'var(--red)'; return; }
    if (!v) return;
    if (f.type === 'number') props[f.key] = { number: Number(v) };
    else if (f.type === 'currency') props[f.key] = { currency: Number(v) };
    else if (f.type === 'date') props[f.key] = { date: v };
    else if (f.type === 'select') props[f.key] = { select: v };
    else if (f.type === 'url') props[f.key] = { url: { text: v, link: v } };
    else props[f.key] = { text: v };
  });
  return { props: props, ok: ok };
}

/* ================= 维护域 ================= */
var MAINT_OPTS = {};
var mState = { kw: '', room: '', status: '', batch: false, picked: {}, curId: null, pendingImg: null };

function mStatus(r) {
  var cycle = numOf(r[MF.CYCLE]);
  var last = parseDay(r[MF.LAST]);
  if (!cycle || !last) return { k: 'gray', left: null, zone: 0 };
  var zone = Math.min(30, Math.max(7, Math.round(cycle * 0.15)));
  var next = new Date(last.getTime() + cycle * DAY);
  var left = daysLeft(next);
  if (left < 0) return { k: 'red', left: left, zone: zone };
  if (left <= zone) return { k: 'amber', left: left, zone: zone };
  return { k: 'green', left: left, zone: zone };
}
function mPill(st) {
  if (st.k === 'red') return '<span class="pill b-red">急需</span>';
  if (st.k === 'amber') return '<span class="pill b-amber">待买</span>';
  if (st.k === 'green') return '<span class="pill b-green">正常</span>';
  return '<span class="pill b-gray">未设周期</span>';
}
function maintRows() {
  var rows = Store.get(DB.MAINT).slice();
  var kw = mState.kw.toLowerCase();
  return rows.filter(function (r) {
    if (mState.room && r[MF.ROOM] !== mState.room) return false;
    if (mState.status && mStatus(r).k !== mState.status) return false;
    if (kw) {
      var s = (String(r[MF.NAME] || '') + ' ' + String(r[MF.DEV] || '') + ' ' + String(r[MF.NOTE] || '') + ' ' + String(r[MF.MODEL] || '')).toLowerCase();
      if (s.indexOf(kw) === -1) return false;
    }
    return true;
  });
}
function renderMStats() {
  var rows = Store.get(DB.MAINT), c = { red: 0, amber: 0, green: 0 };
  rows.forEach(function (r) { var k = mStatus(r).k; if (c[k] !== undefined) c[k]++; });
  $('cntRed').textContent = c.red;
  $('cntAmber').textContent = c.amber;
  $('cntGreen').textContent = c.green;
  $('cntAll').textContent = rows.length;
}
function mCard(r) {
  var st = mStatus(r);
  var tags = [];
  if (r[MF.ROOM]) tags.push(esc(r[MF.ROOM]));
  if (r[MF.CAT]) tags.push(esc(r[MF.CAT]));
  if (r[MF.MODEL]) tags.push('<span class="tag hl">' + esc(r[MF.MODEL]) + '</span>');
  var stock = numOf(r[MF.STOCK]);
  var stockTag = '';
  if (st.k === 'amber' || st.k === 'red') {
    stockTag = (stock !== null && stock > 0)
      ? '<span class="tag" style="background:var(--green-bg);color:var(--green)">有备件 ' + stock + '</span>'
      : '<span class="tag hl">无备件</span>';
  }
  var cycle = numOf(r[MF.CYCLE]);
  var pct = '';
  if (cycle && parseDay(r[MF.LAST])) {
    var used = Math.min(100, Math.max(0, Math.round((todayStart() - parseDay(r[MF.LAST])) / (cycle * DAY) * 100)));
    pct = '<div class="prog' + (st.k === 'red' ? ' rd' : (st.k === 'amber' ? ' am' : '')) + '"><i style="width:' + used + '%"></i></div>';
  }
  var leftTx = st.left === null ? '' : (st.left < 0 ? '已过 ' + (-st.left) + ' 天' : '剩 ' + st.left + ' 天');
  var pick = mState.batch ? '<input type="checkbox" data-pick="' + esc(r._id) + '"' + (mState.picked[r._id] ? ' checked' : '') + ' style="width:18px;height:18px;margin-right:4px">' : '';
  return '<div class="ic" data-mid="' + esc(r._id) + '">' +
    '<div class="ic-top">' + pick + '<span class="mi-name">' + esc(r[MF.NAME]) + '</span> ' + mPill(st) + '</div>' +
    '<div class="ic-meta">' + tags.map(function (t) { return t.indexOf('<span') === 0 ? t : '<span class="tag">' + t + '</span>'; }).join('') + stockTag + '</div>' +
    '<div class="ic-foot"><span>上次 ' + (r[MF.LAST] ? String(r[MF.LAST]).slice(0, 10) : '—') + '</span><span>周期 ' + (cycle || '—') + ' 天</span><span class="left s-' + st.k + '">' + leftTx + '</span></div>' +
    pct +
    (mState.batch ? '' : '<button class="mini pri qbtn" data-done="' + esc(r._id) + '" type="button">已更换</button>') +
    '</div>';
}
function renderMList() {
  var rows = maintRows();
  var groups = {}, order = [];
  rows.forEach(function (r) {
    var g = r[MF.DEV] || '未分组';
    if (!groups[g]) { groups[g] = { name: g, rows: [], worst: 3, room: r[MF.ROOM] || '' }; order.push(g); }
    var st = mStatus(r);
    var w = st.k === 'red' ? 0 : (st.k === 'amber' ? 1 : (st.k === 'green' ? 2 : 3));
    if (w < groups[g].worst) groups[g].worst = w;
    groups[g].rows.push(r);
  });
  order.sort(function (a, b) { return groups[a].worst - groups[b].worst; });
  var html = '';
  order.forEach(function (g) {
    var gp = groups[g];
    var open = gp.worst <= 1 || mState.kw || mState.status || mState.batch;
    var bad = gp.rows.filter(function (r) { var k = mStatus(r).k; return k === 'red' || k === 'amber'; }).length;
    html += '<div class="dev' + (open ? ' open' : '') + '"><div class="dev-h" data-tg>' +
      '<span class="nm">' + esc(g) + '</span><span class="mt">' + esc(gp.room) + ' · ' + gp.rows.length + ' 项' + (bad ? ' · ' + bad + ' 项待办' : '') + '</span>' +
      (bad ? '<span class="pill ' + (gp.worst === 0 ? 'b-red' : 'b-amber') + '">' + bad + '</span>' : '<span class="pill b-green">✓</span>') +
      '<svg class="arr" fill="none" height="16" stroke="currentColor" stroke-linecap="round" stroke-width="2" viewBox="0 0 24 24" width="16"><path d="m9 6 6 6-6 6"/></svg></div>' +
      '<div class="dev-b">' + gp.rows.map(mCard).join('') + '</div></div>';
  });
  if (!order.length) html = '<div class="blank">没有符合条件的维护项。</div>';
  $('mList').innerHTML = html;
}
function writeLog(type, device, item, note, amount) {
  if (!db) return Promise.resolve();
  var props = {};
  props['时间'] = { date: fmtD(todayStart()) };
  props['类型'] = { select: type };
  props['设备'] = { text: device || '' };
  props['维护项'] = { text: item || '' };
  props['操作人'] = { text: user() || '未设置' };
  props['说明'] = { text: note || '' };
  if (amount !== null && amount !== undefined && !isNaN(Number(amount))) props['金额'] = { currency: Number(amount) };
  return db.addRecord({ databaseId: DB.LOG, properties: props }).then(function () {
    return Store.load(DB.LOG);
  }).catch(function (e) { console.error('[log] 写入失败:', e); });
}
function doneFlow(ids) {
  if (!ids.length) return;
  openSheet('完成维护', '<div class="field"><label>本次花费（可空）</label><input id="doneAmt" inputmode="decimal" min="0" placeholder="填写会记入账本" step="0.01" type="number"></div><div class="sub">将把 ' + ids.length + ' 项的上次维护日期更新为今天，并重置周期。</div>', [
    { label: '取消', cls: 'gho', cb: closeSheet },
    { label: '确认完成', cls: 'pri', cb: function () {
      var amt = numOf(($('doneAmt') || {}).value);
      var jobs = ids.map(function (id) {
        var row = null;
        Store.get(DB.MAINT).forEach(function (r) { if (r._id === id) row = r; });
        return db.updateRecord({ databaseId: DB.MAINT, recordId: id, properties: { '上次维护日期': { date: fmtD(todayStart()) } } })
          .then(function () { if (row) return writeLog('维护完成', row[MF.DEV], row[MF.NAME], '', amt); });
      });
      Promise.all(jobs).then(function () {
        return Store.load(DB.MAINT);
      }).then(function () {
        closeSheet();
        toast('已完成 ' + ids.length + ' 项');
        mState.picked = {};
        refreshMaint(); renderToday();
      });
    } }
  ]);
}
function snooze(id) {
  var row = null;
  Store.get(DB.MAINT).forEach(function (r) { if (r._id === id) row = r; });
  if (!row) return;
  var base = parseDay(row[MF.LAST]) || todayStart();
  var nd = new Date(base.getTime() + 30 * DAY);
  db.updateRecord({ databaseId: DB.MAINT, recordId: id, properties: { '上次维护日期': { date: fmtD(nd) } } }).then(function () {
    return writeLog('延后处理', row[MF.DEV], row[MF.NAME], '延后 30 天');
  }).then(function () { return Store.load(DB.MAINT); }).then(function () {
    closeSheet(); toast('已延后 30 天'); refreshMaint(); renderToday();
  });
}
function maintFormFields(row) {
  var devs = (MAINT_OPTS[MF.DEV] || FALLBACK_OPTS[MF.DEV]);
  var models = {};
  MODEL_PRESET.forEach(function (m) { models[m] = 1; });
  Store.get(DB.MAINT).forEach(function (r) { if (r[MF.MODEL]) models[r[MF.MODEL]] = 1; });
  return [
    { key: MF.NAME, label: '维护项', type: 'text', req: true, ph: '例：尘袋 / 滚刷 / 中效滤网' },
    { key: MF.DEV, label: '所属设备', type: 'select', options: devs, hint: '选同一台设备的耗材会归到一组' },
    { key: MF.ROOM, label: '所属房间', type: 'select', options: (MAINT_OPTS[MF.ROOM] || FALLBACK_OPTS[MF.ROOM]), half: true },
    { key: MF.CAT, label: '类别', type: 'select', options: (MAINT_OPTS[MF.CAT] || FALLBACK_OPTS[MF.CAT]), half: true },
    { key: MF.ACT, label: '维护动作', type: 'select', options: (MAINT_OPTS[MF.ACT] || FALLBACK_OPTS[MF.ACT]), half: true },
    { key: MF.CYCLE, label: '更换周期（天）', type: 'number', ph: '例：180', half: true },
    { key: MF.MODEL, label: '耗材型号', type: 'datalist', options: Object.keys(models), ph: '下拉选或直接填' },
    { key: MF.STOCK, label: '备件库存', type: 'number', ph: '家里还有几个', half: true },
    { key: MF.PRICE, label: '耗材单价（¥）', type: 'currency', ph: '统计年度花费', half: true },
    { key: MF.LAST, label: '上次维护日期', type: 'date', half: true },
    { key: MF.URL, label: '说明书链接', type: 'url', ph: 'https://…' },
    { key: MF.NOTE, label: '备注', type: 'text', ph: '官方周期等参考信息' }
  ];
}
function openMaintForm(id) {
  var row = null;
  if (id) Store.get(DB.MAINT).forEach(function (r) { if (r._id === id) row = r; });
  mState.pendingImg = null;
  var values = row || {};
  var body = formHTML(maintFormFields(row), values) +
    '<div class="field"><label>说明书图片</label><input id="ff_img" type="file" accept="image/*">' +
    '<div class="prev" id="imgPrev">' + (row && row[MF.IMG] && row[MF.IMG][0] ? '<img src="' + esc(row[MF.IMG][0].imageUrl) + '" alt="">' : '') + '</div></div>';
  openSheet(id ? '编辑维护项' : '新增维护项', body, [
    { label: '取消', cls: 'gho', cb: closeSheet },
    { label: '保存', cls: 'pri', cb: function () { saveMaint(id, row); } }
  ]);
  var fi = $('ff_img');
  if (fi) fi.addEventListener('change', function () {
    var f = fi.files && fi.files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast('图片不能超过 10MB'); return; }
    var rd = new FileReader();
    rd.onload = function () {
      var b64 = String(rd.result).split(',')[1] || '';
      db.uploadImage({ data: b64, contentType: f.type, fileName: f.name }).then(function (r2) {
        if (!r2 || !r2.url) { toast('图片上传失败'); return; }
        mState.pendingImg = { title: f.name, imageUrl: r2.url };
        $('imgPrev').innerHTML = '<img src="' + esc(r2.url) + '" alt="">';
      }).catch(function (e) { console.error(e); toast('图片上传失败'); });
    };
    rd.readAsDataURL(f);
  });
}
function saveMaint(id, oldRow) {
  var fp = formProps(maintFormFields(oldRow));
  if (!fp.ok) { toast('维护项名称必填'); return; }
  var props = fp.props;
  if (mState.pendingImg) props[MF.IMG] = { image: { images: [mState.pendingImg] } };
  var p = id
    ? db.updateRecord({ databaseId: DB.MAINT, recordId: id, properties: props })
    : db.addRecord({ databaseId: DB.MAINT, properties: props });
  p.then(function () {
    return writeLog(id ? '修改记录' : '新增记录', props[MF.DEV] ? props[MF.DEV].select : (oldRow && oldRow[MF.DEV]), props[MF.NAME].text, id ? '' : '新建');
  }).then(function () { return Store.load(DB.MAINT); }).then(function () {
    closeSheet(); toast('已保存'); refreshMaint(); renderToday();
  }).catch(function (e) { console.error(e); toast('保存失败，请重试'); });
}
function openMaintDetail(id) {
  var row = null;
  Store.get(DB.MAINT).forEach(function (r) { if (r._id === id) row = r; });
  if (!row) return;
  mState.curId = id;
  var st = mStatus(row);
  var cycle = numOf(row[MF.CYCLE]);
  var link = docLink(row);
  var logs = Store.get(DB.LOG).filter(function (l) {
    return (l['设备'] || '') === (row[MF.DEV] || '') && (l['维护项'] || '') === (row[MF.NAME] || '');
  }).slice(-5).reverse();
  var body = '<div style="display:flex;align-items:center;gap:8px">' + mPill(st) +
    '<span class="sub">' + (st.left === null ? '未设周期' : (st.left < 0 ? '已逾期 ' + (-st.left) + ' 天' : '还剩 ' + st.left + ' 天')) + '</span></div>' +
    '<div class="dtgrid">' +
    '<div class="c"><b>型号</b><span>' + esc(row[MF.MODEL] || '—') + '</span></div>' +
    '<div class="c"><b>库存</b><span>' + (numOf(row[MF.STOCK]) === null ? '—' : numOf(row[MF.STOCK])) + '</span></div>' +
    '<div class="c"><b>单价</b><span>' + (numOf(row[MF.PRICE]) === null ? '—' : '¥' + numOf(row[MF.PRICE]).toFixed(2)) + '</span></div>' +
    '</div>' +
    '<div class="kv">' +
    '<div><b>设备</b>' + esc(row[MF.DEV] || '—') + '</div>' +
    '<div><b>房间/类别</b>' + esc(row[MF.ROOM] || '—') + ' / ' + esc(row[MF.CAT] || '—') + '</div>' +
    '<div><b>动作/周期</b>' + esc(row[MF.ACT] || '—') + ' / ' + (cycle || '—') + ' 天</div>' +
    '<div><b>上次维护</b>' + (row[MF.LAST] ? String(row[MF.LAST]).slice(0, 10) : '—') + '</div>' +
    (row[MF.NOTE] ? '<div><b>备注</b>' + esc(row[MF.NOTE]) + '</div>' : '') +
    (link ? '<div><b>说明书</b><a href="' + esc(link) + '" target="_blank" rel="noopener">打开链接</a></div>' : '') +
    '</div>' +
    (row[MF.IMG] && row[MF.IMG][0] ? '<div class="prev"><img src="' + esc(row[MF.IMG][0].imageUrl) + '" alt="说明书"></div>' : '') +
    (logs.length ? '<div style="margin-top:10px"><div class="sub" style="margin-bottom:4px">最近履历</div>' + logs.map(function (l) {
      return '<div class="logline">' + esc(String(l['时间'] || '').slice(0, 10)) + ' · <b>' + esc(l['类型'] || '') + '</b>' + (l['说明'] ? ' · ' + esc(l['说明']) : '') + (numOf(l['金额']) ? ' · ¥' + numOf(l['金额']).toFixed(2) : '') + '</div>';
    }).join('') + '</div>' : '');
  openSheet(row[MF.NAME] || '物品详情', body, [
    { label: '删除', cls: 'dan', cb: function () { delMaint(id, row); } },
    { label: '延后30天', cls: 'gho', cb: function () { snooze(id); } },
    { label: '编辑', cls: 'gho', cb: function () { openMaintForm(id); } },
    { label: '标记完成', cls: 'pri', cb: function () { doneFlow([id]); } }
  ]);
}
function delMaint(id, row) {
  confirmBox('确认删除「' + (row[MF.NAME] || '') + '」吗？此操作不可恢复。', function () {
    $('confirm').classList.remove('on');
    db.deleteRecord({ databaseId: DB.MAINT, recordId: id }).then(function () {
      return writeLog('删除记录', row[MF.DEV], row[MF.NAME], '');
    }).then(function () { return Store.load(DB.MAINT); }).then(function () {
      closeSheet(); toast('已删除'); refreshMaint(); renderToday();
    });
  });
}
function refreshMaint() { renderMStats(); renderMList(); }

/* ================= 管家域（声明式 CRUD） ================= */
var HUB = {
  FEE: {
    dbId: DB.FEE, title: '固定费用', addLabel: '记一笔固定费用',
    fields: [
      { key: '名称', label: '名称', type: 'text', req: true, ph: '例：采暖费' },
      { key: '类别', label: '类别', type: 'select', options: ['居住', '出行', '保险', '通讯', '订阅', '其他'], half: true },
      { key: '缴费周期', label: '缴费周期', type: 'select', options: ['年', '半年', '季', '月'], half: true },
      { key: '下次应缴日', label: '下次应缴日', type: 'date', half: true },
      { key: '金额', label: '金额（¥）', type: 'currency', ph: '可空', half: true },
      { key: '缴费渠道', label: '缴费渠道', type: 'text', ph: '可空', half: true },
      { key: '备注', label: '备注', type: 'text', ph: '可空' }
    ],
    defaults: { '状态': { select: '待缴' } },
    sort: function (a, b) {
      var da = parseDay(a['下次应缴日']), dbb = parseDay(b['下次应缴日']);
      if (!da && !dbb) return 0; if (!da) return 1; if (!dbb) return -1; return da - dbb;
    },
    row: function (r) {
      var due = parseDay(r['下次应缴日']);
      var left = daysLeft(due);
      var amt = numOf(r['金额']);
      return '<div class="row" data-edit="' + esc(r._id) + '"><div class="rmain"><div class="rname">' + esc(r['名称']) + '</div>' +
        '<div class="rmeta">' + esc(r['类别'] || '') + ' · 按' + esc(r['缴费周期'] || '年') + '缴' +
        (amt !== null ? ' · ¥' + amt.toFixed(2) : '') + (r['缴费渠道'] ? ' · ' + esc(r['缴费渠道']) : '') +
        (due ? ' · ' + fmtD(due) : '') + '</div></div>' + pill(left) +
        '<button class="mini pri" data-quick="' + esc(r._id) + '" type="button">已缴费</button></div>';
    },
    blank: '还没有固定费用，点下方按钮记一笔。',
    extra: function (rows) {
      var year = todayStart().getFullYear(), sums = [], i;
      for (i = 0; i < 12; i++) sums.push({ n: 0, amt: 0 });
      rows.forEach(function (r) {
        var due = parseDay(r['下次应缴日']);
        if (due && due.getFullYear() === year) {
          sums[due.getMonth()].n++;
          var a = numOf(r['金额']); if (a !== null) sums[due.getMonth()].amt += a;
        }
      });
      var nowM = todayStart().getMonth(), cal = '';
      for (i = 0; i < 12; i++) {
        var c = sums[i];
        var hot = c.n > 0 && (i === nowM || i === (nowM + 1) % 12);
        cal += '<div class="cell' + (hot ? ' hot' : '') + '"><b>' + (i + 1) + '月</b><span>' + (c.n ? '¥' + Math.round(c.amt) : '—') + '</span></div>';
      }
      return '<div class="cal">' + cal + '</div>';
    },
    quick: function (id) {
      db.getRecord({ databaseId: DB.FEE, recordId: id }).then(function (res) {
        var r = recOf(res);
        var due = parseDay(r['下次应缴日']) || todayStart();
        var cyc = r['缴费周期'] || '年';
        var nd = new Date(due.getTime());
        if (cyc === '月') nd.setMonth(nd.getMonth() + 1);
        else if (cyc === '季') nd.setMonth(nd.getMonth() + 3);
        else if (cyc === '半年') nd.setMonth(nd.getMonth() + 6);
        else nd.setFullYear(nd.getFullYear() + 1);
        return db.updateRecord({ databaseId: DB.FEE, recordId: id, properties: { '下次应缴日': { date: fmtD(nd) }, '状态': { select: '待缴' } } })
          .then(function () { toast('已缴费，下次应缴 ' + fmtD(nd)); return Store.load(DB.FEE); })
          .then(function () { renderHub(); renderToday(); });
      }).catch(function (e) { console.error(e); toast('操作失败'); });
    }
  },
  FES: {
    dbId: DB.FES, title: '节日与生日', addLabel: '添加节日 / 生日',
    fields: [
      { key: '名称', label: '名称', type: 'text', req: true, ph: '例：老妈生日' },
      { key: '类型', label: '类型', type: 'select', options: ['公历节日', '农历节日', '生日', '纪念日'], half: true },
      { key: '日期', label: '日期', type: 'date', half: true },
      { key: '提前提醒天数', label: '提前提醒天数', type: 'number', ph: '例：7', half: true },
      { key: '关联成员', label: '关联成员', type: 'text', ph: '生日填谁，可空', half: true },
      { key: 'AI行程推荐', label: 'AI 行程推荐', type: 'select', options: ['关', '开'], half: true },
      { key: '联动采购', label: '联动采购', type: 'select', options: ['关', '开'], half: true },
      { key: '备注', label: '备注', type: 'text', ph: '可空' }
    ],
    sort: function (a, b) {
      var da = parseDay(a['日期']), dbb = parseDay(b['日期']);
      if (!da && !dbb) return 0; if (!da) return 1; if (!dbb) return -1; return da - dbb;
    },
    row: function (r) {
      var d = parseDay(r['日期']);
      var left = daysLeft(d);
      var tags = [];
      if (r['类型']) tags.push(esc(r['类型']));
      if (r['联动采购'] === '开') tags.push('进采购单');
      if (r['AI行程推荐'] === '开') tags.push('AI行程');
      return '<div class="row" data-edit="' + esc(r._id) + '"><div class="rmain"><div class="rname">' + esc(r['名称']) + '</div>' +
        '<div class="rmeta">' + tags.join(' · ') + (r['关联成员'] ? ' · ' + esc(r['关联成员']) : '') +
        (d ? ' · ' + fmtD(d) : '') + (r['备注'] ? ' · ' + esc(r['备注']) : '') + '</div></div>' + pill(left) + '</div>';
    },
    blank: '还没有节日或生日，点下方按钮添加。'
  },
  DLY: {
    dbId: DB.DLY, title: '日用品', addLabel: '登记日用品',
    fields: [
      { key: '名称', label: '名称', type: 'text', req: true, ph: '例：纸巾' },
      { key: '规格', label: '规格', type: 'text', ph: '可空', half: true },
      { key: '存放位置', label: '存放位置', type: 'select', options: ['', '客厅', '厨房', '客卫', '主卫', '主卧', '客卧', '书房'], half: true },
      { key: '经验消耗天数', label: '经验消耗天数', type: 'number', ph: '例：45', half: true },
      { key: '囤货数量', label: '囤货数量', type: 'number', ph: '例：6', half: true },
      { key: '备注', label: '备注', type: 'text', ph: '可空' }
    ],
    defaults: { '状态': { select: '充足' }, '上次报备日期': { date: fmtD(todayStart()) } },
    sort: function (a, b) {
      var sa = (a['状态'] === '充足') ? 1 : 0, sb = (b['状态'] === '充足') ? 1 : 0;
      return sa - sb;
    },
    row: function (r) {
      var qty = numOf(r['囤货数量']);
      var st = r['状态'] || '充足';
      var stPill = st === '充足' ? '<span class="pill b-green">充足</span>' : '<span class="pill b-amber">' + esc(st) + '</span>';
      var actBtn = st === '充足'
        ? '<button class="mini" data-qk="low" data-quick="' + esc(r._id) + '" type="button">快用完了</button>'
        : '<button class="mini pri" data-qk="ok" data-quick="' + esc(r._id) + '" type="button">已补货</button>';
      return '<div class="row"><div class="rmain" data-edit="' + esc(r._id) + '"><div class="rname">' + esc(r['名称']) + '</div>' +
        '<div class="rmeta">' + (r['规格'] ? esc(r['规格']) + ' · ' : '') + (r['存放位置'] ? esc(r['存放位置']) + ' · ' : '') +
        '约 ' + (numOf(r['经验消耗天数']) || '?') + ' 天一耗' +
        (r['上次报备日期'] ? ' · 报备 ' + String(r['上次报备日期']).slice(0, 10) : '') + '</div></div>' +
        '<span class="qty"><button class="mini" data-qk="dec" data-quick="' + esc(r._id) + '" type="button">−</button><b>' + (qty === null ? 0 : qty) + '</b><button class="mini" data-qk="inc" data-quick="' + esc(r._id) + '" type="button">＋</button></span>' +
        stPill + actBtn + '</div>';
    },
    blank: '还没有日用品，点下方按钮登记。',
    quick: function (id, qk) {
      if (qk === 'inc' || qk === 'dec') {
        db.getRecord({ databaseId: DB.DLY, recordId: id }).then(function (res) {
          var r = recOf(res);
          var q = numOf(r['囤货数量']) || 0;
          var nq = Math.max(0, q + (qk === 'inc' ? 1 : -1));
          return db.updateRecord({ databaseId: DB.DLY, recordId: id, properties: { '囤货数量': { number: nq } } })
            .then(function () { return Store.load(DB.DLY); })
            .then(function () { renderHub(); renderToday(); });
        }).catch(function (e) { console.error(e); });
        return;
      }
      var props = { '状态': { select: qk === 'low' ? '快用完' : '充足' }, '上次报备日期': { date: fmtD(todayStart()) } };
      db.updateRecord({ databaseId: DB.DLY, recordId: id, properties: props }).then(function () {
        toast(qk === 'low' ? '已报备，采购清单会带上' : '好，已补货');
        return Store.load(DB.DLY);
      }).then(function () { renderHub(); renderToday(); })
        .catch(function (e) { console.error(e); toast('操作失败'); });
    }
  }
};
var hubKey = 'FEE';
function renderHub() {
  var cfg = HUB[hubKey];
  var rows = Store.get(cfg.dbId).slice().sort(cfg.sort);
  var html = rows.length ? rows.map(cfg.row).join('') : '<div class="blank">' + cfg.blank + '</div>';
  html += (cfg.extra ? cfg.extra(rows) : '');
  html += '<div style="margin-top:10px"><button class="mini pri" data-hubadd type="button">＋ ' + cfg.addLabel + '</button></div>';
  $('hubBody').innerHTML = '<div class="panel">' + html + '</div>';
}
function hubForm(key, id) {
  var cfg = HUB[key];
  var row = null;
  if (id) Store.get(cfg.dbId).forEach(function (r) { if (r._id === id) row = r; });
  var values = {};
  if (row) cfg.fields.forEach(function (f) { values[f.key] = row[f.key]; });
  var btns = [{ label: '取消', cls: 'gho', cb: closeSheet }, { label: '保存', cls: 'pri', cb: function () {
    var fp = formProps(cfg.fields);
    if (!fp.ok) { toast('有必填项未填'); return; }
    var props = fp.props;
    if (!id && cfg.defaults) for (var k in cfg.defaults) props[k] = cfg.defaults[k];
    var p = id ? db.updateRecord({ databaseId: cfg.dbId, recordId: id, properties: props })
               : db.addRecord({ databaseId: cfg.dbId, properties: props });
    p.then(function () { return Store.load(cfg.dbId); }).then(function () {
      closeSheet(); toast('已保存'); renderHub(); renderToday();
    }).catch(function (e) { console.error(e); toast('保存失败'); });
  } }];
  if (id) btns.unshift({ label: '删除', cls: 'dan', cb: function () {
    confirmBox('确认删除「' + (row['名称'] || '') + '」吗？此操作不可恢复。', function () {
      $('confirm').classList.remove('on');
      db.deleteRecord({ databaseId: cfg.dbId, recordId: id }).then(function () { return Store.load(cfg.dbId); })
        .then(function () { closeSheet(); toast('已删除'); renderHub(); renderToday(); });
    });
  } });
  openSheet((id ? '编辑 · ' : '') + cfg.title, formHTML(cfg.fields, values), btns);
}

/* ================= AI 域 ================= */
function renderAi() {
  var rows = Store.get(DB.TSK);
  var pending = [], done = [];
  rows.forEach(function (r) {
    if (r['状态'] === '待执行' || r['状态'] === '执行中') pending.push(r);
    else if (r['状态'] === '已完成' && r['已读'] !== '已读') done.push(r);
  });
  done.sort(function (a, b) { return String(b['完成时间'] || '').localeCompare(String(a['完成时间'] || '')); });
  var html = '';
  if (pending.length) html += '<div class="blank">云端队列：' + pending.length + ' 条待执行（每小时巡检取货）</div>';
  done.forEach(function (r) {
    var res = String(r['结果'] || '');
    if (res.length > 800) res = res.slice(0, 800) + '……';
    html += '<div class="res"><div class="res-t">' + esc(r['任务类型'] || '任务') +
      (r['完成时间'] ? ' · 完成于 ' + String(r['完成时间']).slice(0, 16).replace('T', ' ') : '') + '</div>' +
      '<div class="res-b">' + esc(res || '（无文字结果）') + '</div>' +
      '<div style="margin-top:8px;text-align:right"><button class="mini pri" data-read="' + esc(r._id) + '" type="button">知道了</button></div></div>';
  });
  if (!pending.length && !done.length) html = '<div class="blank">暂无任务。点上面按钮投递一个，或对 WorkBuddy 说一声。</div>';
  $('aiOut').innerHTML = html;
  $('dotAi').className = 'tdot' + (done.length ? ' on' : '');
  var regs = Store.get(DB.REG);
  if (regs.length) {
    $('aiReg').innerHTML = regs.map(function (r) {
      return '<div>· <b>' + esc(r['任务名称'] || '') + '</b>（' + esc(r['频率'] || '') + '）' +
        (r['上次运行'] ? ' 上次：' + esc(String(r['上次运行']).slice(0, 16).replace('T', ' ')) : '') +
        (r['上次结果'] ? ' ' + esc(r['上次结果']) : '') + '</div>';
    }).join('');
  } else {
    $('aiReg').textContent = '暂无注册任务';
  }
}
function taskPost(type, btn) {
  if (btn) btn.disabled = true;
  var props = {
    '任务类型': { select: type }, '状态': { select: '待执行' },
    '提交时间': { date: fmtDT(new Date()) },
    '提交人': { text: user() || '未设置' }, '已读': { select: '未读' }
  };
  db.addRecord({ databaseId: DB.TSK, properties: props }).then(function () {
    toast('已投递，云端 AI 定时巡检时执行');
    if (btn) btn.disabled = false;
    return Store.load(DB.TSK);
  }).then(function () { renderAi(); }).catch(function (e) {
    console.error(e); toast('投递失败'); if (btn) btn.disabled = false;
  });
}
function taskRead(id) {
  db.updateRecord({ databaseId: DB.TSK, recordId: id, properties: { '已读': { select: '已读' } } })
    .then(function () { return Store.load(DB.TSK); })
    .then(function () { renderAi(); renderToday(); })
    .catch(function (e) { console.error(e); });
}

/* ================= 今天 ================= */
function renderToday() {
  var unread = Store.get(DB.TSK).filter(function (r) { return r['状态'] === '已完成' && r['已读'] !== '已读'; }).length;
  var maintBad = Store.get(DB.MAINT).filter(function (r) { var k = mStatus(r).k; return k === 'red' || k === 'amber'; });
  var feeSoon = Store.get(DB.FEE).filter(function (r) { var l = daysLeft(parseDay(r['下次应缴日'])); return l !== null && l <= 30; });
  var fesSoon = Store.get(DB.FES).filter(function (r) { var l = daysLeft(parseDay(r['日期'])); return l !== null && l <= 30 && l >= 0; });
  var dlyLow = Store.get(DB.DLY).filter(function (r) { return (r['状态'] && r['状态'] !== '充足') || (numOf(r['囤货数量']) !== null && numOf(r['囤货数量']) <= 0); });

  var parts = [];
  if (maintBad.length) parts.push(maintBad.length + ' 项维护');
  if (feeSoon.length) parts.push(feeSoon.length + ' 笔费用');
  if (fesSoon.length) parts.push(fesSoon.length + ' 个日子');
  if (dlyLow.length) parts.push(dlyLow.length + ' 样日用品');
  var banner = '';
  if (unread) {
    banner = '<div class="banner"><b>AI 带回了 ' + unread + ' 条新结果</b><div class="b-sub">云端任务已完成，去看看吧</div><button class="b-btn" data-go="ai" type="button">查看结果</button></div>';
  } else if (parts.length) {
    banner = '<div class="banner"><b>今天要操心：' + parts.join(' · ') + '</b><div class="b-sub">都在下面，逐块处理就好</div></div>';
  } else {
    banner = '<div class="banner"><b>家里一切正常</b><div class="b-sub">没有逾期和临期事项，喝口水休息一下</div></div>';
  }
  $('tdBanner').innerHTML = banner;

  var mh = maintBad.sort(function (a, b) { return mStatus(a).left - mStatus(b).left; }).slice(0, 5);
  $('tdMaint').innerHTML = mh.length ? mh.map(function (r) {
    var st = mStatus(r);
    return '<div class="row"><div class="rmain" data-mid="' + esc(r._id) + '"><div class="rname">' + esc(r[MF.NAME]) + '</div><div class="rmeta">' + esc(r[MF.DEV] || '') + ' · ' + esc(r[MF.ROOM] || '') + '</div></div>' + mPill(st) +
      '<button class="mini" data-snz="' + esc(r._id) + '" type="button">延后</button>' +
      '<button class="mini pri" data-done="' + esc(r._id) + '" type="button">已更换</button></div>';
  }).join('') : '<div class="blank">没有急需或临期的维护项。</div>';

  $('tdFee').innerHTML = feeSoon.length ? feeSoon.sort(function (a, b) { return parseDay(a['下次应缴日']) - parseDay(b['下次应缴日']); }).slice(0, 4).map(HUB.FEE.row).join('') : '<div class="blank">未来 30 天没有待缴费用。</div>';
  $('tdFes').innerHTML = fesSoon.length ? fesSoon.sort(function (a, b) { return parseDay(a['日期']) - parseDay(b['日期']); }).slice(0, 4).map(HUB.FES.row).join('') : '<div class="blank">未来 30 天没有临近的节日或生日。</div>';
  $('tdDly').innerHTML = dlyLow.length ? dlyLow.slice(0, 4).map(HUB.DLY.row).join('') : '<div class="blank">日用品都充足。</div>';

  var hubHot = feeSoon.length + dlyLow.length;
  $('dotHub').className = 'tdot' + (hubHot ? ' on' : '');
}

/* ================= 我的 ================= */
function renderMe() {
  $('meName').textContent = user() || '未设置';
  var rows = Store.get(DB.MAINT);
  var shopM = rows.filter(function (r) {
    var st = mStatus(r);
    if (st.k !== 'red' && st.k !== 'amber') return false;
    var s = numOf(r[MF.STOCK]);
    return s === null || s <= 0;
  });
  var shopD = Store.get(DB.DLY).filter(function (r) {
    return (r['状态'] && r['状态'] !== '充足') || (numOf(r['囤货数量']) !== null && numOf(r['囤货数量']) <= 0);
  });
  $('shopSub').textContent = (shopM.length + shopD.length) + ' 项待买';
  var lines = '';
  if (shopM.length) {
    lines += '<div class="sub" style="margin:4px 0">设备耗材</div>' + shopM.map(function (r) {
      return '<div class="row"><div class="rmain"><div class="rname">' + esc(r[MF.NAME]) + '</div><div class="rmeta">' + esc(r[MF.DEV] || '') + (r[MF.MODEL] ? ' · ' + esc(r[MF.MODEL]) : '') + '</div></div>' +
        (numOf(r[MF.PRICE]) !== null ? '<span class="pill b-gray">¥' + numOf(r[MF.PRICE]).toFixed(2) + '</span>' : '') + '</div>';
    }).join('');
  }
  if (shopD.length) {
    lines += '<div class="sub" style="margin:4px 0">日用品</div>' + shopD.map(function (r) {
      return '<div class="row"><div class="rmain"><div class="rname">' + esc(r['名称']) + '</div><div class="rmeta">' + (r['规格'] ? esc(r['规格']) + ' · ' : '') + esc(r['状态'] || '') + '</div></div></div>';
    }).join('');
  }
  if (!lines) lines = '<div class="blank">没有要买的东西。</div>';
  else lines += '<div style="margin-top:10px"><button class="mini pri" data-copyshop type="button">复制清单去购物</button></div>';
  $('shopBody').innerHTML = lines;

  var year = todayStart().getFullYear();
  var logs = Store.get(DB.LOG).filter(function (l) { return String(l['时间'] || '').indexOf(String(year)) === 0; });
  var sum = 0, cnt = 0;
  logs.forEach(function (l) { var a = numOf(l['金额']); if (a !== null) { sum += a; cnt++; } });
  $('costSub').textContent = year + ' 年 · ' + cnt + ' 笔';
  $('costBody').innerHTML = '<div class="row"><div class="rmain"><div class="rname" style="font-size:20px">¥' + sum.toFixed(2) + '</div><div class="rmeta">维护相关花费合计（含耗材与外勤）</div></div></div>';

  var recent = logs.slice(-60).reverse();
  $('logSub').textContent = '共 ' + logs.length + ' 条';
  $('logBody').innerHTML = recent.length ? recent.map(function (l) {
    return '<div class="logline">' + esc(String(l['时间'] || '').slice(0, 10)) + ' · <b>' + esc(l['类型'] || '') + '</b> · ' +
      esc(l['设备'] || '') + (l['维护项'] ? ' / ' + esc(l['维护项']) : '') +
      (l['操作人'] ? ' · ' + esc(l['操作人']) : '') +
      (l['说明'] ? ' · ' + esc(l['说明']) : '') +
      (numOf(l['金额']) !== null ? ' · ¥' + numOf(l['金额']).toFixed(2) : '') + '</div>';
  }).join('') : '<div class="blank">暂无日志。</div>';
}
function copyShop() {
  var rows = Store.get(DB.MAINT).filter(function (r) {
    var st = mStatus(r);
    if (st.k !== 'red' && st.k !== 'amber') return false;
    var s = numOf(r[MF.STOCK]);
    return s === null || s <= 0;
  });
  var dly = Store.get(DB.DLY).filter(function (r) {
    return (r['状态'] && r['状态'] !== '充足') || (numOf(r['囤货数量']) !== null && numOf(r['囤货数量']) <= 0);
  });
  var tx = '【采购清单 ' + fmtD(todayStart()) + '】\n';
  if (rows.length) {
    tx += '\n■ 设备耗材\n';
    rows.forEach(function (r) {
      tx += '· ' + (r[MF.DEV] || '') + '｜' + (r[MF.NAME] || '') + (r[MF.MODEL] ? '（' + r[MF.MODEL] + '）' : '') + (numOf(r[MF.PRICE]) !== null ? ' ¥' + numOf(r[MF.PRICE]).toFixed(2) : '') + '\n';
    });
  }
  if (dly.length) {
    tx += '\n■ 日用品\n';
    dly.forEach(function (r) { tx += '· ' + (r['名称'] || '') + (r['规格'] ? '（' + r['规格'] + '）' : '') + '\n'; });
  }
  function done() { toast('清单已复制，去粘贴到购物 App 吧'); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tx).then(done, function () { fallback(); });
  } else fallback();
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = tx; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动长按复制'); }
    document.body.removeChild(ta);
  }
}
function exportJSON() {
  var out = { exportedAt: fmtDT(new Date()), tables: {} };
  var names = { MAINT: '家庭维护清单', LOG: '维护日志', FEE: '固定费用台账', FES: '节日与生日', DLY: '日用品库存', TSK: '任务请求表', REG: 'AI任务注册表' };
  for (var k in DB) out.tables[names[k]] = Store.get(DB[k]);
  var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '家庭维护台-备份-' + fmtD(todayStart()) + '.json';
  document.body.appendChild(a); a.click();
  setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
}

/* ================= 路由与事件 ================= */
function switchTab(name, seg) {
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === name);
  var views = document.querySelectorAll('.view');
  for (var j = 0; j < views.length; j++) views[j].classList.remove('on');
  $('v-' + name).classList.add('on');
  if (name === 'hub') {
    if (seg) {
      hubKey = seg;
      var sb = document.querySelectorAll('#hubSeg button');
      for (var k = 0; k < sb.length; k++) sb[k].classList.toggle('on', sb[k].getAttribute('data-seg') === seg);
    }
    renderHub();
  }
  if (name === 'today') renderToday();
  if (name === 'maint') refreshMaint();
  if (name === 'ai') renderAi();
  if (name === 'me') renderMe();
  window.scrollTo(0, 0);
}
function closest(el, sel, stopEl) {
  while (el && el !== stopEl) {
    if (el.matches && el.matches(sel)) return el;
    el = el.parentNode;
  }
  return null;
}
function bind() {
  document.querySelector('.tabbar').addEventListener('click', function (e) {
    var t = closest(e.target, '.tab', this);
    if (t) switchTab(t.getAttribute('data-tab'));
  });
  document.body.addEventListener('click', function (e) {
    var go = closest(e.target, '[data-go]', document.body);
    if (go) { switchTab(go.getAttribute('data-go'), go.getAttribute('data-seg')); return; }
    var sb = closest(e.target, '[data-sb]', document.body);
    if (sb) { var cb = sheetCb[sb.getAttribute('data-sb')]; if (cb) cb(); return; }
    if (closest(e.target, '[data-x]', document.body)) { closeSheet(); return; }
  });
  $('mask').addEventListener('click', closeSheet);
  $('cfNo').addEventListener('click', function () { $('confirm').classList.remove('on'); $('mask').classList.remove('on'); });
  $('cfOk').addEventListener('click', function () { if (confirmCb) confirmCb(); });
  document.addEventListener('keydown', function (e) { if (e.keyCode === 27) closeSheet(); });

  /* 维护 */
  $('kw').addEventListener('input', function () { mState.kw = this.value; renderMList(); });
  $('roomSel').addEventListener('change', function () { mState.room = this.value; renderMList(); });
  $('stSel').addEventListener('change', function () { mState.status = this.value; renderMStats(); renderMList(); });
  document.querySelector('.stats').addEventListener('click', function (e) {
    var b = closest(e.target, '[data-flt]', this);
    if (!b) return;
    var k = b.getAttribute('data-flt');
    mState.status = (mState.status === k) ? '' : k;
    $('stSel').value = mState.status;
    renderMStats(); renderMList();
  });
  $('mList').addEventListener('click', function (e) {
    var done = closest(e.target, '[data-done]', this);
    if (done) { e.stopPropagation(); doneFlow([done.getAttribute('data-done')]); return; }
    var pk = closest(e.target, '[data-pick]', this);
    if (pk) {
      var pid = pk.getAttribute('data-pick');
      mState.picked[pid] = pk.checked;
      var n = 0; for (var k2 in mState.picked) if (mState.picked[k2]) n++;
      $('batchCnt').textContent = '已选 ' + n + ' 项';
      return;
    }
    var tg = closest(e.target, '[data-tg]', this);
    if (tg) { tg.parentNode.classList.toggle('open'); return; }
    var card = closest(e.target, '[data-mid]', this);
    if (card && !mState.batch) openMaintDetail(card.getAttribute('data-mid'));
  });
  $('mAdd').addEventListener('click', function () { openMaintForm(null); });
  $('batchDone').addEventListener('click', function () {
    var ids = [];
    for (var k in mState.picked) if (mState.picked[k]) ids.push(k);
    doneFlow(ids);
  });
  $('batchQuit').addEventListener('click', function () {
    mState.batch = false; mState.picked = {};
    $('batchBar').classList.remove('on');
    renderMList();
  });

  /* 今天快捷 */
  $('v-today').addEventListener('click', function (e) {
    var done = closest(e.target, '[data-done]', this);
    if (done) { doneFlow([done.getAttribute('data-done')]); return; }
    var snz = closest(e.target, '[data-snz]', this);
    if (snz) { snooze(snz.getAttribute('data-snz')); return; }
    var mid = closest(e.target, '[data-mid]', this);
    if (mid) { openMaintDetail(mid.getAttribute('data-mid')); return; }
    var qk = closest(e.target, '[data-quick]', this);
    if (qk) { var cfg = e.target && closest(e.target, '[data-qk]', this) ? HUB.DLY : HUB.FEE; cfg.quick(qk.getAttribute('data-quick'), qk.getAttribute('data-qk')); }
  });

  /* 管家 */
  $('hubSeg').addEventListener('click', function (e) {
    var b = closest(e.target, '[data-seg]', this);
    if (!b) return;
    hubKey = b.getAttribute('data-seg');
    var sb = document.querySelectorAll('#hubSeg button');
    for (var i = 0; i < sb.length; i++) sb[i].classList.toggle('on', sb[i] === b);
    renderHub();
  });
  $('hubBody').addEventListener('click', function (e) {
    var add = closest(e.target, '[data-hubadd]', this);
    if (add) { hubForm(hubKey, null); return; }
    var qk = closest(e.target, '[data-quick]', this);
    if (qk) { e.stopPropagation(); HUB[hubKey].quick(qk.getAttribute('data-quick'), qk.getAttribute('data-qk')); return; }
    var ed = closest(e.target, '[data-edit]', this);
    if (ed) hubForm(hubKey, ed.getAttribute('data-edit'));
  });

  /* AI */
  document.querySelector('.aibtns').addEventListener('click', function (e) {
    var b = closest(e.target, '[data-task]', this);
    if (b) taskPost(b.getAttribute('data-task'), b);
  });
  $('aiOut').addEventListener('click', function (e) {
    var b = closest(e.target, '[data-read]', this);
    if (b) taskRead(b.getAttribute('data-read'));
  });

  /* 我的 */
  $('meEdit').addEventListener('click', function () {
    openSheet('设置操作人', '<div class="field"><label>你的名字</label><input id="meInput" type="text" value="' + esc(user()) + '" placeholder="写日志时署名"></div>', [
      { label: '取消', cls: 'gho', cb: closeSheet },
      { label: '保存', cls: 'pri', cb: function () {
        saveUser(($('meInput').value || '').trim());
        closeSheet(); renderMe(); toast('已保存');
      } }
    ]);
  });
  $('shopBody').addEventListener('click', function (e) {
    if (closest(e.target, '[data-copyshop]', this)) copyShop();
  });
  $('expBtn').addEventListener('click', exportJSON);
}

function subscribe() {
  if (!db || typeof db.onUpdated !== 'function') return;
  var timer = null;
  db.onUpdated(function (payload) {
    var ids = (payload && payload.databaseIds) || [];
    var hit = false;
    for (var k in DB) if (ids.indexOf(DB[k]) > -1) { hit = true; break; }
    if (!hit) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      Store.loadAll().then(function () { renderToday(); refreshMaint(); renderHub(); renderAi(); renderMe(); });
    }, 400);
  });
}
function renderSync(cls, tx) {
  var b = $('syncBox');
  b.className = 'sync ' + cls;
  $('syncTx').textContent = tx;
}
function boot() {
  bind();
  if (!db) {
    renderSync('off', '离线预览');
    $('tdBanner').innerHTML = '<div class="banner"><b>离线预览</b><div class="b-sub">请在资料库中打开本页面，才能读写数据。</div></div>';
    return;
  }
  renderSync('load', '同步中');
  db.getSchema({ databaseId: DB.MAINT }).then(function (schema) {
    var list = (schema && schema.properties) || [];
    list.forEach(function (f) {
      if ((f.type === 'select' || f.type === 'multi_select') && f.config && f.config.options) {
        MAINT_OPTS[f.name] = f.config.options.map(function (o) { return o.text; });
      }
    });
  }).catch(function (e) { console.error('[schema]', e); }).then(function () {
    var rooms = MAINT_OPTS[MF.ROOM] || FALLBACK_OPTS[MF.ROOM];
    $('roomSel').innerHTML = '<option value="">全部房间</option>' + rooms.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('');
    return Store.loadAll();
  }).then(function () {
    renderSync('ok', '已同步');
    renderToday(); refreshMaint(); renderHub(); renderAi(); renderMe();
    subscribe();
  }).catch(function (e) {
    console.error('[boot]', e);
    renderSync('off', '同步失败');
  });
}

try {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
} catch (e) {
  console.error('[app] 初始化异常:', e);
}
})();
