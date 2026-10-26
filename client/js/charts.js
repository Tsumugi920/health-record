'use strict';

/**
 * 趋势图模块：纯 Canvas 绘制折线趋势图，无第三方图表库依赖
 * - HR.charts.render(canvas, entries, type)  绘制某一类型的指标趋势
 * - HR.charts.stats(entries)                 计算统计摘要（最新/平均/最高/最低）
 * - HR.charts.meta(type)                     类型的单位、双序列（血压）等元信息
 */

window.HR = window.HR || {};

HR.charts = (() => {
  const TYPES = {
    血压: { unit: 'mmHg', dual: true, names: ['收缩压', '舒张压'], colors: ['#e0524f', '#3b82f6'] },
    血糖: { unit: 'mmol/L', dual: false, names: ['血糖'], colors: ['#0f9d76'] },
    体重: { unit: 'kg', dual: false, names: ['体重'], colors: ['#8b5cf6'] },
    心率: { unit: '次/分', dual: false, names: ['心率'], colors: ['#f59e0b'] },
    体温: { unit: '℃', dual: false, names: ['体温'], colors: ['#ef476f'] },
  };

  const FONT = '12px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
  const TEXT_COLOR = '#6b7a80';
  const GRID_COLOR = '#e8eef0';
  const AXIS_COLOR = '#c3d1d6';

  let last = null; // { canvas, entries, type } 供鼠标悬停与窗口缩放时重绘

  function meta(type) {
    return TYPES[type] || { unit: '', dual: false, names: [type || '数值'], colors: ['#0f9d76'] };
  }

  function sortAsc(entries) {
    return entries.slice().sort((a, b) => {
      if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? -1 : 1;
      return a.id - b.id;
    });
  }

  function niceStep(span) {
    const raw = span / 4;
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
    for (const c of [1, 2, 2.5, 5, 10]) {
      if (raw <= c * pow + 1e-9) return c * pow;
    }
    return 10 * pow;
  }

  function fmt(v) {
    const n = Number(v);
    return Number.isFinite(n) ? String(Number(n.toFixed(1))) : '-';
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * 绘制核心：entries 为同一成员同一类型的指标记录
   */
  function draw(canvas, entries, type, hoverIndex) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(canvas.clientWidth, 320);
    const cssH = Math.max(canvas.clientHeight, 240);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const data = sortAsc(entries);
    const m = meta(type);

    if (!data.length) {
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('暂无数据，先在左侧录入一条记录吧', cssW / 2, cssH / 2);
      last = null;
      return { data: [], points: [] };
    }

    const pad = { l: 56, r: 20, t: 40, b: 32 };
    const w = cssW - pad.l - pad.r;
    const h = cssH - pad.t - pad.b;
    const n = data.length;

    // 数值范围（血压同时统计收缩/舒张两个序列）
    let min = Infinity;
    let max = -Infinity;
    for (const d of data) {
      const v = Number(d.value);
      if (Number.isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); }
      if (m.dual) {
        const v2 = Number(d.value2);
        if (Number.isFinite(v2)) { min = Math.min(min, v2); max = Math.max(max, v2); }
      }
    }
    if (!Number.isFinite(min)) { min = 0; max = 1; }
    if (min === max) { min -= 1; max += 1; }
    const rawSpan = max - min;
    min -= rawSpan * 0.18;
    max += rawSpan * 0.18;
    if (min < 0) min = 0;

    const step = niceStep(max - min);
    const yMin = Math.floor(min / step) * step;
    const yMax = Math.ceil(max / step) * step;

    const xOf = (i) => (n === 1 ? pad.l + w / 2 : pad.l + (i / (n - 1)) * w);
    const yOf = (v) => pad.t + h - ((v - yMin) / (yMax - yMin)) * h;

    // 网格线与 Y 轴刻度
    ctx.font = FONT;
    ctx.fillStyle = TEXT_COLOR;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = yMin; v <= yMax + 1e-9; v += step) {
      const y = yOf(v);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + w, y);
      ctx.stroke();
      ctx.fillText(fmt(v), pad.l - 8, y);
    }

    // 坐标轴
    ctx.strokeStyle = AXIS_COLOR;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + h);
    ctx.lineTo(pad.l + w, pad.t + h);
    ctx.stroke();

    // X 轴日期标签（数据点较多时隔点显示）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelEvery = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i++) {
      if (i % labelEvery === 0 || i === n - 1) {
        ctx.fillText(String(data[i].recordedAt || '').slice(5), xOf(i), pad.t + h + 8);
      }
    }

    const seriesCount = m.dual ? 2 : 1;
    const points = []; // 主序列的坐标，供悬停提示使用

    for (let s = 0; s < seriesCount; s++) {
      const color = m.colors[s];
      const key = m.dual ? (s === 0 ? 'value' : 'value2') : 'value';
      const pts = data.map((d, i) => ({
        x: xOf(i),
        y: yOf(Number(d[key])),
      }));

      // 单序列时绘制渐变面积
      if (!m.dual) {
        const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + h);
        grad.addColorStop(0, color + '30');
        grad.addColorStop(1, color + '08');
        ctx.fillStyle = grad;
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.lineTo(pts[pts.length - 1].x, pad.t + h);
        ctx.lineTo(pts[0].x, pad.t + h);
        ctx.closePath();
        ctx.fill();
      }

      // 折线
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();

      // 数据点
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      if (s === 0) pts.forEach((p, i) => points.push({ x: p.x, y: p.y, entry: data[i] }));
    }

    // 悬停高亮与提示框
    if (hoverIndex >= 0 && points[hoverIndex]) {
      const p = points[hoverIndex];
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#9fb3ba';
      ctx.beginPath();
      ctx.moveTo(p.x, pad.t);
      ctx.lineTo(p.x, pad.t + h);
      ctx.stroke();
      ctx.setLineDash([]);

      const e = p.entry;
      const lines = [String(e.recordedAt)];
      if (m.dual) lines.push(`收缩压 ${fmt(e.value)} / 舒张压 ${fmt(e.value2)} ${m.unit}`);
      else lines.push(`${m.names[0]} ${fmt(e.value)} ${m.unit}`);
      if (e.note) lines.push(String(e.note));

      ctx.font = FONT;
      const tw = Math.max(...lines.map((t) => ctx.measureText(t).width)) + 22;
      const th = lines.length * 17 + 12;
      let bx = p.x + 12;
      if (bx + tw > cssW - 4) bx = p.x - tw - 12;
      const by = Math.max(4, Math.min(p.y - th - 10, cssH - th - 4));
      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      ctx.strokeStyle = '#dbe5e8';
      roundRect(ctx, bx, by, tw, th, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#33454c';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lines.forEach((t, i) => ctx.fillText(t, bx + 11, by + 8 + i * 17));
    }

    // 图例
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let lx = pad.l + 4;
    m.names.forEach((name, i) => {
      const label = `${name}（${m.unit}）`;
      ctx.fillStyle = m.colors[i];
      ctx.beginPath();
      ctx.arc(lx + 5, pad.t - 16, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#33454c';
      ctx.fillText(label, lx + 14, pad.t - 16);
      lx += ctx.measureText(label).width + 44;
    });

    last = { canvas, entries, type };
    return { data, points };
  }

  function render(canvas, entries, type) {
    draw(canvas, entries, type, -1);

    // 绑定一次悬停与缩放事件
    if (!canvas._hrBound) {
      canvas._hrBound = true;
      canvas.addEventListener('mousemove', (ev) => {
        if (!last || last.canvas !== canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const { points } = draw(canvas, last.entries, last.type, -1);
        let best = -1;
        let bestDist = 26;
        points.forEach((p, i) => {
          const d = Math.abs(p.x - x);
          if (d < bestDist) { bestDist = d; best = i; }
        });
        canvas.style.cursor = best >= 0 ? 'pointer' : 'default';
        if (best >= 0) draw(canvas, last.entries, last.type, best);
      });
      canvas.addEventListener('mouseleave', () => {
        if (last && last.canvas === canvas) draw(canvas, last.entries, last.type, -1);
      });
      window.addEventListener('resize', () => {
        if (last && last.canvas === canvas) draw(canvas, last.entries, last.type, -1);
      });
    }
  }

  /** 统计摘要：基于主数值（血压取收缩压） */
  function stats(entries) {
    const data = sortAsc(entries);
    if (!data.length) return null;
    const primary = data.map((d) => Number(d.value)).filter(Number.isFinite);
    if (!primary.length) return null;
    const avg = primary.reduce((sum, v) => sum + v, 0) / primary.length;
    return {
      count: data.length,
      latest: data[data.length - 1],
      avg,
      max: Math.max(...primary),
      min: Math.min(...primary),
    };
  }

  return { render, stats, meta, TYPES: Object.keys(TYPES) };
})();
