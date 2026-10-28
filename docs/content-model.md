# 内容模型 v0.6

编辑器、JSON DSL 与未来生成器共同使用 schemaVersion 1。规则是唯一执行依据；可视连线由规则投影，删除、撤销、导入和重新加载都会重建连线。

## 物体与行为

```json
{
  "id":"tool","kind":"object","x":230,"width":48,
  "state":"active","label":"通行小帮手",
  "appearance":{"skin":"orb"},
  "behaviors":[
    {"id":"pickup","label":"拿起","actions":[{"type":"hold","target":"tool"}]},
    {"id":"drop","label":"放下","actions":[{"type":"drop"}]},
    {"id":"rest","label":"休息","actions":[{"type":"set","target":"tool","state":"inactive"}]}
  ]
}
```

所有实体都可定义多个命名行为；行为 ID 在所属实体内唯一，动作引用用实体 ID + 行为 ID。编辑器改名会同步引用；删除实体或行为会清理相关调用、完成事件与空动作树，支持撤销。

appearance 只负责表现。可选内置 skin：axe、crate、crocodile、orb；可以挂载 `image:"data:image/png;base64,..."`（也接受 JPEG/WebP）。图片优先，解码失败回退占位图；换内置外观清除自定义图。命中范围由位置和宽度决定。上传上限 24,000 字节；单图 32,768 字符、地图合计 98,304 字符，拒绝远程地址及 SVG。资源随 JSON 离线携带，动画绑定后置。

通用接触效果 `contact:{"effect":"lethal","message":"碰到了危险物。"}` 与外观无关。接触触发的规则先执行，因此拿起或停用该物体可以解除当前接触危险。未解除时，整个重叠期间都会检查致命效果，包含重叠期间重新启用的物体。

巡逻 `motion:{"type":"patrol","minX":490,"maxX":730,"speed":55}` 的左右界是物体左侧 X。active 且未持有时移动，边界折返；inactive 停止移动及接触，但仍能点击、调用行为。巡逻仍是一项有限能力，尚无完整生物 AI。

## 事件和连线

```json
{
  "on":{"type":"contact","source":"tool"},
  "actions":[{"type":"invoke","target":"tool","behavior":"pickup"}]
}
```

一个事件可在同一规则中调用多个目标，也可连接多条规则；不同事件可以调用同一行为。条件是 AND 列表：`{entity,state}`、`{holding:"tool"}`、`{holding:null}`。条件在事件触发时判断，延迟到期不重判。

| 事件 | 来源与时机 |
| --- | --- |
| click | switch、object；旧 hazard 仅兼容导入 |
| contact | 除 zone 外的实体，进入同层接触范围时一次 |
| enter | plate 首次 idle→pressed；zone 每次进入，disabled 时不触发 |
| board | lift，主角跨过到位轿厢中心时 |
| arrive | 带 vertical transport 的 object、旧 ladder、lift，到达出口并离开运输状态 |
| done | 指定实体的指定命名行为完成，on 还需 behavior 字段 |

zone 为无实体碰撞的区域标记，状态 enabled/disabled，只在编辑画面显示框，可用来触发生物行动。主角接触半径为 10，检测该 tick 移动扫过的范围；楼层由脚底 y 隔离。手持物不对持有者触发接触。离开再进入可重新触发。

行为完成可继续连线：

```json
{"on":{"type":"done","source":"tool","behavior":"pickup"},
 "actions":[{"type":"invoke","target":"door","behavior":"open"}]}
```

完成等待该次调用所有 after 分支和嵌套 invoke 完成。并发调用各自计数、各发一次 done。set 巡逻或电梯目标后动作立即完成，持续移动不属于待完成动作；电梯实际到站用 arrive。done 触发的后续规则不延长原调用的完成时间。

## 编辑与布线

工坊左侧地图，右侧仓库、物体、逻辑、地图页签。仓库按类别与关键词筛选；选中场景物体打开定义、属性及端口。事件槽为输出，命名行为槽为输入，显示连接数量并可开始接线；原规则编辑器保留在逻辑页签。输入/输出槽约定参考 [Godot GraphNode](https://docs.godotengine.org/en/stable/classes/class_graphnode.html)。

连线默认直角折线，双击线添加转接点，拖动吸附到 10 单位网格；双击节点或 Delete 删除，方向键微调。选中线可恢复自动布线或定位规则。支持全部 / 选中物体相关 / 隐藏连线。转接点属于表现元数据，不是新的事件或动作。

每条叶动作可选 `editor:{"waypoints":[{"x":300,"y":180}]}`。点按路径顺序排列，每线最多 16 点，x 在 0～1200、y 在 20～620。元数据跟随动作树，规则重排、对象/行为改名不改变归属；删除动作同步删除布线，撤销和 JSON 备份保留布局。运行内核读取后移除元数据，因此模拟快照、计时器和回放结果不受排线影响。

## 动作

| 类型 | 字段与语义 |
| --- | --- |
| set | target、state，设置合法状态；lift 的 lower/upper 为目标层 |
| invoke | target、behavior，调用该实体的命名行为 |
| hold | target，同层近处 active 的 object，24 单位容差；已有持有物则忽略 |
| drop | 将当前持有物放在身后，保留其状态；空手无影响 |
| hurt | 可选 message，直接失败；尚无血量系统 |
| turn | direction 为 -1 或 1，改变主角水平朝向 |
| after | ticks 后执行 actions，嵌套延迟相对实际执行时刻计算 |

持有是主角的一个物体引用。物体仍保留外观和行为，随主角移动；巡逻与对主角接触暂停。行为仍能被连线调用。放下不隐式停用，若要放下后休息，在同一行为中另外设置 inactive。

实体状态：switch off/on；bridge folded/extended；gate closed/open；plate idle/pressed；object active/inactive；zone、ladder enabled/disabled；lift lower/upper。旧 hazard running/stopped 仅导入兼容，运行时映射为通用接触伤害，新工具不再创建。

## 空间与通行

世界固定 1200×640。actor、goal、platform、entity 的脚底 y 默认为 440，可设 160～560，越小越高。actor.direction 为 1 或 -1，speed 为世界单位/秒。不同高度支撑、接触、终点隔离。

通用物体可附加高度移动能力：

```json
{"id":"channel","kind":"object","x":280,"width":60,"y":440,
 "state":"active","label":"高度通道",
 "transport":{"type":"vertical","toY":260,"speed":90,
              "upperDirection":1,"lowerDirection":-1}}
```

`y` 为下端，`transport.toY` 为上端，至少相差 40；速度为单位/秒。`active` 接受进入，`inactive` 停止新进入；已开始的运输完成。高度移动与左右巡逻暂不同时启用。物体可有多个行为和接触效果，支持 `arrive` 连线，外观独立。运输物被持有时不接受进入，主角正在使用的通道不能被他拿起。

旧 ladder 和 lift 沿用根字段 y、toY、speed、upperDirection/lowerDirection。上下端只要求宽度范围与对应高度的路面相交，不要求中心对齐；高度通道在入口/出口对接实际接壤位置。编辑时在 24 单位内吸附，保存为精确高度，内核运行时不模糊匹配楼层。电梯轿厢在当前高度提供支撑，可让井口留空。

主角始终行走，不自动等车。通用高度通道在走入有效接壤范围时开始运输，起点已在范围内也可进入。旧 enabled 梯子沿用跨过中心的进入方式，支持宽度内的偏移路面。电梯仅在轿厢到位时接受登车，board 规则可以调用上楼/下楼行为。未命令离开本层则继续水平行走；空井缺少支撑立即掉落。运行途中可改变电梯目标，抵达端点后按出口朝向继续，离开设施范围后才能重新进入。

实体可选 `height`（8～240）描述几何显示/选择范围；未设置时沿用类型默认高度。`width` 同时影响水平接触范围。高度通道的高度由上下端点决定，路面的厚度仅为显示。普通物体的 height 不改变按脚底楼层隔离的接触语义。

```json
{"on":{"type":"board","source":"elevator"},
 "actions":[{"type":"invoke","target":"elevator","behavior":"up"}]}
```

没有自由跳跃、连续坠落到低层或自动寻路。无支撑直接失败，非终点画布边界失败；先检查同层终点，因此抵达边界上的合法终点仍可成功。

## 顺序与预算

每 tick：时钟 → 到期动作（due/order）→ 点击（输入顺序）→ 巡逻/电梯移动 → 主角行走/显式通行及 board/arrive → 接触/区域/踩板 → 支撑和门 → 终点/边界。每个实体自身的接触规则先于自身默认致命效果；实体和规则均按声明顺序执行，后续可观察前面的修改。after 不取消，到期动作按顺序生效。

固定 60 tick/秒。重置清空持有、联系状态、输入、延迟、楼层和方向；回放记录输入 tick，与同一关卡产生同一模拟结果。草稿和模拟互不修改。

上限：64 个实体、64 段平台、128 条规则；每实体 16 个行为；每列表 1～32 动作、after 最深 4 层、关卡总动作 512；每 tick 1,024 动作、256 个待执行计时器、调用深度 32、每局 36,000 tick。超过运行预算明确失败，可重置。未知能力、无效状态和悬空引用加载前拒绝。

文件导入上限 256 KiB，草稿工作区上限 2 MiB。编辑中几何可以暂时不完整，但引用保持有效；试玩前进行完整验证。`src/examples.js` 是三张完整例子，在「新机制试验场」选择后打开工坊即可编辑。
