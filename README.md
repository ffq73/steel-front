# 钢铁前线 Steel Front · Web 轻量版 v8.0

浏览器内运行的《钢铁雄心》轻量版。**v8.0 地图 UI 交互优化轮 M0–M6 全部落地**。
**M0 观感修复**：离屏画布 DPR 统一（修复"地图缩在角落、部队浮在空白处"的错位事故）、进局视野自适应 `fitToHexes`、城市标签三级分级。
**M1 地图视觉**：占领区斜条纹、海洋距岸三层深度 + 海岸亮边、动态比例尺、指北针外框。
**M2 地图模式**：F1–F10 十种图层 + 顶部图例条 + F4 补给 BFS 流向线 + F2 兵力徽章与主攻箭头。
**M3 兵牌系统**：LOD 三级聚合（z<0.62 简化 / z<0.38 极简）、NATO↔兵种图标（U 键）、经验条/被包围框/姿态图标、伤害浮字、胜率气泡。
**M4 交互与快捷键**：左键拖框选 / 中键拖平移 / 双击选全图同类、Shift+右键路径点（编号旗标）、Ctrl+右键支援攻击、Alt+左键弯曲箭头 / Alt+右键拖重塑线形、B 战略调动、Ctrl+H 移出计划、Del 删命令、Tab 军团循环、X 攻势线 / Shift+X 矛头、右侧命令队列（可逐条撤销）、战宽已满抖动 + toast 说明。
**M5 HUD 重构**：顶栏三级分组 + 紧张度半圆表盘 + 六类可点击定位警报条、左右面板折叠 56px 图标条（折叠后地图区 **91.3%**）、底部三段式（将领履历改上浮层）、迷你地图 220×140（M 键）、三级 Tooltip（L1/L2/L3 富文本 + 日增量 + 边缘翻转）。
**M6 四副本差异化**：一战（堑壕网格 / 无人区泥泞 / 炮击准备仪表+三档条令 / 战争疲惫条）；二战（装甲闪击箭头 / 合围口袋徽章 / 轰炸燃烧 / 装备缺口红点 / 计划加成角标）；冷战（影响力双色渐变 / DEFCON 表盘 / 代理人火苗 / 太空竞赛双轨条 / 影响力投放面板）；现代（制裁网络图 / 军援流动光点 / FPV 打击准星 / 能源依赖环 / 声望疲劳条 / 红线警告框 / 制裁组网 / 军援管道 / 升级管控）。
**性能**：世界坐标背景缓存 + 缩放延迟重绘 → 拖动 5.2ms、缩放 6.5ms、完整帧 4.4ms。

完整优化蓝图见 `docs/钢铁前线-Web版-地图UI交互优化轮开发提示词-v8.md`；M6 交付与实测证据见 `docs/m6_era_delivery.md` + `docs/shots/`。

## 运行

- **开发**：`py tools/devserver.py`（零缓存多线程），访问 `http://localhost:8899/index.html`
- **发布（一条命令，推荐）**：`node tools/release.cjs`
  依次完成：打包单文件版 → 同步中文发布目录 `../钢铁前线_完整单机可玩版/` → 生成分享 zip，最后**自检三条路径的 HTML 逐字节一致**。
  > 本项目有两条分发路径，历史上只重建 `dist/` 而漏了发布目录/zip，导致玩家打开的还是旧构建。改动后请一律用 `release.cjs`，不要分开跑。
- **仅打包**：`node tools/bundle.cjs` → `dist/*.html`（5 个单文件入口）。打包器内置两道自检：ORDER 漏登记模块、命名空间导入无法合成 → 直接 `exit(1)`。
- **测试**：`node tests/run.js` + `node tests/m4_interaction.test.js`（M4 引擎断言 7 项）+ `node tools/sim.js`（平衡 B1–B15）+ `node tests/logistics_width_peace.test.js`
- **资产巡检**：`node tools/check_assets.cjs`
- **调试**：`index.html?dev=1`（+装备/跳天/AI 日志）；`index.html?scenario=ww2&player=GER` 直启剧本
- **调试句柄**：`window.SF`（`world/store/camera/layers/ui/hudV8`）+ `window.SF.engine`（barrage/bloc/sanctions/milaid/drones/space/energy 七个副本专属系统）

## v7.0 战略纵深体系（E1–E5 交付）

| 阶段 | 交付物 | 状态 |
|---|---|---|
| E1 资产归位 | 841 张资产全绑定（事件油画/报纸头版/国策母图/512×640 人物档案卡），`check_assets` 0 缺失 | ✓ |
| E2 沙盘重塑 | 五大地貌纹理、贝塞尔双色河流（渡河 -30%）、双轨铁路+补给枢纽徽章、交战炮火/黑烟粒子、泥泞/冬雪覆盖 | ✓ |
| E3 后勤与战术 | 补给枢纽+摩托化辐射+B.3 断供曲线、地形战宽 B.1（平原6/山5）、预备队增援骰 B.2、四组战术相克矩阵（克制方效果失效） | ✓ |
| E4 资源与和会 | 六资源产出/赤字折损 B.4/燃料池断油瘫痪、占领区抵抗顺从+4 档法案、战后和会（贡献度 35/40/15/10、割让/傀儡/非军事区/资源掠夺） | ✓ |
| E5 校准与发布 | 四时代无头推演巡检全过、11 套测试+sim 全绿、dist 5 入口 + 可玩版目录 + Release ZIP | ✓ |

## v7.0 全景页面流（本轮新增）

```
冷启动主菜单 → 四时代全景副本大厅 → 国家挑选与沙盘档案舱 → 战争大厅（v6） → 战史复盘与授勋大厅
```

| 屏幕 | DOM | 内容 |
|---|---|---|
| 主菜单 | `#screen-main-menu` | 四时代油画 Ken Burns 轮播、金属浮雕 Logo、战役/档案库/设置/鸣谢 |
| 时代大厅 | `#screen-era-select` | 1914/1939/1949/2022 四张展台卡（油画背景 + 机制标签 + 结算周期与烈度） |
| 国家档案舱 | `#screen-country-select` | 可点选全球沙盘（联动高亮）、领袖油画肖像、政体与意识形态、实力三柱、国家精神、[F] 虚构人物线索 |
| 开战确认 | 同屏底栏 | 难度四档（列兵/上校/上将/元帅）+ 铁人模式（禁调试栏）+ 签署总动员令 |
| 战争大厅 | `#screen-gameplay` | v6 全部局内功能（顶栏/军工流水线/大地图/将领带/作战计划盘） |
| 战史复盘 | `#screen-aar` | 事件插画头版、战损总账四联仪表、名将授勋台（按剧本授予勋章）、重战/返回 |

- **状态机**：`js/ui/screenManager.js`（ScreenManager + ERA_META + LEADER_META：40+ 国领袖与政体、国家精神）
- **页面渲染**：`js/ui/screenPages.js`；**肖像与画卷映射**：`js/ui/portraitMap.js`（100+ 领袖油画资产）
- **音效**：`sound.playGate()`（转场）/`playStamp()`（签署）/`playHover()`，全部 WebAudio 程序化合成
- **画布自适应**：屏切换与窗口缩放自动重算（`fitCanvas()`）

## 目录

```
js/core    geom rng bus store assets audio
js/data    constants terrain rivers railways weather resources units nations map
           techs focuses dossierData encyclopedia + scenarios/（ww1|ww2|coldwar|modern 四数据包）
js/engine  world tick economy resources peace logistics resistance battle plans
           movement ai victory research focus template tension laws diplomacy
           barrage attrition(一战) bloc nuclear space(冷战) sanctions energy milaid drones(现代)
js/render  camera layers（地形离屏/归属/动态三层 + 硝烟粒子）
js/ui      screenManager screenPages portraitMap input panels panelArmy panelDesigner
           panelEncyclopedia panelEra panelPeace newsTicker detailSystem
tools      devserver.py sim.js（B1–B15）bundle.cjs（多入口打包 + 两道自检）
           release.cjs（一键发布：打包→同步发布目录→zip→一致性自检）
           check_assets.cjs（资产健康巡检）sync_release.cjs（发布目录同步，被 release.cjs 调用）
tests      run.js + m4_interaction.test.js（M4 引擎断言）+ 11 套剧本/系统/平衡验收（含 logistics_width_peace E3/E4）
```

## 已知边界

- 国家档案舱的沙盘缩略图为程序化绘制（非最终美术），后续可替换为成品战略地图
- AAR 的"战局长卷快退"（Chronicle Replay）为规划项，当前提供总账与授勋
- 铁人模式已禁用调试栏；云存档/联机不在计划内
- agent-browser 真机截图巡检在本机受安全软件限制：IAB 的 `tab.screenshot()` 在重页面会反复 `surface preparation timeout`。地图证据改为页内 `canvas.toDataURL()` 导出（见 docs/shots/），DOM 面板用逐项断言验证
- 发布目录 `钢铁前线_完整单机可玩版/dist/` 是顶层 HTML 的冗余副本（体积翻倍）。zip 已排除它；该目录可整体删除，顶层文件+assets 即完整可玩

