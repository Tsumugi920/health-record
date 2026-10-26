'use strict';

/**
 * 用药提醒模块：按每日 1~3 次设置提醒时间，支持启用/停用/删除
 * 依赖：HR.api、HR.state、HR.toast、HR.escapeHtml、HR.today（由 app.js 提供）
 */

window.HR = window.HR || {};

HR.meds = (() => {
  let cache = [];

  const DEFAULT_TIMES = {
    每日1次: ['08:00'],
    每日2次: ['08:00', '20:00'],
    每日3次: ['08:00', '12:00', '18:00'],
  };

  function formEl() {
    return document.getElementById('medForm');
  }

  /** 根据服用频次渲染对应数量的提醒时间输入框 */
  function renderTimes(count) {
    const box = document.getElementById('medTimes');
    const frequency = document.getElementById('medFrequency').value;
    const defaults = DEFAULT_TIMES[frequency] || [];
    box.innerHTML = Array.from({ length: count }, (_, i) => `
      <label class="time-input">第 ${i + 1} 次提醒
        <input type="time" name="time${i}" value="${defaults[i] || '08:00'}" required />
      </label>`).join('');
  }

  async function refresh() {
    cache = await HR.api.listMeds({ memberId: HR.state.memberId });
    render();
  }

  function render() {
    const box = document.getElementById('medList');
    if (!cache.length) {
      box.innerHTML = '<p class="empty">暂无用药提醒，在左侧为家人添加一条吧。</p>';
      return;
    }
    box.innerHTML = cache.map((med) => `
      <article class="med-card ${med.active ? '' : 'med-inactive'}" data-id="${med.id}">
        <header>
          <div>
            <h3>💊 ${HR.escapeHtml(med.drugName)}</h3>
            <p class="muted small">${HR.escapeHtml(med.dosage || '剂量未填')}${med.dosage ? ' · ' : ''}${HR.escapeHtml(med.frequency)}</p>
          </div>
          <span class="badge ${med.active ? 'badge-on' : 'badge-off'}">${med.active ? '服用中' : '已停用'}</span>
        </header>
        <div class="med-times">
          ${med.times.map((t) => `<span class="time-chip">⏰ ${HR.escapeHtml(t)}</span>`).join('')}
        </div>
        <p class="muted small">周期：${HR.escapeHtml(med.startDate || '—')} ~ ${med.endDate ? HR.escapeHtml(med.endDate) : '长期'}${med.note ? ' · ' + HR.escapeHtml(med.note) : ''}</p>
        <div class="med-actions">
          <button class="btn ghost small-btn" data-action="toggle-med" data-id="${med.id}">${med.active ? '停用' : '启用'}</button>
          <button class="btn ghost danger small-btn" data-action="del-med" data-id="${med.id}">删除</button>
        </div>
      </article>`).join('');
  }

  function collectTimes() {
    return Array.from(formEl().querySelectorAll('#medTimes input[type="time"]'))
      .map((input) => input.value)
      .filter(Boolean)
      .sort();
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    const f = formEl();
    const data = {
      memberId: Number(f.memberId.value),
      drugName: f.drugName.value.trim(),
      dosage: f.dosage.value.trim(),
      frequency: f.frequency.value,
      times: collectTimes(),
      startDate: f.startDate.value,
      endDate: f.endDate.value,
      note: f.note.value.trim(),
      active: true,
    };
    if (!data.drugName) return HR.toast('请填写药品名称', 'warn');
    if (!data.times.length) return HR.toast('请设置提醒时间', 'warn');
    try {
      await HR.api.createMed(data);
      f.drugName.value = '';
      f.dosage.value = '';
      f.note.value = '';
      await refresh();
      HR.toast('用药提醒已添加', 'success');
    } catch (err) {
      HR.toast(err.message, 'error');
    }
  }

  async function onToggle(id) {
    const med = cache.find((m) => m.id === id);
    if (!med) return;
    try {
      await HR.api.updateMed(id, { ...med, active: !med.active });
      await refresh();
      HR.toast(med.active ? '提醒已停用' : '提醒已启用', 'success');
    } catch (err) {
      HR.toast(err.message, 'error');
    }
  }

  async function onDelete(id) {
    if (!window.confirm('确定删除这条用药提醒吗？')) return;
    try {
      await HR.api.deleteMed(id);
      await refresh();
      HR.toast('提醒已删除', 'success');
    } catch (err) {
      HR.toast(err.message, 'error');
    }
  }

  function bind() {
    formEl().addEventListener('submit', onSubmit);
    document.getElementById('medFrequency').addEventListener('change', (ev) => {
      const count = Number(String(ev.target.value).replace(/[^0-9]/g, '')) || 1;
      renderTimes(count);
    });
    document.getElementById('medList').addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-action]');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'toggle-med') onToggle(id);
      if (btn.dataset.action === 'del-med') onDelete(id);
    });
    renderTimes(2); // 默认「每日2次」
  }

  return {
    refresh,
    bind,
    syncMember() {
      formEl().memberId.value = HR.state.memberId;
    },
  };
})();
