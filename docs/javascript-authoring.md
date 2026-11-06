# TypeScript 关卡项目与画外编辑

v0.36.0。在线、静态预览与单文件离线版共用同一套工具，使用者不需要安装 npm。新项目使用 TypeScript；旧 JavaScript 和 JSON 仍可导入，运行时继续使用原有数据、校验器与确定性模拟。

## 从哪里开始

顶部「关卡源码」（Ctrl+O）打开左侧文件树、右侧代码区。点击「从当前画布生成源码」会得到：

```text
level.ts            入口：构造上下文、物体、路线、事件和美术
context.ts          ProjectContext：明确类型的地图与资源依赖
map.ts              行走层、路面、路线点、主角和终点
routes.ts           用已创建的物体连接跨层路线
resources.ts        转出目录资源入口，无需逐项声明
assets/images/      图片目录（内置引用与导入图片）
assets/sounds/      导入音效目录
.gothere/assets.ts  自动生成的只读目录类型索引
.gothere/objects.ts 自动生成的实例与初始化清单
.gothere/scene-groups.ts 自动生成的布景分组清单
events.ts           跨物体事件与动作
scene.ts            装配场景模块
scene/
  styles.ts         可复用图片样式模板与帧动画
  group建筑.ts      具体分组的摆放与绑定（文件随分组生成）
  visuals.ts        合并图层引用，保持原始显示顺序
  feedback.ts       行为、状态与事件的动画音效订阅
  compositions.ts   用图层/物体引用建立编辑组合
objects/
  index.ts          转出自动装配入口，无需手写初始化清单
  bus.ts            一个物体的类、能力、行为与显式实例声明
  ...
@gothere/core       内置基础库，可查看 API 类型声明
```

首次打开新源码槽会生成 TS 项目。已保存的 JS/TS 项目保持原样；要迁移时显式点击「从当前画布生成源码」，旧源码会备份，可「恢复之前的项目」。这会重新生成代码，不能自动保留自定义类、函数和注释，手写库请先导出 ZIP。

- 文件树可搜索、折叠；各文件有独立页签和撤销历史。除入口外，页签可关闭，关闭不删除文件或丢弃修改。Tab 缩进，Shift+Tab 反向缩进；先按 Esc 再按 Tab 可离开代码区。
- 「新建」填写 `shared/cart.ts`，自动形成目录；内容可选普通模块、物体实例或布景分组。物体/分组 TS 模板参与自动装配；普通模块也支持 `.js`。重命名会解析并更新静态 import、type import 和 re-export；有语法错误时先修正。删除前备份，入口文件需先更换入口再删除。
- Ctrl+S 保存整个源码项目，Ctrl+Enter 生成并校验，F5 生成并临时试玩。生成成功后可替换画布（一次撤销）或另存为新草稿。
- ZIP 保留源码、资源字节及编辑器维护的内部元数据；旧纯源码 ZIP 仍按首个源文件选入口。可重新载入继续编辑，无需手写资源清单。导出单文件时，其依赖需自行保留。
- 载入支持 `.zip`、模块 `.ts`、旧 `.js` 和 `.json`。旧手写 JS 保存在兼容入口中，不执行迁移脚本，也不自动拆解手写函数。

画布与源码分别保存。生成、类型检查和错误修正不会改变画布，应用才会改变；源码变化会使旧生成结果失效。源码项目上限256个文件、合计2 MiB，生成数据上限1 MiB。

左栏「＋ 图片 / 音效」导入文件或目录，填写可选子目录即可得到 `assets.images.street.bus` 等可补全引用。图片/声音可在文件树中预览，F12 跳到原文件；索引只读。重命名保留资源 ID，并更新可解析的完整目录引用；无法安全更新的解构/目录别名会提示。资源随 ZIP 和离线编辑器保存，规则和限制见 [目录资源约定](resource-conventions.md)。

新项目通过 `export const item = instance(MyClass, { args: context => [...], order: 10 })` 声明实例，框架创建全部实例后统一调用 configure；普通类不会自动实例化。同一个类可传参声明多份，Objects 类型、补全与定义跳转会自动更新。`sceneGroup()` 声明的布景组也由统一入口装配，新增图层自动追加。顺序、参数、手动控制及兼容边界见 [自动装配](automatic-assembly.md)。

## 查找、修改与试玩

画布选中公交等物体，再打开「关卡源码」，会定位其唯一静态类声明。左栏切换「关卡对象」可浏览中文物体名称、命名行为及相关事件、资源引用；点击行为直达 `.actions(...)` 的实现。共用搜索框同时支持文件名和项目全文，Ctrl+Shift+F 聚焦搜索。索引由 TypeScript AST 和类型关系建立，重命名后重新索引；不会通过物体 ID 猜文件名，也不会执行源码来索引。动态工厂、计算出的 ID 或多个同 ID 类无法唯一映射时，使用全文搜索继续定位。

例如：搜索「开门」，打开公交行为，将驶离动作的 `seconds: 3` 改成 `seconds: 4`，按 F5。右侧使用同一模拟器的独立副本试玩；可切换美术/逻辑显示、暂停、单步、重置、点击机关和拖放物品。勾选「点选查源码」会暂停，点物体跳回源码并显示相关行为、事件与资源。收起试玩可扩大代码区。修改源码会暂停旧试玩并标记过期，重新生成才更新结果。

源码保存、当前源码是否已生成、生成结果是否与画布一致，分别显示。展开底部变更列表可查看相对当前画布的真实字段变化，例如位置 `520 → 500`、时长 `3 秒 → 4 秒`；即使物体数量不变也能看到。大型内嵌资源值缩略显示，列表最多显示200处。

若画布在上次源码同步后另有修改，替换前需查看差异并勾选确认，也可直接另存为新草稿。改源码、重新生成或画布再变化都会使确认失效。替换先保存最近一次画布备份，备份失败则停止应用；应用后 Ctrl+Z 可撤销。重新打开源码可「导出替换前画布」，得到可导入的关卡 JSON。此备份仅保留最近一次替换，不是版本库，也不自动合并两边修改。项目仍需导出 ZIP 备份手写代码。

## 用领域对象描述地图

```ts
import { Level } from '@gothere/core';

export function createMap(): Level {
  const level = new Level('前街到后街', {
    id: 'my-street', description: '帮他走到后街。'
  });
  const front = level.layer('front', { screenY: 550, order: 1 });
  const back = level.layer('back', { screenY: 320, order: 0 });
  front.ground({ from: 20, to: 1180 });
  back.ground({ from: 20, to: 1180 });

  const start = level.point('start', front.at(60));
  const entry = level.point('entry', front.at(800));
  const exit = level.point('exit', back.at(800));
  const finish = level.point('finish', back.at(1100));
  const alley = level.passage('alley', entry, exit, {
    label: '窄巷', distance: 260, size: { width: 40, height: 12 }
  });
  level.route(start, entry, alley, exit, finish);
  level.traveler({ start, speed: 70 });
  level.destination(finish);
  return level;
}
```

`screenY` 是路面的画面基线，由库推导旧数据中的深度；`front.at(x, {height})` 是所属层上的位置，height 是真实离地高度。斜路可用 `ground({from,to,height,endHeight})` 设置两端高度。内外行走与真实升降仍是两种空间含义，不因画面纵坐标变化自动变成斜坡。

`level.route()` 连接同层位置或命名路线点；跨层必须经过显式通路。`level.passage()` 创建普通物体的通路能力并返回路线引用；已有通路物体使用 `level.through(objects.itemAlley)`，生成项目在物体创建后连接路线。旧字符串入口继续兼容。路线不负责寻路、修路或保证有解。

已有层与点用 `level.layer(id)`、`level.point(id)` 取回。Layer、Position、RoutePoint、Passage 在类型系统中区分；不能把 Layer 当作 Position。跨关卡引用还会在生成时拒绝。

## 组合物体能力与可复用类

生成项目采用显式依赖注入。`ProjectContext extends LevelContext` 包含 `map`、`layers`、`points`、`images`，这些类型从声明函数推导。`Entity<C>` 继承 `LevelComponent<C>`，子类可通过 `this.context` 获取项目的具体依赖，也可使用 `this.scene`、`this.resources`。不通过任意字符串向全局容器索取物体。

物体先在构造时注册行为槽，再统一执行 `configure(objects: Objects)`。Objects 的属性是具体的子类实例，跨物体调用例如 `objects.itemBus.doLeave.invoke()`，而非 `level.entity('bus').invoke('leave')`。这两阶段允许公交引用乘客、乘客又引用公交，同时避免访问尚未初始化的实例；type import 不形成运行时依赖环。注册和动作数组仍然是生成数据，不是在模拟期间执行回调。

```ts
class Bus extends Entity<ProjectContext> {
  readonly doLeave = this.behaviorSlot('leave', '驶离');

  constructor(context: ProjectContext) {
    super(context, 'bus', {
      at: context.layers.streetBusRoad.at(500),
      size: { width: 30, height: 75 }, kind: Kinds.Object
    });
  }

  configure(objects: Objects) {
    this.doLeave.actions([
      Actions.set(objects.itemDepartReady, States.Inactive),
      this.move({ to: this.context.layers.streetBusRoad.at(1300), seconds: 3 })
    ]);
    // this.context.images.imageBlockBusBack 是具体图片引用，可补全、跳转。
  }
}
```

系统关键字有来源：事件使用 `Events.Click`，状态 `States.Active`，伤害 `Effects.Lethal`，常用动画 `Motions.Recoil` 等。物体、资源、行为自定义名称在声明处仍需稳定 ID，生成后写入已有运行数据；后续关联尽量使用引用。旧字符串 API 保留兼容，不要求手写旧项目立即迁移。

```ts
// shared/departing-object.ts
import { Entity, Actions, Events, States, Effects, LevelContext, type Level, type Position } from '@gothere/core';

export class DepartingObject extends Entity {
  readonly doLeave = this.behaviorSlot('leave', '向右驶离');

  constructor(context: LevelContext | Level, id: string, at: Position) {
    super(context, id, { at, size: { width: 64, height: 44 } });
    this.contact({ effect: Effects.Lethal, message: '撞上了挡路物。' });
    this.doLeave.actions([
      this.set(States.Inactive),
      Actions.after(0.2, [this.move({ to: at.layer.at(1350), seconds: 2 })])
    ]);
    this.on(Events.Click, [this.doLeave.invoke()], [this.condition(States.Active)]);
  }
}
```

在其他文件中 import 后 `new DepartingObject(level, 'cart', street.at(520))`。编辑器的「类复用示例」可直接试玩。类只组织创作代码；物体不因名字或贴图被赋予隐藏规则。

| API | 用途 |
| --- | --- |
| `level.object(id, {at,size,...})` / `new Entity(level,id,options)` | 创建物体；默认普通物体、active 状态 |
| `level.entity(id)` / `new Entity(level,id)` | 引用已有物体，不重复创建 |
| `item.contact({effect:Effects.Lethal})` | 接触造成致死伤害 |
| `item.surface({enabled:true})` | 添加承托面与默认旋转姿态 |
| `item.draggable({targets:[objects.itemBowl]})` | 玩家可拖放到指定物体 |
| `item.dropTarget({radius:32})` | 添加接收拖放能力 |
| `item.connect(fromPoint,toPoint,{distance})` | 添加通路能力 |
| `item.behavior(id,actions,label?)` / `.on(event,actions,conditions?,details?)` | 注册行为与事件，返回物体，可链式调用 |
| `item.behaviorSlot(id,label?)` | 声明行为引用，使用 `.actions()` 配置、`.invoke()` 调用 |
| `item.move({to:position,seconds})` | 构造移动动作，目的地明确所属层和高度 |
| `item.set(state)` / `.invoke(behavior)` / `.condition(state)` | 状态动作、调用行为和状态条件 |
| `item.hold()` / `Actions.drop()` | 构造持有或放下动作，无须专用物品类型 |
| `Actions.after(seconds,actions)` / `.set(target,state)` / `.invoke(target,behavior)` / `.move(target,options)` | 通用动作；target 可为物体或 ID |
| `level.data` / `item.data` / `level.api` | 完整数据与兼容入口；用于还未封装的字段 |

事件接收动作数组，不接收运行时函数。通路上的移动用既有 `passage`、`progress` 参数；当前层移动可用 `to`。能力组合仍须遵守引擎约束：拖放物不同时承托/旋转/巡逻；通路物体不同时承托；跨层移动须符合现有端点规则。`carriedPhysics` 仅为旧 v1 兼容接口，v3 不支持，不把它描述为新能力。

地图生成器为可保真的 v3 数据输出上述 API。旧 v1/v2 或含不能保真表示的扩展数据使用 `new Level(完整定义)`。`Level.data` 与完整物体定义允许兼容数据，类型约束重点在语义 API，所有输出仍需运行校验。

## 用资源模板搭场景

`resources.ts` 从 `@gothere/assets` 转出 `createAssets`，返回按目录生成的 ImageAsset / SoundAsset 引用；媒体字节存放在资源项目中。新 ProjectContext 将它注入为 `context.assets`，无需逐一 import 或注册图片。`scene/styles.ts` 将同类图层的共同尺寸、显示顺序、帧动画等提为模板；模板可多次放置，实例仍可覆盖大小、偏移和状态变体。

```ts
const { scene, assets } = context;
const shopStyle = scene.template(assets.images.builtin.blockShop, { height: 120, layer: -75 });
const shop = shopStyle.place('shop-a').label('店面', '建筑')
  .at(195, 424).size(215, 120);
const bus = scene.image('bus-picture', assets.images.builtin.blockBusBack)
  .label('公交').at(-80, -90).size(263, 95).order(10)
  .bind(objects.itemBus)
  .variant(States.Inactive, { visible: false });
const feedback = scene.feedbackTemplate({
  label: '驶离反馈', motion: Motions.Recoil, particles: Particles.None,
  sound: Sounds.Puff, duration: 40, delay: 0, strength: 0.12,
  loop: false, hold: false, policy: FeedbackPolicies.Restart,
  anchor: { x: 0.5, y: 0 }, count: 12, color: '#c4d7e3', direction: -90, volume: 0.25
});
feedback.attach('departure', bus,
  { type: FeedbackTriggers.Behavior, behavior: objects.itemBus.doLeave });
```

动画帧也接收 ImageAsset 数组，声音可为 Sounds 常量或 SoundAsset；不同关卡的资源和物体绑定会拒绝混用。背景和活动图片使用同一 API，不从图片名推断碰撞或机关。`scene.arrange([...visuals])` 按引用恢复原图层顺序，`scene.compose()` 按引用建立编辑组合。未知扩展属性可通过 `properties()` 兼容保留。

分组文件、样式和反馈是实际可编辑的创作接口，仍需作者选择构图、图片和位置；不会自动把扁平插画拆成可交互部件，也没有宣称生成器能理解任意素材的语义。

## 类型提示和错误定位

内置 TypeScript 5.9.3 Language Service 在独立后台 Worker 中运行，离线无需 LSP 服务或 CDN。Ctrl+Space 获取实际推断的补全，包括跨文件自定义子类方法；悬停显示类型签名和文档。TS 错误有源码波浪线及底部问题列表，点击问题跳到文件位置。

生成前对全部 TS 文件做语法与严格语义检查，包括入口未引用的文件；错误时不执行生成器。旧 JS 保留兼容，只做语法检查，不强制添加类型。物体 ID 是否存在、动作是否可组合、状态是否有效和关卡能否通关不是 TS 能完全保证的，继续由运行校验和试玩验证。

F12、「转到定义」按钮或 Ctrl+点击跳到项目声明；Alt+← /「← 返回」回到原文件与光标。对象属性跳到装配声明，行为槽跳到子类字段，资源跳到资源目录，SDK 常量跳到只读基础库声明。使用真实 TypeScript 定义查询，没有按字符串 ID 猜测位置。

这是嵌入语言服务，没有实现外部 LSP 协议、自动导入或 IDE 级重构。静态模块支持相对完整文件名（`.ts` / `.js`）、核心库、别名、命名空间和再导出；不支持 npm 包、外部 URL、动态 import、循环依赖与异步入口。更改底层引擎仍需修改应用代码，作者代码不能凭空定义新的运行时动作。

## 画外入场与离场

工具栏勾选「画外工作区」，空格或中键拖动查看左右留白；「适合窗口」回到1200×640游戏画面。主角越界规则不变。

- 仓库选择画外物体或图片时会自动展开留白并定位；普通物体属性可「放到左侧画外」「放到右侧画外」「定位物体」。
- move 动作可「驶出左侧」「驶出右侧」或「在画布点选目标 X」，Esc取消。快捷目的地计入逻辑与所有绑定图片的大小及偏移，留24像素，不只检查碰撞体。
- 入场：初始放到画外，再由区域、点击或行为完成事件调用普通移动。离场使用同一种 move。`moved` 事件表示真实移动完成，`done` / `after` 不会等待移动。

仅适用于无承托、旋转、巡逻或通路位置的普通空间物体。物体 X 范围 -1200～2400（右端计逻辑宽度），超出范围会提示，不能借留白扩展主角世界。地面、路线点、主角与终点保留原有边界。

## 执行边界与实现资料

类型检查最多等待20秒，作者代码执行超时2.5秒，可停止。编译和生成都在后台 Worker，地图 UI 不解析编译器。离线 HTML 因打包编译器与标准库增至约6 MiB，首次检查需初始化语言服务。

浏览器执行编译后的原生 ES modules；Acorn 解析真实模块引用，模块 URL 在生成 Worker 内创建以兼容 `file://`。Worker 可终止阻塞，但不是安全沙箱；只执行信任的代码。生成数据不得含函数、异步值或非 JSON 值。运行时和回放不执行作者源码。类型错误定位到原 TS 行列；执行异常显示原文件名，但行号可能对应编译后 JS，暂未接入 source map。

依据 [TypeScript Language Service API](https://github.com/microsoft/TypeScript/wiki/Using-the-Language-Service-API)、[TypeScript 扩展导入选项](https://www.typescriptlang.org/tsconfig/allowImportingTsExtensions.html)、[Acorn 官方说明](https://github.com/acornjs/acorn/blob/master/acorn/README.md)与 [fflate 官方说明](https://github.com/101arrowz/fflate)。许可随编辑器打包。
