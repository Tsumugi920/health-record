'use strict';

/**
 * 数据存取层：所有数据持久化在 server/data.json
 * - load(): 读取数据；文件不存在时自动写入内置示例数据（3 位家庭成员）
 * - save(): 原子写入（先写临时文件再改名），避免写坏数据文件
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

/** 内置示例数据：3 位家庭成员及其指标、体检报告、用药提醒、就诊记录 */
function buildSeed() {
  const members = [
    { id: 1, name: '王建国', relation: '爷爷', gender: '男', birthDate: '1958-03-12', heightCm: 172, tags: ['高血压', '控盐饮食'] },
    { id: 2, name: '李秀兰', relation: '妈妈', gender: '女', birthDate: '1981-07-30', heightCm: 160, tags: ['减重计划'] },
    { id: 3, name: '王小雨', relation: '女儿', gender: '女', birthDate: '2014-11-05', heightCm: 142, tags: ['生长发育期'] },
  ];

  const metrics = [
    // 王建国：血压呈下降趋势（开始规律服药后），另有体重 / 心率 / 血糖
    { id: 1, memberId: 1, type: '血压', value: 152, value2: 96, unit: 'mmHg', recordedAt: '2026-08-30', note: '晨起测量，略感头晕' },
    { id: 2, memberId: 1, type: '血压', value: 148, value2: 94, unit: 'mmHg', recordedAt: '2026-09-07', note: '' },
    { id: 3, memberId: 1, type: '血压', value: 145, value2: 92, unit: 'mmHg', recordedAt: '2026-09-15', note: '开始服用氨氯地平一周' },
    { id: 4, memberId: 1, type: '血压', value: 142, value2: 90, unit: 'mmHg', recordedAt: '2026-09-24', note: '' },
    { id: 5, memberId: 1, type: '血压', value: 140, value2: 88, unit: 'mmHg', recordedAt: '2026-10-02', note: '' },
    { id: 6, memberId: 1, type: '血压', value: 138, value2: 86, unit: 'mmHg', recordedAt: '2026-10-12', note: '' },
    { id: 7, memberId: 1, type: '血压', value: 134, value2: 84, unit: 'mmHg', recordedAt: '2026-10-24', note: '晨起测量' },
    { id: 8, memberId: 1, type: '体重', value: 74.5, value2: null, unit: 'kg', recordedAt: '2026-08-30', note: '' },
    { id: 9, memberId: 1, type: '体重', value: 73.8, value2: null, unit: 'kg', recordedAt: '2026-09-30', note: '' },
    { id: 10, memberId: 1, type: '体重', value: 73.2, value2: null, unit: 'kg', recordedAt: '2026-10-24', note: '每天晚饭后快走40分钟' },
    { id: 11, memberId: 1, type: '心率', value: 76, value2: null, unit: '次/分', recordedAt: '2026-09-15', note: '' },
    { id: 12, memberId: 1, type: '心率', value: 70, value2: null, unit: '次/分', recordedAt: '2026-10-24', note: '静息心率' },
    { id: 13, memberId: 1, type: '血糖', value: 5.6, value2: null, unit: 'mmol/L', recordedAt: '2026-09-15', note: '空腹' },
    { id: 14, memberId: 1, type: '血糖', value: 5.3, value2: null, unit: 'mmol/L', recordedAt: '2026-10-24', note: '空腹' },

    // 李秀兰：体重缓降，血压血糖正常
    { id: 15, memberId: 2, type: '体重', value: 65.8, value2: null, unit: 'kg', recordedAt: '2026-09-01', note: '' },
    { id: 16, memberId: 2, type: '体重', value: 65.2, value2: null, unit: 'kg', recordedAt: '2026-09-20', note: '' },
    { id: 17, memberId: 2, type: '体重', value: 64.6, value2: null, unit: 'kg', recordedAt: '2026-10-10', note: '' },
    { id: 18, memberId: 2, type: '体重', value: 64.1, value2: null, unit: 'kg', recordedAt: '2026-10-23', note: '每周3次游泳，每次1小时' },
    { id: 19, memberId: 2, type: '血压', value: 118, value2: 76, unit: 'mmHg', recordedAt: '2026-09-01', note: '' },
    { id: 20, memberId: 2, type: '血压', value: 116, value2: 74, unit: 'mmHg', recordedAt: '2026-10-23', note: '' },
    { id: 21, memberId: 2, type: '血糖', value: 5.1, value2: null, unit: 'mmol/L', recordedAt: '2026-09-01', note: '空腹' },
    { id: 22, memberId: 2, type: '血糖', value: 4.9, value2: null, unit: 'mmol/L', recordedAt: '2026-10-23', note: '空腹' },
    { id: 23, memberId: 2, type: '心率', value: 68, value2: null, unit: '次/分', recordedAt: '2026-10-23', note: '' },

    // 王小雨：生长发育期体重，7月初感冒发热的体温记录
    { id: 24, memberId: 3, type: '体重', value: 30.6, value2: null, unit: 'kg', recordedAt: '2026-08-28', note: '入学体检' },
    { id: 25, memberId: 3, type: '体重', value: 31.2, value2: null, unit: 'kg', recordedAt: '2026-10-24', note: '' },
    { id: 26, memberId: 3, type: '体温', value: 38.2, value2: null, unit: '℃', recordedAt: '2026-07-04', note: '感冒发热' },
    { id: 27, memberId: 3, type: '体温', value: 36.8, value2: null, unit: '℃', recordedAt: '2026-07-06', note: '已退烧' },
    { id: 28, memberId: 3, type: '心率', value: 98, value2: null, unit: '次/分', recordedAt: '2026-07-04', note: '发热时' },
  ];

  const records = [
    {
      id: 1,
      memberId: 1,
      title: '2026年度中老年体检',
      org: '市第一人民医院健康管理中心',
      checkDate: '2026-09-15',
      summary: '血压控制仍不理想，总胆固醇边缘升高。建议坚持服药、低盐低脂饮食，每月复测血压。',
      items: [
        { name: '血压', value: '148/94', unit: 'mmHg', flag: '偏高' },
        { name: '总胆固醇', value: '5.8', unit: 'mmol/L', flag: '偏高' },
        { name: '空腹血糖', value: '5.6', unit: 'mmol/L', flag: '正常' },
        { name: '心电图', value: '窦性心律，未见明显ST-T改变', unit: '', flag: '正常' },
        { name: '腹部B超', value: '轻度脂肪肝', unit: '', flag: '偏高' },
      ],
    },
    {
      id: 2,
      memberId: 1,
      title: '高血压专科复查',
      org: '市第一人民医院',
      checkDate: '2026-10-10',
      summary: '血压较前下降，继续当前用药方案，两周后复诊。',
      items: [
        { name: '血压', value: '138/86', unit: 'mmHg', flag: '偏高' },
        { name: '24小时动态血压均值', value: '132/84', unit: 'mmHg', flag: '偏高' },
        { name: '血常规', value: '未见异常', unit: '', flag: '正常' },
      ],
    },
    {
      id: 3,
      memberId: 2,
      title: '年度妇科及常规体检',
      org: '市妇幼保健院',
      checkDate: '2026-07-10',
      summary: '轻度脂肪肝，血脂正常偏高，建议增加运动、控制体重。',
      items: [
        { name: '体重指数(BMI)', value: '25.7', unit: 'kg/m²', flag: '偏高' },
        { name: '甘油三酯', value: '1.8', unit: 'mmol/L', flag: '偏高' },
        { name: '肝功能(ALT)', value: '38', unit: 'U/L', flag: '正常' },
        { name: '乳腺B超', value: '未见明显异常', unit: '', flag: '正常' },
      ],
    },
    {
      id: 4,
      memberId: 3,
      title: '入学体检',
      org: '市儿童医院',
      checkDate: '2026-08-28',
      summary: '生长发育正常，视力良好，建议保持每天户外活动。',
      items: [
        { name: '身高', value: '142', unit: 'cm', flag: '正常' },
        { name: '体重', value: '30.8', unit: 'kg', flag: '正常' },
        { name: '视力', value: '双眼 5.0', unit: '', flag: '正常' },
        { name: '血常规', value: '未见异常', unit: '', flag: '正常' },
      ],
    },
  ];

  const meds = [
    {
      id: 1,
      memberId: 1,
      drugName: '苯磺酸氨氯地平片',
      dosage: '5mg/次',
      frequency: '每日1次',
      times: ['08:00'],
      startDate: '2026-09-01',
      endDate: '',
      active: true,
      note: '早餐前服用',
    },
    {
      id: 2,
      memberId: 1,
      drugName: '阿司匹林肠溶片',
      dosage: '100mg/次',
      frequency: '每日1次',
      times: ['07:30'],
      startDate: '2026-09-01',
      endDate: '',
      active: true,
      note: '早餐后服用，注意观察出血倾向',
    },
    {
      id: 3,
      memberId: 2,
      drugName: '维生素D钙软胶囊',
      dosage: '1粒/次',
      frequency: '每日2次',
      times: ['08:00', '20:00'],
      startDate: '2026-10-01',
      endDate: '',
      active: true,
      note: '',
    },
  ];

  const visits = [
    {
      id: 1,
      memberId: 1,
      date: '2026-09-12',
      hospital: '市第一人民医院',
      department: '心血管内科',
      doctor: '陈明远 主任医师',
      diagnosis: '原发性高血压（2级，中危）',
      treatment: '调整降压方案为氨氯地平5mg每日一次；低盐饮食，每日食盐<5g；两周后复测家庭血压。',
      cost: 386.5,
      note: '带好血压记录本',
    },
    {
      id: 2,
      memberId: 2,
      date: '2026-08-20',
      hospital: '市中医院',
      department: '内分泌科',
      doctor: '刘芳 副主任医师',
      diagnosis: '血脂边缘升高；轻度脂肪肝',
      treatment: '饮食干预＋运动处方，每周有氧运动≥150分钟，3个月后复查血脂。',
      cost: 252,
      note: '',
    },
    {
      id: 3,
      memberId: 3,
      date: '2026-07-05',
      hospital: '市儿童医院',
      department: '呼吸内科',
      doctor: '赵晓东 主治医师',
      diagnosis: '急性上呼吸道感染',
      treatment: '口服小儿氨酚黄那敏颗粒3天，多饮水、注意休息。',
      cost: 96.4,
      note: '7月6日已退烧',
    },
    {
      id: 4,
      memberId: 3,
      date: '2026-09-26',
      hospital: '市口腔医院',
      department: '儿童口腔科',
      doctor: '孙洁 主治医师',
      diagnosis: '第一恒磨牙窝沟较深，龋齿高风险',
      treatment: '行四颗第一恒磨牙窝沟封闭，半年后复查。',
      cost: 480,
      note: '',
    },
  ];

  return { members, metrics, records, meds, visits };
}

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = buildSeed();
    save(seed);
    console.log('[store] data.json 不存在，已写入内置示例数据（3 位家庭成员）');
    return seed;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    throw new Error(`data.json 解析失败：${err.message}`);
  }
}

function save(db) {
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

module.exports = { load, save, nextId, buildSeed, DATA_FILE };
