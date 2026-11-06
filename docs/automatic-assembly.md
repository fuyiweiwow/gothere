# 自动装配：只声明要用的实例

v0.36.0。自动装配用于目录资源作者项目（项目格式版本2）。普通类、资源文件、通用函数不会自动变成游戏物体。编辑器只扫描明确的导出声明，不执行源码来发现内容，也不依据文件名猜测玩法。

## 新建一个物体

源码左栏点「新建」，填入 `objects/toy.ts`，内容选「物体实例 · 自动装配」。文件模板包含类、可编辑的构造参数、`configure()` 和一条实例声明。修改它的名字、位置与交互即可，不必再到入口或 index 文件中添加 import、new 和初始化调用。

一个实例由以下声明加入当前项目的默认装配集合：

```ts
import { instance } from '@gothere/core';
import { Box } from '../shared/box.ts';

export const leftBox = instance(Box, {
  args: context => ['left-box', context.layers.street.at(300)],
  order: 10
});

export const rightBox = instance(Box, {
  args: context => ['right-box', context.layers.street.at(700)],
  order: 20
});
```

`Box` 是普通的 Entity 子类，其构造函数接收上下文、稳定 ID 和位置。参数签名由 TypeScript 检查；仅需上下文的类可写 `instance(Box)`。同一个类可声明多份实例，不需要复制类。图片、行为、能力和事件仍由作者自由组合，不绑定公交站等特定主题。

导出名成为 `objects.leftBox`，拥有具体的 Box 类型，行为槽、补全、悬停及 F12 可用。物体的稳定 ID 与导出名是两回事；移动文件不改变它们。重命名文件会更新静态 import，自动清单随之更新。手动改导出名后，其他引用会通过类型检查报告，无自动全局符号重构承诺。

## 初始化顺序

1. 按固定顺序求值实例的 `args(context)`，构造全部物体及其行为槽。
2. 全部实例可用后，框架依次调用存在的 `configure(objects)`。
3. 入口继续显式连接路线、场景事件与表现。

物体自己的点击等交互可以写在类中，跨对象连线也可写在 `configure`；无需强制集中到 events.ts。events.ts 继续可编辑，自动导出仍保留原始规则顺序，以免改变同一事件下动作的先后。

构造阶段只使用地图和资源上下文；跨对象依赖在 configure 中连接，避免构造顺序依赖。configure 是作者生成阶段的同步初始化，不是运行中回调。可以让参数类型只接收所需的对象子集。异步初始化会被拒绝，不静默生成半张地图。

`order` 是可选的固定安全整数，默认0；相同时按文件路径与导出名的固定字符顺序处理，不使用系统语言排序。画布导出的实例保留原数据顺序。更改顺序可能影响数据与事件顺序，因此不会随机初始化。`createObjects(context)` 每次构造一套实例，同一关卡只调用一次；反复调用会因重复 ID 报错。

## 新增布景分组

「新建 → 布景分组 · 自动装配」生成以下形态：

```ts
import { sceneGroup } from '@gothere/core';
import type { ProjectContext } from '../context.ts';
import type { Objects } from '@gothere/objects';

export const streetDecor = sceneGroup(
  (context: ProjectContext, objects: Objects) => {
    const { scene, assets } = context;
    const shop = scene.image('shop-view', assets.images.street.shop)
      .label('店面').at(200, 300).size(180, 120).order(-10);
    return { shop };
  },
  { order: 10 }
);
```

统一 `createSceneGroups(context, objects, styles)` 自动调用已声明的分组，合并具名图层引用；原有背景、分组、样式、动画音效与绑定均可编辑。两个分组返回相同图层属性或 ID 时会报错，避免后者覆盖前者。

画布导出的 `scene/visuals.ts` 保留显式图层顺序，以维持相同层级下的既有显示关系；新分组的图层自动追加，不必改清单。想插在某个已有图层之间时仍可编辑该顺序；删除被明确引用的旧图层会有失效引用提示。图层的显示层级仍由已有空间和美术配置决定，分组装配顺序不替代这些配置。

## 发现规则与手动控制

- 在项目任意 `.ts` / `.js` 模块中直接从 `@gothere/core` 导入 `instance` / `sceneGroup`，通过顶层 `export const name = instance(...)` / `sceneGroup(...)` 声明参与装配。支持导入别名和 namespace 写法；扫描全部作者文件，因此移动到 shared 等目录后仍有效。
- 普通类与函数不带该声明就不参与。定义库应只导出类/函数；不想装配某个实例时移除相应导出声明。不会扫描所有 Entity 子类并替作者实例化。
- 首轮只识别上述直接声明，不跟踪自定义包装函数、转出 SDK 标记的中间模块、运行时条件和反射注册。作者可以继续显式调用普通函数、循环和 new，自动装配不限制原有编排能力。不能将同一份内容同时手动与自动创建。
- 同类装配声明的导出名在项目中必须唯一。order 必须直接写数字，装配选项不支持展开或运行时计算；args 的同步表达式可以灵活计算参数。
- 当前集合面向一个作者项目的默认场景；多场景选择与独立场景作用域尚未实现。共享定义库不应导出默认场景实例。

## 生成文件、保存与旧项目

`@gothere/objects` 对应只读的 `.gothere/objects.ts`，提供 createObjects 和 Objects 类型；`@gothere/scene-groups` 对应 `.gothere/scene-groups.ts`。可以在文件树查看，不能手写、删除或选为入口。物体引用 F12 直接回到作者的实例声明，行为继续跳到具体类实现。

新导出的 objects/index.ts 只是转出入口，不再列举实例。已保存的手写 v1/v2 项目不自动替换代码；显式「从当前画布生成源码」才采用新结构，并备份上一版。无装配声明的旧项目继续按自己的入口运行。作者可以逐步改写，但没有自动迁移任意手写初始化代码的功能。

项目 ZIP 保存作者声明、资源和已有元数据；装配清单在重新打开时重建，不作为手写源码导出。在线和单文件离线版使用同一扫描、类型检查和生成流程，再交给原来的数据校验及模拟。不引入运行时反射容器，不根据物体名称添加专用规则。稳定发现和初始化顺序继续遵循 [种子复现边界](seed-sharing.md)。
