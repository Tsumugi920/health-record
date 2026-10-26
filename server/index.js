'use strict';

/**
 * health-record 健康档案 —— 后端入口
 * 提供 REST API（健康指标 / 体检报告 / 用药提醒 / 就诊记录）并托管 client/ 前端静态页面
 * 端口：3014（避开 3000~3013），可用环境变量 PORT 覆盖
 */

const path = require('path');
const express = require('express');

const store = require('./store');
const metricsRouter = require('./routes/metrics');
const recordsRouter = require('./routes/records');
const medsRouter = require('./routes/meds');
const visitsRouter = require('./routes/visits');

const app = express();
const PORT = Number(process.env.PORT) || 3014;

app.use(express.json({ limit: '1mb' }));

// 简单的 API 访问日志
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[api] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// 托管前端静态资源（client/index.html 即首页）
app.use(express.static(path.join(__dirname, '..', 'client')));

// 初始化数据文件（不存在时写入内置示例数据）
store.load();

// 家庭成员列表（只读）
app.get('/api/members', (req, res) => {
  res.json(store.load().members);
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'health-record', time: new Date().toISOString() });
});

// 四个业务资源的 CRUD 路由
app.use('/api/metrics', metricsRouter);
app.use('/api/records', recordsRouter);
app.use('/api/meds', medsRouter);
app.use('/api/visits', visitsRouter);

// 未匹配到的 API 返回 404 JSON
app.use('/api', (req, res) => {
  res.status(404).json({ error: `接口不存在: ${req.method} ${req.originalUrl}` });
});

// 统一错误处理
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON 解析失败，请检查请求体格式' });
  }
  console.error('[error]', err && err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`health-record 健康档案已启动: http://localhost:${PORT}`);
  console.log(`数据文件: ${store.DATA_FILE}`);
});
