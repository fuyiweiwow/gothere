# 一定要到达那里

轻松诙谐的 2D 环境解谜与关卡编辑器。主角认准目的地就往前走，玩家改变环境，帮他到达那里。最终目标为 Steam；当前 v0.7 以独立纯逻辑编辑器验证创作模型，暂不投入正式美术和动画。

## 运行与试玩

[直接打开纯编辑器](https://fuyiweiwow.github.io/gothere/editor.html) · [离线编辑器 HTML](https://fuyiweiwow.github.io/gothere/gothere-editor.html)

编辑器打开即进入地图创作，仅使用几何图形、标签与连线。支持物体属性、命名行为、事件槽、折线整理、JSON 导入导出，以及运行/暂停/单步观察。无需游戏首页或美术资源，离线文件直接用浏览器打开；使用者无需安装 npm。操作与参考文档取舍见 [编辑器引擎](docs/editor-engine.md)。

[原型游戏](https://fuyiweiwow.github.io/gothere/) · [离线游戏 HTML](https://fuyiweiwow.github.io/gothere/gothere-play.html)

开发需要 Node.js 22.12.0 或更新版本：

```sh
node server.mjs
```

桌面浏览器打开 http://localhost:4173/editor.html 直接编辑。游戏在 http://localhost:4173 ，十张关卡用于时序回归，另有三个可编辑示例。

```sh
npm run build
```

生成编辑器 `dist/editor.html` / `dist/gothere-editor.html`，以及游戏 `dist/index.html` / `dist/gothere-play.html`；均可直接用桌面浏览器离线打开或静态托管。移动端暂不作为交付前提。临时分享可用 `npm run share`；隧道不保证持续有效。

`main` 为发布分支。推送后，GitHub Actions 先运行内核与数据测试，再构建上述四个单文件 HTML 并发布到 GitHub Pages。草稿保存在当前浏览器中，纯编辑器与游戏工坊的草稿隔离，通过 JSON 交换数据。

## 创作模型

- 每个物体可定义多个命名行为，每个行为由一组动作组成，支持嵌套延迟。
- 工坊左侧地图，右侧「仓库 / 物体 / 逻辑 / 地图」四个页签；仓库支持类别和关键词筛选，并可选中场景已有物体。
- 选中物体查看类型、标识、属性、事件输出与行为输入，每个槽显示已有连接并可发起接线。
- 「连线」工具依次选择事件起点、目标物体和目标行为。支持一对多、多对一、物体连接自身；同一起点可以继续连到其他目标。
- 行为完成也能成为下一条线的起点。连线默认直角折线；双击线添加转接点，拖动或用方向键整理，双击节点或 Delete 删除。选中线可恢复自动布线、查看规则，也可显示全部 / 选中物体相关 / 隐藏连线。虚线表示延迟。规则面板可设置条件、动作和声明顺序，删除规则即删除对应连线。
- 外观、巡逻、接触效果、行为分别定义。斧子、鳄鱼或方块不决定玩法；危险来自通用接触致命效果或伤害动作。
- 「拿起」改变主角与物体的持有关系。持有时暂停巡逻和对主角的接触；行为仍可调用。只有一个手持槽；放下保留物体状态。空手/持有指定物体可作为条件。
- 主角持续行走。梯子显式改变高度；电梯到位才能登车，没有车不会等待，闲置车不会让主角停住。缺少支撑立即掉落失败，非终点边界失败。
- 工坊支持放置、拖动、坐标和楼层编辑、撤销重做、多个草稿、保存恢复、JSON 导入导出。试玩与编辑文档隔离。
- 通用物件可挂载 PNG/JPEG/WebP 图片，随 JSON 和离线文件携带；动画绑定后置。

完整字段与执行语义见 [内容模型](docs/content-model.md)，方向与下一步见 [project.md](project.md)。JSON 是当前 DSL 的数据表达；文本语法、可复用预设和程序生成尚待实现。旧 `hazard` 数据仅保留导入兼容，新创作使用通用物件。

## Windows 开发测试包

```sh
npm ci
npx --no-install install-electron
npm run build:windows
npm run test:windows
```

生成对应版本的 `dist/windows/Gothere-v<version>-win-x64.zip`、SHA-256 和 `latest.json`。解压整个目录后运行 `Gothere.exe`，无需 Node.js 或联网。F11 全屏，草稿保存在 `%APPDATA%\Gothere`。这是游戏开发测试包；本次纯编辑器交付为 HTML，未重新打包 Windows 应用。包尚未签名，第二台干净机器和 Steamworks 发行验证仍待完成。

自动测试默认隐藏运行，使用隔离存档；浏览器测试无头运行，不弹出桌面窗口。只有主动指定 `npm run test:windows -- --visible-performance` 才会进行可见窗口测试。

## 开发与验证

原生 JavaScript ES modules + Canvas；模拟与渲染分离，固定 60 tick/秒。编辑器、JSON 与未来生成器读写同一数据，连线只是规则的可视化，没有第二份图数据。关卡不执行任意 JavaScript。

```sh
npm test
npm run test:coverage
npm run test:e2e
npm run test:editor
npm run test:content
npm run test:wires
npm run test:workspace
npm run test:logic-editor
```

浏览器验证需安装开发依赖，可使用本机 Edge 或 `npx --no-install playwright install chromium`。测试产物写入不提交的 `artifacts/`。

- `src/core/`：DSL 校验、动作、确定性模拟与回放。
- `src/editor/`：草稿历史、引用维护、属性/行为/连线编辑。
- `src/app/preview.js` / `src/render/diagram.js` / `src/shell/editor.js`：无 DOM 预览控制、无美术几何显示与独立编辑器组装。
- `src/examples.js` / `src/levels.js`：三张创作示例与十张时序关卡。
- `src/scene.js` / `src/main.js`：表现、输入及固定步长驱动。
- `desktop/` / `scripts/`：桌面容器、单文件打包及后台验收。

`test:editor` 从空白重建十关并验证解法；`test:content` 验证资源挂载和多层路线；`test:wires` 从控件创作行为和连线，验证多路连接、完成事件、持有/放下、改名/删除/撤销、重载、回放及离线运行。

`test:workspace` 验证左右布局、仓库过滤、物体槽接线、转接点拖动/删除/历史、保存重载与 JSON/离线一致性。
