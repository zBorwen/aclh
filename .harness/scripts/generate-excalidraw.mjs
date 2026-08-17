import fs from 'fs';
import path from 'path';

// ========================================================================
// Excalidraw v2 JSON helpers
// ========================================================================
function createExcalidrawFile(elements) {
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements: elements,
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: null
    },
    files: {}
  }, null, 2);
}

let elementIdCounter = 1;
function genId(prefix = "el") {
  return `${prefix}_${elementIdCounter++}_${Math.random().toString(36).substr(2, 5)}`;
}

function rect({
  x, y, width, height,
  strokeColor = "#1e1e1e",
  backgroundColor = "transparent",
  fillStyle = "solid",
  strokeWidth = 1,
  strokeStyle = "solid",
  roundness = { type: 3 },
  roughness = 0,
  opacity = 100
}) {
  return {
    id: genId("rect"),
    type: "rectangle",
    x, y, width, height,
    angle: 0,
    strokeColor,
    backgroundColor,
    fillStyle,
    strokeWidth,
    strokeStyle,
    roughness,
    opacity,
    groupIds: [],
    frameId: null,
    roundness,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false
  };
}

function text({
  x, y, text: content,
  fontSize = 16,
  fontFamily = 1,
  textAlign = "left",
  verticalAlign = "top",
  strokeColor = "#1e1e1e",
  width = 200,
  height = 30,
  roughness = 0
}) {
  return {
    id: genId("text"),
    type: "text",
    x, y, width, height,
    angle: 0,
    strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    text: content,
    fontSize,
    fontFamily,
    textAlign,
    verticalAlign,
    baseline: fontSize,
    containerId: null,
    originalText: content,
    lineHeight: 1.3
  };
}

function arrow({
  startX, startY, endX, endY,
  points = null,
  strokeColor = "#495057",
  strokeWidth = 2,
  strokeStyle = "solid",
  roughness = 0
}) {
  const pts = points || [[0, 0], [endX - startX, endY - startY]];
  return {
    id: genId("arrow"),
    type: "arrow",
    x: startX,
    y: startY,
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
    angle: 0,
    strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth,
    strokeStyle,
    roughness,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 2 },
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    points: pts,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: "arrow"
  };
}

function caption({ x, y, text: content, width = 200, strokeColor = "#868e96", fontSize = 11, height = 16, textAlign = "center" }) {
  return text({ x, y, text: content, width, strokeColor, fontSize, height, textAlign });
}

// ========================================================================
// Diagram 1: ACLH 全局系统架构与组件组织全景
// ========================================================================
function buildDiagram1() {
  const els = [];

  // Title Banner
  els.push(rect({ x: 40, y: 30, width: 1320, height: 65, backgroundColor: "#1971c2", strokeColor: "#1864ab", strokeWidth: 2 }));
  els.push(text({ x: 60, y: 45, text: "AI Coding Lifecycle Harness (ACLH) 架构全景与组件组织", fontSize: 24, strokeColor: "#ffffff", width: 800, height: 35 }));
  els.push(text({ x: 920, y: 52, text: "标准 · 流程 · 记忆 · 门禁 一体化 AI 研发底座", fontSize: 15, strokeColor: "#d0ebff", width: 420, height: 25 }));

  // Layer 1: 多智能体接入 (Agent Entrypoints)
  const l1Y = 115;
  els.push(rect({ x: 40, y: l1Y, width: 1320, height: 110, backgroundColor: "#f8f9fa", strokeColor: "#ced4da", strokeWidth: 1, strokeStyle: "dashed" }));
  els.push(text({ x: 55, y: l1Y + 10, text: "1. 多智能体接入协议层 (Agent Entrypoints & Routing)", fontSize: 15, strokeColor: "#495057", width: 500, height: 20 }));

  const agents = [
    { name: "Cursor IDE", file: ".cursor/rules/main.mdc", desc: "Globs **/* 自动注入", color: "#e7f5ff", border: "#339af0" },
    { name: "Claude Code", file: "CLAUDE.md", desc: "引导读取 AGENTS.md 与配置", color: "#fff4e6", border: "#ff922b" },
    { name: "GitHub Copilot", file: ".github/copilot-instructions.md", desc: "全局约束与规范挂载", color: "#f3f0ff", border: "#845ef7" },
    { name: "通用 AI / Root Rules", file: "AGENTS.md", desc: "核心加载顺序 0→5 & 双环协议", color: "#ebfbee", border: "#51cf66" }
  ];
  agents.forEach((ag, i) => {
    const cardX = 60 + i * 315;
    const cardY = l1Y + 35;
    els.push(rect({ x: cardX, y: cardY, width: 295, height: 75, backgroundColor: ag.color, strokeColor: ag.border, strokeWidth: 1.5 }));
    els.push(text({ x: cardX + 12, y: cardY + 8, text: ag.name, fontSize: 15, strokeColor: "#1e1e1e", width: 270, height: 20 }));
    els.push(text({ x: cardX + 12, y: cardY + 30, text: `📄 ${ag.file}`, fontSize: 13, strokeColor: "#495057", width: 270, height: 18 }));
    els.push(text({ x: cardX + 12, y: cardY + 50, text: ag.desc, fontSize: 12, strokeColor: "#868e96", width: 270, height: 16 }));
  });

  // Layer 2: 配置中心与预设编排
  const l2Y = 245;
  els.push(rect({ x: 40, y: l2Y, width: 1320, height: 110, backgroundColor: "#fff9db", strokeColor: "#fcc419", strokeWidth: 1.5 }));
  els.push(text({ x: 55, y: l2Y + 10, text: "2. 配置中心与预设编排 (.harness/harness.yaml)", fontSize: 16, strokeColor: "#f08c00", width: 500, height: 20 }));

  const presets = [
    { id: "full-lifecycle", label: "🌟 full-lifecycle (全生命周期)", desc: "正式业务：需求→设计→任务→TDD→测试→交付", bg: "#ffffff" },
    { id: "testing-only", label: "🧪 testing-only (补测试)", desc: "老项目加固：禁改源码，提升单测覆盖率", bg: "#ffffff" },
    { id: "maintenance", label: "🛠️ maintenance (日常维护)", desc: "缺陷修复：关联 Bug-Ledger，PR 审查驱动", bg: "#ffffff" },
    { id: "quick-start", label: "⚡ quick-start (极速起步)", desc: "新项目冷启动：最小配置，仅基础命名规范", bg: "#ffffff" }
  ];
  presets.forEach((p, i) => {
    const pX = 60 + i * 315;
    const pY = l2Y + 38;
    els.push(rect({ x: pX, y: pY, width: 295, height: 62, backgroundColor: p.bg, strokeColor: "#fab005", strokeWidth: 1 }));
    els.push(text({ x: pX + 10, y: pY + 8, text: p.label, fontSize: 13, strokeColor: "#1e1e1e", width: 275, height: 18 }));
    els.push(text({ x: pX + 10, y: pY + 30, text: p.desc, fontSize: 11, strokeColor: "#495057", width: 275, height: 26 }));
  });

  // Layer 3: 三大核心插件柱
  const l3Y = 375;
  // Pillar 1: Rules
  els.push(rect({ x: 40, y: l3Y, width: 420, height: 250, backgroundColor: "#e7f5ff", strokeColor: "#339af0", strokeWidth: 1.5 }));
  els.push(text({ x: 55, y: l3Y + 12, text: "📦 规范插件 (plugins/rules/)", fontSize: 16, strokeColor: "#1864ab", width: 380, height: 22 }));
  const ruleCards = [
    { title: "naming-frontend.yaml", desc: "组件 PascalCase, Hook camelCase, 样式 kebab-case, BEM 规则" },
    { title: "react-patterns.yaml", desc: "提取 Hook 组合优于继承, 禁止直接操作 DOM / 派生状态滥用" },
    { title: "typescript-strict.yaml", desc: "Strict 模式, 禁止 any (用 unknown), 优先 Discriminated Unions" }
  ];
  ruleCards.forEach((rc, i) => {
    const rcY = l3Y + 45 + i * 62;
    els.push(rect({ x: 55, y: rcY, width: 390, height: 54, backgroundColor: "#ffffff", strokeColor: "#74c0fc", strokeWidth: 1 }));
    els.push(text({ x: 65, y: rcY + 6, text: rc.title, fontSize: 13, strokeColor: "#1864ab", width: 370, height: 18 }));
    els.push(text({ x: 65, y: rcY + 26, text: rc.desc, fontSize: 11, strokeColor: "#495057", width: 370, height: 22 }));
  });

  // Pillar 2: Process
  els.push(rect({ x: 490, y: l3Y, width: 420, height: 250, backgroundColor: "#ebfbee", strokeColor: "#51cf66", strokeWidth: 1.5 }));
  els.push(text({ x: 505, y: l3Y + 12, text: "⚙️ 流程插件 (plugins/process/)", fontSize: 16, strokeColor: "#2b8a3e", width: 380, height: 22 }));
  const processCards = [
    { title: "full-lifecycle.yaml", desc: "6 阶段生命周期: 需求→设计→任务→实现→测试→交付" },
    { title: "tdd-workflow.yaml", desc: "内环 RED-GREEN-REFACTOR + 外环人工审查 + 反馈转测试" },
    { title: "pr-review.yaml & testing-only.yaml", desc: "PR Checklist, 无 ticket TODO / console.log 拦截, 补测专线" }
  ];
  processCards.forEach((pc, i) => {
    const pcY = l3Y + 45 + i * 62;
    els.push(rect({ x: 505, y: pcY, width: 390, height: 54, backgroundColor: "#ffffff", strokeColor: "#8ce99a", strokeWidth: 1 }));
    els.push(text({ x: 515, y: pcY + 6, text: pc.title, fontSize: 13, strokeColor: "#2b8a3e", width: 370, height: 18 }));
    els.push(text({ x: 515, y: pcY + 26, text: pc.desc, fontSize: 11, strokeColor: "#495057", width: 370, height: 22 }));
  });

  // Pillar 3: Templates
  els.push(rect({ x: 940, y: l3Y, width: 420, height: 250, backgroundColor: "#f3f0ff", strokeColor: "#845ef7", strokeWidth: 1.5 }));
  els.push(text({ x: 955, y: l3Y + 12, text: "📑 模板插件 (plugins/templates/)", fontSize: 16, strokeColor: "#5f3dc4", width: 380, height: 22 }));
  const templateCards = [
    { title: "spec.md (需求规格模板)", desc: "业务背景、验收标准 (AC)、Figma 链接、影响面、非功能需求" },
    { title: "task-tdd.md (任务与测试规划)", desc: "测试用例清单 (RED 先行)、实现思路、影响分析、历史检查" },
    { title: "bug-entry.yaml (缺陷元数据)", desc: "症状、报错特征、根因分析、防范规则、复盘经验" }
  ];
  templateCards.forEach((tc, i) => {
    const tcY = l3Y + 45 + i * 62;
    els.push(rect({ x: 955, y: tcY, width: 390, height: 54, backgroundColor: "#ffffff", strokeColor: "#b197fc", strokeWidth: 1 }));
    els.push(text({ x: 965, y: tcY + 6, text: tc.title, fontSize: 13, strokeColor: "#5f3dc4", width: 370, height: 18 }));
    els.push(text({ x: 965, y: tcY + 26, text: tc.desc, fontSize: 11, strokeColor: "#495057", width: 370, height: 22 }));
  });

  // Layer 4: 项目记忆层
  const l4Y = 645;
  els.push(rect({ x: 40, y: l4Y, width: 1320, height: 195, backgroundColor: "#fff4e6", strokeColor: "#ff922b", strokeWidth: 1.5 }));
  els.push(text({ x: 55, y: l4Y + 10, text: "3. 活知识与项目记忆中枢 (.harness/project/) —— AI 上下文精准供给", fontSize: 16, strokeColor: "#d9480f", width: 800, height: 22 }));

  const projectAssets = [
    { name: "profile.yaml", title: "项目元数据 & 环境", desc: "技术栈、语言、包管理、平台、标准命令 (dev/test/lint/build)" },
    { name: "architecture.yaml", title: "架构与模块边界", desc: "模块划分、职责、依赖方向 (UI->Domain->Infra)、公开 API" },
    { name: "bug-ledger.yaml", title: "缺陷知识账本", desc: "历史 Bug、根因分析、预防规则、复盘教训（编码前必读）" },
    { name: "gotchas.yaml", title: "框架/环境暗坑", desc: "常见陷阱、错误与正确代码模式对比 (如 useEffect 清理)" },
    { name: "decisions.yaml", title: "架构决策记录 (ADR)", desc: "技术选型决策背景、原因、否决备选方案、预期影响" },
    { name: "dev-notes.yaml", title: "开发与环境备忘", desc: "环境冲突、临时配置、迁移注意事项等开发实战记录" }
  ];
  projectAssets.forEach((pa, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const paX = 60 + col * 425;
    const paY = l4Y + 38 + row * 72;
    els.push(rect({ x: paX, y: paY, width: 405, height: 62, backgroundColor: "#ffffff", strokeColor: "#ffa94d", strokeWidth: 1 }));
    els.push(text({ x: paX + 10, y: paY + 6, text: `📌 ${pa.name} - ${pa.title}`, fontSize: 13, strokeColor: "#d9480f", width: 385, height: 18 }));
    els.push(text({ x: paX + 10, y: paY + 28, text: pa.desc, fontSize: 11, strokeColor: "#495057", width: 385, height: 26 }));
  });

  // Layer 5: 运行时执行空间与自动化质量门禁
  const l5Y = 860;
  // Left: WIP Workspace
  els.push(rect({ x: 40, y: l5Y, width: 640, height: 230, backgroundColor: "#f8f9fa", strokeColor: "#495057", strokeWidth: 1.5 }));
  els.push(text({ x: 55, y: l5Y + 12, text: "4. 任务执行与状态流转空间 (docs/wip/<task-id>/)", fontSize: 16, strokeColor: "#212529", width: 550, height: 22 }));

  const wipFiles = [
    { name: "init-task.mjs", desc: "脚手架：node .harness/scripts/init-task.mjs JIRA-101 一键初始化工作区" },
    { name: ".state.yaml", desc: "任务状态机：phase (requirements/design/impl/testing/review), 审查轮次" },
    { name: "spec.md & tasks.md", desc: "从模板派生，承载本任务具体的 AC、TDD 测试清单、影响面分析" },
    { name: "test-plan.md & changelog.md", desc: "记录完整测试用例集、人工拒绝记录与版本修改时间线" }
  ];
  wipFiles.forEach((wf, i) => {
    const wfY = l5Y + 42 + i * 44;
    els.push(rect({ x: 55, y: wfY, width: 610, height: 38, backgroundColor: "#ffffff", strokeColor: "#ced4da", strokeWidth: 1 }));
    els.push(text({ x: 65, y: wfY + 4, text: `📁 ${wf.name}`, fontSize: 12, strokeColor: "#1e1e1e", width: 170, height: 16 }));
    els.push(text({ x: 235, y: wfY + 4, text: wf.desc, fontSize: 11, strokeColor: "#495057", width: 420, height: 28 }));
  });

  // Right: Automated Quality Guardrails
  els.push(rect({ x: 700, y: l5Y, width: 660, height: 230, backgroundColor: "#fff5f5", strokeColor: "#ff6b6b", strokeWidth: 1.5 }));
  els.push(text({ x: 715, y: l5Y + 12, text: "5. 自动化质量防线与门禁引擎 (Quality Guardrails)", fontSize: 16, strokeColor: "#c92a2a", width: 580, height: 22 }));

  const guardrails = [
    { name: "check.mjs 静态规则检查器", desc: "解析 harness.yaml，执行 filename / grep / file-exists / eslint-delegate 检查", badge: "CLI / CI" },
    { name: "pre-commit.sh Git 拦截钩子", desc: "提交前强制触发: 1. node check.mjs -> 2. 执行 profile.yaml 中的 lint & test", badge: "Git Hook" },
    { name: "ESLint / TypeScript 规则代理", desc: "将 naming-convention, exhaustive-deps, strict 等规范桥接至原生 linter", badge: "Compiler" },
    { name: "PR 审查自动化模式检查", desc: "扫描 console.log、无 Ticket 的 TODO 注释、破坏性更新文档标注", badge: "PR Guard" }
  ];
  guardrails.forEach((gr, i) => {
    const grY = l5Y + 42 + i * 44;
    els.push(rect({ x: 715, y: grY, width: 630, height: 38, backgroundColor: "#ffffff", strokeColor: "#ffc9c9", strokeWidth: 1 }));
    els.push(text({ x: 725, y: grY + 4, text: `🛡️ ${gr.name}`, fontSize: 12, strokeColor: "#c92a2a", width: 220, height: 16 }));
    els.push(text({ x: 955, y: grY + 4, text: gr.desc, fontSize: 11, strokeColor: "#495057", width: 380, height: 28 }));
  });

  // Connecting Arrows
  els.push(arrow({ startX: 700, startY: 225, endX: 700, endY: 245, strokeColor: "#1971c2", strokeWidth: 2 }));
  els.push(arrow({ startX: 700, startY: 355, endX: 700, endY: 375, strokeColor: "#fab005", strokeWidth: 2 }));
  els.push(arrow({ startX: 700, startY: 625, endX: 700, endY: 645, strokeColor: "#51cf66", strokeWidth: 2 }));
  els.push(arrow({ startX: 700, startY: 840, endX: 700, endY: 860, strokeColor: "#ff922b", strokeWidth: 2 }));

  return els;
}

// ========================================================================
// Diagram 2: ACLH 双环验证机制与全生命周期工作流
// ========================================================================
function buildDiagram2() {
  const els = [];

  // Title Banner
  els.push(rect({ x: 40, y: 30, width: 1340, height: 65, backgroundColor: "#2b8a3e", strokeColor: "#237032", strokeWidth: 2 }));
  els.push(text({ x: 60, y: 45, text: "ACLH 双环验证机制 (Dual-Loop) 与全生命周期流转状态机", fontSize: 24, strokeColor: "#ffffff", width: 850, height: 35 }));
  els.push(text({ x: 940, y: 52, text: "内环机器 TDD 极速迭代 · 外环人工审查知识闭环", fontSize: 15, strokeColor: "#d3f9d8", width: 420, height: 25 }));

  // Section 1: 六阶段主生命周期流水线
  const l1Y = 115;
  els.push(rect({ x: 40, y: l1Y, width: 1340, height: 145, backgroundColor: "#f8f9fa", strokeColor: "#adb5bd", strokeWidth: 1 }));
  els.push(text({ x: 55, y: l1Y + 10, text: "一、全生命周期阶段流转 (full-lifecycle.yaml 六阶段状态机与门禁)", fontSize: 15, strokeColor: "#343a40", width: 600, height: 20 }));

  const phases = [
    { num: "01", name: "需求 (Requirements)", entry: "Jira 工单存在", exit: "spec.md 完成", color: "#e7f5ff", border: "#339af0" },
    { num: "02", name: "设计 (Design)", entry: "Spec 评审通过", exit: "Figma & 组件拆解", color: "#fff4e6", border: "#ff922b" },
    { num: "03", name: "任务拆解 (Task)", entry: "设计已批准", exit: "TDD 测试卡/影响分析", color: "#f3f0ff", border: "#845ef7" },
    { num: "04", name: "编码实现 (Implement)", entry: "任务已拆解", exit: "测试/Lint 全绿", color: "#ebfbee", border: "#51cf66" },
    { num: "05", name: "测试验证 (Testing)", entry: "功能实现完成", exit: "覆盖率达标/人工通过", color: "#fff9db", border: "#fcc419" },
    { num: "06", name: "交付上线 (Delivery)", entry: "测试验收完成", exit: "PR 合并/Bug账本归档", color: "#e6fcf5", border: "#20c997" }
  ];

  phases.forEach((ph, i) => {
    const phX = 55 + i * 220;
    const phY = l1Y + 38;
    els.push(rect({ x: phX, y: phY, width: 210, height: 95, backgroundColor: ph.color, strokeColor: ph.border, strokeWidth: 1.5 }));
    els.push(text({ x: phX + 8, y: phY + 6, text: `Phase ${ph.num}: ${ph.name}`, fontSize: 13, strokeColor: "#1e1e1e", width: 195, height: 18 }));
    els.push(text({ x: phX + 8, y: phY + 30, text: `▶ Entry: ${ph.entry}`, fontSize: 11, strokeColor: "#495057", width: 195, height: 16 }));
    els.push(text({ x: phX + 8, y: phY + 52, text: `✔ Exit: ${ph.exit}`, fontSize: 11, strokeColor: "#2b8a3e", width: 195, height: 16 }));
    els.push(text({ x: phX + 8, y: phY + 74, text: `⚡ 门禁已配置`, fontSize: 10, strokeColor: "#868e96", width: 195, height: 14 }));

    if (i < phases.length - 1) {
      els.push(arrow({ startX: phX + 210, startY: phY + 47, endX: phX + 220, endY: phY + 47, strokeColor: "#868e96", strokeWidth: 2 }));
    }
  });

  // Section 2: 双环驱动模型
  const l2Y = 280;
  els.push(rect({ x: 40, y: l2Y, width: 1340, height: 750, backgroundColor: "#ffffff", strokeColor: "#212529", strokeWidth: 2 }));
  els.push(text({ x: 60, y: l2Y + 15, text: "二、核心引擎：双环验证驱动机制 (Dual-Loop Engine: Inner TDD Loop + Outer Human Review Loop)", fontSize: 18, strokeColor: "#212529", width: 900, height: 25 }));

  // Inner Loop Container
  const inX = 65;
  const inY = l2Y + 55;
  const inW = 580;
  const inH = 660;
  els.push(rect({ x: inX, y: inY, width: inW, height: inH, backgroundColor: "#f8f9fa", strokeColor: "#1971c2", strokeWidth: 2 }));
  els.push(rect({ x: inX, y: inY, width: inW, height: 40, backgroundColor: "#1971c2", strokeColor: "#1971c2", strokeWidth: 1 }));
  els.push(text({ x: inX + 15, y: inY + 10, text: "⚡ 内环 (Inner Loop) —— 机器验证与 TDD 极速循环 (AI 自闭环)", fontSize: 16, strokeColor: "#ffffff", width: 550, height: 22 }));

  // Step 0: 查阅知识
  els.push(rect({ x: inX + 20, y: inY + 55, width: 540, height: 60, backgroundColor: "#fff4e6", strokeColor: "#ff922b", strokeWidth: 1.5 }));
  els.push(text({ x: inX + 30, y: inY + 62, text: "Step 0: 编码前防御检查 (Pre-check)", fontSize: 14, strokeColor: "#d9480f", width: 500, height: 18 }));
  els.push(text({ x: inX + 30, y: inY + 84, text: "检索 bug-ledger.yaml 历史 Bug 与 gotchas.yaml 框架避坑指南", fontSize: 12, strokeColor: "#495057", width: 520, height: 16 }));

  // Step 1: RED
  els.push(rect({ x: inX + 20, y: inY + 135, width: 540, height: 85, backgroundColor: "#ffe3e3", strokeColor: "#fa5252", strokeWidth: 2 }));
  els.push(text({ x: inX + 30, y: inY + 142, text: "🔴 阶段 1: RED (编写失败的测试用例)", fontSize: 15, strokeColor: "#c92a2a", width: 500, height: 20 }));
  els.push(text({ x: inX + 30, y: inY + 165, text: "• 动作: 在写业务代码前先写测试用例 (tasks.md / *.test.ts)", fontSize: 12, strokeColor: "#1e1e1e", width: 520, height: 16 }));
  els.push(text({ x: inX + 30, y: inY + 185, text: "• 门禁: 测试必须且仅能因【功能尚未实现】而失败", fontSize: 12, strokeColor: "#c92a2a", width: 520, height: 16 }));

  // Step 2: GREEN
  els.push(rect({ x: inX + 20, y: inY + 240, width: 540, height: 85, backgroundColor: "#d3f9d8", strokeColor: "#40c057", strokeWidth: 2 }));
  els.push(text({ x: inX + 30, y: inY + 247, text: "🟢 阶段 2: GREEN (编写最简实现代码)", fontSize: 15, strokeColor: "#2b8a3e", width: 500, height: 20 }));
  els.push(text({ x: inX + 30, y: inY + 270, text: "• 动作: 编写刚好能让失败测试转绿的最简业务逻辑", fontSize: 12, strokeColor: "#1e1e1e", width: 520, height: 16 }));
  els.push(text({ x: inX + 30, y: inY + 290, text: "• 门禁: 严禁为了让测试通过而回过头篡改测试用例！", fontSize: 12, strokeColor: "#2b8a3e", width: 520, height: 16 }));

  // Step 3: REFACTOR
  els.push(rect({ x: inX + 20, y: inY + 345, width: 540, height: 85, backgroundColor: "#e7f5ff", strokeColor: "#339af0", strokeWidth: 2 }));
  els.push(text({ x: inX + 30, y: inY + 352, text: "🔵 阶段 3: REFACTOR (重构与架构优化)", fontSize: 15, strokeColor: "#1864ab", width: 500, height: 20 }));
  els.push(text({ x: inX + 30, y: inY + 375, text: "• 动作: 消除重复代码、抽取 Custom Hooks、对齐设计模式", fontSize: 12, strokeColor: "#1e1e1e", width: 520, height: 16 }));
  els.push(text({ x: inX + 30, y: inY + 395, text: "• 门禁: 测试总数不得减少，所有测试必须全部保持绿色", fontSize: 12, strokeColor: "#1864ab", width: 520, height: 16 }));

  // Step 4: Machine Verification
  els.push(rect({ x: inX + 20, y: inY + 450, width: 540, height: 80, backgroundColor: "#f1f3f5", strokeColor: "#868e96", strokeWidth: 1.5 }));
  els.push(text({ x: inX + 30, y: inY + 457, text: "🤖 阶段 4: 机器自动门禁验证 (Automated Checks)", fontSize: 14, strokeColor: "#343a40", width: 500, height: 18 }));
  els.push(text({ x: inX + 30, y: inY + 480, text: "• 运行 node .harness/scripts/check.mjs (文件名、Grep 正则、禁例)", fontSize: 12, strokeColor: "#495057", width: 520, height: 16 }));
  els.push(text({ x: inX + 30, y: inY + 500, text: "• 运行 npm test & npm run lint 确保编译与单测 100% 通过", fontSize: 12, strokeColor: "#495057", width: 520, height: 16 }));

  // Inner loop cycle arrows
  els.push(arrow({ startX: inX + 290, startY: inY + 115, endX: inX + 290, endY: inY + 135, strokeColor: "#fa5252", strokeWidth: 2 }));
  els.push(arrow({ startX: inX + 290, startY: inY + 220, endX: inX + 290, endY: inY + 240, strokeColor: "#40c057", strokeWidth: 2 }));
  els.push(arrow({ startX: inX + 290, startY: inY + 325, endX: inX + 290, endY: inY + 345, strokeColor: "#339af0", strokeWidth: 2 }));
  els.push(arrow({ startX: inX + 290, startY: inY + 430, endX: inX + 290, endY: inY + 450, strokeColor: "#495057", strokeWidth: 2 }));

  // Arrow from Inner Loop to Outer Loop
  els.push(arrow({ startX: inX + 560, startY: inY + 490, endX: inX + 615, endY: inY + 490, strokeColor: "#845ef7", strokeWidth: 3 }));
  els.push(text({ x: inX + 565, y: inY + 465, text: "内环全绿\n提交审查", fontSize: 11, strokeColor: "#5f3dc4", width: 60, height: 26 }));

  // Outer Loop Container (Right)
  const outX = 680;
  const outY = l2Y + 55;
  const outW = 675;
  const outH = 660;
  els.push(rect({ x: outX, y: outY, width: outW, height: outH, backgroundColor: "#fbf9ff", strokeColor: "#7048e8", strokeWidth: 2 }));
  els.push(rect({ x: outX, y: outY, width: outW, height: 40, backgroundColor: "#7048e8", strokeColor: "#7048e8", strokeWidth: 1 }));
  els.push(text({ x: outX + 15, y: outY + 10, text: "👥 外环 (Outer Loop) —— 人工代码审查与知识资产沉淀闭环", fontSize: 16, strokeColor: "#ffffff", width: 640, height: 22 }));

  // Step 1: Submit
  els.push(rect({ x: outX + 20, y: outY + 55, width: 635, height: 60, backgroundColor: "#ffffff", strokeColor: "#9775fa", strokeWidth: 1.5 }));
  els.push(text({ x: outX + 30, y: outY + 62, text: "Step 1: SUBMIT (向人类工程师呈现方案与成果)", fontSize: 14, strokeColor: "#5f3dc4", width: 600, height: 18 }));
  els.push(text({ x: outX + 30, y: outY + 84, text: "提交完整 Diff、单测通过记录、修改日志 changelog.md 供人工审阅", fontSize: 12, strokeColor: "#495057", width: 600, height: 16 }));

  // Pass / Reject
  els.push(rect({ x: outX + 20, y: outY + 130, width: 305, height: 90, backgroundColor: "#ebfbee", strokeColor: "#40c057", strokeWidth: 2 }));
  els.push(text({ x: outX + 30, y: outY + 138, text: "✅ 审查通过 (Pass)", fontSize: 14, strokeColor: "#2b8a3e", width: 280, height: 18 }));
  els.push(text({ x: outX + 30, y: outY + 160, text: "• 标记 .state.yaml 为 complete\n• 推进至交付 (Delivery) 阶段\n• 合并 PR 并清理 WIP 空间", fontSize: 11, strokeColor: "#1e1e1e", width: 285, height: 50 }));

  els.push(rect({ x: outX + 350, y: outY + 130, width: 305, height: 90, backgroundColor: "#fff5f5", strokeColor: "#fa5252", strokeWidth: 2 }));
  els.push(text({ x: outX + 360, y: outY + 138, text: "❌ 审查拒绝 (Reject)", fontSize: 14, strokeColor: "#c92a2a", width: 280, height: 18 }));
  els.push(text({ x: outX + 360, y: outY + 160, text: "• 触发 Human Feedback 协议\n• 严禁直接改代码实现！\n• 必须先将意见转为测试", fontSize: 11, strokeColor: "#c92a2a", width: 285, height: 50 }));

  // Human Feedback Protocol
  const hfX = outX + 20;
  const hfY = outY + 235;
  els.push(rect({ x: hfX, y: hfY, width: 635, height: 260, backgroundColor: "#fff9db", strokeColor: "#fab005", strokeWidth: 2 }));
  els.push(text({ x: hfX + 15, y: hfY + 10, text: "📋 人工反馈修复协议 (Human Feedback Protocol 6 步闭环)", fontSize: 15, strokeColor: "#f08c00", width: 600, height: 20 }));

  const hfSteps = [
    { num: "1", text: "记录反馈: 在 tasks.md 记录 Review 意见与轮次", color: "#1e1e1e" },
    { num: "2", text: "转为测试: 将人类反馈的问题编写为一个失败测试 (RED)", color: "#c92a2a" },
    { num: "3", text: "确认失败: 验证测试确实因人类指出的问题而挂掉", color: "#c92a2a" },
    { num: "4", text: "修复实现: 编写业务代码让该测试变绿 (GREEN)", color: "#2b8a3e" },
    { num: "5", text: "自动沉淀: 写入 bug-ledger.yaml（经验回流）", color: "#d9480f" },
    { num: "6", text: "重新提交: 更新 changelog.md 并重新提交审查", color: "#5f3dc4" }
  ];
  hfSteps.forEach((s, i) => {
    const sRow = Math.floor(i / 2);
    const sCol = i % 2;
    const sX = hfX + 15 + sCol * 305;
    const sY = hfY + 38 + sRow * 68;
    els.push(rect({ x: sX, y: sY, width: 295, height: 58, backgroundColor: "#ffffff", strokeColor: "#ffd43b", strokeWidth: 1 }));
    els.push(text({ x: sX + 10, y: sY + 6, text: `Step ${s.num}:`, fontSize: 13, strokeColor: s.color, width: 60, height: 16 }));
    els.push(text({ x: sX + 65, y: sY + 6, text: s.text, fontSize: 11, strokeColor: "#1e1e1e", width: 220, height: 46 }));
  });

  // Bug Ledger Integration
  const blX = outX + 20;
  const blY = outY + 510;
  els.push(rect({ x: blX, y: blY, width: 635, height: 125, backgroundColor: "#ffe8cc", strokeColor: "#fd7e14", strokeWidth: 2 }));
  els.push(text({ x: blX + 15, y: blY + 10, text: "🧠 知识资产持续进化：Bug Ledger 经验回流闭环", fontSize: 15, strokeColor: "#d9480f", width: 600, height: 20 }));
  els.push(text({ x: blX + 15, y: blY + 35, text: "每一次人工 Reject 并修复成功，都会自动沉淀一条 Bug 知识条目到 bug-ledger.yaml：", fontSize: 12, strokeColor: "#495057", width: 600, height: 18 }));
  els.push(text({ x: blX + 25, y: blY + 58, text: "• 记录字段: symptom (现象) → root_cause (根因) → prevention_rule (防范规则) → lesson (教训)", fontSize: 11, strokeColor: "#1e1e1e", width: 590, height: 18 }));
  els.push(text({ x: blX + 25, y: blY + 80, text: "• 经验反哺: 未来所有任务在【内环 Step 0】执行前强制读取，彻底避免 AI 犯重复错误！", fontSize: 11, strokeColor: "#d9480f", width: 590, height: 18 }));

  // Outer loop arrows
  els.push(arrow({ startX: outX + 172, startY: outY + 115, endX: outX + 172, endY: outY + 130, strokeColor: "#40c057", strokeWidth: 2 }));
  els.push(arrow({ startX: outX + 502, startY: outY + 115, endX: outX + 502, endY: outY + 130, strokeColor: "#fa5252", strokeWidth: 2 }));
  els.push(arrow({ startX: outX + 502, startY: outY + 220, endX: outX + 502, endY: outY + 235, strokeColor: "#fab005", strokeWidth: 2 }));
  els.push(arrow({ startX: outX + 337, startY: hfY + 260, endX: outX + 337, endY: blY, strokeColor: "#fd7e14", strokeWidth: 2 }));

  // Feedback loop back to Inner Loop
  els.push(arrow({
    startX: blX,
    startY: blY + 60,
    endX: inX + 560,
    endY: inY + 80,
    points: [[0, 0], [-30, 0], [-30, -420], [-80, -420]],
    strokeColor: "#fd7e14",
    strokeWidth: 2.5,
    strokeStyle: "dashed"
  }));
  els.push(text({ x: inX + 540, y: inY + 30, text: "知识回流\n反哺内环", fontSize: 11, strokeColor: "#d9480f", width: 60, height: 26 }));

  return els;
}

// ========================================================================
// Diagram 3: ACLH 上下文加载协议与知识飞轮数据流
// ========================================================================
function buildDiagram3() {
  const els = [];

  // Title Banner
  els.push(rect({ x: 40, y: 30, width: 1340, height: 65, backgroundColor: "#e8590c", strokeColor: "#d9480f", strokeWidth: 2 }));
  els.push(text({ x: 60, y: 45, text: "ACLH AI 上下文加载协议 (Context Pipeline) 与知识飞轮数据流", fontSize: 24, strokeColor: "#ffffff", width: 850, height: 35 }));
  els.push(text({ x: 930, y: 52, text: "严格 6 步阅读协议 · 任务执行 · 历史经验自我进化", fontSize: 15, strokeColor: "#ffe8cc", width: 430, height: 25 }));

  // Part 1: 阅读协议流水线 (0 -> 5)
  const l1Y = 115;
  els.push(rect({ x: 40, y: l1Y, width: 1340, height: 290, backgroundColor: "#f8f9fa", strokeColor: "#adb5bd", strokeWidth: 1.5 }));
  els.push(text({ x: 55, y: l1Y + 12, text: "一、AI 代理初始上下文加载流水线 (AGENTS.md 强制约束的 0 → 5 阅读顺序)", fontSize: 16, strokeColor: "#212529", width: 800, height: 22 }));

  const readSteps = [
    { step: "Step 0", title: "配置与预设解析", file: ".harness/harness.yaml", desc: "解析 preset 或 plugins\n确定激活的规则、流程、模板", bg: "#e7f5ff", border: "#339af0", textCol: "#1864ab" },
    { step: "Step 1", title: "项目基座与架构", file: "profile.yaml + architecture.yaml", desc: "技术栈、Node 版本、标准命令\n(dev/test/lint)、模块边界\n与依赖方向", bg: "#ebfbee", border: "#51cf66", textCol: "#2b8a3e" },
    { step: "Step 2", title: "历史经验资产", file: "bug-ledger.yaml + gotchas.yaml", desc: "历史踩坑、根因与防范规则\n框架代码禁忌、ADR 决策", bg: "#fff4e6", border: "#ff922b", textCol: "#d9480f" },
    { step: "Step 3", title: "编码规范挂载", file: ".harness/plugins/rules/*.yaml", desc: "仅挂载激活插件：\n命名(naming)、React 模式、\nTS 严格模式等细则", bg: "#f3f0ff", border: "#845ef7", textCol: "#5f3dc4" },
    { step: "Step 4", title: "流程与门禁挂载", file: ".harness/plugins/process/*.yaml", desc: "TDD 双环工作流、PR 清单\n阶段准入 / 准出门禁", bg: "#fff9db", border: "#fcc419", textCol: "#f08c00" },
    { step: "Step 5", title: "标准化任务模板", file: ".harness/plugins/templates/*", desc: "spec.md（需求）\ntask-tdd.md（任务卡）\nbug-entry.yaml（缺陷）蓝本", bg: "#e6fcf5", border: "#20c997", textCol: "#0ca678" }
  ];
  readSteps.forEach((rs, i) => {
    const rsX = 55 + i * 220;
    const rsY = l1Y + 45;
    els.push(rect({ x: rsX, y: rsY, width: 210, height: 230, backgroundColor: rs.bg, strokeColor: rs.border, strokeWidth: 1.5 }));
    els.push(rect({ x: rsX, y: rsY, width: 210, height: 32, backgroundColor: rs.border, strokeColor: rs.border, strokeWidth: 1 }));
    els.push(text({ x: rsX + 10, y: rsY + 6, text: `${rs.step}: ${rs.title}`, fontSize: 13, strokeColor: "#ffffff", width: 190, height: 18 }));
    els.push(text({ x: rsX + 10, y: rsY + 40, text: `📄 ${rs.file}`, fontSize: 11, strokeColor: rs.textCol, width: 190, height: 28 }));
    els.push(text({ x: rsX + 10, y: rsY + 75, text: rs.desc, fontSize: 11, strokeColor: "#495057", width: 190, height: 140 }));

    if (i < readSteps.length - 1) {
      els.push(arrow({ startX: rsX + 210, startY: rsY + 115, endX: rsX + 220, endY: rsY + 115, strokeColor: "#868e96", strokeWidth: 2 }));
    }
  });

  // Part 2: 任务生命周期与知识飞轮
  const l2Y = 425;
  els.push(rect({ x: 40, y: l2Y, width: 1340, height: 490, backgroundColor: "#ffffff", strokeColor: "#212529", strokeWidth: 2 }));
  els.push(text({ x: 55, y: l2Y + 12, text: "二、知识飞轮闭环机制 (Knowledge Flywheel: 从任务生成到历史沉淀的自进化流向)", fontSize: 16, strokeColor: "#212529", width: 850, height: 22 }));

  // Node 1: Task Init
  const n1X = 65;
  const n1Y = l2Y + 50;
  els.push(rect({ x: n1X, y: n1Y, width: 280, height: 180, backgroundColor: "#e7f5ff", strokeColor: "#339af0", strokeWidth: 1.5 }));
  els.push(text({ x: n1X + 12, y: n1Y + 10, text: "1. 任务创建 (Init Task)", fontSize: 15, strokeColor: "#1864ab", width: 255, height: 20 }));
  els.push(text({ x: n1X + 12, y: n1Y + 36, text: "• node init-task.mjs JIRA-X\n• 自动生成 docs/wip/JIRA-X/\n  - .state.yaml (状态追踪)\n  - spec.md (需求契约)\n  - tasks.md (TDD 任务清单)\n  - test-plan.md & changelog.md", fontSize: 11, strokeColor: "#1e1e1e", width: 255, height: 130 }));

  // Node 2: TDD Inner Loop
  const n2X = 390;
  const n2Y = l2Y + 50;
  els.push(rect({ x: n2X, y: n2Y, width: 290, height: 180, backgroundColor: "#ebfbee", strokeColor: "#51cf66", strokeWidth: 1.5 }));
  els.push(text({ x: n2X + 12, y: n2Y + 10, text: "2. 内环 TDD 实现与自测", fontSize: 15, strokeColor: "#2b8a3e", width: 265, height: 20 }));
  els.push(text({ x: n2X + 12, y: n2Y + 36, text: "• 查阅 bug-ledger / gotchas 防御\n• RED: 编写挂掉的单测\n• GREEN: 最小化实现业务逻辑\n• REFACTOR: 结构优化/保持全绿\n• 运行 check.mjs 静态规则自检", fontSize: 11, strokeColor: "#1e1e1e", width: 265, height: 130 }));

  // Node 3: Guardrails
  const n3X = 725;
  const n3Y = l2Y + 50;
  els.push(rect({ x: n3X, y: n3Y, width: 290, height: 180, backgroundColor: "#fff5f5", strokeColor: "#ff6b6b", strokeWidth: 1.5 }));
  els.push(text({ x: n3X + 12, y: n3Y + 10, text: "3. 门禁拦截 (Guardrails)", fontSize: 15, strokeColor: "#c92a2a", width: 265, height: 20 }));
  els.push(text({ x: n3X + 12, y: n3Y + 36, text: "• pre-commit.sh 强制拦截:\n  1) node check.mjs (文件名/Grep)\n  2) npm run lint (静态代码规范)\n  3) npm test (全量自动化单测)\n• 拦截未通过禁止生成 Commit", fontSize: 11, strokeColor: "#1e1e1e", width: 265, height: 130 }));

  // Node 4: Human Review
  const n4X = 1060;
  const n4Y = l2Y + 50;
  els.push(rect({ x: n4X, y: n4Y, width: 295, height: 180, backgroundColor: "#f3f0ff", strokeColor: "#845ef7", strokeWidth: 1.5 }));
  els.push(text({ x: n4X + 12, y: n4Y + 10, text: "4. 外环审查 (Human Review)", fontSize: 15, strokeColor: "#5f3dc4", width: 270, height: 20 }));
  els.push(text({ x: n4X + 12, y: n4Y + 36, text: "• 提交 Diff 与测试报告\n• 人工审查业务逻辑与架构对齐\n• PASS: 推进至交付上线\n• REJECT: 触发反馈转化协议\n  (必须先转为失败测试再修复)", fontSize: 11, strokeColor: "#1e1e1e", width: 270, height: 130 }));

  // Flow Arrows between Top 4 Nodes
  els.push(arrow({ startX: n1X + 280, startY: n1Y + 90, endX: n2X, endY: n2Y + 90, strokeColor: "#339af0", strokeWidth: 2 }));
  els.push(arrow({ startX: n2X + 290, startY: n2Y + 90, endX: n3X, endY: n3Y + 90, strokeColor: "#51cf66", strokeWidth: 2 }));
  els.push(arrow({ startX: n3X + 290, startY: n3Y + 90, endX: n4X, endY: n4Y + 90, strokeColor: "#ff6b6b", strokeWidth: 2 }));

  // Bottom: Knowledge Hub
  const fnX = 200;
  const fnY = l2Y + 270;
  const fnW = 980;
  const fnH = 180;
  els.push(rect({ x: fnX, y: fnY, width: fnW, height: fnH, backgroundColor: "#fff4e6", strokeColor: "#ff922b", strokeWidth: 2 }));
  els.push(text({ x: fnX + 20, y: fnY + 12, text: "🔄 知识飞轮：缺陷与经验沉淀中枢 (Knowledge Evolution Hub)", fontSize: 16, strokeColor: "#d9480f", width: 900, height: 22 }));

  const hubAssets = [
    { title: "Bug Ledger 知识累积", desc: "每次 Reject 修复后自动记录：\nsymptom → root_cause →\nprevention_rule → lesson", color: "#d9480f" },
    { title: "Gotchas 暗坑库补充", desc: "框架坑、异步陷阱沉淀为\n正反代码示例\n(wrong vs correct)", color: "#d9480f" },
    { title: "ADR 决策与备忘录更新", desc: "选型更新 decisions.yaml\n环境 / 依赖调整记入\ndev-notes.yaml", color: "#d9480f" }
  ];
  hubAssets.forEach((ha, i) => {
    const haX = fnX + 20 + i * 315;
    const haY = fnY + 45;
    els.push(rect({ x: haX, y: haY, width: 300, height: 115, backgroundColor: "#ffffff", strokeColor: "#ffd8a8", strokeWidth: 1 }));
    els.push(text({ x: haX + 10, y: haY + 8, text: `📚 ${ha.title}`, fontSize: 13, strokeColor: ha.color, width: 280, height: 18 }));
    els.push(text({ x: haX + 10, y: haY + 32, text: ha.desc, fontSize: 11, strokeColor: "#495057", width: 280, height: 75 }));
  });

  // Human Review Reject -> Knowledge Hub
  els.push(arrow({
    startX: n4X + 150,
    startY: n4Y + 180,
    endX: fnX + 800,
    endY: fnY,
    points: [[0, 0], [0, 40], [-250, 40], [-250, 90]],
    strokeColor: "#845ef7",
    strokeWidth: 2
  }));
  els.push(text({ x: n4X - 120, y: n4Y + 195, text: "Reject 修复后自动沉淀", fontSize: 11, strokeColor: "#845ef7", width: 140, height: 18 }));

  // Knowledge Hub -> Back to Context Loading (Flywheel)
  els.push(arrow({
    startX: fnX,
    startY: fnY + 90,
    endX: 160,
    endY: l1Y + 275,
    points: [[0, 0], [-130, 0], [-130, -300], [-30, -300]],
    strokeColor: "#e8590c",
    strokeWidth: 3,
    strokeStyle: "dashed"
  }));
  els.push(text({ x: 50, y: l2Y + 280, text: "🌟 经验反哺\n下次任务自动加载\nAI 不再犯同类错误", fontSize: 11, strokeColor: "#d9480f", width: 130, height: 45 }));

  return els;
}

// ========================================================================
// Diagram 4 (NEW): 插件化组织体系与预设装配逻辑
// ========================================================================
function buildDiagram4() {
  const els = [];

  // Title Banner
  els.push(rect({ x: 40, y: 30, width: 1320, height: 64, backgroundColor: "#5f3dc4", strokeColor: "#4c2fa8", strokeWidth: 2 }));
  els.push(text({ x: 60, y: 44, text: "ACLH 插件化组织体系与预设装配逻辑 (Plugin Taxonomy & Preset Assembly)", fontSize: 23, strokeColor: "#ffffff", width: 950, height: 35 }));
  els.push(text({ x: 900, y: 52, text: "每一个 YAML/MD 都是插件 · 预设决定装配哪些插件", fontSize: 14, strokeColor: "#d0bfff", width: 450, height: 22 }));

  // ------------- Section A: 三大插件族 -------------
  const aY = 110;
  els.push(rect({ x: 40, y: aY, width: 1320, height: 340, backgroundColor: "#f8f9fa", strokeColor: "#adb5bd", strokeWidth: 1.5, strokeStyle: "dashed" }));
  els.push(text({ x: 55, y: aY + 12, text: "一、插件分类体系：规则 · 流程 · 模板 三大插件族 (.harness/plugins/)", fontSize: 16, strokeColor: "#212529", width: 800, height: 22 }));

  // Pillar 1: rules
  const rX = 55, rY = aY + 55, rW = 410, rH = 270;
  els.push(rect({ x: rX, y: rY, width: rW, height: rH, backgroundColor: "#e7f5ff", strokeColor: "#339af0", strokeWidth: 1.5 }));
  els.push(rect({ x: rX, y: rY, width: rW, height: 30, backgroundColor: "#339af0", strokeColor: "#339af0", strokeWidth: 1 }));
  els.push(text({ x: rX + 10, y: rY + 6, text: "📦 规则插件 rules/ —— 定义“怎么做”", fontSize: 14, strokeColor: "#ffffff", width: 380, height: 18 }));
  const rCards = [
    { t: "naming-frontend.yaml", d: "命名规范（文件/组件/Hook/BEM）→ filename-pattern 校验" },
    { t: "react-patterns.yaml", d: "推荐 vs 禁止模式（DOM 操作/派生状态）→ eslint-delegate" },
    { t: "typescript-strict.yaml", d: "strict 编译、禁 any、Discriminated Unions → tsc/eslint" }
  ];
  rCards.forEach((c, i) => {
    const cy = rY + 38 + i * 58;
    els.push(rect({ x: rX + 12, y: cy, width: rW - 24, height: 50, backgroundColor: "#ffffff", strokeColor: "#74c0fc", strokeWidth: 1 }));
    els.push(text({ x: rX + 20, y: cy + 4, text: c.t, fontSize: 12, strokeColor: "#1864ab", width: rW - 40, height: 16 }));
    els.push(text({ x: rX + 20, y: cy + 24, text: c.d, fontSize: 10, strokeColor: "#495057", width: rW - 40, height: 22 }));
  });

  // Pillar 2: process
  const pX = 495, pY = aY + 55, pW = 410, pH = 270;
  els.push(rect({ x: pX, y: pY, width: pW, height: pH, backgroundColor: "#ebfbee", strokeColor: "#51cf66", strokeWidth: 1.5 }));
  els.push(rect({ x: pX, y: pY, width: pW, height: 30, backgroundColor: "#51cf66", strokeColor: "#51cf66", strokeWidth: 1 }));
  els.push(text({ x: pX + 10, y: pY + 6, text: "⚙️ 流程插件 process/ —— 定义“走什么流程”", fontSize: 14, strokeColor: "#ffffff", width: 380, height: 18 }));
  const pCards = [
    { t: "full-lifecycle.yaml", d: "六阶段状态机，entry→constraints→exit 三级门禁" },
    { t: "tdd-workflow.yaml", d: "RED·GREEN·REFACTOR 内环 + 外环审查 + 禁改测试" },
    { t: "pr-review.yaml", d: "PR 清单 + console.log/无单 TODO 的 grep 扫描" },
    { t: "testing-only.yaml", d: "禁改源码，覆盖率 语句80% 分支70% 函数80%" }
  ];
  pCards.forEach((c, i) => {
    const cy = pY + 38 + i * 58;
    els.push(rect({ x: pX + 12, y: cy, width: pW - 24, height: 50, backgroundColor: "#ffffff", strokeColor: "#8ce99a", strokeWidth: 1 }));
    els.push(text({ x: pX + 20, y: cy + 4, text: c.t, fontSize: 12, strokeColor: "#2b8a3e", width: pW - 40, height: 16 }));
    els.push(text({ x: pX + 20, y: cy + 24, text: c.d, fontSize: 10, strokeColor: "#495057", width: pW - 40, height: 22 }));
  });

  // Pillar 3: templates
  const tX = 935, tY = aY + 55, tW = 410, tH = 270;
  els.push(rect({ x: tX, y: tY, width: tW, height: tH, backgroundColor: "#f3f0ff", strokeColor: "#845ef7", strokeWidth: 1.5 }));
  els.push(rect({ x: tX, y: tY, width: tW, height: 30, backgroundColor: "#845ef7", strokeColor: "#845ef7", strokeWidth: 1 }));
  els.push(text({ x: tX + 10, y: tY + 6, text: "📑 模板插件 templates/ —— 定义“产出什么”", fontSize: 14, strokeColor: "#ffffff", width: 380, height: 18 }));
  const tCards = [
    { t: "spec.md", d: "需求规格：背景 / 验收 AC / Figma / 影响面 / 非功能" },
    { t: "task-tdd.md", d: "RED 测试清单先行 → 实现思路 → 影响分析 → 审核表" },
    { t: "bug-entry.yaml", d: "缺陷元数据：symptom → root_cause → prevention → lesson" }
  ];
  tCards.forEach((c, i) => {
    const cy = tY + 38 + i * 58;
    els.push(rect({ x: tX + 12, y: cy, width: tW - 24, height: 50, backgroundColor: "#ffffff", strokeColor: "#b197fc", strokeWidth: 1 }));
    els.push(text({ x: tX + 20, y: cy + 4, text: c.t, fontSize: 12, strokeColor: "#5f3dc4", width: tW - 40, height: 16 }));
    els.push(text({ x: tX + 20, y: cy + 24, text: c.d, fontSize: 10, strokeColor: "#495057", width: tW - 40, height: 22 }));
  });

  // Footer note for Section A
  els.push(caption({ x: 55, y: aY + 335, text: "插件 = 单一文件 (YAML/MD)；规则与流程插件内嵌 checks，可被 check.mjs 引擎扫描执行", width: 1290, textAlign: "center" }));

  // ------------- Section B: 预设装配矩阵 -------------
  const bY = 470;
  els.push(rect({ x: 40, y: bY, width: 1320, height: 300, backgroundColor: "#fff9db", strokeColor: "#fcc419", strokeWidth: 1.5 }));
  els.push(text({ x: 55, y: bY + 12, text: "二、装配中心 harness.yaml：场景预设 → 组合出激活插件集 (Preset → Plugin Set)", fontSize: 16, strokeColor: "#f08c00", width: 850, height: 22 }));

  // Assembly rule strip
  els.push(rect({ x: 60, y: bY + 40, width: 1280, height: 46, backgroundColor: "#fff3bf", strokeColor: "#fab005", strokeWidth: 1.5 }));
  els.push(text({ x: 75, y: bY + 50, text: "装配规则：若 harness.yaml 显式声明 plugins:（手动组合）→ 完全覆盖 preset；否则用 preset 名展开 presets[preset] 中的组合", fontSize: 13, strokeColor: "#d9480f", width: 1240, height: 26 }));

  const presetCols = [
    {
      id: "full-lifecycle", icon: "🌟", color: "#1971c2", bg: "#e7f5ff",
      rows: [
        ["rules", "naming-frontend · react-patterns · typescript-strict"],
        ["process", "tdd-workflow · full-lifecycle · pr-review"],
        ["templates", "task-tdd · bug-entry · spec"],
        ["project", "全部 6 个知识资产"]
      ]
    },
    {
      id: "testing-only", icon: "🧪", color: "#2b8a3e", bg: "#ebfbee",
      rows: [
        ["rules", "typescript-strict"],
        ["process", "testing-only"],
        ["templates", "task-tdd"],
        ["project", "profile · architecture · gotchas"]
      ]
    },
    {
      id: "maintenance", icon: "🛠️", color: "#d9480f", bg: "#fff4e6",
      rows: [
        ["rules", "naming-frontend · typescript-strict"],
        ["process", "pr-review"],
        ["templates", "bug-entry"],
        ["project", "profile · bug-ledger · gotchas · dev-notes"]
      ]
    },
    {
      id: "quick-start", icon: "⚡", color: "#5f3dc4", bg: "#f3f0ff",
      rows: [
        ["rules", "naming-frontend"],
        ["process", "—"],
        ["templates", "—"],
        ["project", "profile"]
      ]
    }
  ];
  presetCols.forEach((pc, i) => {
    const cx = 60 + i * 322;
    const cy = bY + 96;
    const cw = 306, ch = 195;
    els.push(rect({ x: cx, y: cy, width: cw, height: ch, backgroundColor: pc.bg, strokeColor: pc.color, strokeWidth: 1.5 }));
    els.push(text({ x: cx + 10, y: cy + 6, text: `${pc.icon} ${pc.id}`, fontSize: 14, strokeColor: pc.color, width: 280, height: 18 }));
    pc.rows.forEach((row, r) => {
      const ry = cy + 26 + r * 43;
      els.push(rect({ x: cx + 8, y: ry, width: cw - 16, height: 39, backgroundColor: "#ffffff", strokeColor: "#f1f3f5", strokeWidth: 1 }));
      els.push(text({ x: cx + 14, y: ry + 4, text: row[0], fontSize: 10, strokeColor: pc.color, width: 60, height: 14 }));
      els.push(text({ x: cx + 14, y: ry + 18, text: row[1], fontSize: 9, strokeColor: "#495057", width: cw - 28, height: 20 }));
    });
  });

  // ------------- Section C: 激活解析引擎 -------------
  const cY = 790;
  els.push(rect({ x: 40, y: cY, width: 1320, height: 170, backgroundColor: "#fff5f5", strokeColor: "#ff6b6b", strokeWidth: 1.5 }));
  els.push(text({ x: 55, y: cY + 12, text: "三、激活解析引擎：AI 如何知道该用哪些插件 (AGENTS.md Step 0 → check.mjs)", fontSize: 16, strokeColor: "#c92a2a", width: 900, height: 22 }));

  const flow = [
    { t: "读取 .harness/\nharness.yaml", d: "确定 preset 或 plugins", c: "#e7f5ff", b: "#339af0" },
    { t: "解析优先级\nplugins > preset", d: "手动组合完全覆盖预设", c: "#fff3bf", b: "#fab005" },
    { t: "展开激活插件集\n{rules, process, templates}", d: "按类别收集插件名", c: "#ebfbee", b: "#51cf66" },
    { t: "从 plugins/ 目录\n加载对应 YAML/MD", d: "只读加载激活项到上下文", c: "#f3f0ff", b: "#845ef7" },
    { t: "check.mjs 解析激活插件的\nchecks 并执行扫描", d: "filename / grep / file-exists", c: "#fff5f5", b: "#ff6b6b" },
    { t: "输出结果\nPASS / FAIL + 违规清单", d: "失败则阻断 commit (pre-commit)", c: "#e6fcf5", b: "#20c997" }
  ];
  const flowX0 = 55, flowW = 195, flowGap = 20, flowY = cY + 44, flowH = 105;
  flow.forEach((f, i) => {
    const fx = flowX0 + i * (flowW + flowGap);
    els.push(rect({ x: fx, y: flowY, width: flowW, height: flowH, backgroundColor: f.c, strokeColor: f.b, strokeWidth: 1.5 }));
    els.push(text({ x: fx + 8, y: flowY + 7, text: f.t, fontSize: 12, strokeColor: "#1e1e1e", width: flowW - 16, height: 44, textAlign: "center" }));
    els.push(text({ x: fx + 8, y: flowY + 54, text: f.d, fontSize: 10, strokeColor: "#495057", width: flowW - 16, height: 40, textAlign: "center" }));
    if (i < flow.length - 1) {
      els.push(arrow({ startX: fx + flowW, startY: flowY + 50, endX: fx + flowW + flowGap, endY: flowY + 50, strokeColor: "#868e96", strokeWidth: 2 }));
    }
  });

  els.push(caption({ x: 55, y: cY + 158, text: "同一套装配协议同时服务于：AI 上下文加载（AGENTS.md 0→5 阅读）与 本地静态校验（check.mjs 可执行）", width: 1290, textAlign: "center" }));

  return els;
}

// ========================================================================
// Diagram 5 (NEW): 设计逻辑：痛点 → 机制 → 支柱 → 端到端执行链路
// ========================================================================
function buildDiagram5() {
  const els = [];

  // Title Banner
  els.push(rect({ x: 40, y: 30, width: 1320, height: 64, backgroundColor: "#e8590c", strokeColor: "#d9480f", strokeWidth: 2 }));
  els.push(text({ x: 60, y: 44, text: "ACLH 设计逻辑：痛点驱动 → 机制回应 → 三大支柱 → 端到端执行链路", fontSize: 23, strokeColor: "#ffffff", width: 1000, height: 35 }));
  els.push(text({ x: 950, y: 52, text: "为什么这么设计 · 每个痛点都有对应的确定性机制", fontSize: 14, strokeColor: "#ffe8cc", width: 400, height: 22 }));

  // ------------- Section A: 痛点 (Pain Points) -------------
  const aX = 40, aY = 115, aW = 340, aH = 550;
  els.push(rect({ x: aX, y: aY, width: aW, height: aH, backgroundColor: "#fff5f5", strokeColor: "#ff6b6b", strokeWidth: 1.5 }));
  els.push(text({ x: aX + 12, y: aY + 10, text: "❌ 传统 AI 编码的五大痛点 (Pain Points)", fontSize: 15, strokeColor: "#c92a2a", width: 315, height: 20 }));

  const pains = [
    { t: "🧠 上下文失控 · Token 浪费", d: "AI 盲目扫描全仓库，注意力稀释\n(Lost in the Middle)" },
    { t: "🧱 缺乏架构边界约束", d: "倾向“能跑就行”，破坏分层与依赖方向" },
    { t: "🔁 重复踩坑 · 无长时记忆", d: "同一框架陷阱反复犯，无项目记忆" },
    { t: "🔄 测试与实现因果倒置", d: "先写实现后补测试，甚至篡改断言" },
    { t: "🚪 缺少确定性防线", d: "仅自然语言约束，无脚本/Git 钩子拦截" }
  ];
  pains.forEach((p, i) => {
    const py = aY + 38 + i * 100;
    els.push(rect({ x: aX + 12, y: py, width: aW - 24, height: 90, backgroundColor: "#ffffff", strokeColor: "#ffc9c9", strokeWidth: 1.5 }));
    els.push(text({ x: aX + 22, y: py + 8, text: p.t, fontSize: 13, strokeColor: "#c92a2a", width: aW - 44, height: 20 }));
    els.push(text({ x: aX + 22, y: py + 34, text: p.d, fontSize: 10.5, strokeColor: "#495057", width: aW - 44, height: 52 }));
  });

  // ------------- Section B: 机制回应 (Design Responses) -------------
  const bX = 430, bY = 115, bW = 380, bH = 550;
  els.push(rect({ x: bX, y: bY, width: bW, height: bH, backgroundColor: "#f1f8ff", strokeColor: "#1971c2", strokeWidth: 1.5 }));
  els.push(text({ x: bX + 12, y: bY + 10, text: "✅ 机制回应 (ACLH Design Responses)", fontSize: 15, strokeColor: "#1864ab", width: 355, height: 20 }));

  const resps = [
    { t: "📖 严格 0→5 阅读协议", d: "按序只读激活插件与项目资产，精准供给上下文", c: "#e7f5ff", b: "#339af0" },
    { t: "🗺️ 边界与命名规则", d: "目录规范 + architecture.yaml 依赖方向约束", c: "#e7f5ff", b: "#339af0" },
    { t: "🧠 项目记忆库前置检查", d: "bug-ledger / gotchas 编码前必读，防止重复犯错", c: "#fff4e6", b: "#ff922b" },
    { t: "🔴🟢🔵 TDD 双环铁律", d: "RED 先行 · 禁改测试 · 反馈必须先转测试再修复", c: "#ebfbee", b: "#51cf66" },
    { t: "🛡️ 三层物理门禁", d: "check.mjs + pre-commit + PR 清单三道拦截", c: "#fff5f5", b: "#ff6b6b" }
  ];
  resps.forEach((r, i) => {
    const ry = bY + 38 + i * 100;
    els.push(rect({ x: bX + 12, y: ry, width: bW - 24, height: 90, backgroundColor: r.c, strokeColor: r.b, strokeWidth: 1.5 }));
    els.push(text({ x: bX + 22, y: ry + 8, text: r.t, fontSize: 13, strokeColor: "#1e1e1e", width: bW - 44, height: 20 }));
    els.push(text({ x: bX + 22, y: ry + 34, text: r.d, fontSize: 10.5, strokeColor: "#343a40", width: bW - 44, height: 52 }));
  });

  // Pain -> Response mapping arrows
  pains.forEach((p, i) => {
    const py = aY + 38 + i * 100 + 45;
    els.push(arrow({ startX: aX + aW, startY: py, endX: bX, endY: py, strokeColor: "#fa5252", strokeWidth: 2, strokeStyle: "dashed" }));
  });

  // ------------- Section C: 三大支柱 (Pillars & Memory) -------------
  const cX = 860, cY = 115, cW = 500, cH = 550;
  els.push(rect({ x: cX, y: cY, width: cW, height: cH, backgroundColor: "#f8f9fa", strokeColor: "#495057", strokeWidth: 1.5 }));
  els.push(text({ x: cX + 12, y: cY + 10, text: "四大支柱：规则 · 流程 · 记忆 · 门禁 (Layering)", fontSize: 15, strokeColor: "#212529", width: 475, height: 20 }));

  const layers = [
    {
      t: "约束层 (Control)：规则 + 流程 + 模板", color: "#1864ab", bg: "#e7f5ff", b: "#339af0",
      d: "规范 + 流程 + 模板 —— 定义“怎么做、走什么流程、产出什么”"
    },
    {
      t: "记忆层 (Memory)：项目活知识库", color: "#d9480f", bg: "#fff4e6", b: "#ff922b",
      d: "六个知识资产：bug-ledger、gotchas、ADR 等，编码前强制读取"
    },
    {
      t: "门禁层 (Guardrails)：机器物理拦截", color: "#c92a2a", bg: "#fff5f5", b: "#ff6b6b",
      d: "check.mjs + pre-commit + lint/test + PR 清单 —— 违反规范即被拦截"
    }
  ];
  layers.forEach((l, i) => {
    const ly = cY + 40 + i * 165;
    els.push(rect({ x: cX + 14, y: ly, width: cW - 28, height: 150, backgroundColor: l.bg, strokeColor: l.b, strokeWidth: 1.5 }));
    els.push(text({ x: cX + 24, y: ly + 10, text: l.t, fontSize: 14, strokeColor: l.color, width: cW - 48, height: 20 }));
    els.push(text({ x: cX + 24, y: ly + 40, text: l.d, fontSize: 11, strokeColor: "#343a40", width: cW - 48, height: 95 }));
  });

  // Arrow from responses into pillars
  els.push(arrow({ startX: bX + bW, startY: bY + 270, endX: cX, endY: cY + 270, strokeColor: "#1971c2", strokeWidth: 2, strokeStyle: "dashed" }));

  // ------------- Section D: 端到端执行链路 -------------
  const dY = 690;
  els.push(rect({ x: 40, y: dY, width: 1320, height: 250, backgroundColor: "#ffffff", strokeColor: "#212529", strokeWidth: 1.5 }));
  els.push(text({ x: 55, y: dY + 12, text: "端到端执行链路 (End-to-End: Agent 启动 → 交付 → 知识沉淀)", fontSize: 15, strokeColor: "#212529", width: 700, height: 20 }));

  const steps = [
    { t: "🚀 Agent 启动", d: "读 AGENTS.md\n按 0→5 加载上下文", c: "#e7f5ff", b: "#339af0" },
    { t: "📁 init-task.mjs", d: "生成 docs/wip/JIRA-X\n任务空间 + 模板", c: "#ebfbee", b: "#51cf66" },
    { t: "🔄 内环 TDD", d: "RED→GREEN→REFACTOR\n知识前置检查 + 单测", c: "#f3f0ff", b: "#845ef7" },
    { t: "🔍 check.mjs", d: "静态自检\n文件名/Grep/存在性", c: "#fff5f5", b: "#ff6b6b" },
    { t: "🔒 pre-commit", d: "Git 钩子\nlint + test 强制全绿", c: "#fff9db", b: "#fcc419" },
    { t: "👥 外环审查", d: "人工 PR Review\n逻辑与架构把关", c: "#f8f9fa", b: "#adb5bd" },
    { t: "✅ 交付沉淀", d: "PR 合并 · WIP 清理\nbug-ledger 记账", c: "#e6fcf5", b: "#20c997" }
  ];
  const sX0 = 55, sW = 168, sGap = 16, sY = dY + 42, sH = 110;
  steps.forEach((s, i) => {
    const sx = sX0 + i * (sW + sGap);
    els.push(rect({ x: sx, y: sY, width: sW, height: sH, backgroundColor: s.c, strokeColor: s.b, strokeWidth: 1.5 }));
    els.push(text({ x: sx + 6, y: sY + 8, text: s.t, fontSize: 12, strokeColor: "#1e1e1e", width: sW - 12, height: 20, textAlign: "center" }));
    els.push(text({ x: sx + 6, y: sY + 34, text: s.d, fontSize: 9.5, strokeColor: "#495057", width: sW - 12, height: 66, textAlign: "center" }));
    if (i < steps.length - 1) {
      els.push(arrow({ startX: sx + sW, startY: sY + 55, endX: sx + sW + sGap, endY: sY + 55, strokeColor: "#868e96", strokeWidth: 2 }));
    }
  });

  // Reject return loop: 外环审查 → 内环 TDD (沿底部回绕)
  const reviewBottomX = 55 + 5 * (sW + sGap) + sW / 2;         // 1059 (审查卡底部中心)
  const tddBottomX = 55 + 2 * (sW + sGap) + sW / 2;            // 507  (TDD 卡底部中心)
  els.push(arrow({
    startX: reviewBottomX,
    startY: sY + sH,
    endX: tddBottomX,
    endY: sY + sH,
    points: [[0, 0], [0, 22], [-(reviewBottomX - tddBottomX), 22], [-(reviewBottomX - tddBottomX), 0]],
    strokeColor: "#fa5252",
    strokeWidth: 2.5,
    strokeStyle: "dashed"
  }));
  els.push(text({ x: 580, y: dY + 174, text: "❌ 审查拒绝：反馈先转为失败测试 → 修复 → 重新提交（严禁直接改实现）", fontSize: 10.5, strokeColor: "#c92a2a", width: 500, height: 16, textAlign: "center" }));

  els.push(caption({ x: 55, y: dY + 205, text: "四个入口文档 (Cursor / Claude / Copilot / AGENTS.md) → 同一套装配与双环轨道；任何 Agent 进入都走同一条受约束的流水线", width: 1290, textAlign: "center" }));
  els.push(caption({ x: 55, y: dY + 228, text: "循环不变量：内环保测试全绿守恒 · 外环保架构与业务正确 · 知识飞轮保经验永续累积", width: 1290, textAlign: "center" }));

  return els;
}

// ========================================================================
// Execution & Write to Files
// ========================================================================
const outputDir = path.resolve('docs/diagrams');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const diagrams = [
  { file: '01-aclh-system-architecture.excalidraw', elements: buildDiagram1() },
  { file: '02-aclh-dual-loop-workflow.excalidraw', elements: buildDiagram2() },
  { file: '03-aclh-context-knowledge-flywheel.excalidraw', elements: buildDiagram3() },
  { file: '04-aclh-plugin-preset-composition.excalidraw', elements: buildDiagram4() },
  { file: '05-aclh-design-logic-e2e-chain.excalidraw', elements: buildDiagram5() }
];

for (const d of diagrams) {
  const filePath = path.join(outputDir, d.file);
  fs.writeFileSync(filePath, createExcalidrawFile(d.elements));
  console.log(`Generated: ${filePath} (${d.elements.length} elements)`);
}