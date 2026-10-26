# health-record 健康档案

家庭健康数据管理小系统，**前后端完整项目**（非纯静态页面）：健康指标录入与趋势图、体检报告、用药提醒、就诊记录，数据由 Express 后端持久化到 `server/data.json`。

技术栈：**Node.js + Express**（REST API 后端）· **原生 HTML/CSS/JavaScript**（前端，Canvas 手绘趋势图，无前端框架、无第三方图表库）。

## 功能

- 👨‍👩‍👧 **家庭成员切换**：内置 3 位示例成员（爷爷 王建国 / 妈妈 李秀兰 / 女儿 王小雨），顶栏切换后所有数据跟随成员过滤
- 📏 **健康指标**：录入血压 / 血糖 / 体重 / 心率 / 体温；Canvas 趋势图（血压绘制收缩压 + 舒张压双线，支持悬停查看明细）；最新 / 平均 / 最高 / 最低统计摘要；最近记录列表与删除
- 📋 **体检报告**：录入报告标题、机构、日期、总体结论，以及逐项检查明细（`项目|结果|单位|提示`），明细按偏高/偏低/正常着色
- 💊 **用药提醒**：按每日 1~3 次设置每日提醒时间（如 08:00 / 20:00），支持启用 / 停用 / 删除
- 🏥 **就诊记录**：医院、科室、医生、诊断、处置/处方、费用
- 💾 数据全部持久化在 `server/data.json`

## 目录结构

```
health-record/
├── package.json              # 启动脚本 npm start（后端端口 3014）
├── README.md
├── server/                   # 后端：Node + Express
│   ├── index.js              # 入口：托管前端静态资源 + 挂载 API 路由
│   ├── store.js              # 数据存取层（读写 data.json，内置示例数据）
│   ├── data.json             # 持久化数据文件（首次启动自动生成）
│   └── routes/
│       ├── metrics.js        # 健康指标 CRUD  /api/metrics
│       ├── records.js        # 体检报告 CRUD  /api/records
│       ├── meds.js           # 用药提醒 CRUD  /api/meds
│       └── visits.js         # 就诊记录 CRUD  /api/visits
└── client/                   # 前端（由 Express 托管）
    ├── index.html
    ├── style.css
    ├── app.js                # 入口：状态管理、页签切换、指标页、就诊记录页
    └── js/
        ├── api.js            # fetch 封装与 REST 接口定义
        ├── charts.js         # Canvas 趋势图（含悬停提示、统计摘要）
        ├── records.js        # 体检报告模块
        └── meds.js           # 用药提醒模块
```

## 安装与启动

要求 Node.js ≥ 14。

```bash
cd health-record
npm install
npm start
```

启动后浏览器打开 **<http://localhost:3014>** 即可使用。

- 端口说明：后端默认使用 **3014**（避开常用的 3000~3013）。如需修改，可用环境变量覆盖：`PORT=4000 npm start`
- 数据文件：首次启动时若 `server/data.json` 不存在，会自动写入内置示例数据（3 位成员及各自的指标、报告、用药、就诊记录）。删除该文件后重启即可恢复示例数据

## REST API

Base URL：`http://localhost:3014`，除成员列表外均支持按 `?memberId=` 过滤。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/members` | 家庭成员列表 |
| GET/POST | `/api/metrics` | 健康指标：列表 / 新增 |
| GET/PUT/DELETE | `/api/metrics/:id` | 健康指标：详情 / 修改 / 删除 |
| GET/POST | `/api/records` | 体检报告：列表 / 新增 |
| GET/PUT/DELETE | `/api/records/:id` | 体检报告：详情 / 修改 / 删除 |
| GET/POST | `/api/meds` | 用药提醒：列表 / 新增 |
| GET/PUT/DELETE | `/api/meds/:id` | 用药提醒：详情 / 修改（启用/停用）/ 删除 |
| GET/POST | `/api/visits` | 就诊记录：列表 / 新增 |
| GET/PUT/DELETE | `/api/visits/:id` | 就诊记录：详情 / 修改 / 删除 |
| GET | `/api/health` | 健康检查 |

### curl 示例

```bash
# 列出爷爷（memberId=1）的健康指标
curl "http://localhost:3014/api/metrics?memberId=1"

# 新增一条血压指标（value=收缩压，value2=舒张压）
curl -X POST http://localhost:3014/api/metrics \
  -H "Content-Type: application/json" \
  -d '{"memberId":1,"type":"血压","value":136,"value2":85,"recordedAt":"2026-10-25","note":"晨起测量"}'

# 列出用药提醒
curl http://localhost:3014/api/meds

# 新增用药提醒（每日 2 次）
curl -X POST http://localhost:3014/api/meds \
  -H "Content-Type: application/json" \
  -d '{"memberId":2,"drugName":"钙片","dosage":"1粒/次","frequency":"每日2次","times":["08:00","20:00"],"startDate":"2026-10-25"}'

# 新增体检报告
curl -X POST http://localhost:3014/api/records \
  -H "Content-Type: application/json" \
  -d '{"memberId":1,"title":"年度体检","org":"市第一人民医院","checkDate":"2026-10-25","summary":"总体正常","items":[{"name":"血压","value":"134/84","unit":"mmHg","flag":"偏高"}]}'

# 新增就诊记录
curl -X POST http://localhost:3014/api/visits \
  -H "Content-Type: application/json" \
  -d '{"memberId":1,"date":"2026-10-25","hospital":"市第一人民医院","department":"心血管内科","diagnosis":"高血压复诊","cost":120}'

# 删除（示例）
curl -X DELETE http://localhost:3014/api/metrics/1
```

### 指标字段说明

| 字段 | 说明 |
| --- | --- |
| `memberId` | 成员 ID（1/2/3） |
| `type` | `血压` / `血糖` / `体重` / `心率` / `体温` |
| `value` | 主数值；血压时为收缩压 |
| `value2` | 仅血压需要：舒张压（必须小于收缩压） |
| `recordedAt` | 测量日期 `YYYY-MM-DD`，缺省为当天 |
| `note` | 备注，可选 |

## 前端说明

前端为原生实现，脚本加载顺序：`js/api.js` → `js/charts.js` → `js/records.js` → `js/meds.js` → `app.js`，通过全局命名空间 `window.HR` 共享状态与工具函数（`HR.state`、`HR.api`、`HR.toast` 等）。

趋势图由 `js/charts.js` 用 Canvas 手绘：自适应容器宽度与高分屏（DPR 缩放）、网格刻度自动取整、血压双序列双色、鼠标悬停显示日期与数值提示框、数据稀疏时自动放宽 Y 轴范围。
