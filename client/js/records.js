'use strict';

/**
 * 体检报告模块：列表展示 + 录入 + 删除
 * 依赖：HR.api、HR.state、HR.toast、HR.escapeHtml、HR.today（由 app.js 提供）
 */

window.HR = window.HR || {};

HR.records = (() => {
  let cache = [];

  function formEl() {
    return document.getElementById('recordForm');
  }

  function memberName(id) {
    const m = (HR.state.members || []).find((x) => x.id === Number(id));
    return m ? m.name : `成员${id}`;
  }

  /** 把「项目|结果|单位|提示」格式的多行文本解析成明细数组 */
  function parseItems(text) {
    return String(text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, value, unit, flag] = line.split('|').map((s) => s.trim());
        return { name: name || '', value: value || '', unit: unit || '', flag: flag || '正常' };
      })
      .filter((item) => item.name);
  }

  function flagClass(flag) {
    if (/偏高|异常|阳性|风险/.test(flag)) return 'flag-high';
    if (/偏低/.test(flag)) return 'flag-low';
    return 'flag-ok';
  }

  async function refresh() {
    cache = await HR.api.listRecords({ memberId: HR.state.memberId });
    render();
  }

  function render() {
    const box = document.getElementById('recordList');
    if (!cache.length) {
      box.innerHTML = '<p class="empty">暂无体检报告，在左侧添加一份吧。</p>';
      return;
    }
    box.innerHTML = cache.map((r) => `
      <article class="record-card" data-id="${r.id}">
        <header>
          <div>
            <h3>📋 ${HR.escapeHtml(r.title)}</h3>
            <p class="muted small">${HR.escapeHtml(memberName(r.memberId))} · ${HR.escapeHtml(r.org || '未填写机构')} · ${HR.escapeHtml(r.checkDate)}</p>
          </div>
          <button class="btn ghost danger small-btn" data-action="del-record" data-id="${r.id}">删除</button>
        </header>
        ${r.summary ? `<p class="record-summary">${HR.escapeHtml(r.summary)}</p>` : ''}
        ${r.items && r.items.length ? `
          <details>
            <summary>查看检查明细（${r.items.length} 项）</summary>
            <table class="items-table">
              <thead><tr><th>项目</th><th>结果</th><th>单位</th><th>提示</th></tr></thead>
              <tbody>
                ${r.items.map((it) => `
                  <tr>
                    <td>${HR.escapeHtml(it.name)}</td>
                    <td>${HR.escapeHtml(it.value || '—')}</td>
                    <td>${HR.escapeHtml(it.unit || '')}</td>
                    <td><span class="flag ${flagClass(it.flag || '')}">${HR.escapeHtml(it.flag || '正常')}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </details>` : ''}
      </article>`).join('');
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    const f = formEl();
    const data = {
      memberId: Number(f.memberId.value),
      title: f.title.value.trim(),
      org: f.org.value.trim(),
      checkDate: f.checkDate.value,
      summary: f.summary.value.trim(),
      items: parseItems(f.items.value),
    };
    if (!data.title) return HR.toast('请填写报告标题', 'warn');
    try {
      await HR.api.createRecord(data);
      f.title.value = '';
      f.org.value = '';
      f.summary.value = '';
      f.items.value = '';
      f.checkDate.value = HR.today();
      f.memberId.value = HR.state.memberId;
      await refresh();
      HR.toast('体检报告已保存', 'success');
    } catch (err) {
      HR.toast(err.message, 'error');
    }
  }

  async function onDelete(id) {
    if (!window.confirm('确定删除这份体检报告吗？')) return;
    try {
      await HR.api.deleteRecord(id);
      await refresh();
      HR.toast('报告已删除', 'success');
    } catch (err) {
      HR.toast(err.message, 'error');
    }
  }

  function bind() {
    formEl().addEventListener('submit', onSubmit);
    document.getElementById('recordList').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-action="del-record"]');
      if (btn) onDelete(Number(btn.dataset.id));
    });
  }

  return {
    refresh,
    bind,
    syncMember() {
      formEl().memberId.value = HR.state.memberId;
    },
  };
})();
