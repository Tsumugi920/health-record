'use strict';

/**
 * API 模块：统一封装 fetch，对应后端 REST 接口
 * 所有前端模块共享全局命名空间 window.HR
 */

window.HR = window.HR || {};

HR.api = (() => {
  async function request(path, options = {}) {
    const config = { headers: {}, ...options };
    if (config.body && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
      config.headers['Content-Type'] = 'application/json';
    }
    let res;
    try {
      res = await fetch(path, config);
    } catch (err) {
      throw new Error('无法连接服务器，请确认后端已启动（npm start）');
    }
    if (!res.ok) {
      let message = `请求失败（HTTP ${res.status}）`;
      try {
        const body = await res.json();
        if (body && body.error) message = body.error;
      } catch (_) { /* 响应不是 JSON 时忽略 */ }
      throw new Error(message);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  const qs = (params) => {
    const entries = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
    return entries.length ? '?' + new URLSearchParams(entries).toString() : '';
  };

  return {
    // 家庭成员
    listMembers: () => request('/api/members'),

    // 健康指标
    listMetrics: (params) => request('/api/metrics' + qs(params)),
    createMetric: (data) => request('/api/metrics', { method: 'POST', body: data }),
    updateMetric: (id, data) => request(`/api/metrics/${id}`, { method: 'PUT', body: data }),
    deleteMetric: (id) => request(`/api/metrics/${id}`, { method: 'DELETE' }),

    // 体检报告
    listRecords: (params) => request('/api/records' + qs(params)),
    createRecord: (data) => request('/api/records', { method: 'POST', body: data }),
    updateRecord: (id, data) => request(`/api/records/${id}`, { method: 'PUT', body: data }),
    deleteRecord: (id) => request(`/api/records/${id}`, { method: 'DELETE' }),

    // 用药提醒
    listMeds: (params) => request('/api/meds' + qs(params)),
    createMed: (data) => request('/api/meds', { method: 'POST', body: data }),
    updateMed: (id, data) => request(`/api/meds/${id}`, { method: 'PUT', body: data }),
    deleteMed: (id) => request(`/api/meds/${id}`, { method: 'DELETE' }),

    // 就诊记录
    listVisits: (params) => request('/api/visits' + qs(params)),
    createVisit: (data) => request('/api/visits', { method: 'POST', body: data }),
    updateVisit: (id, data) => request(`/api/visits/${id}`, { method: 'PUT', body: data }),
    deleteVisit: (id) => request(`/api/visits/${id}`, { method: 'DELETE' }),
  };
})();
