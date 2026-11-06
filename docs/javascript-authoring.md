# 画外编辑与 JavaScript 编排

v0.31.0。在线开发版与单文件离线版均可使用，不需要安装 npm。JavaScript 是作者源码，运行数据继续使用原有 DSL。

## 画外入场与离场

画布工具栏勾选「画外工作区」，用空格或中键拖动画布查看左右留白。留白只是编辑区域，实际游戏画面仍为 1200×640，主角越界规则不变。「适合窗口」回到游戏画面。

- 从仓库的场景物体列表选择画外物体时，会自动展开留白并定位；资源图层列表也可定位画外图片。
- 普通物体的属性中有「放到左侧画外」「放到右侧画外」「定位物体」。位置可以继续拖动、拉伸或数值微调，每次操作独立撤销。
- 行为中的 move 动作有「驶出左侧」「驶出右侧」，自动设置目标 X。计算包含逻辑范围、绑定图片及其状态变体，留出24像素，不只检查碰撞体。
- 「在画布点选目标 X」进入点选模式；点击后保存目的地，Esc取消。仅改变 X，保留所属层、离地高度和持续时间。需要改变层或进入内外通路时，仍在动作属性中明确设置。
- 入场：把初始位置放到画外，再将普通移动动作目标放回画内；事件可来自区域接近、点击或其他物体的行为完成。离场使用同一种 move。

初始画外摆放适用于没有承托、旋转、巡逻和通路位置的普通空间物体。路面、路线节点、主角与终点仍保留原有边界；不在画外创建新的可行走世界。空间物体 X 范围为 -1200～2400（右端计入逻辑宽度）。图片过大、偏移过远导致快捷摆放超限时，提示调整资源，不静默截断。移动结束仍以 moved 事件连接；done / after 不会等待真实移动完成。

## 文件树与源码项目

顶部「JavaScript 关卡源码」打开左侧文件树、右侧编辑区。首次打开或点击「从当前画布生成源码」，将关卡拆成下面的项目，保留物体、规则和美术数据。入口仅十几行，具体物体不再挤在同一个文件中。

```text
level.js            入口：搭建地图、添加物体、连接事件和美术
map.js              地图、行走层、主角和终点
events.js           跨物体事件与动作
scene.js            图片、动画、音效与图层（有关卡美术时）
objects/
  index.js          创建所有物体
  bus.js            一个物体的类、属性与行为
  ...
@gothere/core       编辑器提供的基础库，可只读查看
```

- 文件树可搜索、展开和折叠；点击文件打开页签。各文件保留自己的撤销记录，切换文件不会互相覆盖。
- 「新建」填写 `shared/cart.js` 这样的路径即可建目录和文件。「重命名」同时更新项目内的静态 import 和 re-export；存在语法错误时先修正再重命名。
- 删除前会备份项目；入口需先改选才能删除。删除不会自动删除其他文件的引用，校验会指出缺失模块。
- Ctrl+S 保存整个项目到当前草稿槽，Ctrl+Enter 生成并校验。生成成功后可整体替换画布（一次撤销），或另存为新草稿。
- 「导出项目 ZIP」保存全部 `.js` 源文件与目录；重新载入 ZIP 可继续编辑。ZIP 的首个 JS 文件为入口，不需要作者维护 JSON 清单。「导出此文件」只导出正在看的文件，它的依赖需另行保留。
- 「载入项目 / 关卡」也接受旧 `.js`、旧 `.json`：旧手写函数和循环保留在兼容入口，旧数据转成分文件项目。加载项目不会执行源码。
- 画布与源码分别保存，重新应用源码不自动合并画布修改。重新从画布生成、载入文件或示例前保留一份源码项目，可「恢复之前的项目」。

源码最多256个文件、合计2 MiB，生成结果最多1 MiB。CodeMirror 提供语法着色、文件路径提示和 `level.`、`this.`、`Actions.`、`api.` 及部分对象变量的 API 提示；Ctrl+Space 主动调用。当前是限定补全，不是完整 LSP，没有全面类型推断、跳转定义或智能重构。

## 面向对象的基础库

支持真正的 ES module 静态 import/export、别名、命名空间及再导出。基础库由编辑器提供，在线和离线均不访问 CDN。项目内用 `./`、`../` 引入文件，核心库用 `@gothere/core`。暂不支持 npm 包、外部 URL、动态 import、循环依赖或异步关卡入口。

```js
// level.js
import { Level } from '@gothere/core';
import { DepartingObject } from './objects/departing-object.js';

export default function buildLevel() {
  const level = new Level();
  new DepartingObject(level, 'cart', { x: 520 });
  return level;
}
```

```js
// objects/departing-object.js
import { Entity, Actions } from '@gothere/core';

export class DepartingObject extends Entity {
  constructor(level, id, { x = 500 } = {}) {
    const object = level.api.object(id, {
      x, width: 64, height: 44,
      contact: { effect: 'lethal', message: '撞上了挡路物。' }
    });
    super(level, object.id);
    this.behavior('leave', [
      this.set('inactive'),
      Actions.after(0.2, [this.move({ x: 1350, seconds: 2 })])
    ]);
    this.on('click', [this.invoke('leave')], [this.condition('active')]);
  }
}
```

窗口的「类复用示例」可以直接载入这两个文件。自定义类放进 `shared/` 等目录，再由多个文件 import，类不按贴图或名称决定玩法。

| 对象 | 用法 |
| --- | --- |
| `new Level()` / `new Level(definition)` | 创建空白分层关卡，或从完整地图定义创建；复制输入，不修改基稿 |
| `level.data` / `level.api` | 原有数据与底层编排 API；定义结构和动作继续共用旧 DSL |
| `level.object(id, options, Type?)` | 快捷创建物体，可指定继承 Entity 的类；快捷几何只支持 v3 |
| `level.addObject(data, Type?)` / `new Entity(level, data)` | 注册已有的完整物体定义，兼容 v1/v2/v3 |
| `level.entity(id)` / `new Entity(level, id)` | 引用已有物体，不重复添加；不存在时报错 |
| `level.rule(data)` / `level.art(data)` | 注册完整规则和资源图层 |
| `item.data` / `item.id` | 物体属性和标识 |
| `item.behavior(...)` / `item.on(...)` | 注册行为与事件，可链式调用，返回该物体 |
| `item.move(...)` / `item.set(...)` / `item.invoke(...)` / `item.condition(...)` | 构造动作或条件，语义沿用下表 |
| `Actions.after(seconds, actions)` / `.set(target, state)` / `.invoke(target, behavior)` | 通用动作，target 可为物体或 ID |

类、函数和循环仅用于生成普通数据。`on` 接收动作数组，不接收运行中回调；同一核心校验、模拟、存档与回放继续使用生成结果。美术和动画仍可在画布编辑。

## 执行与兼容

生成在可停止的独立 Worker 中执行，超过2.5秒终止。模块源码通过 Acorn 解析真实语法，字符串和注释中的 import 不当作依赖；浏览器执行原生 ES module，不靠正则改写类或 export。模块 URL 在 Worker 内创建，确保双击离线 HTML 同样可以使用。静态服务为此允许 `script-src blob:` 和 `worker-src blob:`，未开启 `unsafe-eval`。

Worker 隔离阻塞，但不是安全沙箱：只执行信任的代码；它仍具有浏览器允许的网络与存储等能力。运行时不执行作者脚本，生成结果不能包含函数、异步回调或非 JSON 值。错误显示文件、行号或运行调用位置；未使用的文件不会随入口执行，需按需 import。

## 小型 API

在新项目中通过 `level.api` 调用；旧脚本的 `level` 仍是数据，`api` 是原先的 API。也可 `import { createAPI } from '@gothere/core'` 绑定到已有数据。物体引用可传 ID 或 `api.entity()` 返回的对象。

| 方法 | 含义 |
| --- | --- |
| `api.entity(id)` | 查找现有物体，不存在时报错 |
| `api.addObject(data)` / `api.addRule(data)` / `api.addArt(data)` | 注册完整物体、规则和图层 |
| `api.object(id, options)` | 新建普通物体；目前快捷创建只支持 v3 分层关卡 |
| `api.behavior(target, id, actions, label?)` | 添加命名行为，同 ID 则替换 |
| `api.on(target, event, actions, conditions?, details?)` | 添加事件规则；details 可填 other、behavior 等事件字段 |
| `api.set(target, state)` | 状态动作 |
| `api.invoke(target, behavior)` | 调用行为动作 |
| `api.after(seconds, actions)` | 延迟动作；秒数转换为60 tick/秒 |
| `api.move(target, {x, seconds, ...})` | 移动动作，默认保留当前位置的深度和高度；支持 plane、passage、progress |
| `api.condition(target, state)` | 状态条件 |
| `api.empty()` | 返回独立的空白 v3 关卡；使用 `api = createAPI(level)` 重新绑定 API |

对象默认在首个行走层，可用 `plane`、`elevation` 设置层与离地高度，`height` 是物体自身高度。对象也可直接调用 `item.move(...)`、`item.set(...)`、`item.behavior(...)`、`item.on(...)`、`item.invoke(...)` 和 `item.condition(...)`。资源仍可在可视化面板编辑，目前没有资源包 DSL 或运行中脚本。

具体入场、通路进出、持有和接触仍遵循现有模拟约束；API 不推断寻路、不绕过层归属、不保证任意脚本生成的地图都有解。工具实现依据 [Acorn 官方文档](https://github.com/acornjs/acorn/blob/master/acorn/README.md) 与 [fflate 官方文档](https://github.com/101arrowz/fflate)，第三方许可随编辑器打包。
