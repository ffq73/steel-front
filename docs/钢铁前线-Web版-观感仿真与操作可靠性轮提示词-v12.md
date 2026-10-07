# 钢铁前线 Web 版 · v12「观感 · 仿真 · 可靠性」综合施工提示词

> **UI 美观度优化 × 地图仿真度提升 × 玩家操作全流程模拟验收**
> 目标一句话：让游戏**好看、地图像真战场、每一个看得见的按钮都真的能用**——不允许任何
> 「系统装置失效」继续留在玩家手上。
>
> 本文档基于 2026-10 初的一轮**真人操作级模拟实测**（9 个批次、60+ 项交互逐一驱动）得出，
> 所有缺陷均带 `文件:行号` 与复现方式。先通读 §1 基线再动手，避免修坏已经验证通过的东西。

---

## 0. 你的角色与工作方式

你是本项目的**接手施工工程师**。项目是零依赖 Web 大战略游戏（《钢铁雄心》轻量版）：
原生 JS + Canvas 2D，ES Modules 开发、`tools/bundle.cjs` 压平打包成单文件 `file://` 可玩版。

- **先读后改**：每个任务块动手前，先读「文件地图」（附录 B）里列出的文件。
- **改哪测哪**：每完成一个任务块，跑对应验收并**给出实测数字**（不允许「应该可以了」）。
- **不做超出本文档的「顺手重构」**：本项目有严格的确定性引擎约束与打包自检，越界改动会连环炸。

---

## 1. 当前基线（先读！这里是你接手时的真实状态）

### 1.1 功能基线 —— 以下操作面已逐项实测**全部正常**，是回归红线，不许破坏

| # | 操作面 | 实测方式与结果 |
|---|---|---|
| 1 | 左侧抽屉 **10 个页签**（工业/招募/队列/空军/海军/情报/学说/贸易/统计/时代机制） | 逐个 `.click()`，全部激活且内容 ≥17 字符 |
| 2 | 顶栏弹窗 6 个（国策/统帅/编制/百科/存档/统计） | 全部打开；关闭按钮与 **ESC 均可关闭** |
| 3 | 速度控制 | `data-speed` 0~4 五档全部生效；空格暂停；`+/-` 加减速正常 |
| 4 | 地图鼠标手势 | 坐标级点击选格（命中首都 23,13）、右键下达 `advance` 命令、框选 11 个师、中键拖动平移、滚轮缩放 1.10→1.41 |
| 5 | 键盘 | X/Z/C/V/B/H/S/M/U/Tab/Del 全部有响应且 toast 语义正确 |
| 6 | 地图模式 F1–F10 | 10 档全部切换成功，F2–F10 图例条内容正常 |
| 7 | 存读档 | 存档写入 localStorage `steelfront.save.v2`；读档重载页面并恢复（day/units/player 一致） |
| 8 | 时代机制面板 | 渲染正常，二战分支的占领区治理法案单选钮在位 |
| 9 | 47 天战争推演 | 无崩溃、无未捕获异常；历史事件链正常触发（华沙陷落 → 西线假战） |
| 10 | 底部将领条 | 6 张将领卡正常渲染（见 §1.3 环境假象提醒） |

> 注意 #10：在 rAF 停摆的无头/后台环境里将领条会显示为空，那是**测试环境假象**，不是 bug。
> 验收时必须手动驱动帧（游戏暴露了 `SF.advanceFrame(ts)` 调试句柄）再断言。

### 1.2 已确认缺陷 —— 你的第一优先级，全部带定位

| 编号 | 严重度 | 缺陷 | 定位 | 复现/证据 |
|---|---|---|---|---|
| **D1** | P0 | **海洋被画成陆地色**：地形填充循环没有跳过 `terrain === 'sea'` 的格子，海格被套用平原系浮雕渐变并按 `owner==='N'` 打 0.60 alpha → 大洋呈灰绿浑色，**海陆一眼分不清**（实测截图 `docs/shots/v12_map_before.jpg`，波罗的海与丹麦几乎同色） | `js/render/layers.js` `drawTerrain()` 六角格循环（约 L178–243，`ctx.globalAlpha = hex.owner === 'N' ? 0.60 : 0.85` 在 **L213**） | 打开 ww2 剧本缩放到全图，看波罗的海/北海颜色 |
| **D2** | P0 | **X/Shift+X 自动选靶荒谬**：攻势线按「到 `w.hexes[w.hexes.length-1]`（地图最右下角一格）的距离」找最近敌城 → 德国 1939 年按 X，矛头指向**耶路撒冷**（实测 toast 原文） | `js/ui/input.js:551-557`（`nearCity` 以地图末格为基准）；同构逻辑还有一处 `js/ui/panels.js:148`（按格子枚举顺序取第一个敌国首都） | 开局按 X，观察 toast 与地图上的箭头 |
| **D3** | P1 | **地形对比度不足**：各地形 relief 渐变的明暗 stop 色过于接近，山脉/森林/丘陵/沼泽在成图上几乎不可辨（喀尔巴阡山、阿登森林看不出起伏） | `js/render/layers.js` `drawTerrain()` reliefGrad 各分支 + `js/data/terrain.js` 色板 | 全图查看东欧平原—喀尔巴阡—巴尔干 |
| **D4** | P1 | **国界与省界层级不分**：每个行省边都有同等权重的深色描边，加上政治色 0.36 alpha 覆盖 → 圈层糊成一片，国家边界反而不突出（国界霓虹发光代码已存在但被淹没） | `js/render/layers.js:636-664`（`drawnBorders` 去重的边界绘制，含「国界深黑立体剪影/国界所属国特色霓虹发光」） | 对照 `v12_map_before.jpg` 德波边界 |
| **D5** | P1 | **兵牌堆叠杂乱**：单格可堆 6 师（`K.STACK_LIMIT: 6`，`js/data/constants.js:30`），`draw3DNATOCounters`（`js/render/layers.js:1593`）逐师绘制计数器 → 柏林周边一格竖 5~6 块牌子 | 同上 | 战争爆发后看任何主战场 |
| **D6** | P2 | **城市无光晕**：城市格只有小圆点+星标，没有城区辉光与街区质感；首都与大城市无视觉分级差异 | `js/render/layers.js:1093` 起的城市地标分级渲染 | 看柏林/巴黎 vs 小城 |
| **D7** | P2 | **X 与 Z 的战区名未串联**：划线 toast 已带战区名（v11 已做），但 X 键攻势线 toast 不报战区名，玩家不知道箭头属于哪条线 | `js/ui/input.js:558-562` | 按 X 看 toast |

### 1.3 环境与工具约定（不遵守会浪费半天排查）

1. **开发服务器必须用 `py tools/devserver.py`**（多线程 + 零缓存，端口 8899）。单线程服务器会被几十个并发模块请求卡死。
2. **无头/后台浏览器里 rAF 可能停摆**（实测 800ms 0 帧）。此时：
   - 一切在 rAF 循环里的更新（HUD/将领条/警报条/渲染）都不会发生 —— **不是 bug**；
   - 驱动游戏用调试句柄：`window.SF = { world, store, camera, layers, ui, hudV8, engine, advanceFrame, fastForward, tickOnce, setMapModeByIndex }`；
   - **禁止用帧间隔测性能**（后台节流会给出 22ms 的假数字）。用同步循环测量：`fn(); t0=now(); for(i<n) fn()`。
3. **`tab.screenshot()` 在重页面上会超时**。取画面用页内导出：`document.getElementById('sfmap').toDataURL()`（画布太大时先 `drawImage` 缩到 ≤960 宽再导出，base64 分段取回）。
4. 纯数据视觉验收可用 `node tools/map_preview.cjs ww2`（sharp 栅格化全图）与 `node tools/atlas_view.cjs`（终端打印图层）。

### 1.4 架构与管线红线（v11 已固化，破坏即炸）

- **打包三道自检**（`tools/bundle.cjs`）：①ORDER 覆盖所有被 import 的模块；②`import * as X` 命名空间合成；③逐模块核对 `export` 顶层名在产物中有同名声明。**新增任何 js 文件必须登记进 ORDER**，否则自检 exit(1)。
- **引擎指纹**（`tests/provinces.test.js` 断言 7）：`js/engine/**` 的 md5 登记在 `tests/engine_manifest.json`。你若正当修改引擎，跑 `node tests/provinces.test.js --update-engine-manifest` **显式登记**——不登记就是测试失败。
- **发布三路径一体**：`node tools/release.cjs` 一次完成 dist 打包 → 同步中文发布目录 → 生成 zip → MD5 自检。交付前必须跑且看到「三者一致」。
- **测试全绿红线**：现有 **27 个测试文件**（23 单元 + 4 通局）必须全部通过，特别守护：`playable_nations`（选了它就得能玩）、`focus_trees`（国策接线）、`era_ops`（登陆/情报/海区）、`atlas_map`（图集几何+战区命名）。
- **确定性铁律**：`js/engine/**` 禁止 `Math.random()`/`Date.now()` 参与结算逻辑；视觉层允许。

---

## 2. 硬约束（延续既有 C1–C42，新增以下条款）

- **C43 地形渲染禁止给海格上陆色**：`terrain === 'sea'` 的格子不得进入陆地形填充路径（D1 的根因条款）。海洋观感由海洋地毯 + `drawSeaDepth` + 海岸高光共同负责。
- **C44 任何自动选靶必须以玩家视角度量**：进攻目标/防线/矛头的选取基准点只能是**玩家前线质心、玩家首都或指定将领位置**，禁止使用地图包围盒角落、格子枚举顺序等与玩家无关的基准（D2 根因）。
- **C45 视觉层级三分**：地图线条必须分三级权重——国界（最重）、省界（弱）、海岸（独立高光）；任何新描边先归级再画。
- **C46 每格计数器显示上限**：单格渲染的兵牌 ≤4 块，溢出合并为 `+N` 徽章；合并徽章可点击展开（或悬停下钻）。数据层不动，只动显示层。
- **C47 UI 控件零死区**：任何渲染出来的按钮/开关必须有真实行为（改状态/开面板/dispatch）；禁止 `alert()` 占位（项目内已清零，保持零）。
- **C48 观感改动必须双端一致**：源码（devserver）与 dist 单文件版的观感一致由 bundle 自检保证；CSS 一律写进 `css/style.css` 或 `css/tokens.css`，禁止内联样式块超过 5 行（时代面板等历史遗留逐步收敛，不要求本轮清零）。
- **C49 操作模拟回归**：交付前必须完整执行 §5 的 S2 模拟验收表并逐项给出通过证据；任何一项失败不得交付。

---

## 3. 任务块 A —— 地图仿真度（M1–M5）

> 总验收素材：`docs/shots/v12_map_before.jpg`（本轮实测基线）。你的成品必须与之对比给出前后图
> （`docs/shots/v12_map_after*.png`，用 §1.3-3 的页内导出法或 `tools/map_preview.cjs`）。

### M1 海洋修复与水体分层（修 D1）
- 地形填充循环**跳过海格**；海洋观感 = 海洋地毯渐变 + `drawSeaDepth` 深度晕 + 近岸浅水带（已有海岸高光代码，保留并微调）。
- 远海更深、近岸更浅：给 `drawSeaDepth` 增加按「到最近陆地的跳数」分 2~3 档的深度色（BFS 一次性预计算，缓存到 world 派生字段，**不入档**——参考 v10 的 SAVE_REPLACER 剥离名单，若挂到 hex 上必须同步剥离名单）。
- **验收**：全图截图中，海面与任意陆地色 ΔE 明显可分；波罗的海、地中海、黑海三处目视均为水体；`tests/atlas_map.test.js` 仍全绿。

### M2 地形色板与光照强化（修 D3）
- 重做 `TERRAIN` 色板（`js/data/terrain.js`）与 `drawTerrain` relief 渐变 stop 色，目标是在 0.36 alpha 政治色覆盖下仍能一眼区分五种地貌：
  - 平原：暖麦绿；森林：深针叶绿（含 M2 已有树冠细节，保留）；丘陵：赭黄；山地：冷灰 + 雪线（保留雪顶）；沼泽：浊绿；沙漠：沙金；城市：冷灰蓝。
- 保持既有 315° 西北斜照与省多边形 bevel 高光/背阴逻辑，只调强度参数，不推翻结构。
- **验收**：东欧平原—喀尔巴阡山—巴尔干山地一条纵剖线截图，三种地貌可辨；`tools/sim.js` B1–B15 仍全绿（地形系数没动，只动色板）。

### M3 边界层级重构（修 D4）
- 按附录 B 找到边界绘制段，实现三级：
  - **国界**：粗（≈2.2px@z1）深色剪影 + 所属国色的低强度霓虹（既有代码启用并调优）；
  - **省界**：细（≈0.8px）低对比，仅在缩放 z ≥ 1.0 时淡入（LOD）；
  - **海岸**：保持现有双层海浪高光。
- 政治色 alpha 从 0.36 微调至让地形透出但国家仍成块的值（建议 0.30~0.42 区间实测取优）。
- **验收**：德波国界在任何缩放级别都是图上最醒目的线；z<0.7 时省界近乎消失；帧耗时同步测量 ≤ v11 基线 +1.5ms。

### M4 城市光晕与城区质感（修 D6）
- 首都：暖色 radial glow（半径 ≈1.2 格）+ 城市格街区纹理（已有 `drawTerrainDetails` 的 city 分支，若无则补：3~5 个小矩形街区 + 中心广场）；
- 大城市（w≥3）：半径 ≈0.7 格弱光晕；小城不加。
- 光晕画在**归属层之后、计数器层之前**（层次：地形→政治→城市光晕→省名水印→兵牌）。
- **验收**：柏林/巴黎/莫斯科与随机小城对比截图；全图城市 ≤110 座，光晕绘制纳入地图缓存（不进每帧路径，确认 `drawTerrain`/`drawMapMode` 的缓存命中路径不因光晕变慢）。

### M5 兵牌堆叠收纳（修 D5）
- `draw3DNATOCounters`（L1593）内按格分组，每组只画前 4 块（按 hp+org 战力降序取前 4），其余并入 `+N` 徽章（徽章样式与现有 X2/X3 编制徽章一致的语言）。
- 悬停该格时（现有 tooltip 体系）列出全部师——数据已有，只补 tooltip 分支。
- **验收**：柏林周边堆叠格截图前后对比；点击/悬停下钻能列出被合并的师；战斗定位（点格选师）行为不变——`tests/m4_interaction.test.js` 7/7 仍绿。

---

## 4. 任务块 B —— UI 美观度（U1–U6）

> 原则：不推翻布局骨架（v9.5 已把顶栏/缎带/抽屉/底栏的位置定死并实测零溢出），做**质感与一致性**。
> 所有改动在 1600×900 与 1280×720 两档视口下检查。

### U1 弹窗标题栏统一
六个模态（`sf-focus-modal` / `sf-chars-modal` / `sf-designer-modal` / `sf-encyclopedia-modal` / `sf-save-modal` / `sf-stats-modal`）的 header 现在风格各异（有的有旗标有的没有、关闭按钮样式不一）。统一为一种 `modal-header` 语言：左侧旗标+标题+副题，右侧统一关闭钮（ESC 提示保留）；抽出公共 CSS 类，逐个 modal 收敛内联样式。
**验收**：六弹窗截图拼接对比；关闭按钮/ESC 在六个弹窗上行为一致（用 §5 批次 2 脚本复测）。

### U2 抽屉页签态强化
`sf-drawer-tab-btn` 的 active/hover 态对比度不足。active 态加左侧金色指示条 + 文字提亮；hover 态微亮底。宽度紧张时允许两行排布（页签是竖排抽屉顶部的横排钮组，实测当前单行放得下 10 个）。
**验收**：1600×900 与 1280×720 下 10 个页签均可见、无换行溢出（`scrollWidth ≤ clientWidth`）。

### U3 Toast 视觉统一
`showToast` 是全局唯一通道（v11 已把时代面板/情报面板的 alert 清零）。给 toast 加左侧类型色条（info 黄铜 / warn 橙 / bad 红）与入场动效（150ms），文案超长自动省略。
**验收**：触发 3 类 toast 的截图；`tests/no_emoji.test.js` 仍绿（toast 允许的图标沿用既有白名单规则）。

### U4 国策树节点四态更鲜明
`focus-node-card` 的 done/active/available/locked 四态目前只靠文字标签区分。加状态边框色 + 完成态金色勾角标 + 锁定态降低整体对比（active 保持现有脉冲）。**数据与交互不动**（点击调档案卡、签署、加速按钮都已在）。
**验收**：德国国策树打开后四种状态同屏可见的截图；`tests/focus_trees.test.js` 仍绿。

### U5 底部将领条质感
`sf-general-card` 加 hover 抬升（既有按钮 hover-lift 语言）与选中态金边；空槽「编组新军」卡弱化为虚线框。
**验收**：将领条 hover 前后截图；点击选中/再点调档案链路复测（§5 批次 9）。

### U6 图例条与比例尺观感
`sf-map-legend`（F2–F10 图例）与 `sf-map-scale` 做同语言玻璃底+金框；图例项间距统一 6px 栅格。
**验收**：F4 补给模式图例条截图；图例出现/消失不推挤地图画布（layout shift 为 0：切换模式前后 `getBoundingClientRect` 不变）。

---

## 5. 任务块 C —— 操作可靠性（S1–S4）

### S1 修复 D2 自动选靶（必做）
在 `js/engine/plans.js` 新增共享纯函数 `pickOffensiveTarget(world, kind)`（`'spearhead' | 'offensive'`）：
- 基准点 = 玩家前线格（与任一交战国相邻的己方格）质心；无前线则玩家首都；
- **主敌** = 与玩家共享边界格数最多的交战国；
- `spearhead`：主敌首都 → 退而求其次「距基准点最近的敌国首都」→ 再退「距基准点最近的敌国城市」→ 交战格；
- `offensive`：距基准点最近的敌国城市（忽略中立国城市——v11 已把锚点限定交战国，沿用该规则）；
- `input.js` 与 `panels.js` 两处调用点全部改走它（消灭两份漂移的副本逻辑）；
- toast 文案报出目标与战区名（顺带修 D7）。
**验收**：德国 ww2 开局按 X → toast 指向华沙/波兹南方向（不是耶路撒冷）；Shift+X → 直指华沙（波德边境最长）；对 `pickOffensiveTarget` 写 6 条断言进 `tests/era_ops.test.js` 或新文件（含：无交战国时返回 null 且 toast 提示、多敌国时选边境最长者、无首都国回退）。

### S2 玩家操作全流程模拟（回归表 = 交付门槛）
按下表逐批执行（页内 `evaluate` 驱动真实 DOM 事件；键盘事件必须带 `code`，鼠标事件必须带 `buttons`；先关掉 `#sf-brief` 简报遮罩）。**每批 0 失败才算通过**，结果表附进交付说明。

| 批次 | 操作 | 通过判据 |
|---|---|---|
| 1 | 依次点击 10 个抽屉页签 | 每页签激活且内容非空 |
| 2 | 开 6 个顶栏弹窗 → 关闭钮关一次、ESC 关一次 | 全部可开可关 |
| 3 | 五档速度钮 + 空格 + `+/-` | `SF.world.speed` 每步与预期一致 |
| 4 | 坐标级：左键选首都格；右键相邻己方格；右键相邻敌格 | `ui.selHex` 命中；`order.type` 为 advance/attack |
| 5 | 框选敌我接壤区；中键拖动；滚轮缩放 | `ui.selUnits.length>0`；相机位移；z 变化 |
| 6 | 键位 X/Z/C/V/B/H/S/M/U/Tab/Del | 每键有 toast 或状态变化，语义正确 |
| 7 | F1–F10 | 10 档切换成功 |
| 8 | 存档 → 读档 | localStorage 出键；读档后 day/units/player 恢复 |
| 9 | 时代面板点一个法案单选；右栏收展；帮助开/关；指标弹窗；国策快捷槽 | 全部有真实响应 |
| 10 | `SF.advanceFrame` 手动驱动 12 帧后检查 HUD | 将领条 6 卡、焦点文案、警报条均在刷新 |

### S3 静态零死区审计（防新增死按钮）
写 `tests/ui_wiring.test.js`（node 端，读源码文本即可）：
- 扫描 `index.html` 所有带 `id` 的 `<button>`：其 id 必须在 `js/` 内被 `addEventListener`/`onclick`/`querySelector` 绑定，或在白名单（`sf-load-btn` 类历史隐藏件）；
- 扫描 `js/ui/**/*.js` 里生成的 `data-*` 交互属性：必须有对应 `querySelectorAll` 绑定；
- 扫描全项目 `alert(`：必须为 0。
**验收**：测试通过；故意解绑一个按钮再跑，测试必须变红（自证有效）。

### S4 47 天战争 soak（稳定性）
`loadScenario('ww2')` 后连跑 47 天 `dayTick`（node 端即可，不必浏览器）：无未捕获异常、无 NaN 扩散（抽查 units/org/hp、nations/pp/stability）、`world.over` 可为真但不得抛错。
**验收**：附 console 摘录；`tests/test_ww2_playthrough.js` 保持全绿。

---

## 6. 任务块 D —— 性能守护（P1–P2）

- **P1**：M1–M5 全部只允许写进**地图缓存路径**（`drawTerrain`/`drawMapMode`，dirty 时才重绘）或低频路径；禁止把逐帧新计算塞进 `render()`/`drawUnitsLayer()`。改完后同步测量：`layers.render` ≤ 8ms（v11 基线 6.3ms + 余量）、地图缓存重建 ≤ 90ms（v11 基线 73.5ms）。
- **P2**：M1 的海深 BFS、M4 的城市光晕如需预计算，结果挂 `world` 派生字段时**必须同步进 `js/save.js` 的 SAVE_REPLACER 剥离名单**（前科：v10 循环引用导致全存档静默失败）。存档往返测试：存→读→再存，字节数差 <2%。

---

## 7. 验收与交付（全部满足才算完工）

1. §1.2 的 D1–D7 全部修复并逐条给出前后证据（截图/断言）；
2. §5 S2 十批模拟全过 + S3/S4 新测试入库；
3. 全量测试绿：`for t in tests/*.test.js tests/test_*playthrough.js; do node $t; done`（27 个文件）+ `node tools/sim.js`（B1–B15）+ `node tools/check_assets.cjs`（0 缺失）；
4. 若动了引擎：`node tests/provinces.test.js --update-engine-manifest` 已登记；
5. `node tools/bundle.cjs` 三道自检全过；新模块已登记 ORDER；
6. `node tools/release.cjs` 输出「dist / 发布目录 / zip 三者一致」；
7. 交付说明写入 `docs/v12_delivery.md`：前后对比图、模拟结果表、性能实测、已知未做。

---

## 附录 A：玩家操作模拟的技术要点（S2 落地用）

```js
// 统一驱动模板（页内 evaluate 内执行；每批一个调用，避免响应超时）
const map = document.getElementById('sfmap');
const rect = map.getBoundingClientRect();
const scr = (q, r) => { const p = SF.camera.toPix(q, r); return { x: rect.left + p.x, y: rect.top + p.y }; };
const mev = (type, x, y, button = 0, buttons = 1) => map.dispatchEvent(new MouseEvent(type,
  { bubbles: true, cancelable: true, clientX: x, clientY: y, button, buttons }));
const kev = (key, code) => document.dispatchEvent(new KeyboardEvent('keydown',
  { key, code, bubbles: true }));   // 键盘事件必须带 code（只发 key 会卡住 isSpaceDown 类状态）
// 坐标系：cam.toPix 返回画布逻辑坐标 + 画布在视口的 offset = 屏幕坐标
// 画布过大截图：先 drawImage 缩到 ≤960 宽再 toDataURL，base64 分段取回
```

## 附录 B：文件地图（改哪里）

| 要改什么 | 文件 |
|---|---|
| 地形/海洋/边界/城市渲染 | `js/render/layers.js`（drawTerrain ≈L127–300；边界 ≈L636–664；城市地标 ≈L1093+；计数器 ≈L1593+） |
| 地形色板与系数 | `js/data/terrain.js`（只动 color/name，atk/def 系数**不许动**——sim.js B 系断言依赖） |
| 自动选靶 | `js/engine/plans.js`（新增 pickOffensiveTarget）；调用点 `js/ui/input.js:551-557`、`js/ui/panels.js:148` |
| 弹窗/页签/toast/将领条样式 | `css/style.css`（追加 v12 段，cascade 覆盖，参照 v9.5/v10.1 段落组织） |
| 设计令牌 | `css/tokens.css`（新色板进 tokens，不散落硬编码） |
| 海深/城市预计算 | `js/render/layers.js` 或新文件 `js/render/terrainfx.js`（若新增文件：登记 bundle ORDER；若挂 world 派生字段：同步 save.js 剥离名单） |
| 静态审计测试 | `tests/ui_wiring.test.js`（新增） |
| 打包/发布 | `tools/bundle.cjs`、`tools/release.cjs`（一般不需要动） |

## 附录 C：历轮沿革与「不可破坏」清单

- v8 交互（M4 键位/框选/命令队列）、v9 六系统、v9.5 UI 布局（顶栏 79px 预算/缎带零溢出）、
  v10 行省沙盘（省多边形 + `?hexmap=1` 逃生阀）、v11 图集地图（atlas 三层 DSL，**禁止手改
  生成的几何**——要改国界改 `OWN_*` 图层字符串）；
- v11 刚接线的四条链不许退化：剧本国策树（688 节点）、野战军与计划加成、时代面板、登陆/情报；
- 顶栏任何新增元素先查 79px 高度预算与缎带横向滚动（历史前科：超限按钮被静默裁掉）；
- 引擎结算层禁 `Math.random`；`mulberry32` 种子链不许断。

—— 完 ——
