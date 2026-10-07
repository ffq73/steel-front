# 钢铁前线 Web 版 · v12「观感 · 仿真 · 可靠性」交付报告

> 交付日期：2026-10-03
> 基线：v11（416→1920 格图集地图 + 剧本国策树 + 野战军计划链）
> 本轮三大目标：**好看（UI 美观）· 地图像真战场（仿真度）· 每个按钮都能用（操作可靠性）**

---

## 1. 缺陷修复总表（D1–D7 全部闭环）

| 编号 | 缺陷 | 修复方式 | 定位 | 验收证据 |
|---|---|---|---|---|
| **D1** P0 | 海洋被画成陆地色 | `drawTerrain` 六角格循环**跳过 `terrain==='sea'`**（C43）；`drawSeaDepth` 移出 else 分支，两个分支（时代地毯/无地毯）都执行；深度色重做为三档水体（近岸浅青 → 中深 → 深海） | `js/render/layers.js` drawTerrain + drawSeaDepth | 全图截图波罗的海/北海/地中海均为蓝灰水体（`docs/shots/v12_map_after.jpg` / `v12_after_centraleurope.jpg`）；海陆对比肉眼可分 |
| **D2** P0 | X/Shift+X 自动选靶指向耶路撒冷 | 新增共享纯函数 `pickOffensiveTarget(world, kind)`（C44）：基准点=玩家前线质心（无前线则首都），主敌=共享边界格最多者；矛头=主敌首都→最近敌都→最近敌城→交战格；攻势线=距基准点最近的主敌城市；`input.js` 与 `panels.js` 两处调用点全部改走它 | `js/engine/plans.js`（新增）；`js/ui/input.js`；`js/ui/panels.js` | 浏览器实测：德国 1939 按 X → toast「推进至 **波兹南**」；Shift+X →「直插 **华沙**」；`tests/pick_target.test.js` 8/8（含「不是耶路撒冷」反证断言） |
| **D3** P1 | 地形对比度不足 | `TERRAIN` 色板重制（`js/data/terrain.js`，atk/def 系数未动）；drawTerrain relief 渐变 stop 色拉开（山地冷灰+雪线保留、丘陵赭黄、森林深针叶、平原暖麦绿、沼泽浊绿、沙漠沙金、城市冷灰蓝）；地形 alpha 0.60/0.85 → 0.72/0.92 | `js/data/terrain.js`；`js/render/layers.js` | 中欧截图上平原-丘陵-山地-森林可辨；`tools/sim.js` B1–B15 全绿（系数未动） |
| **D4** P1 | 国界与省界层级不分 | 边界三级权重（C45）：国界=深色剪影(≈2.2px@z1)+所属国低强度霓虹（宽晕+芯线双 pass）；省界=0.8px 细虚线**仅 z≥1.0 淡入（LOD）**；海陆交界彻底退出边界描边（由海岸高光独立负责）；政治色 alpha 0.36→0.32；bevel 高光/背阴强度整体调低降噪 | `js/render/layers.js` drawMapMode 边界段 | 中欧截图（z=0.5）：省界白虚线完全消失，国界+交战红色警戒线最醒目 |
| **D5** P1 | 兵牌堆叠杂乱 | 显示层单卡 + ×N 合并徽章（C46 ≤4 的更强形态）；堆内排序改为 **hp+org 战力降序**取封面（UNIT_PRIORITY 作同分裁决）；tooltip 命中测试对齐为单卡区域 → 命中返回封面师；hex 情报舱「驻守编成」列表按同一排序展示前 4 + 其余 N 师（下钻） | `js/render/layers.js` draw3DNATOCounters；`js/ui/hudV8.js` | 柏林特写截图：单卡+徽章；数据层 `hex.units` 顺序未动；`tests/m4_interaction.test.js` 7/7 仍绿 |
| **D6** P2 | 城市无光晕 | 首都=暖金 radial glow（半径 1.2 格）；大城市(w≥3)=冷白弱光晕（0.7 格）；小城不加；城区加中心广场（3~5 街区+广场线） | `js/render/layers.js` drawMapMode 城市光晕段 + drawTerrainDetails city 分支 | 柏林/巴黎/莫斯科首都金晕 vs 小城无晕；光晕画在政治层后、水印前，进地图缓存 |
| **D7** P2 | X 键 toast 不报战区名 | `pickOffensiveTarget` 返回 `theater`（沿用 `theaterNameFor` 前线命名语言），X/Shift+X/矛头按钮 toast 均带战区名 | `js/engine/plans.js`；两调用点 | 实测 toast「🎯 攻势线已标定：…（西线（斯特拉斯堡方向））」 |

---

## 2. S2 玩家操作全流程模拟（10 批全过，0 失败）

> 驱动方式：页内 `evaluate` 派发真实 DOM 事件（键盘带 `code`、鼠标带 `buttons`）；
> 帧驱动用 `SF.advanceFrame(n)`（**n=帧数**——S2 排障期间确认过语义，见 §6 排障记录）。

| 批次 | 操作 | 结果 | 关键实测值 |
|---|---|---|---|
| 1 | 10 个抽屉页签逐个点击 | ✅ | 10/10 激活，内容 ≥17 字符 |
| 2 | 6 顶栏弹窗 开→钮关→再开→ESC 关 | ✅ | 6/6（stats 弹窗为动态创建，首次点击后 DOM 在位） |
| 3 | 五档速度钮 + 空格 + `+/-` | ✅ | data-speed 0–4 与 world.speed 逐档一致；空格→0；`+`→2、`-`→1 |
| 4 | 左键选首都 / 右键己格 / 右键敌格 | ✅ | selHex=(23,13) 柏林；order=advance；order=attack |
| 5 | 框选接壤区 + 中键平移 + 滚轮缩放 | ✅ | 框选 3 师；平移 90.1px；z 1.10→1.33→1.10 |
| 6 | X/Shift+X/Z/C/V/B/H/S/M/U/Tab/Del | ✅ | 每键 toast/状态变化语义正确；X→波兹南（D2 修复实证）、Shift+X→华沙、M 迷你地图开/关、U 兵牌 nato↔icon、Tab 切野战军、Del 清令 |
| 7 | F1–F10 地图模式 | ✅ | 10/10 切换到正确 modeId（default/navy/air/supply/terrain/resistance/resource/industry/faction/weather）；F2–F10 图例条点亮，F1 无图例 |
| 8 | 存档 → 主菜单「继续历史档案」读档 | ✅ | 槽 1 落盘 1,493,524 字节；恢复 day=3 / GER / 307 师；`store.world === SF.world` 一致 |
| 9 | 时代法案单选 + 右栏收展 + 帮助 + 指标弹窗 + 国策快捷槽 | ✅ | 法案切换 world 生效+toast；collapsed-right 类切换；help 开/关；sf-generic-modal 开/关；国策树开 |
| 10 | `SF.advanceFrame(12)` 驱动 12 帧后查 HUD | ✅ | 将领条 **0 → 6 卡**（复现并按文档判定为 rAF 停摆环境假象）；焦点文案刷新；12 帧 1812ms |

## 2.1 S2 排障期间发现并修复的存量真雷（v11 遗留，非本轮引入）

**plans.js:174 填线就位命令违反 movement 契约 → 下一 tick 必崩帧。**
`assignToFront` 给不在前线格的师下发 `{type:'move', target}`，而 movement.js 的 move 分支
要求 `order.path[0]`（契约注释：`move {path}`）——Z/V 填线后第一次 dayTick 即
`TypeError: Cannot read properties of undefined (reading '0')`，rAF 主循环死亡。
node 侧 47 天 soak 不按 Z/V，因此历轮测试从未踩中；本轮 S2 批次 8 的 tickOnce 首次暴露。

- **修复**：改走 `{type:'advance', dest}`——自带敌接火转攻击、堆叠上限绕行、抵达清令，语义正合填线就位。
- **回归**：`tests/soak47.test.js` 新增 S4-4（填线后全部命令可被 processMove 安全消费 + 再跑 3 天不炸）。
- 修复后浏览器实测：存档→读档→再 tick 3 天全程无异常。

## 2.2 已知边角（不阻塞交付）

- **时代面板法案单选的绑定是 `setTimeout(10ms)` 后挂 onchange**（panelEra.js:136）。
  渲染后 10ms 内的机器点击会丢失（人类无感）。全新会话与「主菜单→继续战役」真实路径
  均验证通过（法案写入 world + toast）；仅在多轮世界替换的自动化会话中出现过闭包过期，
  真实用户路径不可复现，未改动。
- IAB 桥接下 `tab.screenshot()` 在重页面上超时（文档 §1.3-3 已有前科）——本轮全部走
  页内画布导出（`#sfmap` → ≤960 宽 JPEG）。

---

## 3. 新增测试（入库）

| 文件 | 内容 | 结果 |
|---|---|---|
| `tests/pick_target.test.js` | S1 自动选靶 8 断言（null 回避/华沙矛头/波兹南攻势线/边境最长主敌/无首都回退/战区名/基准点 C44/双调用点一致） | 8/8 |
| `tests/ui_wiring.test.js` | S3 静态零死区审计：W1 index.html 按钮 id 全接线（白名单 sf-load-btn）、W2 js/ui 的 data-* 全有读取点、W3 全项目 alert()=0、W4 内存解绑自证 | 4/4 + 真实解绑变红自证 |
| `tests/soak47.test.js` | S4 47 天战争 soak（无异常/无数值 NaN/事件容器完好）+ P2 存档往返（<2% 漂移 + 剥离名单生效）+ S4-4 填线契约回归 | 6/6 |

**C47 附带成果**：全项目 `alert(` 调用清零（文档断言「已清零」与实情不符——本轮实际清掉
panelArmy/panelTrade×5/panelDoctrine/panelAir/panels 导入路径共 8 处 + 此前 2 处，统一改走
`showToast` 通道并按 U3 分型着色）。

---

## 4. UI 美观度（U1–U6 全部落地）

- **U1 弹窗标题栏统一**：六模态（国策/统帅/编制/百科/存档/统计）全部收敛到 `modal-header`
  语言——左旗标或徽记 + `modal-title` + `modal-sub` 副题，右统一 `关闭 (ESC)` 钮。
- **U2 抽屉页签**：active 左侧金色指示条（`::before` 渐变）+ 文字提亮，hover 微亮底。
- **U3 Toast**：左侧类型色条（info 黄铜 / warn 橙 / bad 红，令牌进 tokens.css）+ 超长省略
  （`max-width:min(72vw,720px)` + ellipsis）；入场动效沿用 v9.5 sfToastIn。
- **U4 国策四态**：available 黄铜描边、done 绿边+金色勾角标（`::after` ✔）、locked 降对比
  （0.38 + 去饱和）、active 保留脉冲。
- **U5 将领条**：hover 抬升 3px + 金晕；active 双层金边；空槽虚线弱化。
- **U6 图例/比例尺**：同语言玻璃底+金框（`--sf-glass-*` 令牌）+ 6px 栅格；两者均绝对定位，
  F1↔F2 切换时画布 `getBoundingClientRect` 不变（零 layout shift，批次 7 实测）。

## 5. 性能实测（P1/P2）

> 环境：ZCode IAB（软件渲染）。**绝对值与 v11 基线（6.3ms/73.5ms，测试者硬件 GPU）不可比**，
> 故按「隔离增量 + 结构性论证」交付：

| 项 | 实测 | 说明 |
|---|---|---|
| 每帧（默认 z1.1/档1.5，缓存命中） | 20.7ms | 分解：动态层 20.9ms（含 13.3M 像素合成 + 兵牌层 19.8ms）——**全部为 v11 既有路径，本轮零改动** |
| 全重建（默认档） | 地形 225.8ms + 归属 77.6ms | 归属层 ≤90ms 达标 |
| 本轮新增增量 | 海深 BFS 1.5ms；城市光晕 2.2ms/103 城 | 均为一次性缓存路径 |
| 边界绘制 | 逐边 save/stroke → 批量 4–5 次 stroke | 客观减少绘制调用 |
| 海深缓存键 | 旧键含 day/owner（**每天整图重算 BFS**）→ 纯地形键 | 相对 v11 是净收益 |
| 结构性保证 | M1–M5 全部只写入 `drawTerrain`/`drawMapMode` 脏重建路径 | 每帧路径零新增代码 |
| P2 存档往返 | 存→读→再存字节数漂移 <2%（实测通过）；派生数据全部渲染器实例私有，未挂 world/hex | SAVE_REPLACER 名单无需扩充；P2-2 断言序列化串无 polygon/cell/provinces |

## 6. 排障记录（两起假警报，均非产品缺陷）

1. **`SF.advanceFrame` "卡死"**：实为把 `performance.now()` 当帧数传入 → 请求 4.5 万帧。
   语义确认：`advanceFrame(n=1)` 的 n 是帧数。修正用法后 12 帧 1812ms 正常完成。
2. **桥接层间歇性结果掺假**（与代码无关）：ZCode node_repl 桥接多次返回与所发代码不符的
   乱码结果。对策：凡与代码返回形状不符的结果一律作废重跑；最终全部结论以形状吻合的
   干净结果与 Bash 侧真实输出为准。

## 6.1 交付后事故：发布版白屏（用户报告"两个文件夹打不开"）——已修复

v12 首次 release 后，用户双击发布目录/zip 内的 HTML 无反应。定位：**压平打包的顶层
const/let/class 跨模块撞名**——`CROP`（data/map.js × scenarios/ww1/map.js）、`REMAP`、
`ENERGY`（scenarios/ww1/map.js × scenarios/ww2/map.js）三组。devserver 的 ESM 各模块
作用域隔离，源码毫无异样；压平后同一脚本作用域重复声明 = SyntaxError，1.3MB 主脚本整体
解析失败 → 白屏。bundle 原有三道自检（ORDER 覆盖/命名空间合成/导出名核对）均不查撞名。

修复与加固：
- `scenarios/ww1/map.js`：`CROP→WW1_CROP`；`scenarios/ww2/map.js`：`REMAP→WW2_REMAP`、
  `ENERGY→WW2_ENERGY`（均模块内私用，改名零风险；ww1 顺带统一 WW1_ 命名族）。
- **bundle.cjs 新增自检 4**：跨模块顶层 const/let/class 撞名 → 构建期硬失败并列出全部
  肇事模块；function/var 同名（合法但压平后后者覆盖）降级警告。
- 重建后五个 dist 产物逐一 `node --check` 全过；`release.cjs` 三者一致重刷；
  临时静态服务器实载发布版验证：主菜单 4 钮渲染 → 单人战役 → 时代选择屏，全链路可开。

## 7. 全量验证清单

| 项 | 结果 |
|---|---|
| 全量测试 `tests/*.test.js + tests/test_*playthrough.js + tests/provinces.test.js` | **31/31 通过，0 失败** |
| `node tools/sim.js`（B1–B15） | 全部断言通过 |
| `node tools/check_assets.cjs` | 缺失 0（manifest 845 项） |
| 引擎指纹 | `node tests/provinces.test.js --update-engine-manifest` 已显式登记（plans.js 两轮改动后重登记） |
| `node tools/bundle.cjs` 三道自检 | 通过；dist 五入口各 1663 KB |
| `node tools/release.cjs` | **dist / 发布目录 / zip 三者一致** |

## 8. 改动文件清单

- `js/engine/plans.js`：新增 `pickOffensiveTarget`（S1/C44/D2/D7）；填线命令 move→advance（存量雷修复）
- `js/ui/input.js`、`js/ui/panels.js`：X 键与矛头按钮改走共享选靶；showToast 分型；U1 弹窗头×3；导入路径 alert→toast
- `js/ui/hudV8.js`：tooltip 命中对齐单卡 + 封面师排序同源（M5）
- `js/ui/panelArmy/panelTrade/panelDoctrine/panelAir.js`：alert 清零（C47）
- `js/ui/panelDesigner/panelEncyclopedia/panelStats.js`：U1 弹窗头统一
- `js/render/layers.js`：M1 海格跳过+海深双分支+三档水体+缓存键纯化；M2 七地貌浮雕分支+bevel 降噪；M3 边界三级批绘+政治 alpha 0.32；M4 城市光晕+中心广场；M5 封面排序
- `js/data/terrain.js`：色板重制（系数未动）
- `css/tokens.css`、`css/style.css`：v12 令牌与 U1–U6 样式段（级联末尾追加）
- `tests/pick_target.test.js`、`tests/ui_wiring.test.js`、`tests/soak47.test.js`：新增
- `docs/shots/v12_map_after.jpg`、`v12_after_centraleurope.jpg`、`v12_after_berlin.jpg`：交付对比图（基线 `v12_map_before.jpg` 沿用）

## 9. 已知未做

- 时代面板法案绑定的 `setTimeout(10ms)` 竞态未收敛（§2.2，真实路径无感，留待 v13 随 era 面板重构一并处理）。
- 软件渲染环境下兵牌层 19.8ms 的进一步优化（LOD 已有三级，本轮不动 v11 计数器结构）。
- 桥接截图超时的替代通道未工程化（页内画布导出已够交付）。

## 10. v12.1 增补：玩家试玩捉虫 + 国策树扩充（2026-10-04）

### 10.1 时间不自动流逝（用户报告）

**根因**：`main.js tickOnce()` 对凡 `important:true` 的事件一律 `W.speed=0` 急停，而
①`air.js` 玩家联队王牌诞生 `important: w.nat===world.player`（几乎每 1–2 天触发）；
②四剧本 events.js 的历史新闻时间线多为 `important:true`（现代开局几乎每周一条）；
③`econSocial.js` 社会动荡。开倍速后几秒即被静默拍停一次，表现为"时间不自动流逝"。

**修复**：`tickOnce` 急停改为白名单 `PAUSE_EVENT_TYPES`（宣战/投降/和会/DEFCON/核升级/
政变/一战剧本大事件/能源断供/红线危机/停火窗口），新闻、王牌、动荡、城市易手不再急停。
90 天四剧本模拟：ww2/modern 0 急停、coldwar 2、ww1 7（首次第 70 天）。

### 10.2 headless 玩家试玩台与修复清单

新增 `tools/playtest.mjs`：31 局（4 剧本 × 全可玩国家）按玩家真实路径（store.dispatch 下单/
部署 + pickFocus + startResearch）跑 220 天，校验世界不变量。捉出并修复 7 个 bug：

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| 1 | battle.js:155 | 全攻方低于撤退阈值时 `attackers[0]` 抛 TypeError，主循环冻死（9/31 局崩溃） | 空守卫提前到守军过滤前 |
| 2 | movement.js enterHex | 盟军部队接管盟友领土（奥匈进驻德军刚夺回的柏林→误触发协约国胜利） | 占领须与格子归属国处于战争状态 |
| 3 | battle.js moveIn | 同型问题 | 同上 |
| 4 | movement.js 攻击分支 | 目标格已被盟军占据时仍涌入 | 只进己方/敌国格，命令就地转化 |
| 5 | ai.js 二线机动 | 驻城市部队全部抽往前线，内地空城 → 突破后无人区行军直捣首都 | 驻己方城市部队不外调 + 首都 4 格内有敌军时二线回防 |
| 6 | victory.js | 柏林≠GER 即判"协约国大胜"终局（RUS 试玩 12 天） | 首都目标须目标国已投降或 VP 损失≥50%（capitalDown） |
| 7 | air.js initAir | A 剧本硬编码联队坐标对所有剧本执行，国家缺失仍兜底生成（ww1 冒出 POL/SOV 联队） | 硬编码坐标仅限剧本 A；其余剧本按参战国首都通用部署 |

另修数据：ww1 REMAP 补 `'t':'USA'`（北美插图 39 格无名标签）；首都默认 fort 2（atlas.js）。

### 10.3 国策树扩充（496 → 约 680 节点）

- coldwar：48 → 112（USA/SOV/CHN/GBR 各 22–23 + 新增 FRA 22，全部节点带描述）
- modern：64 → 133（RUS 28、UKR 24、其余 16–17；新增节点带描述，[F] 原创人物链未动；
  `isr_startup_nation` 的无效 stat `researchSpeed` 改为引擎实际读取的 `research`）
- ww1：BEL/BUL/ROM/GRE 各 4→8，ITA 8→12（第二/三列，带描述）
- ww2：FRA 16→24、CCP 16→24（第二链，带描述）

`tests/focus_trees.test.js` 全绿（唯一 id、前置无死链、效果类型全部被 applyEffect 认领、无不可达节点）。

### 10.4 发布验证

- 31 局 playtest 全绿 + 全部 24 个测试套件通过 + `provinces.test.js --update-engine-manifest` 重登记。
- `provinces.js` 本地 `pointInPoly` 副本删除，统一导入 `core/geom.js`（消除压平同名覆盖告警）。
- headless Chromium 走查（playwright-core + 本机 chromium-1234）：dev 四剧本 URL 直启 + 发布包
  五页完整菜单流（单人战役→时代卡→国家沙盘→画布点选国土→签署总动员令→开战），8 倍速
  时间推进 27–28 天/3.5s，console/page 错误为 0（做旧旗 `_weathered.png` 回退属设计，豁免）。
- 补齐 11 面完全缺失的国旗 SVG（ww1: DNK/NLD/SWZ/ESP/SRB/MNE；coldwar: AFG/IND/VNM/ZAF；modern: BLR）。
- release 重新同步，zip 更新为 `钢铁前线_SteelFront_v1.1_完整可玩版.zip`。

### 10.5 增补：开局画面冻死的行省构建崩溃（v12.1 追加修复）

**现象**：约 6% 开局概率，进入战役后画面冻死、时间不走，console 报
`TypeError: Cannot read properties of undefined (reading '0')`。
48 次启动探针（8 组剧本×国家组合）复现 3 次。

**根因**：`js/render/provinces.js` 行省多边形构建中，`organicCurve` 对
<0.5px 的退化边返回两点 `[a,b]`，而装配处 `rawPts.push(curve[0], curve[1], curve[2])`
假设恒有三点——`curve[2]` 为 undefined 进入多边形，`simplifyPoly` 读
`c[0]` 抛异常。异常发生在首帧 `drawTerrain → ensureWorldProvinces`，
直接杀死 rAF 主循环 → 时间冻结。曲线控制点随每局随机种子微变，
故仅在偶尔两条曲线点足够接近时触发（间歇性）。

**修复**：①装配处跳过退化边的缺失第三点；②`simplifyPoly` 对空洞点
纵深防御（`if(!c||!p||!q) continue`）。修复后 48 次启动探针 0 异常，
provinces.test.js 7/7，dev+发布走查全绿。
