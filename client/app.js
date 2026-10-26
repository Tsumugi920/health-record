'use strict';

/**
 * 应用入口：
 * - 全局状态与公共工具（HR.state / HR.toast / HR.escapeHtml / HR.today）
 * - 页签切换、家庭成员切换
 * - 健康指标（录入表单 + 最近记录表格 + 趋势图）
 * - 就诊记录（其余两个页签分别在 js/records.js 与 js/meds.js）
 */

window.HR = window.HR || {};

HR.state = { members: [], memberId: null, metrics: [] };

HR.escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

HR.today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

HR.toast = (message, type = 'info') => {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(HR.toast._timer);
  HR.toast._timer = setTimeout(() => { el.className = 'toast'; }, 2400);
};

HR.fmtNum = (v) => String(Number(Number(v).toFixed(1)));

const $ = (sel) => document.querySelector(sel);

const METRIC_VALUE_LABELS = {
  血压: '收缩压',
  血糖: '血糖值',
  体重: '体重',
  心率: '心率',
  体温: '体温',
};

function ageOf(birthDate) {
  if (!birthDate) return '—';
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const monthDiff = now.getMonth() - b.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

/* ---------- 家庭成员 ---------- */

async function loadMembers() {
  const members = await HR.api.listMembers();
  HR.state.members = members;
  const options = members
    .map((m) => `<option value="${m.id}">${HR.escapeHtml(m.name)}（${HR.escapeHtml(m.relation)}）</option>`)
    .join('');
  $('#memberSelect').innerHTML = options;
  ['#metricMember', '#recordMember', '#medMember', '#visitMember'].forEach((sel) => {
    $(sel).innerHTML = options;
  });
  HR.state.memberId = members.length ? members[0].id : null;
  $('#memberSelect').value = HR.state.memberId;
  renderMemberMeta();
  syncMemberSelects();
}

function renderMemberMeta() {
  const m = HR.state.members.find((x) => x.id === HR.state.memberId);
  const box = $('#memberMeta');
  if (!m) { box.innerHTML = '<span>暂无成员</span>'; return; }
  const tags = (m.tags || []).map((t) => `<span class="tag">${HR.escapeHtml(t)}</span>`).join('');
  box.innerHTML = `<span>${HR.escapeHtml(m.relation)} · ${HR.escapeHtml(m.gender)} · ${ageOf(m.birthDate)}岁</span>${tags}`;
}

function syncMemberSelects() {
  ['#metricMember', '#recordMember', '#medMember', '#visitMember'].forEach((sel) => {
    const el = $(sel);
    if (el) el.value = HR.state.memberId;
  });
}

async function onMemberChange() {
  HR.state.memberId = Number($('#memberSelect').value);
  renderMemberMeta();
  syncMemberSelects();
  await refreshAll();
}

/* ---------- 健康指标 ---------- */

async function loadMetrics() {
  if (!HR.state.memberId) return;
  HR.state.metrics = await HR.api.listMetrics({ memberId: HR.state.memberId });
  renderMetricTable();
  renderChart();
}

function renderChart() {
  const type = $('#chartType').value;
  const entries = HR.state.metrics.filter((m) => m.type === type);
  HR.charts.render($('#trendChart'), entries, type);
  renderStats(entries, type);
}

function renderStats(entries, type) {
  const box = $('#metricStats');
  const m = HR.charts.meta(type);
  const st = HR.charts.stats(entries);
  if (!st) {
    box.innerHTML = '<span class="chip">暂无数据</span>';
    return;
  }
  const latest = st.latest;
  const latestText = m.dual
    ? `${HR.fmtNum(latest.value)}/${HR.fmtNum(latest.value2)} ${m.unit}`
    : `${HR.fmtNum(latest.value)} ${m.unit}`;
  const fmtV = (v) => (m.dual ? HR.fmtNum(v) : `${HR.fmtNum(v)} ${m.unit}`);
  box.innerHTML = [
    `<span class="chip chip-primary">最新 ${latestText}</span>`,
    `<span class="chip">${m.dual ? '收缩平均 ' : '平均 '}${fmtV(st.avg)}</span>`,
    `<span class="chip">最高 ${fmtV(st.max)}</span>`,
    `<span class="chip">最低 ${fmtV(st.min)}</span>`,
    `<span class="chip">共 ${st.count} 次</span>`,
  ].join('');
}

function renderMetricTable() {
  const tbody = $('#metricTable tbody');
  const list = HR.state.metrics.slice(0, 10); // 后端已按日期倒序
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">暂无记录，先在上方录入一条吧。</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((m) => {
    const valueText = m.type === '血压'
      ? `${HR.fmtNum(m.value)}/${HR.fmtNum(m.value2)} ${m.unit || ''}`
      : `${HR.fmtNum(m.value)} ${m.unit || ''}`;
    return `
      <tr>
        <td>${HR.escapeHtml(m.recordedAt)}</td>
        <td><span class="metric-type">${HR.escapeHtml(m.type)}</span></td>
        <td><strong>${HR.escapeHtml(valueText)}</strong></td>
        <td class="muted">${HR.escapeHtml(m.note || '—')}</td>
        <td><button class="btn ghost danger small-btn" data-del-metric="${m.id}">删除</button></td>
      </tr>`;
  }).join('');
}

function onMetricTypeChange() {
  const f = $('#metricForm');
  const type = f.type.value;
  const isBp = type === '血压';
  $('#valueLabelText').textContent = METRIC_VALUE_LABELS[type] || '数值';
  $('#value2Wrap').classList.toggle('hidden', !isBp);
  f.value2.required = isBp;
  f.value.placeholder = isBp ? '收缩压，如 135' : METRIC_VALUE_LABELS[type] || '';
}

async function onMetricSubmit(ev) {
  ev.preventDefault();
  const f = $('#metricForm');
  const type = f.type.value;
  const data = {
    memberId: Number(f.memberId.value),
    type,
    value: f.value.value,
    value2: type === '血压' ? f.value2.value : null,
    recordedAt: f.recordedAt.value,
    note: f.note.value.trim(),
  };
  try {
    await HR.api.createMetric(data);
    f.note.value = '';
    await loadMetrics();
    HR.toast('指标已保存', 'success');
  } catch (err) {
    HR.toast(err.message, 'error');
  }
}

/* ---------- 就诊记录 ---------- */

let visitsCache = [];

async function loadVisits() {
  visitsCache = await HR.api.listVisits({ memberId: HR.state.memberId });
  renderVisits();
}

function renderVisits() {
  const box = $('#visitList');
  if (!visitsCache.length) {
    box.innerHTML = '<p class="empty">暂无就诊记录，在左侧添加一条吧。</p>';
    return;
  }
  box.innerHTML = visitsCache.map((v) => `
    <article class="visit-card" data-id="${v.id}">
      <header>
        <div>
          <h3>🏥 ${HR.escapeHtml(v.hospital)}${v.department ? ' · ' + HR.escapeHtml(v.department) : ''}</h3>
          <p class="muted small">${HR.escapeHtml(v.date)}${v.doctor ? ' · ' + HR.escapeHtml(v.doctor) : ''}${v.cost ? ' · 花费 ¥' + HR.fmtNum(v.cost) : ''}</p>
        </div>
        <button class="btn ghost danger small-btn" data-del-visit="${v.id}">删除</button>
      </header>
      <p><span class="label">诊断：</span>${HR.escapeHtml(v.diagnosis)}</p>
      ${v.treatment ? `<p class="muted small"><span class="label">处置：</span>${HR.escapeHtml(v.treatment)}</p>` : ''}
      ${v.note ? `<p class="muted small">${HR.escapeHtml(v.note)}</p>` : ''}
    </article>`).join('');
}

async function onVisitSubmit(ev) {
  ev.preventDefault();
  const f = $('#visitForm');
  const data = {
    memberId: Number(f.memberId.value),
    date: f.date.value,
    hospital: f.hospital.value.trim(),
    department: f.department.value.trim(),
    doctor: f.doctor.value.trim(),
    diagnosis: f.diagnosis.value.trim(),
    treatment: f.treatment.value.trim(),
    cost: f.cost.value,
    note: f.note.value.trim(),
  };
  try {
    await HR.api.createVisit(data);
    f.hospital.value = '';
    f.department.value = '';
    f.doctor.value = '';
    f.diagnosis.value = '';
    f.treatment.value = '';
    f.note.value = '';
    f.cost.value = '';
    await loadVisits();
    HR.toast('就诊记录已保存', 'success');
  } catch (err) {
    HR.toast(err.message, 'error');
  }
}

/* ---------- 页签与整体刷新 ---------- */

function bindTabs() {
  $('#tabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.tab');
    if (!btn) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === btn));
    document.querySelectorAll('.panel').forEach((p) => {
      p.classList.toggle('active', p.id === `panel-${btn.dataset.tab}`);
    });
    if (btn.dataset.tab === 'records') HR.records.refresh();
    if (btn.dataset.tab === 'meds') HR.meds.refresh();
    if (btn.dataset.tab === 'visits') loadVisits();
  });
}

async function refreshAll() {
  await Promise.all([loadMetrics(), HR.records.refresh(), HR.meds.refresh(), loadVisits()]);
}

function bindMetricDelete() {
  $('#metricTable').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-del-metric]');
    if (!btn) return;
    if (!window.confirm('确定删除这条指标记录吗？')) return;
    try {
      await HR.api.deleteMetric(Number(btn.dataset.delMetric));
      await loadMetrics();
      HR.toast('记录已删除', 'success');
    } catch (err) {
      HR.toast(err.message, 'error');
    }
  });
}

function bindVisitDelete() {
  $('#visitList').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-del-visit]');
    if (!btn) return;
    if (!window.confirm('确定删除这条就诊记录吗？')) return;
    try {
      await HR.api.deleteVisit(Number(btn.dataset.delVisit));
      await loadVisits();
      HR.toast('记录已删除', 'success');
    } catch (err) {
      HR.toast(err.message, 'error');
    }
  });
}

async function init() {
  try {
    $('#today').textContent = HR.today();
    await loadMembers();

    $('#metricForm').recordedAt.value = HR.today();
    $('#recordForm').checkDate.value = HR.today();
    $('#medForm').startDate.value = HR.today();
    $('#visitForm').date.value = HR.today();

    $('#memberSelect').addEventListener('change', onMemberChange);
    $('#metricForm').addEventListener('submit', onMetricSubmit);
    $('#metricType').addEventListener('change', onMetricTypeChange);
    $('#chartType').addEventListener('change', renderChart);
    $('#visitForm').addEventListener('submit', onVisitSubmit);
    bindMetricDelete();
    bindVisitDelete();
    bindTabs();
    HR.records.bind();
    HR.meds.bind();
    onMetricTypeChange();

    await refreshAll();
  } catch (err) {
    HR.toast(err.message || '初始化失败', 'error');
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', init);
