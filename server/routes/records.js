'use strict';

/**
 * 体检报告路由 /api/records
 * items 为检查明细数组：[{ name, value, unit, flag }]
 */

const express = require('express');
const store = require('../store');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateRecord(body) {
  if (!body || typeof body !== 'object') return '请求体不能为空';
  if (!Number(body.memberId)) return 'memberId 不能为空';
  if (!String(body.title || '').trim()) return 'title（报告标题）不能为空';
  if (body.checkDate && !DATE_RE.test(body.checkDate)) return 'checkDate 格式应为 YYYY-MM-DD';
  if (body.items !== undefined && body.items !== null) {
    if (!Array.isArray(body.items)) return 'items 应为数组';
    for (const item of body.items) {
      if (typeof item !== 'object' || item === null || !String(item.name || '').trim()) {
        return 'items 中每一项都必须包含 name';
      }
    }
  }
  return null;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    name: String(item.name || '').trim(),
    value: String(item.value || '').trim(),
    unit: String(item.unit || '').trim(),
    flag: String(item.flag || '正常').trim(),
  }));
}

function normalize(body, existing) {
  return {
    id: existing ? existing.id : undefined,
    memberId: Number(body.memberId),
    title: String(body.title).trim(),
    org: String(body.org || '').trim(),
    checkDate: body.checkDate || new Date().toISOString().slice(0, 10),
    summary: String(body.summary || '').trim(),
    items: normalizeItems(body.items),
  };
}

// 列表（支持 ?memberId=），按体检日期倒序
router.get('/', (req, res) => {
  const db = store.load();
  let list = db.records.slice();
  if (req.query.memberId) list = list.filter((r) => r.memberId === Number(req.query.memberId));
  list.sort((a, b) => {
    if (a.checkDate !== b.checkDate) return a.checkDate < b.checkDate ? 1 : -1;
    return b.id - a.id;
  });
  res.json(list);
});

router.get('/:id', (req, res) => {
  const item = store.load().records.find((r) => r.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: '体检报告不存在' });
  res.json(item);
});

router.post('/', (req, res) => {
  const error = validateRecord(req.body);
  if (error) return res.status(400).json({ error });
  const db = store.load();
  if (!db.members.some((m) => m.id === Number(req.body.memberId))) {
    return res.status(400).json({ error: '家庭成员不存在' });
  }
  const item = normalize(req.body);
  item.id = store.nextId(db.records);
  db.records.push(item);
  store.save(db);
  res.status(201).json(item);
});

router.put('/:id', (req, res) => {
  const db = store.load();
  const item = db.records.find((r) => r.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: '体检报告不存在' });
  const merged = { ...item, ...req.body, id: item.id };
  const error = validateRecord(merged);
  if (error) return res.status(400).json({ error });
  Object.assign(item, normalize(merged, item));
  store.save(db);
  res.json(item);
});

router.delete('/:id', (req, res) => {
  const db = store.load();
  const index = db.records.findIndex((r) => r.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: '体检报告不存在' });
  const [removed] = db.records.splice(index, 1);
  store.save(db);
  res.json({ ok: true, id: removed.id });
});

module.exports = router;
