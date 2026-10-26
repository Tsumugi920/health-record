'use strict';

/**
 * 用药提醒路由 /api/meds
 * times 为每日提醒时间数组（HH:MM），active 表示是否服用中
 */

const express = require('express');
const store = require('../store');

const router = express.Router();

const TIME_RE = /^\d{2}:\d{2}$/;
const DEFAULT_TIMES = {
  每日1次: ['08:00'],
  每日2次: ['08:00', '20:00'],
  每日3次: ['08:00', '12:00', '18:00'],
};

function validateMed(body) {
  if (!body || typeof body !== 'object') return '请求体不能为空';
  if (!Number(body.memberId)) return 'memberId 不能为空';
  if (!String(body.drugName || '').trim()) return 'drugName（药品名称）不能为空';
  if (!String(body.frequency || '').trim()) return 'frequency（服用频次）不能为空';
  if (!Array.isArray(body.times) || body.times.length === 0) return 'times 至少需要一个提醒时间';
  for (const t of body.times) {
    if (!TIME_RE.test(String(t))) return `提醒时间格式应为 HH:MM，收到：${t}`;
  }
  if (body.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) return 'startDate 格式应为 YYYY-MM-DD';
  if (body.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.endDate)) return 'endDate 格式应为 YYYY-MM-DD';
  return null;
}

function normalize(body, existing) {
  const times = (Array.isArray(body.times) ? body.times : DEFAULT_TIMES[body.frequency] || ['08:00'])
    .map((t) => String(t))
    .filter((t) => TIME_RE.test(t))
    .sort();
  return {
    id: existing ? existing.id : undefined,
    memberId: Number(body.memberId),
    drugName: String(body.drugName).trim(),
    dosage: String(body.dosage || '').trim(),
    frequency: String(body.frequency).trim(),
    times,
    startDate: body.startDate || new Date().toISOString().slice(0, 10),
    endDate: String(body.endDate || '').trim(),
    active: body.active === undefined ? true : Boolean(body.active),
    note: String(body.note || '').trim(),
  };
}

// 列表（支持 ?memberId=），新增的在前
router.get('/', (req, res) => {
  const db = store.load();
  let list = db.meds.slice();
  if (req.query.memberId) list = list.filter((m) => m.memberId === Number(req.query.memberId));
  list.sort((a, b) => b.id - a.id);
  res.json(list);
});

router.get('/:id', (req, res) => {
  const item = store.load().meds.find((m) => m.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: '用药提醒不存在' });
  res.json(item);
});

router.post('/', (req, res) => {
  const error = validateMed(req.body);
  if (error) return res.status(400).json({ error });
  const db = store.load();
  if (!db.members.some((m) => m.id === Number(req.body.memberId))) {
    return res.status(400).json({ error: '家庭成员不存在' });
  }
  const item = normalize(req.body);
  item.id = store.nextId(db.meds);
  db.meds.push(item);
  store.save(db);
  res.status(201).json(item);
});

router.put('/:id', (req, res) => {
  const db = store.load();
  const item = db.meds.find((m) => m.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: '用药提醒不存在' });
  const merged = { ...item, ...req.body, id: item.id };
  const error = validateMed(merged);
  if (error) return res.status(400).json({ error });
  Object.assign(item, normalize(merged, item));
  store.save(db);
  res.json(item);
});

router.delete('/:id', (req, res) => {
  const db = store.load();
  const index = db.meds.findIndex((m) => m.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: '用药提醒不存在' });
  const [removed] = db.meds.splice(index, 1);
  store.save(db);
  res.json({ ok: true, id: removed.id });
});

module.exports = router;
