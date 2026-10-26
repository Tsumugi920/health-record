'use strict';

/**
 * 就诊记录路由 /api/visits
 */

const express = require('express');
const store = require('../store');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateVisit(body) {
  if (!body || typeof body !== 'object') return '请求体不能为空';
  if (!Number(body.memberId)) return 'memberId 不能为空';
  if (!String(body.hospital || '').trim()) return 'hospital（医院）不能为空';
  if (!String(body.diagnosis || '').trim()) return 'diagnosis（诊断结论）不能为空';
  if (body.date && !DATE_RE.test(body.date)) return 'date 格式应为 YYYY-MM-DD';
  if (body.cost !== undefined && body.cost !== null && body.cost !== '') {
    if (!Number.isFinite(Number(body.cost))) return 'cost 应为数字';
  }
  return null;
}

function normalize(body, existing) {
  return {
    id: existing ? existing.id : undefined,
    memberId: Number(body.memberId),
    date: body.date || new Date().toISOString().slice(0, 10),
    hospital: String(body.hospital).trim(),
    department: String(body.department || '').trim(),
    doctor: String(body.doctor || '').trim(),
    diagnosis: String(body.diagnosis).trim(),
    treatment: String(body.treatment || '').trim(),
    cost: Number(body.cost || 0),
    note: String(body.note || '').trim(),
  };
}

// 列表（支持 ?memberId=），按就诊日期倒序
router.get('/', (req, res) => {
  const db = store.load();
  let list = db.visits.slice();
  if (req.query.memberId) list = list.filter((v) => v.memberId === Number(req.query.memberId));
  list.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.id - a.id;
  });
  res.json(list);
});

router.get('/:id', (req, res) => {
  const item = store.load().visits.find((v) => v.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: '就诊记录不存在' });
  res.json(item);
});

router.post('/', (req, res) => {
  const error = validateVisit(req.body);
  if (error) return res.status(400).json({ error });
  const db = store.load();
  if (!db.members.some((m) => m.id === Number(req.body.memberId))) {
    return res.status(400).json({ error: '家庭成员不存在' });
  }
  const item = normalize(req.body);
  item.id = store.nextId(db.visits);
  db.visits.push(item);
  store.save(db);
  res.status(201).json(item);
});

router.put('/:id', (req, res) => {
  const db = store.load();
  const item = db.visits.find((v) => v.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: '就诊记录不存在' });
  const merged = { ...item, ...req.body, id: item.id };
  const error = validateVisit(merged);
  if (error) return res.status(400).json({ error });
  Object.assign(item, normalize(merged, item));
  store.save(db);
  res.json(item);
});

router.delete('/:id', (req, res) => {
  const db = store.load();
  const index = db.visits.findIndex((v) => v.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: '就诊记录不存在' });
  const [removed] = db.visits.splice(index, 1);
  store.save(db);
  res.json({ ok: true, id: removed.id });
});

module.exports = router;
