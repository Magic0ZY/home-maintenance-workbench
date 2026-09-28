/* 家庭维护工作台 · 主脚本快照
 * 本文件由 page/index.html 内的 <script> 块抽出，仅为便于阅读，改它不生效。
 */

(function () {
'use strict';

/* ================= 配置 ================= */
var DB = {
  MAINT: 'YOUR_MAINT_DB_ID',
  LOG: 'YOUR_LOG_DB_ID',
  FEE: 'YOUR_FEE_DB_ID',
  FES: 'YOUR_FES_DB_ID',
  DLY: 'YOUR_DLY_DB_ID',
  TSK: 'YOUR_TSK_DB_ID',
  REG: 'YOUR_REG_DB_ID',
  LEDGER: 'YOUR_LEDGER_DB_ID',
  MEMBER: 'YOUR_MEMBER_DB_ID',
  PREF: 'YOUR_PREF_DB_ID',
  PREP: 'YOUR_PREP_DB_ID',
  SNAP: 'YOUR_SNAP_DB_ID',
  LOC: 'YOUR_LOC_DB_ID',
  PET: 'YOUR_PET_DB_ID',
  PETCARE: 'YOUR_PETCARE_DB_ID',
  ITEM: 'YOUR_ITEM_DB_ID',
  DEV: 'YOUR_DEV_DB_ID'
};
var GUEST = '__guest__';
var MF = {
  NAME: '维护项', DEV: '所属设备', ROOM: '房间', CAT: '类别', ACT: '维护动作',
  CYCLE: '周期天数', LAST: '上次维护日期', URL: '说明书链接', IMG: '说明书图片',
  NOTE: '备注', MODEL: '耗材型号', STOCK: '备件库存', PRICE: '耗材单价', OWNER: '负责人',
  MODULE: '归属模块', PET: '宠物'
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
/* 可撤销提示条：显示 8 秒，点「撤销」即执行回滚操作 */
function showUndo(msg, cb) {
  var el = document.createElement('div');
  el.className = 'undo';
  el.innerHTML = '<span>' + esc(msg) + '</span><button type="button">撤销</button>';
  el.querySelector('button').addEventListener('click', function () {
    if (el.parentNode) el.parentNode.removeChild(el);
    cb();
  });
  document.body.appendChild(el);
  setTimeout(function () { el.classList.add('on'); }, 10);
  setTimeout(function () {
    el.classList.remove('on');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  }, 8000);
}
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
/* 游客模式：能看不能改 */
function isGuest() { return user() === GUEST; }
function canWrite() {
  if (isGuest()) { toast('游客模式只能查看，不能修改'); return false; }
  return true;
}
/* 家庭成员：下拉选择 + 可自建；首次进入强制选择，之后记住 */
function members() {
  var rows = Store.get(DB.MEMBER).slice();
  rows.sort(function (a, b) { return String(a['角色'] || '').localeCompare(String(b['角色'] || '')); });
  return rows;
}
function memberNames() {
  return members().map(function (m) { return m['姓名']; }).filter(Boolean);
}
function memberOf(name) {
  var hit = null;
  members().forEach(function (m) { if (m['姓名'] === name) hit = m; });
  return hit;
}
function refreshAllViews() { renderToday(); refreshMaint(); renderHub(); renderAi(); renderMe(); }
function openMemberSheet(force) {
  var rows = members();
  var opts = rows.map(function (m) {
    var mark = m['权限'] === '管理员' ? '（管理员 · 需解锁）' : (m['角色'] ? '（' + m['角色'] + '）' : '');
    return '<option value="' + esc(m['姓名']) + '"' + (user() === m['姓名'] ? ' selected' : '') + '>' +
      esc(m['姓名']) + mark + '</option>';
  }).join('') + '<option value="' + GUEST + '"' + (isGuest() ? ' selected' : '') + '>游客（只看不动）</option>';
  var body = '<div class="field"><label>' + (force ? '第一次进来，先选一下你是谁' : '切换当前成员') + '</label>' +
    '<select id="memPick">' + (opts || '<option value="">（还没有成员，请在下面新建）</option>') + '</select>' +
    '<div class="hint">选好后会记住，之后写日志、记账、报备、投递任务都自动署你的名字。</div></div>' +
    '<div class="field"><label>＋ 新建成员</label><input id="memNew" type="text" placeholder="输入姓名，如：老妈">' +
    '<div class="hint">新建后自动写进「家庭成员」表，以后下拉框里直接可选。</div></div>';
  openSheet(force ? '选择成员' : '切换成员', body, [
    { label: '确定', cls: 'pri', cb: function () {
      var nn = ($('memNew').value || '').trim();
      var picked = ($('memPick').value || '');
      if (nn) {
        db.addRecord({ databaseId: DB.MEMBER, properties: { '姓名': { text: nn } } })
          .then(function () { return Store.load(DB.MEMBER); })
          .then(function () {
            saveUser(nn); sheetLock = false; closeSheet(); refreshAllViews();
            toast('已新建成员并切换为 ' + nn);
          }).catch(function (e) { console.error(e); toast('新建失败，请重试'); });
        return;
      }
      if (!picked) { toast('先选一个成员，或输入新名字'); return; }
      var applyPick = function () {
        saveUser(picked); sheetLock = false; closeSheet(); refreshAllViews();
        toast(picked === GUEST ? '游客模式：可以随便看，改不了数据' : '当前成员：' + picked);
      };
      if (isAdminMember(picked) && !adminTrusted()) {
        toast('这是管理员账户，需要解锁');
        unlockAdmin(applyPick);
        return;
      }
      applyPick();
    } }
  ], force);
}
function pill(left) {
  if (left === null) return '<span class="pill b-gray">未定</span>';
  if (left < 0) return '<span class="pill b-red">已过 ' + (-left) + ' 天</span>';
  if (left <= 30) return '<span class="pill b-amber">' + left + ' 天后</span>';
  return '<span class="pill b-gray">' + left + ' 天后</span>';
}
function recOf(res) { return (res && res.result) ? res.result : res; }
/* 时间合理性校验：AI 有时凭估算写「完成时间」，可能出现未来时间或早于提交时间。
   校验不通过就退回用提交时间显示，并标注原因，避免把错误时间当真。 */
function whenTx(r) {
  var done = String(r['完成时间'] || '').slice(0, 16).replace('T', ' ');
  var sub = String(r['提交时间'] || '').slice(0, 16).replace('T', ' ');
  var now = fmtDT(new Date());
  if (!done) return sub ? ('提交于 ' + sub) : '时间未记录';
  if (done > now) return (sub ? '提交于 ' + sub : '时间未记录') + ' · 完成时间异常已忽略';
  if (sub && done < sub) return '提交于 ' + sub + ' · 完成时间异常已忽略';
  return '完成于 ' + done;
}

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
  failed: {},
  loadAll: function (ids) {
    var self = this;
    var list = ids || [DB.MAINT, DB.LOG, DB.FEE, DB.FES, DB.DLY, DB.TSK, DB.REG, DB.LEDGER, DB.MEMBER, DB.PREF, DB.PREP, DB.SNAP, DB.LOC, DB.PET, DB.PETCARE, DB.ITEM, DB.DEV];
    return new Promise(function (resolve) {
      var i = 0, fails = [], CONC = 4;
      function next() {
        if (i >= list.length) { resolve(fails); return; }
        var id = list[i++];
        self.load(id)
          .then(function () { delete self.failed[id]; })
          .catch(function (e) {
            console.error('[store] 加载失败，重试一次 ' + id, e);
            return self.load(id).catch(function (e2) {
              console.error('[store] 重试仍失败 ' + id, e2);
              self.failed[id] = 1; fails.push(id);
            });
          })
          .then(function () { next(); });
      }
      for (var k = 0; k < CONC; k++) next();
    });
  }
};
/* 重新同步：右上角状态条点击 / 未加载提示里的按钮都用它 */
function resync() {
  renderSync('load', '同步中');
  Store.loadAll().then(function (fails) {
    var nf = (fails || []).length;
    if (nf) {
      renderSync('off', nf + ' 张表未加载 · 点重试');
      toast('还有 ' + nf + ' 张表没加载上，过一会儿再点一次');
    } else {
      renderSync('ok', '已同步');
      toast('已重新同步');
    }
    renderToday(); refreshMaint(); renderHub(); renderAi(); renderMe();
  });
}

/* ================= 通用组件 ================= */
var sheetCb = {};
function openSheet(title, bodyHTML, btns, lock) {
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
  var x = document.querySelector('.xbtn');
  if (x) x.style.display = lock ? 'none' : '';
  sheetLock = !!lock;
  $('mask').classList.add('on');
  $('sheet').classList.add('on');
}
var sheetLock = false;
function closeSheet() {
  if (sheetLock) return;
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
    } else if (f.type === 'area') {
      html += '<textarea id="ff_' + f.key + '" rows="3" placeholder="' + esc(f.ph || '') + '">' + esc(v || '') + '</textarea>';
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

/* 通用状态计算：给定「周期天数 + 上次日期」，算出红黄绿。维护项/宠物护理共用。 */
function calcStatus(cycle, last) {
  if (!cycle || !last) return { k: 'gray', left: null, zone: 0 };
  var zone = Math.min(30, Math.max(7, Math.round(cycle * 0.15)));
  var next = new Date(last.getTime() + cycle * DAY);
  var left = daysLeft(next);
  if (left < 0) return { k: 'red', left: left, zone: zone };
  if (left <= zone) return { k: 'amber', left: left, zone: zone };
  return { k: 'green', left: left, zone: zone };
}
function mStatus(r) { return calcStatus(numOf(r[MF.CYCLE]), parseDay(r[MF.LAST])); }
function careStatus(r) { return calcStatus(numOf(r['周期天数']), parseDay(r['上次日期'])); }
function carePill(st) {
  if (st.k === 'red') return '<span class="pill b-red">该做了</span>';
  if (st.k === 'amber') return '<span class="pill b-amber">快了</span>';
  if (st.k === 'green') return '<span class="pill b-green">正常</span>';
  return '<span class="pill b-gray">未设周期</span>';
}
/* 物品有效期：过期红、30 天内黄，已用完/送人置灰 */
function itemStatus(r) {
  var st = r['状态'] || '';
  if (st === '已用完' || st === '已过期' || st === '已送人') return { k: 'gray', label: st, left: null };
  var exp = parseDay(r['保质期至']);
  if (!exp) return { k: 'gray', label: st || '未填保质期', left: null };
  var left = daysLeft(exp);
  if (left < 0) return { k: 'red', label: '已过期 ' + (-left) + ' 天', left: left };
  if (left <= 30) return { k: 'amber', label: left + ' 天后到期', left: left };
  return { k: 'green', label: '剩 ' + left + ' 天', left: left };
}
function itemExpiring() {
  return Store.get(DB.ITEM).filter(function (r) {
    var st = r['状态'] || '';
    if (st === '已用完' || st === '已过期' || st === '已送人') return false;
    var s = itemStatus(r);
    return s.left !== null && s.left <= 30;
  });
}
function petNames() { return Store.get(DB.PET).map(function (p) { return p['名字']; }).filter(Boolean); }
function locNames() { return Store.get(DB.LOC).map(function (l) { return l['名称']; }).filter(Boolean); }
/* 位置路径：药箱挂在柜子A下 → 显示「柜子A › 药箱」；移动药箱只需改它的上级 */
function locPath(name) {
  var byName = {};
  Store.get(DB.LOC).forEach(function (l) { byName[l['名称']] = l; });
  var chain = [], cur = name, guard = 0;
  while (cur && guard++ < 6) {
    chain.unshift(cur);
    var row = byName[cur];
    var up = row ? (row['上级位置'] || '') : '';
    if (!up || up === cur) break;
    cur = up;
  }
  return chain.join(' › ');
}
/* 设备清单：唯一来源 = 设备档案表（维护项里历史遗留的设备名也一并列出，避免选不到） */
function devNames() {
  var out = [];
  Store.get(DB.DEV).forEach(function (d) { if (d['设备名'] && out.indexOf(d['设备名']) < 0) out.push(d['设备名']); });
  Store.get(DB.MAINT).forEach(function (m) { var n = m[MF.DEV]; if (n && out.indexOf(n) < 0) out.push(n); });
  return out;
}
/* 房间清单的唯一来源 = 维护清单的「房间」选项（随 schema 走，不再各处硬编码） */
function roomList() {
  var base = (MAINT_OPTS[MF.ROOM] && MAINT_OPTS[MF.ROOM].length) ? MAINT_OPTS[MF.ROOM] : ['客厅', '厨房', '客卫', '主卫', '主卧', '客卧', '书房'];
  var extra = ['阳台', '储物间', '玄关', '其他'];
  var out = [];
  base.concat(extra).forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); });
  return out;
}
var PET_KEY = 'wb_home_maint_pet';
function curPet() { try { return localStorage.getItem(PET_KEY) || ''; } catch (e) { return ''; } }
function setPet(n) { try { localStorage.setItem(PET_KEY, n); } catch (e) {} }
/* ============ 管理员权限（本机防护，不是加密） ============
   说明：页面是静态网页，这里只能防误选、手滑改错；
   真正的安全边界是资料库的分享权限（家人给「查看」就改不了数据）。 */
var ADMIN_PW_KEY = 'wb_home_maint_adminpw';
var ADMIN_OK_KEY = 'wb_home_maint_adminok';
function hashPw(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return 'h' + h;
}
function hasAdminPw() { try { return !!localStorage.getItem(ADMIN_PW_KEY); } catch (e) { return false; } }
function setAdminPw(s) { try { localStorage.setItem(ADMIN_PW_KEY, hashPw(s)); } catch (e) {} }
function checkAdminPw(s) { try { return localStorage.getItem(ADMIN_PW_KEY) === hashPw(s); } catch (e) { return false; } }
function adminTrusted() { try { return localStorage.getItem(ADMIN_OK_KEY) === '1'; } catch (e) { return false; } }
function trustAdmin(v) { try { if (v) { localStorage.setItem(ADMIN_OK_KEY, '1'); } else { localStorage.removeItem(ADMIN_OK_KEY); } } catch (e) {} }
function isAdminMember(name) { var m = memberOf(name); return !!(m && m['权限'] === '管理员'); }
/* 打开管理员解锁流程：没设过密码就先设置，设过就校验 */
function unlockAdmin(after) {
  if (!hasAdminPw()) {
    openSheet('设置管理员密码', '<div class="field"><label>第一次用管理员账户，先设一个密码</label>' +
      '<input id="pwNew" type="password" placeholder="自己记得住就行"></div>' +
      '<div class="hint">密码只存在这台设备的浏览器里，换了手机要重新设一次。忘了也不要紧：清除本机浏览器数据即可重设。</div>',
      [{ label: '取消', cls: 'gho', cb: closeSheet }, { label: '设置并解锁', cls: 'pri', cb: function () {
        var v = ($('pwNew').value || '').trim();
        if (v.length < 3) { toast('密码至少 3 位'); return; }
        setAdminPw(v); trustAdmin(true); closeSheet();
        toast('管理员密码已设置，本机已解锁');
        if (after) after();
      } }]);
    return;
  }
  openSheet('管理员解锁', '<div class="field"><label>输入管理员密码</label>' +
    '<input id="pwIn" type="password" placeholder="密码"></div>' +
    '<div class="hint">解锁后本机记住，不用每次输。要重新锁上，去「我的 → 成员与权限」点锁定。</div>',
    [{ label: '取消', cls: 'gho', cb: closeSheet }, { label: '解锁', cls: 'pri', cb: function () {
      var v = ($('pwIn').value || '').trim();
      if (!checkAdminPw(v)) { toast('密码不对，该账户不可选择'); return; }
      trustAdmin(true); closeSheet();
      toast('管理员权限已解锁');
      if (after) after();
    } }]);
}
/* 重设管理员密码（需先解锁） */
function resetAdminPw() {
  if (isGuest()) { toast('游客模式只能查看，不能修改'); return; }
  var go = function () {
    openSheet('重设管理员密码', '<div class="field"><label>新的管理员密码</label><input id="pwRs" type="password" placeholder="至少 3 位"></div>' +
      '<div class="hint">改完本机仍是解锁状态。</div>',
      [{ label: '取消', cls: 'gho', cb: closeSheet }, { label: '保存', cls: 'pri', cb: function () {
        var v = ($('pwRs').value || '').trim();
        if (v.length < 3) { toast('密码至少 3 位'); return; }
        setAdminPw(v); trustAdmin(true); closeSheet(); toast('管理员密码已更新'); renderMe();
      } }]);
  };
  if (!adminTrusted()) { unlockAdmin(go); return; }
  go();
}
/* 改名后同步引用字段（不动维护日志，历史留痕） */function syncMemberName(oldName, newName) {
  var jobs = [
    { db: DB.MAINT, field: MF.OWNER }, { db: DB.PETCARE, field: '负责人' },
    { db: DB.PREP, field: '负责人' }, { db: DB.FES, field: '关联成员' },
    { db: DB.LEDGER, field: '记录人' }
  ];
  var tasks = [];
  jobs.forEach(function (j) {
    Store.get(j.db).forEach(function (r) {
      if ((r[j.field] || '') === oldName) {
        var props = {};
        props[j.field] = { text: newName };
        tasks.push({ db: j.db, recordId: r._id, properties: props });
      }
    });
  });
  if (!tasks.length) return Promise.resolve(0);
  var p = Promise.resolve();
  tasks.forEach(function (t) { p = p.then(function () { return db.updateRecord({ databaseId: t.db, recordId: t.recordId, properties: t.properties }); }); });
  return p.then(function () {
    var dbs = {};
    tasks.forEach(function (t) { dbs[t.db] = 1; });
    return Promise.all(Object.keys(dbs).map(function (d2) { return Store.load(d2); })).then(function () { return tasks.length; });
  });
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
  if (!canWrite()) return;
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
  if (!canWrite()) return;
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
    { key: MF.DEV, label: '所属设备', type: 'datalist', options: devNames(), hint: '从设备里选；想加新设备就点右上「管理设备」，也可以直接在这里填新名字' },
    { key: MF.ROOM, label: '所属房间', type: 'select', options: (MAINT_OPTS[MF.ROOM] || FALLBACK_OPTS[MF.ROOM]), half: true },
    { key: MF.CAT, label: '类别', type: 'select', options: (MAINT_OPTS[MF.CAT] || FALLBACK_OPTS[MF.CAT]), half: true },
    { key: MF.ACT, label: '维护动作', type: 'select', options: (MAINT_OPTS[MF.ACT] || FALLBACK_OPTS[MF.ACT]), half: true },
    { key: MF.CYCLE, label: '更换周期（天）', type: 'number', ph: '例：180', half: true },
    { key: MF.MODEL, label: '耗材型号', type: 'datalist', options: Object.keys(models), ph: '下拉选或直接填' },
    { key: MF.STOCK, label: '备件库存', type: 'number', ph: '家里还有几个', half: true },
    { key: MF.PRICE, label: '耗材单价（¥）', type: 'currency', ph: '统计年度花费', half: true },
    { key: MF.LAST, label: '上次维护日期', type: 'date', half: true },
    { key: MF.OWNER, label: '负责人', type: 'datalist', options: memberNames(), ph: '从家庭成员里选，或自己填', half: true },
    { key: MF.MODULE, label: '归属模块', type: 'select', options: (MAINT_OPTS[MF.MODULE] || ['家电', '宠物', '日用', '其他']), half: true },
    { key: MF.PET, label: '宠物', type: 'datalist', options: petNames().concat(['共用']), ph: '哪只猫用；多只共用就填「共用」', half: true },
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
  if (!canWrite()) return;
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
  if (!canWrite()) return;
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
      var now = todayStart(), y0 = now.getFullYear(), m0 = now.getMonth();
      var keys = [], i;
      if (feeHorizon === 'y1') { for (i = 0; i < 12; i++) keys.push({ y: y0, m: i }); }
      else if (feeHorizon === 'y2') { for (i = 0; i < 12; i++) keys.push({ y: y0 + 1, m: i }); }
      else { for (i = 0; i < 12; i++) { var d = new Date(y0, m0 + i, 1); keys.push({ y: d.getFullYear(), m: d.getMonth() }); } }
      var sums = {};
      rows.forEach(function (r) {
        var due = parseDay(r['下次应缴日']);
        if (!due) return;
        var k = due.getFullYear() + '-' + due.getMonth();
        if (!sums[k]) sums[k] = { n: 0, amt: 0 };
        sums[k].n++;
        var a = numOf(r['金额']); if (a !== null) sums[k].amt += a;
      });
      var cal = '', total = 0;
      keys.forEach(function (kk, idx) {
        var c = sums[kk.y + '-' + kk.m] || { n: 0, amt: 0 };
        total += c.amt;
        var hot = c.n > 0 && kk.y === y0 && kk.m === m0;
        var lbl = (idx === 0 || kk.m === 0) ? (kk.y + '年' + (kk.m + 1) + '月') : ((kk.m + 1) + '月');
        cal += '<div class="cell' + (hot ? ' hot' : '') + '"><b>' + lbl + '</b><span>' + (c.n ? '¥' + Math.round(c.amt) : '—') + '</span></div>';
      });
      var seg = '<div class="seg small" style="margin-top:10px">' +
        '<button data-feeh="roll" class="' + (feeHorizon === 'roll' ? 'on' : '') + '" type="button">未来12个月</button>' +
        '<button data-feeh="y1" class="' + (feeHorizon === 'y1' ? 'on' : '') + '" type="button">本年</button>' +
        '<button data-feeh="y2" class="' + (feeHorizon === 'y2' ? 'on' : '') + '" type="button">次年</button></div>';
      return seg + '<div class="cal">' + cal + '</div>' +
        '<div class="sub" style="margin-top:6px">区间合计 ¥' + Math.round(total) + '　·　点任意一行可编辑或删除</div>';
    },
    quick: function (id) {
      if (!canWrite()) return;
      db.getRecord({ databaseId: DB.FEE, recordId: id }).then(function (res) {
        var r = recOf(res);
        var prevDue = r['下次应缴日'] ? String(r['下次应缴日']).slice(0, 10) : '';
        var due = parseDay(r['下次应缴日']) || todayStart();
        var cyc = r['缴费周期'] || '年';
        var nd = new Date(due.getTime());
        if (cyc === '月') nd.setMonth(nd.getMonth() + 1);
        else if (cyc === '季') nd.setMonth(nd.getMonth() + 3);
        else if (cyc === '半年') nd.setMonth(nd.getMonth() + 6);
        else nd.setFullYear(nd.getFullYear() + 1);
        return db.updateRecord({ databaseId: DB.FEE, recordId: id, properties: { '下次应缴日': { date: fmtD(nd) }, '状态': { select: '待缴' } } })
          .then(function () {
            toast('已缴费，下次应缴 ' + fmtD(nd));
            if (prevDue) showUndo('已记为缴费（' + fmtD(nd) + '）', function () {
              db.updateRecord({ databaseId: DB.FEE, recordId: id, properties: { '下次应缴日': { date: prevDue } } })
                .then(function () { return Store.load(DB.FEE); })
                .then(function () { renderHub(); renderToday(); toast('已撤销，日期还原为 ' + prevDue); });
            });
            return Store.load(DB.FEE);
          })
          .then(function () { renderHub(); renderToday(); });
      }).catch(function (e) { console.error(e); toast('操作失败'); });
    }
  },
  FES: {
    dbId: DB.FES, title: '节日与生日', addLabel: '添加节日 / 生日',
    fields: function () { return [
      { key: '名称', label: '名称', type: 'text', req: true, ph: '例：老妈生日' },
      { key: '类型', label: '类型', type: 'select', options: ['公历节日', '农历节日', '生日', '纪念日'], half: true },
      { key: '日期', label: '日期', type: 'date', half: true },
      { key: '提前提醒天数', label: '提前提醒天数', type: 'number', ph: '例：7', half: true },
      { key: '关联成员', label: '关联成员', type: 'datalist', options: memberNames(), ph: '生日填谁（下拉选），可空', half: true },
      { key: 'AI行程推荐', label: 'AI 行程推荐', type: 'select', options: ['关', '开'], half: true },
      { key: '联动采购', label: '联动采购', type: 'select', options: ['关', '开'], half: true },
      { key: '备注', label: '备注', type: 'text', ph: '可空' }
    ]; },
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
    blank: '还没有节日或生日，点下方按钮添加。',
    extra: function (rows) {
      var fesMap = {};
      rows.forEach(function (r) { fesMap[r['名称']] = r; });
      var preps = Store.get(DB.PREP).slice().sort(function (a, b) {
        return String(a['关联日子'] || '').localeCompare(String(b['关联日子'] || ''));
      });
      var html = '<div class="sub" style="margin-top:14px">准备清单　<span style="font-weight:400">（到点由 AI 自动提醒；生日礼物、月饼这类都挂这儿）</span></div>';
      if (!preps.length) {
        html += '<div class="blank">还没有准备事项。比如「生日前 7 天买礼物」「中秋前 5 天准备月饼」。</div>';
      }
      preps.forEach(function (p) {
        var fes = fesMap[p['关联日子']];
        var due = fes ? parseDay(fes['日期']) : null;
        var adv = numOf(p['提前天数']) || 0;
        var fireAt = due ? new Date(due.getTime() - adv * DAY) : null;
        var left = fireAt ? daysLeft(fireAt) : null;
        var st = p['状态'] || '待准备';
        var stPill = st === '已完成' ? '<span class="pill b-green">已完成</span>'
          : (st === '不需要' ? '<span class="pill b-gray">不需要</span>'
            : (left === null ? '<span class="pill b-gray">未关联日期</span>'
              : (left <= 0 ? '<span class="pill b-amber">该准备了</span>' : '<span class="pill b-gray">' + left + ' 天后提醒</span>')));
        html += '<div class="row"><div class="rmain" data-prepedit="' + esc(p._id) + '"><div class="rname">' + esc(p['事项']) + '</div>' +
          '<div class="rmeta">' + esc(p['关联日子'] || '未关联日子') + (adv ? ' · 提前 ' + adv + ' 天' : '') +
          (fireAt ? ' · ' + fmtD(fireAt) + ' 起提醒' : '') + (p['负责人'] ? ' · ' + esc(p['负责人']) : '') +
          (p['备注'] ? ' · ' + esc(p['备注']) : '') + '</div></div>' + stPill +
          (st === '已完成' ? '' : '<button class="mini pri" data-prepdone="' + esc(p._id) + '" type="button">备好了</button>') + '</div>';
      });
      html += '<div style="margin-top:10px"><button class="mini pri" data-prepadd type="button">＋ 添加准备事项</button></div>';
      return html;
    }
  },
  DLY: {
    dbId: DB.DLY, title: '日用品', addLabel: '登记日用品',
    fields: function () { return [
      { key: '名称', label: '名称', type: 'text', req: true, ph: '例：纸巾' },
      { key: '规格', label: '规格', type: 'text', ph: '可空，如 3kg 装', half: true },
      { key: '单位', label: '单位', type: 'datalist', options: ['袋', '箱', '卷', '瓶', '包', '盒', '罐', '提', '个', '块', '支'], ph: '袋/箱/卷…填一次就自动带出', half: true },
      { key: '存放位置', label: '存放位置', type: 'select', options: [''].concat(roomList()), half: true },
      { key: '经验消耗天数', label: '经验消耗天数', type: 'number', ph: '例：45', half: true },
      { key: '宠物', label: '宠物', type: 'datalist', options: petNames().concat(['共用']), ph: '哪只用；多只共用就填「共用」', half: true },
      { key: '囤货数量', label: '囤货数量', type: 'number', ph: '例：6', half: true },
      { key: '备注', label: '备注', type: 'text', ph: '可空' }
    ]; },
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
        '每 ' + (numOf(r['经验消耗天数']) || '?') + ' 天消耗 1 ' + (r['单位'] ? esc(r['单位']) : '') +
        (r['上次报备日期'] ? ' · 报备 ' + String(r['上次报备日期']).slice(0, 10) : '') + '</div></div>' +
        '<span class="qty"><button class="mini" data-qk="dec" data-quick="' + esc(r._id) + '" type="button">−</button><b>' + (qty === null ? 0 : qty) + (r['单位'] ? esc(r['单位']) : '') + '</b><button class="mini" data-qk="inc" data-quick="' + esc(r._id) + '" type="button">＋</button></span>' +
        stPill + actBtn + '</div>';
    },
    blank: '还没有日用品，点下方按钮登记。',
    quick: function (id, qk) {
      if (!canWrite()) return;
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
  },
  LEDGER: {
    dbId: DB.LEDGER, title: '家庭账本', addLabel: '记一笔开销',
    fields: [
      { key: '事项', label: '事项', type: 'text', req: true, ph: '例：超市买菜 / 猫粮 / 换个水龙头' },
      { key: '类别', label: '类别', type: 'select', options: ['饮食', '日用', '居家', '维护', '出行', '人情', '其他'], half: true },
      { key: '日期', label: '日期', type: 'date', half: true },
      { key: '金额', label: '金额（¥）', type: 'currency', ph: '例：320', half: true },
      { key: '备注', label: '备注', type: 'text', ph: '可空', half: true }
    ],
    defaults: { '日期': { date: fmtD(todayStart()) }, '记录人': { text: user() || '未设置' } },
    sort: function (a, b) { return String(b['日期'] || '').localeCompare(String(a['日期'] || '')); },
    row: function (r) {
      var amt = numOf(r['金额']);
      return '<div class="row" data-edit="' + esc(r._id) + '"><div class="rmain"><div class="rname">' + esc(r['事项']) + '</div>' +
        '<div class="rmeta">' + (r['日期'] ? String(r['日期']).slice(0, 10) : '') +
        (r['类别'] ? ' · ' + esc(r['类别']) : '') +
        (r['记录人'] ? ' · ' + esc(r['记录人']) : '') +
        (r['备注'] ? ' · ' + esc(r['备注']) : '') + '</div></div>' +
        (amt !== null ? '<span class="pill b-gray">¥' + amt.toFixed(2) + '</span>' : '') + '</div>';
    },
    blank: '账本还是空的。点下方按钮记一笔，或在「AI」页的输入框里说一句让我记。'
  },
  PREF: {
    dbId: DB.PREF, title: '偏好设置', addLabel: '添加一条偏好',
    fields: [
      { key: '场景', label: '场景', type: 'select', options: ['行程推荐', '礼物建议', '采购建议', '沟通提醒', '通用'], req: true, half: true },
      { key: '状态', label: '状态', type: 'select', options: ['启用', '停用'], half: true },
      { key: '偏好内容', label: '偏好内容', type: 'area', req: true, ph: '例：不做游客向打卡，优先能参与进去的玩法' },
      { key: '备注', label: '备注', type: 'text', ph: '可空' }
    ],
    defaults: { '状态': { select: '启用' } },
    sort: function (a, b) { return String(a['场景'] || '').localeCompare(String(b['场景'] || '')); },
    row: function (r) {
      var on = r['状态'] !== '停用';
      return '<div class="row" data-edit="' + esc(r._id) + '"><div class="rmain"><div class="rname">' + esc(r['场景'] || '') + '</div>' +
        '<div class="rmeta">' + esc(r['偏好内容'] || '') + (r['备注'] ? ' · ' + esc(r['备注']) : '') + '</div></div>' +
        (on ? '<span class="pill b-green">启用</span>' : '<span class="pill b-gray">停用</span>') + '</div>';
    },
    blank: '还没有偏好。点下面按钮加一条，AI 生成建议时会按这里的条目来。'
  },
  PREP: {
    dbId: DB.PREP, title: '准备事项', addLabel: '添加准备事项',
    fields: function () { return [
      { key: '事项', label: '事项', type: 'text', req: true, ph: '例：买生日礼物 / 准备月饼' },
      { key: '关联日子', label: '关联日子', type: 'datalist', options: Store.get(DB.FES).map(function (r) { return r['名称']; }), ph: '从节日/生日里选，或自己填', half: true },
      { key: '提前天数', label: '提前几天提醒', type: 'number', ph: '例：7', half: true },
      { key: '负责人', label: '负责人', type: 'datalist', options: memberNames(), ph: '可空', half: true },
      { key: '状态', label: '状态', type: 'select', options: ['待准备', '已完成', '不需要'], half: true },
      { key: '备注', label: '备注', type: 'text', ph: '可空' }
    ]; },
    defaults: { '状态': { select: '待准备' } },
    sort: function (a, b) { return String(a['关联日子'] || '').localeCompare(String(b['关联日子'] || '')); },
    blank: '还没有准备事项。'
  },
  MEMBER: {
    dbId: DB.MEMBER, title: '成员', addLabel: '添加成员',
    fields: [
      { key: '姓名', label: '姓名', type: 'text', req: true, ph: '例：老妈 / 老婆', half: true },
      { key: '角色', label: '角色', type: 'select', options: ['本人', '配偶', '子女', '父亲', '母亲', '其他亲属', '室友'], half: true },
      { key: '权限', label: '权限', type: 'select', options: ['成员', '管理员'], half: true },
      { key: '生日', label: '生日', type: 'date', half: true },
      { key: '手机', label: '手机', type: 'text', ph: '可空', half: true },
      { key: '备注', label: '备注', type: 'text', ph: '可空', half: true }
    ],
    defaults: { '权限': { select: '成员' } },
    sort: function (a, b) { return String(a['姓名'] || '').localeCompare(String(b['姓名'] || '')); },
    row: function (r) {
      return '<div class="row"><div class="rmain" data-memedit="' + esc(r._id) + '"><div class="rname">' + esc(r['姓名']) +
        (r['权限'] === '管理员' ? ' <span class="tag">管理员</span>' : '') + '</div>' +
        '<div class="rmeta">' + [r['角色'], r['生日'] ? '生日 ' + String(r['生日']).slice(0, 10) : '', r['手机'], r['备注']].filter(Boolean).map(esc).join(' · ') + '</div></div></div>';
    },
    blank: '还没有成员。',
    afterSave: function (oldRow, props) {
      var newName = props['姓名'] ? props['姓名'].text : '';
      var oldName = oldRow ? (oldRow['姓名'] || '') : '';
      if (!oldRow || !newName || oldName === newName) return Promise.resolve();
      return syncMemberName(oldName, newName).then(function (n) {
        /* 若改的正是当前操作人，本机身份跟着改 */
        if (user() === oldName) saveUser(newName);
        if (n) toast('改名完成，已同步更新 ' + n + ' 处引用');
      });
    }
  },
  PET: {
    dbId: DB.PET, title: '宠物档案', addLabel: '添加宠物',
    fields: [
      { key: '名字', label: '名字', type: 'text', req: true, ph: '例：豆豆', half: true },
      { key: '类型', label: '类型', type: 'select', options: ['猫', '狗', '其他'], half: true },
      { key: '品种', label: '品种', type: 'text', ph: '可空', half: true },
      { key: '生日', label: '生日', type: 'date', half: true },
      { key: '体重kg', label: '体重（kg）', type: 'number', ph: '可空', half: true },
      { key: '绝育', label: '绝育', type: 'select', options: ['未知', '已绝育', '未绝育'], half: true },
      { key: '备注', label: '备注', type: 'text', ph: '可空' }
    ],
    sort: function (a, b) { return String(a['名字'] || '').localeCompare(String(b['名字'] || '')); },
    row: function (r) {
      return '<div class="row"><div class="rmain" data-petedit="' + esc(r._id) + '"><div class="rname">' + esc(r['名字']) + '</div>' +
        '<div class="rmeta">' + [r['类型'], r['品种'], r['绝育']].filter(Boolean).map(esc).join(' · ') + '</div></div></div>';
    },
    blank: '还没有宠物档案，先加一只。'
  },
  PETCARE: {
    dbId: DB.PETCARE, title: '宠物护理', addLabel: '添加护理项目',
    fields: function () { return [
      { key: '宠物', label: '宠物', type: 'datalist', options: petNames(), req: true, half: true },
      { key: '项目', label: '项目', type: 'select', options: ['洗澡', '体内驱虫', '体外驱虫', '疫苗', '体检', '清洁耳朵', '刷牙', '其他'], half: true },
      { key: '周期天数', label: '周期天数', type: 'number', ph: '例：30', half: true },
      { key: '上次日期', label: '上次日期', type: 'date', half: true },
      { key: '负责人', label: '负责人', type: 'datalist', options: memberNames(), half: true },
      { key: '备注', label: '备注', type: 'text', ph: '可空', half: true }
    ]; },
    defaults: function () { return { '宠物': { text: curPet() }, '上次日期': { date: fmtD(todayStart()) }, '负责人': { text: user() || '未设置' } }; },
    sort: function (a, b) { return String(a['项目'] || '').localeCompare(String(b['项目'] || '')); },
    row: function (r) {
      var st = careStatus(r);
      return '<div class="row"><div class="rmain" data-careedit="' + esc(r._id) + '"><div class="rname">' + esc(r['项目']) + '</div>' +
        '<div class="rmeta">' + esc(r['宠物'] || '') + ' · 上次 ' + (r['上次日期'] ? String(r['上次日期']).slice(0, 10) : '—') +
        ' · 周期 ' + (numOf(r['周期天数']) || '—') + ' 天</div></div>' + carePill(st) + '</div>';
    },
    blank: '还没有护理项目。'
  },
  ITEM: {
    dbId: DB.ITEM, title: '物品归档', addLabel: '登记物品',
    fields: function () { return [
      { key: '名称', label: '名称', type: 'text', req: true, ph: '例：面霜 / 眼药水' },
      { key: '品类', label: '品类', type: 'select', options: ['护肤品', '彩妆', '药品', '保健品', '食品', '日用', '工具', '其他'], half: true },
      { key: '位置', label: '位置', type: 'datalist', options: locNames(), ph: '从「存放位置」里选，或自己填', half: true },
      { key: '入库日期', label: '入库日期', type: 'date', half: true },
      { key: '保质期至', label: '保质期至', type: 'date', half: true },
      { key: '开封日期', label: '开封日期', type: 'date', half: true },
      { key: '数量', label: '数量', type: 'number', ph: '例：1', half: true },
      { key: '状态', label: '状态', type: 'select', options: ['未开封', '在用', '已用完', '已过期', '已送人'], half: true },
      { key: '备注', label: '备注', type: 'text', ph: '可空' }
    ]; },
    defaults: { '入库日期': { date: fmtD(todayStart()) }, '状态': { select: '未开封' } },
    sort: function (a, b) {
      var x = itemStatus(a), y = itemStatus(b);
      var va = x.left === null ? 99999 : x.left, vb = y.left === null ? 99999 : y.left;
      return va - vb;
    },
    row: function (r) {
      var st = itemStatus(r);
      return '<div class="row"><div class="rmain" data-edit="' + esc(r._id) + '"><div class="rname">' + esc(r['名称']) + '</div>' +
        '<div class="rmeta">' + [r['品类'], r['位置'] ? locPath(r['位置']) : '', r['保质期至'] ? '保质期至 ' + String(r['保质期至']).slice(0, 10) : '', numOf(r['数量']) ? 'x' + numOf(r['数量']) : ''].filter(Boolean).map(esc).join(' · ') + '</div></div>' +
        '<span class="pill b-' + st.k + '">' + esc(st.label) + '</span></div>';
    },
    blank: '还没有归档物品。点下面按钮登记，填上品类、名称、位置、保质期，以后忘在哪直接搜。',
    extra: function (rows) {
      var exp = itemExpiring();
      var locs = Store.get(DB.LOC);
      var html = '<div class="sub" style="margin-top:12px">共 ' + rows.length + ' 件归档物品' +
        (exp.length ? '　·　<b style="color:var(--amber)">' + exp.length + ' 件 30 天内到期</b>' : '') +
        '　·　存放位置 ' + locs.length + ' 个</div>';
      html += '<div style="margin-top:8px"><button class="mini" data-locmgr type="button">管理存放位置（编号编码）</button></div>';
      return html;
    }
  },
  LOC: {
    dbId: DB.LOC, title: '存放位置', addLabel: '添加位置',
    fields: function () { return [
      { key: '名称', label: '名称', type: 'text', req: true, ph: '例：主卧抽屉A / 药箱' },
      { key: '位置编码', label: '位置编码', type: 'text', ph: '例：B-D-1', half: true },
      { key: '所属区域', label: '所属区域', type: 'datalist', options: roomList(), ph: '与维护清单的房间同名，可自填', half: true },
      { key: '上级位置', label: '上级位置', type: 'datalist', options: locNames(), ph: '药箱放在柜子A里 → 上级填柜子A', half: true },
      { key: '说明', label: '说明', type: 'text', ph: '里面主要放什么' }
    ]; },
    sort: function (a, b) { return String(a['名称'] || '').localeCompare(String(b['名称'] || '')); },
    row: function (r) {
      var n = 0;
      Store.get(DB.ITEM).forEach(function (x) { if ((x['位置'] || '') === r['名称']) n++; });
      return '<div class="row"><div class="rmain" data-edit="' + esc(r._id) + '"><div class="rname">' + esc(r['名称']) +
        (r['位置编码'] ? ' <span class="tag">' + esc(r['位置编码']) + '</span>' : '') + '</div>' +
        '<div class="rmeta">' + [locPath(r['名称']) !== r['名称'] ? locPath(r['名称']) : '', r['所属区域'], r['说明'], n ? n + ' 件物品' : ''].filter(Boolean).map(esc).join(' · ') + '</div></div></div>';
    },
    blank: '还没有登记存放位置。'
  },
  DEV: {
    dbId: DB.DEV, title: '设备', addLabel: '添加设备',
    fields: function () { return [
      { key: '设备名', label: '设备名', type: 'text', req: true, ph: '例：扫地机器人' },
      { key: '房间', label: '房间', type: 'datalist', options: roomList(), ph: '放哪个房间', half: true },
      { key: '类别', label: '类别', type: 'datalist', options: (MAINT_OPTS[MF.CAT] || ['米家电器', '清洁设备', '厨房电器', '卫浴电器', '其他']), ph: '可空', half: true },
      { key: '型号', label: '型号', type: 'text', ph: '可空', half: true },
      { key: '购入日期', label: '购入日期', type: 'date', half: true },
      { key: '保修至', label: '保修至', type: 'date', half: true },
      { key: '备注', label: '备注', type: 'text', ph: '可空' }
    ]; },
    sort: function (a, b) { return String(a['设备名'] || '').localeCompare(String(b['设备名'] || '')); },
    row: function (r) {
      var n = 0;
      Store.get(DB.MAINT).forEach(function (m) { if ((m[MF.DEV] || '') === r['设备名']) n++; });
      return '<div class="row"><div class="rmain" data-devedit="' + esc(r._id) + '"><div class="rname">' + esc(r['设备名']) + '</div>' +
        '<div class="rmeta">' + [r['房间'], r['类别'], r['型号'], r['保修至'] ? '保修至 ' + String(r['保修至']).slice(0, 10) : '', n ? n + ' 条维护项' : '暂无维护项'].filter(Boolean).map(esc).join(' · ') + '</div></div></div>';
    },
    blank: '还没有设备档案。',
    afterSave: function (oldRow, props) {
      var newName = props['设备名'] ? props['设备名'].text : '';
      var oldName = oldRow ? (oldRow['设备名'] || '') : '';
      if (!oldRow || !newName || oldName === newName) return Promise.resolve();
      var tasks = [];
      Store.get(DB.MAINT).forEach(function (m) {
        if ((m[MF.DEV] || '') === oldName) tasks.push(m._id);
      });
      if (!tasks.length) return Promise.resolve();
      var p = Promise.resolve();
      tasks.forEach(function (id) {
        p = p.then(function () { return db.updateRecord({ databaseId: DB.MAINT, recordId: id, properties: { '所属设备': { text: newName } } }); });
      });
      return p.then(function () { return Store.load(DB.MAINT); }).then(function () {
        toast('设备改名完成，已同步 ' + tasks.length + ' 条维护项');
      });
    }
  }
};
var hubKey = 'FEE';
var feeHorizon = 'roll';
function renderHub() {
  if (hubKey === 'PET') { renderPetPanel(); return; }
  if (hubKey === 'ITEM') { renderItemPanel(); return; }
  var cfg = HUB[hubKey];
  if (Store.failed[cfg.dbId]) { renderLoadFail(cfg.title); return; }
  var rows = Store.get(cfg.dbId).slice().sort(cfg.sort);
  var html = rows.length ? rows.map(cfg.row).join('') : '<div class="blank">' + cfg.blank + '</div>';
  html += (cfg.extra ? cfg.extra(rows) : '');
  html += '<div style="margin-top:10px"><button class="mini pri" data-hubadd type="button">＋ ' + cfg.addLabel + '</button></div>';
  $('hubBody').innerHTML = '<div class="panel">' + html + '</div>';
}
/* 表没加载上（≠ 没有数据）：明确说清 + 就地重试 */
function renderLoadFail(title) {
  $('hubBody').innerHTML = '<div class="panel"><div class="blank">「' + esc(title || '这张表') + '」这次没加载上——<b>不是数据没了</b>，是请求失败了。点下面重新拉一次，或稍等几秒再点。</div>' +
    '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="mini pri" data-resync type="button">重新同步</button>' +
    '<button class="mini" data-goreload type="button">刷新页面</button></div></div>';
}
/* 物品：品类多选筛选 */
var itemFilter = [];
function renderItemPanel() {
  var cfg = HUB.ITEM;
  if (Store.failed[DB.ITEM]) { renderLoadFail(cfg.title); return; }
  var rows = Store.get(DB.ITEM).slice().sort(cfg.sort);
  var cats = ['药品', '化妆品', '护肤品', '保健品', '食品', '日用', '工具', '其他'];
  var chips = '<div class="petchips">' + cats.map(function (c) {
    return '<button class="petchip' + (itemFilter.indexOf(c) >= 0 ? ' on' : '') + '" data-itemf="' + esc(c) + '" type="button">' + esc(c) + '</button>';
  }).join('') +
    '<button class="petchip' + (itemFilter.length === cats.length ? ' on' : '') + '" data-itemf="__all" type="button">全选</button>' +
    '<button class="petchip' + (itemFilter.length ? '' : ' on') + '" data-itemf="__none" type="button">全不选</button>' +
    '</div>';
  var shown = itemFilter.length ? rows.filter(function (r) { return itemFilter.indexOf(r['品类'] || '') >= 0; }) : rows;
  var exp = itemExpiring();
  var head = '<div class="panel">' + chips +
    '<div class="sub">共 ' + rows.length + ' 件' + (itemFilter.length ? '，筛选后 ' + shown.length + ' 件' : '') +
    (exp.length ? '　·　<b style="color:var(--amber)">' + exp.length + ' 件 30 天内到期</b>' : '') + '</div></div>';
  var list = '<div class="panel">' + (shown.length ? shown.map(cfg.row).join('')
    : '<div class="blank">' + (itemFilter.length ? '选中的品类下还没有物品。' : cfg.blank) + '</div>') + '</div>';
  var btns = '<div class="panel"><div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="mini pri" data-hubadd type="button">＋ ' + cfg.addLabel + '</button>' +
    '<button class="mini" data-moveitems type="button">批量移动</button>' +
    '<button class="mini" data-locmgr type="button">管理存放位置</button></div></div>';
  $('hubBody').innerHTML = head + list + btns;
}
/* 存放位置管理弹层：位置编码体系的入口，物品归档、日用品后续都可引用 */
function openLocSheet() {
  var locs = Store.get(DB.LOC).slice().sort(HUB.LOC.sort);
  var body = '<div class="sub" style="margin-bottom:8px">给主要存储空间编号编码（如「客厅柜子A → L-C-A」），之后登记物品时从下拉里选，忘放哪了直接查。</div>';
  body += locs.length ? locs.map(function (l) {
    var path = locPath(l['名称']);
    return '<div class="row"><div class="rmain" data-locedit="' + esc(l._id) + '"><div class="rname">' + esc(l['名称']) +
      (l['位置编码'] ? ' <span class="tag">' + esc(l['位置编码']) + '</span>' : '') + '</div>' +
      '<div class="rmeta">' + [path !== l['名称'] ? '在 ' + path : '', l['所属区域'], l['说明']].filter(Boolean).map(esc).join(' · ') + '</div></div></div>';
  }).join('') : '<div class="blank">还没有位置。点下面按钮加第一个，比如「客厅柜子A / L-C-A」。</div>';
  openSheet('存放位置', body, [
    { label: '关闭', cls: 'gho', cb: closeSheet },
    { label: '＋ 添加位置', cls: 'pri', cb: function () { hubForm('LOC', null); } }
  ]);
}
/* 设备管理：增删改设备档案（维护项的「所属设备」是文本，所以老记录不会被改坏） */
function openDevSheet() {
  if (Store.failed[DB.DEV]) { toast('设备表没加载上，点右上角状态条重试'); return; }
  var devs = Store.get(DB.DEV).slice().sort(HUB.DEV.sort);
  var body = '<div class="sub" style="margin-bottom:8px">家电、传感器、宠物设备都在这儿维护。点一行可编辑；<b>改名会同步更新维护项里的设备名</b>；删掉一台设备不会动它的维护项（会保留旧名字）。</div>';
  body += devs.length ? devs.map(HUB.DEV.row).join('') : '<div class="blank">' + HUB.DEV.blank + '</div>';
  openSheet('管理设备', body, [
    { label: '关闭', cls: 'gho', cb: closeSheet },
    { label: '＋ 添加设备', cls: 'pri', cb: function () { hubForm('DEV', null); } }
  ]);
}
/* 物品批量移动：把一批物品整体挪到另一个位置（药箱从柜子A挪到柜子B这种） */
function openMoveSheet() {
  if (Store.failed[DB.ITEM]) { toast('物品表没加载上，点右上角状态条重试'); return; }
  var rows = Store.get(DB.ITEM).slice().sort(HUB.ITEM.sort);
  var shown = itemFilter.length ? rows.filter(function (r) { return itemFilter.indexOf(r['品类'] || '') >= 0; }) : rows;
  if (!shown.length) { toast('没有可移动的物品'); return; }
  var locs = Store.get(DB.LOC).slice();
  var opts = locs.map(function (l) { return '<option value="' + esc(l['名称']) + '">' + esc(locPath(l['名称'])) + '</option>'; }).join('');
  var body = '<div class="sub" style="margin-bottom:8px">勾选要一起移动的物品，再填目标位置。' +
    (locs.length ? '（如果整箱挪动，也可以直接改那个「位置」的「上级位置」——物品不用动。）' : '') + '</div>' +
    '<div class="field"><label>目标位置</label><input id="mvTo" list="mvLocList" placeholder="从位置里选，或自己填">' +
    '<datalist id="mvLocList">' + opts + '</datalist>' +
    '<div class="hint">位置可在「管理存放位置」里先建好，比如「药箱」的上级填「柜子A」。</div></div>' +
    '<div style="margin:10px 0 4px"><button class="mini" data-mvall type="button">全选</button> <button class="mini" data-mvnone type="button">全不选</button></div>' +
    '<div style="max-height:38vh;overflow:auto">' + shown.map(function (r) {
      return '<label class="row" style="cursor:pointer;align-items:center"><input type="checkbox" class="mvck" value="' + esc(r._id) + '" checked>' +
        '<span class="rmain" style="margin-left:10px"><span class="rname">' + esc(r['名称']) + '</span>' +
        '<div class="rmeta">' + [r['品类'], r['位置'] ? '现在在 ' + esc(locPath(r['位置'])) : '未登记位置'].filter(Boolean).join(' · ') + '</div></span></label>';
    }).join('') + '</div>';
  openSheet('批量移动物品', body, [
    { label: '取消', cls: 'gho', cb: closeSheet },
    { label: '移动', cls: 'pri', cb: function () {
      if (!canWrite()) return;
      var to = ($('mvTo').value || '').trim();
      if (!to) { toast('先填目标位置'); return; }
      var ids = [];
      Array.prototype.forEach.call(document.querySelectorAll('.mvck'), function (c) { if (c.checked) ids.push(c.value); });
      if (!ids.length) { toast('至少勾一件'); return; }
      var p = Promise.resolve(), n = 0;
      ids.forEach(function (id) {
        p = p.then(function () {
          return db.updateRecord({ databaseId: DB.ITEM, recordId: id, properties: { '位置': { text: to } } })
            .then(function () { n++; });
        });
      });
      p.then(function () { return Store.load(DB.ITEM); }).then(function () {
        closeSheet(); renderHub(); renderMe(); toast('已把 ' + n + ' 件物品移到「' + to + '」');
      }).catch(function (e) { console.error(e); toast('移动失败，请重试'); });
    } }
  ]);
}
/* 宠物模块：宠物视角聚合 —— 档案 + 护理周期 + 该宠物的设备耗材 + 专属消耗品 */
function renderPetPanel() {
  if (Store.failed[DB.PET]) { renderLoadFail('宠物档案'); return; }
  var pets = Store.get(DB.PET).slice().sort(HUB.PET.sort);
  if (!pets.length) {
    $('hubBody').innerHTML = '<div class="panel"><div class="blank">还没有宠物档案。先加一只（类型可选猫／狗／其他），之后它的护理周期、专属设备耗材、猫粮猫砂都会聚到这里。</div>' +
      '<div style="margin-top:10px"><button class="mini pri" data-petadd type="button">＋ 添加宠物</button></div></div>';
    return;
  }
  var cur = curPet();
  var has = false;
  pets.forEach(function (p) { if (p['名字'] === cur) has = true; });
  if (!has) { cur = pets[0]['名字']; setPet(cur); }
  var p = null;
  pets.forEach(function (x) { if (x['名字'] === cur) p = x; });

  var chips = '<div class="petchips">' + pets.map(function (x) {
    return '<button class="petchip' + (x['名字'] === cur ? ' on' : '') + '" data-petsel="' + esc(x['名字']) + '" type="button">' +
      esc(x['名字']) + (x['类型'] ? ' · ' + esc(x['类型']) : '') + '</button>';
  }).join('') + '<button class="petchip add" data-petadd type="button">＋ 加一只</button></div>';

  var age = '';
  var bd = parseDay(p['生日']);
  if (bd) {
    var months = Math.round((todayStart() - bd) / DAY / 30.44);
    age = months >= 24 ? (Math.floor(months / 12) + ' 岁') : (months + ' 个月');
  }
  var profile = '<div class="row"><div class="rmain" data-petedit="' + esc(p._id) + '"><div class="rname">' + esc(p['名字']) +
    (p['类型'] ? ' <span class="tag">' + esc(p['类型']) + '</span>' : '') +
    (p['绝育'] && p['绝育'] !== '未知' ? ' <span class="tag">' + esc(p['绝育']) + '</span>' : '') + '</div>' +
    '<div class="rmeta">' + [p['品种'], age ? '约 ' + age : '', numOf(p['体重kg']) !== null ? numOf(p['体重kg']) + ' kg' : '', p['生日'] ? '生日 ' + String(p['生日']).slice(0, 10) : ''].filter(Boolean).map(esc).join(' · ') + '</div></div>' +
    '<button class="mini" data-petedit="' + esc(p._id) + '" type="button">编辑</button></div>' +
    (p['备注'] ? '<div class="rmeta" style="padding:2px 2px 6px">' + esc(p['备注']) + '</div>' : '');

  var care = Store.get(DB.PETCARE).filter(function (c) { return (c['宠物'] || '') === cur; });
  care.sort(function (a, b) {
    var x = careStatus(a), y = careStatus(b);
    return (x.left === null ? 99999 : x.left) - (y.left === null ? 99999 : y.left);
  });
  var careHtml = care.length ? care.map(function (c) {
    var st = careStatus(c);
    return '<div class="row"><div class="rmain" data-careedit="' + esc(c._id) + '"><div class="rname">' + esc(c['项目']) + '</div>' +
      '<div class="rmeta">上次 ' + (c['上次日期'] ? String(c['上次日期']).slice(0, 10) : '—') +
      ' · 周期 ' + (numOf(c['周期天数']) || '—') + ' 天' +
      (st.left === null ? '' : (st.left < 0 ? ' · 已过 ' + (-st.left) + ' 天' : ' · 还剩 ' + st.left + ' 天')) +
      (c['负责人'] ? ' · ' + esc(c['负责人']) : '') + '</div></div>' + carePill(st) +
      '<button class="mini pri" data-caredone="' + esc(c._id) + '" type="button">做了</button></div>';
  }).join('') : '<div class="blank">还没有护理项目。加一条「洗澡 · 30 天」「体外驱虫 · 30 天」，就会自动算下次该做的时间。</div>';

  var devs = Store.get(DB.MAINT).filter(function (m) {
    var pn = m[MF.PET] || '';
    return pn === cur || pn === '共用' || ((m[MF.MODULE] || '') === '宠物' && !pn);
  });
  var devHtml = devs.length ? devs.map(function (m) {
    var st = mStatus(m);
    var stock = numOf(m[MF.STOCK]);
    var shared = (m[MF.PET] || '') === '共用' || (!m[MF.PET] && (m[MF.MODULE] || '') === '宠物');
    return '<div class="row"><div class="rmain" data-mid="' + esc(m._id) + '"><div class="rname">' + esc(m[MF.NAME]) +
      (shared ? ' <span class="tag">共用</span>' : '') + '</div>' +
      '<div class="rmeta">' + esc(m[MF.DEV] || '') + ' · 上次 ' + (m[MF.LAST] ? String(m[MF.LAST]).slice(0, 10) : '—') +
      ' · 周期 ' + (numOf(m[MF.CYCLE]) || '—') + ' 天' +
      (stock !== null ? ' · 备件 ' + stock : '') + '</div></div>' + mPill(st) + '</div>';
  }).join('') : '<div class="blank">还没有归到「' + esc(cur) + '」名下的设备耗材。在维护模块里把耗材的「归属模块」设为宠物、填上宠物名（多只共用就填「共用」），它就会出现在这里。</div>';

  var goods = Store.get(DB.DLY).filter(function (d) {
    var pn = d[MF.PET] || '';
    return pn === cur || pn === '共用';
  });
  var goodHtml = goods.length ? goods.map(function (d) {
    var st = d['状态'] || '充足';
    var shared = (d[MF.PET] || '') === '共用';
    return '<div class="row"><div class="rmain" data-dlyedit="' + esc(d._id) + '"><div class="rname">' + esc(d['名称']) +
      (shared ? ' <span class="tag">共用</span>' : '') + '</div>' +
      '<div class="rmeta">' + (d['规格'] ? esc(d['规格']) + ' · ' : '') + '囤货 ' + (numOf(d['囤货数量']) === null ? 0 : numOf(d['囤货数量'])) + (d['单位'] ? esc(d['单位']) : '') +
      ' · 每 ' + (numOf(d['经验消耗天数']) || '?') + ' 天消耗 1 ' + (d['单位'] ? esc(d['单位']) : '') + '</div></div>' +
      (st === '充足' ? '<span class="pill b-green">充足</span>' : '<span class="pill b-amber">' + esc(st) + '</span>') + '</div>';
  }).join('') : '<div class="blank">还没有归到「' + esc(cur) + '」的消耗品。在日用品里把猫粮、猫砂的「宠物」字段填成它就行。</div>';

  var html = '<div class="panel">' + chips + profile + '</div>' +
    '<div class="panel"><div class="panel-h"><h3>护理周期</h3><span class="sub">洗澡、驱虫、疫苗、体检</span></div>' + careHtml +
    '<div style="margin-top:10px"><button class="mini pri" data-careadd type="button">＋ 添加护理项目</button></div></div>' +
    '<div class="panel"><div class="panel-h"><h3>它的设备耗材</h3><span class="sub">饮水机滤芯、猫厕所除臭块这类（含共用）</span></div>' + devHtml + '</div>' +
    '<div class="panel"><div class="panel-h"><h3>它的消耗品</h3><span class="sub">猫粮、猫砂这类（含共用）</span></div>' + goodHtml + '</div>';
  $('hubBody').innerHTML = html;
}
function hubForm(key, id) {
  var cfg = HUB[key];
  var fields = (typeof cfg.fields === 'function') ? cfg.fields() : cfg.fields;
  var row = null;
  if (id) Store.get(cfg.dbId).forEach(function (r) { if (r._id === id) row = r; });
  var values = {};
  if (row) fields.forEach(function (f) { values[f.key] = row[f.key]; });
  var btns = [{ label: '取消', cls: 'gho', cb: closeSheet }, { label: '保存', cls: 'pri', cb: function () {
    if (!canWrite()) return;
    var fp = formProps(fields);
    if (!fp.ok) { toast('有必填项未填'); return; }
    var props = fp.props;
    if (!id) {
      var dft = (typeof cfg.defaults === 'function') ? cfg.defaults() : cfg.defaults;
      if (dft) for (var k in dft) props[k] = dft[k];
    }
    var p = id ? db.updateRecord({ databaseId: cfg.dbId, recordId: id, properties: props })
               : db.addRecord({ databaseId: cfg.dbId, properties: props });
    p.then(function () { return (cfg.afterSave && row) ? cfg.afterSave(row, props) : null; })
      .then(function () { return Store.load(cfg.dbId); }).then(function () {
      closeSheet(); toast('已保存'); renderHub(); renderToday(); renderMe();
    }).catch(function (e) { console.error(e); toast('保存失败'); });
  } }];
  if (id) btns.unshift({ label: '删除', cls: 'dan', cb: function () {
    if (!canWrite()) return;
    confirmBox('确认删除「' + (row['名称'] || '') + '」吗？此操作不可恢复。', function () {
      $('confirm').classList.remove('on');
      db.deleteRecord({ databaseId: cfg.dbId, recordId: id }).then(function () { return Store.load(cfg.dbId); })
        .then(function () { closeSheet(); toast('已删除'); renderHub(); renderToday(); });
    });
  } });
  openSheet((id ? '编辑 · ' : '') + cfg.title, formHTML(fields, values), btns);
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
      ' · ' + esc(whenTx(r)) + '</div>' +
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
  if (!canWrite()) return;
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
  if (!canWrite()) return;
  db.updateRecord({ databaseId: DB.TSK, recordId: id, properties: { '已读': { select: '已读' } } })
    .then(function () { return Store.load(DB.TSK); })
    .then(function () { renderAi(); renderToday(); })
    .catch(function (e) { console.error(e); });
}
/* 自由指令：把随口一句话原样投进信箱（任务类型=其他，原话放「参数」），
   由云端 AI 判断意图后落到对应的表，并在结果里回报做了什么。 */
function askPost(tx, btn, onOk) {
  if (!canWrite()) return;
  if (!tx) { toast('先说点什么'); return; }
  if (btn) btn.disabled = true;
  var props = {
    '任务类型': { select: '其他' },
    '参数': { text: tx },
    '状态': { select: '待执行' },
    '提交时间': { date: fmtDT(new Date()) },
    '提交人': { text: user() || '未设置' },
    '已读': { select: '未读' }
  };
  db.addRecord({ databaseId: DB.TSK, properties: props }).then(function () {
    if (onOk) onOk();
    toast('已交给云端 AI，下一轮巡检时处理');
    if (btn) btn.disabled = false;
    return Store.load(DB.TSK);
  }).then(function () { renderAi(); renderToday(); })
    .catch(function (e) {
      console.error('[ask] 提交失败:', e);
      toast('提交失败，请重试');
      if (btn) btn.disabled = false;
    });
}
function askSend() {
  var el = $('askInput');
  if (!el) return;
  var tx = (el.value || '').trim();
  if (!tx) { toast('先说点什么'); return; }
  askPost(tx, $('askSend'), function () { el.value = ''; });
}

/* ================= 今天 ================= */
function renderToday() {
  var unread = Store.get(DB.TSK).filter(function (r) { return r['状态'] === '已完成' && r['已读'] !== '已读'; }).length;
  var maintBad = Store.get(DB.MAINT).filter(function (r) { var k = mStatus(r).k; return k === 'red' || k === 'amber'; });
  var careBad = Store.get(DB.PETCARE).filter(function (c) { var k = careStatus(c).k; return k === 'red' || k === 'amber'; });
  var feeSoon = Store.get(DB.FEE).filter(function (r) { var l = daysLeft(parseDay(r['下次应缴日'])); return l !== null && l <= 30; });
  var fesSoon = Store.get(DB.FES).filter(function (r) { var l = daysLeft(parseDay(r['日期'])); return l !== null && l <= 30 && l >= 0; });
  var dlyAlert = Store.get(DB.DLY).filter(function (r) { return r['状态'] && r['状态'] !== '充足'; });
  var dlyUncounted = Store.get(DB.DLY).filter(function (r) { var q = numOf(r['囤货数量']); return q === null || q <= 0; }).length;

  var parts = [];
  if (maintBad.length) parts.push(maintBad.length + ' 项维护');
  if (careBad.length) parts.push(careBad.length + ' 项宠物护理');
  if (feeSoon.length) parts.push(feeSoon.length + ' 笔费用');
  if (fesSoon.length) parts.push(fesSoon.length + ' 个日子');
  if (dlyAlert.length) parts.push(dlyAlert.length + ' 样日用品');
  var banner = '';
  var nFail = Object.keys(Store.failed || {}).length;
  if (unread) {
    banner = '<div class="banner"><b>AI 带回了 ' + unread + ' 条新结果</b><div class="b-sub">云端任务已完成，去看看吧</div><button class="b-btn" data-go="ai" type="button">查看结果</button></div>';
  } else if (nFail) {
    banner = '<div class="banner"><b>有 ' + nFail + ' 张表这次没加载上</b><div class="b-sub">不是数据没了，是请求失败——点右边重试一次</div><button class="b-btn" data-resync type="button">重新同步</button></div>';
  } else if (parts.length) {
    banner = '<div class="banner"><b>今天要操心：' + parts.join(' · ') + '</b><div class="b-sub">都在下面，逐块处理就好</div></div>';
  } else {
    banner = '<div class="banner"><b>家里一切正常</b><div class="b-sub">没有逾期和临期事项，喝口水休息一下</div></div>';
  }
  $('tdBanner').innerHTML = banner;

  var urgent = [];
  maintBad.forEach(function (r) { urgent.push({ kind: 'm', st: mStatus(r), row: r }); });
  careBad.forEach(function (c) { urgent.push({ kind: 'c', st: careStatus(c), row: c }); });
  urgent.sort(function (a, b) { return (a.st.left === null ? 99999 : a.st.left) - (b.st.left === null ? 99999 : b.st.left); });
  $('tdMaint').innerHTML = urgent.length ? urgent.slice(0, 5).map(function (u) {
    if (u.kind === 'm') {
      var r = u.row;
      return '<div class="row"><div class="rmain" data-mid="' + esc(r._id) + '"><div class="rname">' + esc(r[MF.NAME]) +
        (r[MF.MODULE] === '宠物' ? ' <span class="tag">宠物</span>' : '') + '</div><div class="rmeta">' + esc(r[MF.DEV] || '') + ' · ' + esc(r[MF.ROOM] || '') + '</div></div>' + mPill(u.st) +
        '<button class="mini" data-snz="' + esc(r._id) + '" type="button">延后</button>' +
        '<button class="mini pri" data-done="' + esc(r._id) + '" type="button">已更换</button></div>';
    }
    var c = u.row;
    return '<div class="row"><div class="rmain" data-carejump="1"><div class="rname">' + esc(c['项目']) + ' <span class="tag">宠物</span></div>' +
      '<div class="rmeta">' + esc(c['宠物'] || '') + ' · 上次 ' + (c['上次日期'] ? String(c['上次日期']).slice(0, 10) : '—') +
      ' · 周期 ' + (numOf(c['周期天数']) || '—') + ' 天</div></div>' + carePill(u.st) +
      '<button class="mini pri" data-caredone="' + esc(c._id) + '" type="button">做了</button></div>';
  }).join('') : '<div class="blank">没有急需或临期的维护项。</div>';

  $('tdFee').innerHTML = feeSoon.length ? feeSoon.sort(function (a, b) { return parseDay(a['下次应缴日']) - parseDay(b['下次应缴日']); }).slice(0, 4).map(HUB.FEE.row).join('') : '<div class="blank">未来 30 天没有待缴费用。</div>';
  $('tdFes').innerHTML = fesSoon.length ? fesSoon.sort(function (a, b) { return parseDay(a['日期']) - parseDay(b['日期']); }).slice(0, 4).map(HUB.FES.row).join('') : '<div class="blank">未来 30 天没有临近的节日或生日。</div>';
  $('tdDly').innerHTML = dlyAlert.length ? dlyAlert.slice(0, 4).map(HUB.DLY.row).join('')
    : (dlyUncounted ? '<div class="blank">有 ' + dlyUncounted + ' 样日用品还没盘点囤货数量。点「全部 ›」补上真实数量，或点「快用完了」报备，管家红点就会消失。</div>'
      : '<div class="blank">日用品都充足。</div>');
  var expItems = itemExpiring();
  if (expItems.length) {
    $('tdDly').innerHTML += '<div class="row"><div class="rmain" data-go="hub" data-seg="ITEM" style="cursor:pointer">' +
      '<div class="rname">物品即将到期</div><div class="rmeta">护肤品/药品等 ' + expItems.length + ' 件 30 天内到期，点开看物品归档</div></div>' +
      '<span class="pill b-amber">' + expItems.length + '</span></div>';
  }

  var hubHot = feeSoon.length + dlyAlert.length;
  $('dotHub').className = 'tdot' + (hubHot ? ' on' : '');
}

/* ================= 我的 ================= */
function renderMe() {
  var me = memberOf(user());
  $('meName').textContent = isGuest() ? '游客' : (user() || '未设置');
  if ($('meMeta')) {
    $('meMeta').textContent = isGuest()
      ? '游客模式：只能查看，不能修改（点右侧切换可换成成员）'
      : (me
        ? ((me['角色'] ? me['角色'] : '成员') + (me['生日'] ? ' · 生日 ' + String(me['生日']).slice(0, 10) : '') + (me['手机'] ? ' · ' + me['手机'] : ''))
        : '还没在「家庭成员」表里建立档案，点右侧切换可新建');
  }
  var prefs = Store.get(DB.PREF).slice().sort(HUB.PREF.sort);
  if ($('memBody')) {
    var mrows = Store.get(DB.MEMBER).slice().sort(HUB.MEMBER.sort);
    var mh = mrows.length ? mrows.map(HUB.MEMBER.row).join('') : '<div class="blank">' + HUB.MEMBER.blank + '</div>';
    mh += '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="mini pri" data-memadd type="button">＋ 添加成员</button>' +
      (adminTrusted() ? '<button class="mini" data-lockadmin type="button">锁定管理员</button>'
        : '<button class="mini" data-unlockadmin type="button">解锁管理员</button>') +
      (hasAdminPw() ? '<button class="mini" data-resetpw type="button">重设管理员密码</button>' : '') +
      '</div>' +
      '<div class="hint" style="margin-top:8px">管理员账户在选择时需要密码（或点标题 5 下解锁）。密码只存在本机浏览器——这是防误选、防手滑的门槛，不是加密；真正的防线是资料库分享权限：给家人「查看」就改不了数据。' +
      (adminTrusted() ? '　<b>当前：本机已解锁</b>' : '') + '</div>';
    $('memBody').innerHTML = mh;
  }
  if ($('snapSub')) {
    var snaps = Store.get(DB.SNAP);
    var times = {};
    snaps.forEach(function (r) { var t = snapTime(r); if (t) times[t] = 1; });
    var tl = Object.keys(times).sort().reverse();
    $('snapSub').textContent = tl.length
      ? ('已存 ' + tl.length + ' 次快照，最近一次：' + tl[0] + '（只保留最近 ' + SNAP_KEEP + ' 次）')
      : '还没有快照。点右侧立即存一份；云端 AI 每周也会自动存。';
  }
  var pb = $('prefBody');
  if (pb) {
    pb.innerHTML = (prefs.length ? prefs.map(HUB.PREF.row).join('') : '<div class="blank">' + HUB.PREF.blank + '</div>') +
      '<div style="margin-top:10px"><button class="mini pri" data-prefadd type="button">＋ ' + HUB.PREF.addLabel + '</button></div>';
  }
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
      return '<div class="row"><div class="rmain"><div class="rname">' + esc(r['名称']) + '</div><div class="rmeta">' +
        (r['规格'] ? esc(r['规格']) + ' · ' : '') + esc(r['状态'] || '') +
        (r['单位'] ? ' · 买 ' + esc(r['单位']) : '') +
        (numOf(r['经验消耗天数']) ? ' · 每 ' + numOf(r['经验消耗天数']) + ' 天消耗 1 ' + esc(r['单位'] || '') : '') + '</div></div></div>';
    }).join('');
  }
  if (!lines) lines = '<div class="blank">没有要买的东西。</div>';
  else lines += '<div style="margin-top:10px"><button class="mini pri" data-copyshop type="button">复制清单去购物</button></div>';
  $('shopBody').innerHTML = lines;

  var year = todayStart().getFullYear();
  var logs = Store.get(DB.LOG).filter(function (l) { return String(l['时间'] || '').indexOf(String(year)) === 0; });
  var sum = 0, cnt = 0;
  logs.forEach(function (l) { var a = numOf(l['金额']); if (a !== null) { sum += a; cnt++; } });
  var led = Store.get(DB.LEDGER).filter(function (l) { return String(l['日期'] || '').indexOf(String(year)) === 0; });
  var ledSum = 0;
  led.forEach(function (l) { var a = numOf(l['金额']); if (a !== null) ledSum += a; });
  $('costSub').textContent = year + ' 年';
  $('costBody').innerHTML =
    '<div class="row"><div class="rmain"><div class="rname" style="font-size:20px">¥' + ledSum.toFixed(2) + '</div><div class="rmeta">家庭开销合计（账本 ' + led.length + ' 笔）</div></div>' +
    '<button class="mini" data-go="hub" data-seg="LEDGER" type="button">看账本</button></div>' +
    '<div class="row"><div class="rmain"><div class="rname" style="font-size:16px">¥' + sum.toFixed(2) + '</div><div class="rmeta">维护相关花费（日志 ' + cnt + ' 笔）</div></div></div>';

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
    dly.forEach(function (r) { tx += '· ' + (r['名称'] || '') + (r['规格'] ? '（' + r['规格'] + '）' : '') + (r['单位'] ? ' ×1 ' + r['单位'] : '') + '\n'; });
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
  for (var k in DB) out.tables[names[k] || k] = Store.get(DB[k]);
  var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '家庭维护台-备份-' + fmtD(todayStart()) + '.json';
  document.body.appendChild(a); a.click();
  setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
}
/* ================= 云端快照（防误删/防结构被改） ================= */
var SNAP_KEEP = 8;
var SNAP_NAMES = {
  MAINT: '家庭维护清单', LOG: '维护日志', FEE: '固定费用台账', FES: '节日与生日',
  DLY: '日用品库存', TSK: '任务请求表', LEDGER: '家庭账本', MEMBER: '家庭成员',
  PREF: '偏好设置', PREP: '节日准备', REG: 'AI任务注册表',
  LOC: '存放位置', PET: '宠物档案', PETCARE: '宠物护理', ITEM: '物品归档',
  DEV: '设备档案'
};
function snapTime(r) { return String(r['快照时间'] || '').slice(0, 16).replace('T', ' '); }
function snapNow(btn) {
  if (!canWrite()) return;
  if (btn) btn.disabled = true;
  var ts = fmtDT(new Date());
  var keys = Object.keys(SNAP_NAMES);
  var failed = [];
  function step(i) {
    if (i >= keys.length) return Promise.resolve();
    var k = keys[i];
    var rows = Store.get(DB[k]);
    var props = {
      '快照时间': { date: ts },
      '表名': { text: SNAP_NAMES[k] },
      '记录数': { number: rows.length },
      '内容': { text: JSON.stringify(rows) }
    };
    return db.addRecord({ databaseId: DB.SNAP, properties: props })
      .catch(function (e) { console.error('[snap] ' + SNAP_NAMES[k] + ' 快照失败:', e); failed.push(SNAP_NAMES[k]); })
      .then(function () { return step(i + 1); });
  }
  step(0)
    .then(function () { return Store.load(DB.SNAP); })
    .then(function () { return pruneSnaps(); })
    .then(function () {
      if (btn) btn.disabled = false;
      toast(failed.length ? ('快照完成，' + failed.length + ' 张表失败（可能数据过长）') : '快照已存进云端');
      renderMe();
    });
}
function pruneSnaps() {
  var rows = Store.get(DB.SNAP).slice();
  var times = {};
  rows.forEach(function (r) { var t = snapTime(r); if (t) times[t] = 1; });
  var list = Object.keys(times).sort().reverse();
  if (list.length <= SNAP_KEEP) return Promise.resolve();
  var keep = {};
  list.slice(0, SNAP_KEEP).forEach(function (t) { keep[t] = 1; });
  var del = [];
  rows.forEach(function (r) { var t = snapTime(r); if (t && !keep[t]) del.push(r._id); });
  if (!del.length) return Promise.resolve();
  function step2(i) {
    if (i >= del.length) return Promise.resolve();
    return db.deleteRecord({ databaseId: DB.SNAP, recordId: del[i] })
      .catch(function (e) { console.error('[snap] 清理旧快照失败:', e); })
      .then(function () { return step2(i + 1); });
  }
  return step2(0).then(function () { return Store.load(DB.SNAP); });
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
    var rsy = closest(e.target, '[data-resync]', this);
    if (rsy) { resync(); return; }
    var cd2 = closest(e.target, '[data-caredone]', this);
    if (cd2) {
      if (!canWrite()) return;
      db.updateRecord({ databaseId: DB.PETCARE, recordId: cd2.getAttribute('data-caredone'), properties: { '上次日期': { date: fmtD(todayStart()) } } })
        .then(function () { return Store.load(DB.PETCARE); })
        .then(function () { renderToday(); renderHub(); toast('已更新为今天'); })
        .catch(function (err) { console.error(err); toast('操作失败'); });
      return;
    }
    if (closest(e.target, '[data-carejump]', this)) { switchTab('hub', 'PET'); return; }
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
    var ps = closest(e.target, '[data-petsel]', this);
    if (ps) { setPet(ps.getAttribute('data-petsel')); renderHub(); return; }
    var pa2 = closest(e.target, '[data-petadd]', this);
    if (pa2) { hubForm('PET', null); return; }
    var pe3 = closest(e.target, '[data-petedit]', this);
    if (pe3) { hubForm('PET', pe3.getAttribute('data-petedit')); return; }
    var ca = closest(e.target, '[data-careadd]', this);
    if (ca) { hubForm('PETCARE', null); return; }
    var ce = closest(e.target, '[data-careedit]', this);
    if (ce) { hubForm('PETCARE', ce.getAttribute('data-careedit')); return; }
    var cd = closest(e.target, '[data-caredone]', this);
    if (cd) {
      e.stopPropagation();
      if (!canWrite()) return;
      db.updateRecord({ databaseId: DB.PETCARE, recordId: cd.getAttribute('data-caredone'), properties: { '上次日期': { date: fmtD(todayStart()) } } })
        .then(function () { return Store.load(DB.PETCARE); })
        .then(function () { renderHub(); renderToday(); toast('已更新为今天'); })
        .catch(function (err) { console.error(err); toast('操作失败'); });
      return;
    }
    var de = closest(e.target, '[data-dlyedit]', this);
    if (de) { hubForm('DLY', de.getAttribute('data-dlyedit')); return; }
    var lm = closest(e.target, '[data-locmgr]', this);
    if (lm) { openLocSheet(); return; }
    var rs = closest(e.target, '[data-resync]', this);
    if (rs) { resync(); return; }
    var gr = closest(e.target, '[data-goreload]', this);
    if (gr) { location.reload(); return; }
    var itf = closest(e.target, '[data-itemf]', this);
    if (itf) {
      var v = itf.getAttribute('data-itemf');
      if (v === '__none') itemFilter = [];
      else if (v === '__all') itemFilter = ['药品', '化妆品', '护肤品', '保健品', '食品', '日用', '工具', '其他'];
      else {
        var idx = itemFilter.indexOf(v);
        if (idx >= 0) itemFilter.splice(idx, 1); else itemFilter.push(v);
      }
      renderHub();
      return;
    }
    var mvi = closest(e.target, '[data-moveitems]', this);
    if (mvi) { openMoveSheet(); return; }
    var dmg = closest(e.target, '[data-devmgr]', this);
    if (dmg) { openDevSheet(); return; }
    var mid2 = closest(e.target, '[data-mid]', this);
    if (mid2) { openMaintDetail(mid2.getAttribute('data-mid')); return; }
    var pa = closest(e.target, '[data-prepadd]', this);
    if (pa) { hubForm('PREP', null); return; }
    var pe2 = closest(e.target, '[data-prepedit]', this);
    if (pe2) { hubForm('PREP', pe2.getAttribute('data-prepedit')); return; }
    var pd = closest(e.target, '[data-prepdone]', this);
    if (pd) {
      e.stopPropagation();
      if (!canWrite()) return;
      db.updateRecord({ databaseId: DB.PREP, recordId: pd.getAttribute('data-prepdone'), properties: { '状态': { select: '已完成' } } })
        .then(function () { return Store.load(DB.PREP); })
        .then(function () { renderHub(); renderToday(); toast('已标记完成'); })
        .catch(function (err) { console.error(err); toast('操作失败'); });
      return;
    }
    var fh = closest(e.target, '[data-feeh]', this);
    if (fh) { feeHorizon = fh.getAttribute('data-feeh'); renderHub(); return; }
    var add = closest(e.target, '[data-hubadd]', this);
    if (add) { hubForm(hubKey, null); return; }
    var qk = closest(e.target, '[data-quick]', this);
    if (qk) { e.stopPropagation(); HUB[hubKey].quick(qk.getAttribute('data-quick'), qk.getAttribute('data-qk')); return; }
    var ed = closest(e.target, '[data-edit]', this);
    if (ed) hubForm(hubKey, ed.getAttribute('data-edit'));
  });

  /* AI */
  document.querySelector('.aibtns').addEventListener('click', function (e) {
    var a = closest(e.target, '[data-ask]', this);
    if (a) { askPost(a.getAttribute('data-ask'), a); return; }
    var b = closest(e.target, '[data-task]', this);
    if (b) taskPost(b.getAttribute('data-task'), b);
  });
  if ($('askSend')) $('askSend').addEventListener('click', askSend);
  if ($('askInput')) $('askInput').addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.keyCode === 13) askSend();
  });
  $('aiOut').addEventListener('click', function (e) {
    var b = closest(e.target, '[data-read]', this);
    if (b) taskRead(b.getAttribute('data-read'));
  });

  /* 我的 */
  $('meEdit').addEventListener('click', function () {
    openMemberSheet(false);
  });
  $('shopBody').addEventListener('click', function (e) {
    if (closest(e.target, '[data-copyshop]', this)) copyShop();
  });
  if ($('prefBody')) $('prefBody').addEventListener('click', function (e) {
    var add = closest(e.target, '[data-prefadd]', this);
    if (add) { hubForm('PREF', null); return; }
    var ed = closest(e.target, '[data-edit]', this);
    if (ed) hubForm('PREF', ed.getAttribute('data-edit'));
  });
  $('shBody').addEventListener('click', function (e) {
    var le = closest(e.target, '[data-locedit]', this);
    if (le) { hubForm('LOC', le.getAttribute('data-locedit')); return; }
    var de2 = closest(e.target, '[data-devedit]', this);
    if (de2) { hubForm('DEV', de2.getAttribute('data-devedit')); return; }
    var ma = closest(e.target, '[data-mvall]', this);
    if (ma) { Array.prototype.forEach.call(document.querySelectorAll('.mvck'), function (c) { c.checked = true; }); return; }
    var mn = closest(e.target, '[data-mvnone]', this);
    if (mn) { Array.prototype.forEach.call(document.querySelectorAll('.mvck'), function (c) { c.checked = false; }); return; }
  });
  /* 我的 → 成员与权限 */
  if ($('memBody')) $('memBody').addEventListener('click', function (e) {
    var ma = closest(e.target, '[data-memadd]', this);
    if (ma) { hubForm('MEMBER', null); return; }
    var me2 = closest(e.target, '[data-memedit]', this);
    if (me2) { hubForm('MEMBER', me2.getAttribute('data-memedit')); return; }
    if (closest(e.target, '[data-lockadmin]', this)) { trustAdmin(false); renderMe(); toast('管理员已锁定，下次选择需重新解锁'); return; }
    if (closest(e.target, '[data-unlockadmin]', this)) { unlockAdmin(function () { renderMe(); }); return; }
    if (closest(e.target, '[data-resetpw]', this)) { resetAdminPw(); return; }
  });
  /* 隐藏解锁：标题连点 5 下 */
  var tapN = 0, tapT = 0;
  if ($('brandTitle')) $('brandTitle').addEventListener('click', function () {
    var now = Date.now();
    if (now - tapT > 900) tapN = 0;
    tapT = now; tapN++;
    if (tapN >= 5) { tapN = 0; unlockAdmin(function () { renderMe(); }); }
  });
  $('expBtn').addEventListener('click', exportJSON);
  /* 右上角状态条：点一下重新同步（加载失败时的救命入口） */
  if ($('syncBox')) $('syncBox').addEventListener('click', function () { resync(); });
  if ($('resyncBtn')) $('resyncBtn').addEventListener('click', function () { resync(); });
  if ($('devMgrBtn')) $('devMgrBtn').addEventListener('click', function () { openDevSheet(); });
  if ($('snapBtn')) $('snapBtn').addEventListener('click', function () {
    var self = this;
    confirmBox('把当前所有数据存一份云端快照？会向「数据快照」表写入 11 条记录。', function () {
      $('confirm').classList.remove('on');
      snapNow(self);
    });
  });
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
  }).then(function (fails) {
    var nf = (fails || []).length;
    if (nf) renderSync('off', nf + ' 张表未加载 · 点重试');
    else renderSync('ok', '已同步');
    renderToday(); refreshMaint(); renderHub(); renderAi(); renderMe();
    /* 首次进入必须选成员；已选但成员表里查不到（被改名/删除）也要求重选 */
    var nm = user();
    if (!nm || !memberOf(nm)) openMemberSheet(true);
    else if (isAdminMember(nm) && !adminTrusted()) {
      toast('管理员账户需要解锁');
      openMemberSheet(true);
    }
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
