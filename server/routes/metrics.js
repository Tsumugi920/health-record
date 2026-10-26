'use strict';

/**
 * 健康指标路由 /api/metrics
 * 支持类型：血压（value=收缩压, value2=舒张压）/ 血糖 / 体重 / 心率 / 体温
 */

const express = require('express');
const store = require('../store');

const router = express.Router();

const METRIC_TYPES = {
  血压: 'mmHg',
  血糖: 'mmol/L',
  体重: 'kg',
  心率: '次/分',
  体温: '℃',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateMetric(body) {
  if (!body || typeof body !== 'object') return '请求体不能为空';
  if (!Number(body.memberId)) return 'memberId 不能为空';
  if (!METRIC_TYPES[body.type]) return `type 必须是以下之一：${Object.keys(METRIC_TYPES).join('、')}`;
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0) return 'value 必须是大于 0 的数字';
  if (body.type === '血压') {
    const v2 = Number(body.value2);
    if (!Number.isFinite(v2) || v2 <= 0) return '血压类型必须提供舒张压 value2（大于 0 的数字）';
    if (v2 >= value) return '舒张压 value2 应小于收缩压 value';
  }
  if (body.recordedAt && !DATE_RE.test(body.recordedAt)) return 'recordedAt 格式应为 YYYY-MM-DD';
  return null;
}

function normalize(body, existing) {
  return {
    id: existing ? existing.id : undefined,
    memberId: Number(body.memberId),
    type: body.type,
    value: Number(body.value),
    value2: body.type === '血压' ? Number(body.value2) : null,
    unit: METRIC_TYPES[body.type],
    recordedAt: body.recordedAt || new Date().toISOString().slice(0, 10),
    note: String(body.note || '').trim(),
  };
}

// 列表（支持 ?memberId=&type= 过滤），按测量日期倒序
router.get('/', (req, res) => {
  const db = store.load();
  let list = db.metrics.slice();
  if (req.query.memberId) list = list.filter((m) => m.memberId === Number(req.query.memberId));
  if (req.query.type) list = list.filter((m) => m.type === req.query.type);
  list.sort((a, b) => {
    if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? 1 : -1;
    return b.id - a.id;
  });
  res.json(list);
});

router.get('/:id', (req, res) => {
  const item = store.load().metrics.find((m) => m.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: '指标记录不存在' });
  res.json(item);
});

router.post('/', (req, res) => {
  const error = validateMetric(req.body);
  if (error) return res.status(400).json({ error });
  const db = store.load();
  if (!db.members.some((m) => m.id === Number(req.body.memberId))) {
    return res.status(400).json({ error: '家庭成员不存在' });
  }
  const item = normalize(req.body);
  item.id = store.nextId(db.metrics);
  db.metrics.push(item);
  store.save(db);
  res.status(201).json(item);
});

router.put('/:id', (req, res) => {
  const db = store.load();
  const item = db.metrics.find((m) => m.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: '指标记录不存在' });
  const merged = { ...item, ...req.body, id: item.id };
  const error = validateMetric(merged);
  if (error) return res.status(400).json({ error });
  Object.assign(item, normalize(merged, item));
  store.save(db);
  res.json(item);
});

router.delete('/:id', (req, res) => {
  const db = store.load();
  const index = db.metrics.findIndex((m) => m.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: '指标记录不存在' });
  const [removed] = db.metrics.splice(index, 1);
  store.save(db);
  res.json({ ok: true, id: removed.id });
});

module.exports = router;
