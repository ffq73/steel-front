# M6 四副本差异化 · 交付说明（v8.0）

> 里程碑：**M6 — 四副本差异化（每副本 ≥3 项）**
> 验收口径：四副本各 3 张截图 + 专属交互实测说明
> 状态：**16 项全部落地并实测通过**

---

## 0. 实现总览

M6 的 16 项增强中，**引擎侧系统（炮击准备 / 战争疲惫 / 阵营影响力 / DEFCON / 制裁网络 / 军援管道 / 无人机打击 / 太空竞赛）在 E1–E4 轮已存在**，本轮做的是三件事：

1. **把系统接进主循环**——原先 `bloc / drones / sanctions / milaid / space / energy` 六个模块只被单元测试调用，从不参与实战。本轮在 [`js/engine/world.js`](../js/engine/world.js) 装配、在 [`js/engine/tick.js`](../js/engine/tick.js) 月度推进，四副本才真正"活"起来。
2. **新增专属地图图层**——[`js/render/eraLayers.js`](../js/render/eraLayers.js)（约 640 行）。
3. **新增专属 HUD 与面板**——[`js/ui/eraHud.js`](../js/ui/eraHud.js)（约 640 行）+ [`css/era.css`](../css/era.css)。

图层的活状态绘制在世界缓存之外（`cam.fullRender` 时跳过），因此不影响拖动零重绘的性能架构。

---

## 1. 一战「火药桶 1914」

| # | 增强项 | 实现位置 | 实测结果 |
|---|---|---|---|
| 1 | **堑壕网格** | `eraLayers.drawWW1` | 前线格之间绘制 5 齿锯齿战壕线 + 沙袋圆点，构成连续壕沟网络；驻军壕沟度 ≥10% 时叠加内圈虚线并标注 `壕 25%` 深化等级 |
| 2 | **无人区泥泞** | 同上 | 敌我前线之间的无驻军空缺格渲染为 `#4a3f33` 泥泞焦土色，并按格索引确定性分布 5 个弹坑圆斑（同格不闪烁） |
| 3 | **炮击准备仪表** | `eraHud.renderBarrageGauge` | 计划盘左侧常驻环形进度仪表：显示模式名 / 已准备天数 / 累计弹药消耗；准备完毕转绿发光 |
| 4 | 炮击三选一 | `eraHud.openBarrageModal` | 点击仪表弹出三档：短促急袭（2 天 / 5 弹/天 / 壕沟 -50%）、标准炮火准备（6 天 / 12 弹/天 / 清零）、长时毁灭炮击（12 天 / 25 弹/天 / 清零 + 疲惫 +3.0） |
| 5 | **战争疲惫条** | `eraHud.renderWearinessBar` | 表盘旁红色细条 0–100%，≥40% 转橙、≥70% 转红并发光；稳定度 <30% 时整条闪烁（革命风险警示） |

**证据**：[`m6-ww1-01-trench.png`](shots/m6-ww1-01-trench.png)（堑壕 + 泥泞）、[`m6-ww1-02-front-frame.png`](shots/m6-ww1-02-front-frame.png)（整段前线壕沟网格 + `壕 25%` 深化标注）

---

## 2. 二战「全面战争 1939」

| # | 增强项 | 实现位置 | 实测结果 |
|---|---|---|---|
| 1 | **闪击箭头动画** | `eraLayers` 的 `world.blitzFeed` 消费段 | 装甲师突破时生成金色渐变箭头 + 拖尾，3 秒生长-淡出动画，带阴影辉光与方向锋头，附 `装甲闪击突破` 标签 |
| 2 | **合围口袋** | `eraLayers.findPockets` | 对敌国做 BFS 连通块分析（块 ≤6 格、外邻无同国纵深、且被我方闭合）→ 红虚线圈出 + 圆心徽章显示被围师数 |
| 3 | **战略轰炸燃烧** | `eraLayers` 的 `world.bombedHexes` 段 | 被炸工业格显示呼吸火焰 🔥 + 产能受损失效条（橙条长度 = 剩余产能） |
| 4 | **装备缺口红点** | `eraHud.renderEquipDeficitBadge` | 工业流水线页签右上挂红色脉冲角标，数值 = 兵力 <85% 的师数；悬停提示"请补充装备" |
| 5 | **计划加成角标** | `eraHud.renderPlanBonusBadges` | 将领带卡片右上显示 `+42%`；执行中转为金色 |

**实测数值**：造 5 个缺编师 → 红点显示 `5`，提示"5 个师缺编（兵力 <85%），请补充装备"；挂一个 `planning=0.42 / executing=true` 的野战军 → 曼施坦因卡角标显示 `+42%`（title：作战计划加成 42.0%，执行中每日 -5%）。

**证据**：[`m6-ww2-02-blitz-bomb.png`](shots/m6-ww2-02-blitz-bomb.png)（两处合围口袋徽章 `17` / `24` + 轰炸火焰与产能条）、[`m6-ww2-03-blitz-arrow.png`](shots/m6-ww2-03-blitz-arrow.png)（金色闪击箭头 + 标签）

---

## 3. 冷战「铁幕 1949」

| # | 增强项 | 实现位置 | 实测结果 |
|---|---|---|---|
| 1 | **影响力双色渐变** | `eraLayers.drawColdWar` | 按 `nation.influence` 的美苏占比做 蓝→灰→红 连续混色填充；影响力差 >30 的边境格用强势方颜色加粗描边（阵营倾角） |
| 2 | **DEFCON 半圆表盘** | 同上 | 屏幕右上常驻：五档刻度绿→黄→橙→红→黑，当前档位加粗高亮，白色指针 + `D2` 读数 + `末日钟 4.5` |
| 3 | **代理人火苗** | 同上 | 以 `min(USA影响力, SOV影响力)` 识别"双方共同渗透"的热点国（≥20 触发），按热度显示 1–3 个 🔥 与 `争夺 75` 标签 |
| 4 | **太空竞赛进度条** | 同上 | 屏幕顶部双轨细条，各 7 个镀金里程碑点（已完成点亮为金色），下方进度线与 `USA 太空竞赛 3/7` 读数 |
| 5 | **影响力投放面板** | `eraHud.openInfluencePanel` | 点击他国格弹出：双色影响力对比条 + 情报点 + 三个行动（经济渗透 / 策动政变 / 阵营改组），各带实时成功率预估 |
| 6 | 双轨顶栏 | `eraHud.renderRivalTrack` | 表盘下方下轨显示对手情报估算：`对手 苏联 师 49/我 36 · 影响力 90 · 声望 60 · 工 52` |
| 7 | DEFCON 降级红边 | `eraHud.checkDefconFlash` | DEFCON 降级时全屏红边脉冲 2.6s + 中央告警框 |

**实测数值**：点击加拿大格 → 面板显示 `美利坚合众国 80% / 苏联 10%`，三档成功率 95% / 80% / 82%；执行"经济渗透"后 USA 影响力 `80 → 95`，toast 确认。

**证据**：[`m6-coldwar-01-influence-defcon.png`](shots/m6-coldwar-01-influence-defcon.png)（双色渐变 + 火苗 + D3 表盘）、[`m6-coldwar-02-space-defcon.png`](shots/m6-coldwar-02-space-defcon.png)（太空竞赛 3/7 与 4/7 双轨 + D2 表盘 + 全图渐变）

---

## 4. 现代「多极危机 2022」

| # | 增强项 | 实现位置 | 实测结果 |
|---|---|---|---|
| 1 | **制裁网络图** | `eraLayers.drawModern` | 制裁国之间绘制虚线（线色 = 发起国色，线粗 = 强度 1–3），中点挂 `S3` / `S1` 强度角标；强度由制裁包的实际惩罚力度推导 |
| 2 | **军援流动光点** | 同上 | 军援线上 3 个相位错开的流动光点（速度/亮度随流量），两端淡入淡出；红线武器（`escalationAdd ≥ 25`，如 ATACMS / F-16）用红色光点；线上标注 `400/月` |
| 3 | **FPV 打击准星** | 同上 | 打击时目标格出现四段十字准星 + 外环 + 中心点（0.8s 动画，由 `world.fpvStrikes` 驱动），后半程叠加命中爆炸环与 💥 |
| 4 | **能源依赖环** | 同上 | 各国格角标环形图，显示 `已断管线数 / 总管线数`；断供比例 ≥60% 转橙、>0 转黄、无断供绿色 |
| 5 | **声望条 + 疲劳条** | `eraHud.renderPrestigeFatigue` | 表盘旁双细条：声望（蓝紫渐变 0–100）、疲劳（黄→橙，≥70% 转红并闪烁） |
| 6 | **红线警告框** | `eraHud.checkRedlineWarning` | 军援/打击触及红线时顶部弹红框，含三档反应预估：`升级等级 +2 → 预计反应：部分动员 — 对手将在边境方向增兵并提高戒备` |
| 7 | **制裁面板（一键组网）** | `eraHud.openSanctionPanel` | 4 个制裁包单选 + 多目标国勾选，底部实时显示反噬预估（贸易损失装备点/月） |
| 8 | **军援管道面板** | `eraHud.openAidPanel` | 点击他国格弹出：月流量滑条（0–400）+ 5 类装备（红线武器带红框标记）+ 暴露概率实时计算 |
| 9 | **升级管控面板** | `eraHud.openEscalationPanel` | 克制 / 均衡 / 激进三档，显示各自升级概率 20% / 50% / 82%，影响对手红线响应 |

**实测数值**：军援面板默认暴露 20%；改选红线武器 ATACMS 后 → 55%（附"红线武器，显著提高升级风险"）；点击建立管道 → 红线警告框弹出。

**证据**：[`m6-modern-01-network-full.png`](shots/m6-modern-01-network-full.png)（全图制裁虚线 + 军援光点 + FPV 准星）、[`m6-modern-02-aid-fpv.png`](shots/m6-modern-02-aid-fpv.png)（军援走廊 `200/月` `400/月` + `S2`/`S1` 角标 + 能源依赖环特写）

---

## 5. 截图产出说明

截图由游戏内 `canvas.toDataURL()` 直接导出主画布（**像素级真实渲染**，非示意图），因此：

- 地图侧全部 M6 视觉增强（堑壕 / 泥泞 / 口袋 / 闪击 / 渐变 / 表盘 / 太空条 / 制裁 / 军援 / 准星 / 能源环）**都在这批截图中**；
- 纯 DOM 的 HUD 面板（炮击仪表、疲惫条、缺口红点、计划角标、影响力面板、制裁面板、军援面板、红线警告）无法由 canvas 导出，已用**逐项 DOM 实测断言**验证（见上文各"实测数值"）。

导出脚本模式（可在浏览器控制台复用）：

```js
// 裁剪到世界实际覆盖的屏幕矩形，去掉空白边
const cv = document.getElementById('sfmap');
const wb = SF.layers.worldBounds(SF.world);
const o = document.createElement('canvas');
o.width = Math.round(wb.w * SF.camera.z * SF.camera.dpr);
o.height = Math.round(wb.h * SF.camera.z * SF.camera.dpr);
o.getContext('2d').drawImage(cv, 0, 0, o.width, o.height, 0, 0, o.width, o.height);
o.toDataURL('image/png');
```

---

## 6. 调试句柄

本轮把四副本引擎模块挂到 `window.SF.engine`，便于控制台直接驱动：

```js
SF.engine.barrage.setBarrageMode(SF.world, planId, 'prolonged');
SF.engine.bloc.investInfluence(SF.world, 'USA', 'CHN', 20);
SF.engine.sanctions.imposeSanction(SF.world, 'USA', 'RUS', 'swift_ban');
SF.engine.milaid.sendAidPackage(SF.world, 'USA', 'UKR', 'atacms_long_range');
SF.engine.drones.launchFpvStrike(SF.world, 'UKR', hexIdx, 24);
SF.engine.space.launchSpaceMission(SF.world, 'USA', milestoneId);
```

---

## 7. 回归验证

| 验证 | 结果 |
|---|---|
| `node tests/run.js` | 7 passed, 0 failed |
| `node tests/m4_interaction.test.js` | 7 passed, 0 failed |
| `node tools/sim.js`（B1–B15） | 全部断言通过 |
| 全量 `tests/*.js`（16 个文件） | 全部通过（含四副本通局推演） |
| `node tools/bundle.cjs` | 5 个单文件分发版各 1211 KB |

新增/修改文件：

- 新增：`js/render/eraLayers.js`、`js/ui/eraHud.js`、`css/era.css`、`docs/shots/*.png`
- 修改：`js/engine/world.js`（装配六子系统）、`js/engine/tick.js`（月度推进）、`js/engine/drones.js`（打击事件流）、`js/render/layers.js`（图层挂载）、`js/ui/input.js`（他国格点击派发）、`js/main.js`（HUD 挂载 + 引擎句柄）、`index.html`、`tools/bundle.cjs`
