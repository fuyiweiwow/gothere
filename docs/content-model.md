# 内容模型 v0.14

编辑器、JSON DSL 与未来生成器共同使用 schemaVersion 1。规则是唯一执行依据；可视连线由规则投影，删除、撤销、导入和重新加载都会重建连线。

## 物体与行为

```json
{
  "id":"tool","kind":"object","x":230,"width":48,
  "state":"active","label":"通行小帮手",
  "presentation":{"symbol":"block","color":"#9db9ad","animation":"none"},
  "behaviors":[
    {"id":"pickup","label":"拿起","actions":[{"type":"hold","target":"tool"}]},
    {"id":"drop","label":"放下","actions":[{"type":"drop"}]},
    {"id":"rest","label":"休息","actions":[{"type":"set","target":"tool","state":"inactive"}]}
  ]
}
```

所有实体都可定义多个命名行为；行为 ID 在所属实体内唯一，动作引用用实体 ID + 行为 ID。编辑器改名会同步引用；删除实体或行为会清理相关调用、完成事件与空动作树，支持撤销。

可选 `presentation` 保留旧草稿的程序化表现兼容：symbol 为 block、cloud、beam、umbrella、pot、creature 或 support；color 为六位十六进制颜色；animation 为 none、bob 或 pulse。当前编辑器使用下文的 `scene` 配置图片与动画；逻辑属性面板不再编辑这些旧表现字段。渲染器只读实体状态、真实姿态/坐标和模拟 tick，不影响机制。

旧 `appearance` 仅保留数据导入兼容，可包含 axe、crate、crocodile、orb 内置 skin 及有界 PNG/JPEG/WebP data URL；仍拒绝远程地址和 SVG。当前编辑器不显示旧贴图，也不提供上传。完整资源包和状态到动画片段的映射尚未实现。

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
| rotated | 具有 pose 的 object，当前旋转命令实际执行到目标角度 |
| supportlost | 动态 object 的有效支撑消失，或 supportProbe 的检测点从有支撑变成无支撑；同高度替代支撑不触发 |
| supportfound | supportProbe 的检测点从无支撑变成有支撑；初始支撑不触发 |
| landed | 动态 object 下落后落在承托面上；初始静止支撑不触发 |
| impact | 带 collider 或 surface 的 object 受到动态物体落下撞击；可选 on.other 筛选撞击者 |
| actorlanded | 主角下落后安全落到该实体的 collider 上沿或 surface；持续行走和初始站立不触发 |
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
| rotate | target、angle（-75～75 度）、ticks（1～3600 整数），从当前角度匀速旋转到目标 |
| enable | target、capability（collider 或 surface）、enabled（布尔值），启停已配置的能力，保留外观和 active 状态 |
| after | ticks 后执行 actions，嵌套延迟相对实际执行时刻计算 |

持有是主角的一个物体引用。物体仍保留外观和行为，随主角移动；巡逻与对主角接触暂停。行为仍能被连线调用。放下不隐式停用，若要放下后休息，在同一行为中另外设置 inactive。

实体状态：switch off/on；bridge folded/extended；gate closed/open；plate idle/pressed；object active/inactive；zone、ladder enabled/disabled；lift lower/upper。旧 hazard running/stopped 仅导入兼容，运行时映射为通用接触伤害，新工具不再创建。

### 时机窗口与恢复

限时效果由普通行为组合。例如点击规则仅在 inactive 时调用出现行为，行为依次 set active、enable surface，然后 after 300 tick 停用 surface 并 set inactive。活动期间重复点击不满足条件，不会叠加时长；到期后重新允许触发。编辑器中的延迟秒数转换为整数 tick 保存。

旋转机关可以在激活后启动 rotate，再 after 指定时长旋回原角度；需要等旋转完成后才重新允许触发，可使用 rotated 事件，或显式延迟恢复。生物受撞后可 set inactive 并 after 恢复 active；伤害来自接触规则调用的行为。过晚操作不另设失败计时器，由真实路线、下落或危险接触自然产生结果。

条件只在事件触发时判断。after 到期不会重新检查原条件，也不会因状态变化而自动取消；反复调用和不同延迟分支仍按既有顺序执行。需要防止重入时，由状态条件和行为共同表达，不使用关卡专用时钟。

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

主角始终行走，不自动等车。通用高度通道在走入有效接壤范围时开始运输，起点已在范围内也可进入。旧 enabled 梯子沿用跨过中心的进入方式，支持宽度内的偏移路面。电梯仅在轿厢到位时接受登车，board 规则可以调用上楼/下楼行为。未命令离开本层则继续水平行走；没有车时不会等待。运行途中可改变电梯目标，抵达端点后按出口朝向继续，离开设施范围后才能重新进入。

实体可选 `height`（8～240）描述几何显示/选择范围；未设置时沿用类型默认高度。`width` 同时影响水平接触范围。高度通道的高度由上下端点决定，路面的厚度仅为显示。普通物体的 height 不改变按脚底楼层隔离的接触语义。

```json
{"on":{"type":"board","source":"elevator"},
 "actions":[{"type":"invoke","target":"elevator","behavior":"up"}]}
```

### 斜面与可选重力

```json
{
  "world":{"width":1200,"height":640,"groundY":440,
           "physics":{"gravity":900,"maxFallSpeed":480}},
  "platforms":[{"x":200,"width":240,"y":200,"yEnd":340}]
}
```

`world.physics` 是可选的地图运行规则。存在时两个参数均必填：gravity 为 60～3600 单位/秒²，maxFallSpeed 为 60～1800 单位/秒；不提供时沿用旧版缺路直接失败，旧解法与回放不受影响。开启后主角失去支撑进入 `falling`，保持水平速度，下落到第一个承托面后恢复 `walking`。下落没有额外距离伤害，碰到非终点画布边界失败；没有自由跳跃或自动寻路。

路面 `y` 是左端高度，`yEnd` 是右端高度；缺省 yEnd 时为水平面。两端均为 160～560，路面水平宽度至少 1。含 yEnd 的地图运行时必须开启重力。起点与终点校验使用所在 X 的实际路面高度。相邻面的接缝需精确相接；不同高度的重叠面不会将主角吸上去。交叉路面保留当前支撑，支撑丢失才下落。

每 tick 可经过路面接缝、离开边缘、下落、落地并继续行走；采用连续轨迹与承托线的交点，检测 tick 中间的窄落点。高度通道可连接静态斜面的实际采样高度，吸附取通道中心在相交路面上的高度。桥展开、电梯轿厢、启用的物体承托面及矩形碰撞体上沿均可承托主角。

路面是单向承托线。普通接触仍采用脚底高度及水平范围约定，重力模式沿本 tick 的斜面/下落轨迹检测；启用的 collider 上沿也参与接触规则及致命效果检测。仅显式配置 collider 时尺寸才参与下述物体支撑模型。主角落地写入 `kind:'land'` 日志，落在实体上时另发 actorlanded；快照的主角 `vy` 和 `support` 在重置时清空。

### 物体姿态、承托与旋转

```json
{"id":"panel","kind":"object","label":"翻板","x":200,"y":260,"width":300,"state":"active",
 "pose":{"angle":0,"pivot":0},"surface":{"enabled":true},
 "behaviors":[{"id":"lower","label":"放下","actions":[{"type":"rotate","target":"panel","angle":30,"ticks":60}]}]}
```

`pose` 与外观和承托分离，`surface` 可选。angle 为 -75～75 度，正值向右下倾斜；pivot 为 0～1 的长度比例（0 左端、0.5 中间、1 右端）。x/y 是未旋转时的左基点，width 是局部长度，世界支点为 `(x+width*pivot,y)`。两端围绕支点旋转，水平投影宽度随角度变化；承托与接触使用变换后的基线，显示厚度不参与碰撞。

`surface.enabled:true` 提供单向承托，需开启 world.physics；未配置时旋转不产生隐形路面。active/inactive 只管原有接触和巡逻，承托独立；持有时承托暂停，放下后恢复。起点和终点也可位于初始姿态的有效承托面。`enable` 动作可启停该承托面；动态矩形可以停在其上，失去支撑后自行下落。

旋转命令按固定 tick 插值；点击/到期动作启动的命令在同 tick 推进第一帧。新命令替换同物体的旧命令，从当前角度重新计时；旧命令不再发完成事件。实际执行指定时长后发一次 `rotated`，可连接任意行为。暂停冻结，重置恢复初始姿态，回放使用相同步长；日志记录旋转结束，快照 `rotation` 显示起始/目标角度、总 tick 和已执行 tick。

`rotate` 启动持续运动，不延长命名行为的 `done`；等待实际运动结束需连接 `rotated`。物体先更新运动，再处理动态物体和主角的承托搬运，随后按实体声明顺序发旋转完成事件；事件启动的新旋转从下一 tick 推进。主角保持局部站立位置，再继续水平行走，走出真实端点后下落。巡逻平移可与旋转组合；pose 与 transport/collider 当前互斥。暂不检测旋转扫过的整块体积或侧面挤压。

可编辑角度、任意比例支点、承托开关和行为中的目标角度/秒数；端点节点改变长度与角度并保持另一端位置，整体拖动保留姿态。校验初始/目标端点 Y 为 160～560，超界需调整后运行；草稿可暂时关闭重力，运行校验会提示。关闭姿态前需移除引用它的旋转动作与完成连线，避免规则丢失。

### 矩形碰撞体、动态下落与撞击

```json
{"id":"weight","kind":"object","label":"落物","x":515,"y":280,"width":30,"height":30,"state":"active",
 "collider":{"enabled":true},"body":{"type":"dynamic"}}
```

`collider` 是可选的直立矩形（宽 width、高 height，缺省高 36，y 为底边）。上沿 `y-height` 承托主角和其他物体；不配置 body 时保持固定位置，仍可沿既有 patrol 路径移动。配置 `body:{type:'dynamic'}` 后由地图的 gravity/maxFallSpeed 驱动竖直运动；body 要求 collider 和 world.physics，不与 pose、transport 或巡逻组合。矩形碰撞体暂不支持旋转。未启用这些能力的旧物体沿用原先语义。

支撑由物体底边的水平覆盖范围和承托面实际高度检测，取相交范围内最高点；窄边支撑、斜面和上下堆放均不要求手写物体对关系。支撑更新从下往上处理，实体声明顺序不改变下落/落地结果。动态物体保持直立，随支撑的接触位置平移/升降，支撑消失后下落；缺少初始支撑时直接处于 falling，不额外发送 supportlost。落地取该步首先经过的上沿，避免穿透静态窄落点；不向上吸附到已经穿过的面。

active/inactive 不暂停重力或碰撞；`enable` 只改变指定碰撞/承托能力。持有时暂停重力并移出支撑集合，放下后重新评估支撑；放到已有支撑上可直接静止。物体完全落出画布下方后模式为 outside，停止更新；不直接结束主角的旅程。没有主角全身体积撞击、侧向阻挡、反弹、力传递、滑动或角动量，启用碰撞也不执行重叠排解。

```json
{"on":{"type":"impact","source":"creature","other":"weight"},
 "actions":[{"type":"invoke","target":"creature","behavior":"rest"}]}
```

supportlost 从失去支撑的动态物体发出；landed 从下落后落定的物体发出；impact 从被撞的物体发出，on.other 可选，需引用动态物体，省略表示任意落物。道路没有实体事件槽，因此只有 landed；具有 surface 的物体也能接收 impact。初始静止和持续接触不重复发落地/撞击事件。撞击不自动伤害或停用目标，反应由连线的命名行为定义。

物体几何先统一更新，再派发已产生的物理事件；事件中撤掉的支撑由下一 tick 物理更新检测。上下堆放保持支撑引用，随下方物体下落时不反复发撞击。事件日志保留 source、other、落地/撞击 speed；运行实体 `bodyState` 显示 mode（supported/falling/held/outside）、vy、support。暂停、单步、重置和回放沿用固定 tick。

编辑器「矩形碰撞体」控制能力定义，「碰撞初始启用」控制 enabled；「受重力影响」自动补齐碰撞体和地图重力。行为中选择「启用 / 停用能力」可撤去支撑。物体事件槽提供失去支撑、落地和受撞击，逻辑页可筛选撞击者。移除能力前需移除引用它的事件/动作；删除物体会清理包含撞击者筛选的引用。尺寸、历史、JSON 交换和离线文件保留这些数据。

### 固定/铰接物体的支撑检测

```json
{"id":"sill","kind":"object","label":"檐面","x":40,"y":360,"width":240,"state":"active",
 "pose":{"angle":0,"pivot":0},"surface":{"enabled":true},"supportProbe":{"at":1}}
```

`supportProbe.at` 是物体基线上的本地比例（0 左端，1 右端）；有姿态时随姿态变换，没有姿态时取底边对应点。内核检测该点是否接触其他真实路面、承托面或矩形上沿，排除自身和持有物。需要地图重力，不与动态 body 同时定义；动态物体已有自己的支撑解析。

支撑从有到无发出 supportlost，从无到有发出 supportfound；初始状态不发事件，同高度替代支撑不算丢失。状态与 active/inactive 独立，持有时暂停检测，放下后重新取样且不制造一次虚假丢失。快照 `supportState` 显示 mode（supported/unsupported/held）及 support。该能力只检测，不施加力矩；旋转仍由事件调用普通命名行为。检测的是明确的点，不是自动受力或整块体积碰撞。

### 持有物缓降和主角落地

```json
{"carriedPhysics":{"gravityScale":0.25,"maxFallSpeed":90}}
```

普通物体可配置 `carriedPhysics`，需要地图重力。被主角持有且处于 active 时生效：重力乘以 gravityScale（0.05～1），限速取物件与地图 maxFallSpeed 中较小者。启用时立即钳制已有下落速度，不产生向上的位移；放下或 inactive 恢复地图参数。它不运输主角、不预设落点，实际下落仍由同一轨迹计算器执行。

主角可选 `actor.maxLandingSpeed`（60～1800），超过该速度落地时以 hard-landing 结束；省略保持旧关卡行为。安全落地后，实际承托所属实体发出 actorlanded，可连接转向、收起、放下等行为。道路只有落地日志；与实体重叠时按既有支撑优先顺序确定真正的落点承托，不向所有重叠面广播。日志记录支撑和落地速度。落地反应在本 tick 轨迹计算后、普通接触前执行，转向从下一 tick 生效；危险落地不会调用安全落地反应。

检查器提供支撑检测点、持有时重力倍率和限速，以及主角的安全落地上限；事件槽和规则编辑器能接支撑失去/恢复及主角落地。编辑与运行遵循相同数据，没有隐藏检测物体。

## 顺序与预算

每 tick：时钟 → 到期动作（due/order）→ 点击（输入顺序）→ 巡逻/电梯/旋转 → 动态物体支撑与下落、固定检测点取样 → 主角承托搬运 → rotated 与物理/支撑事件 → 主角行走/重力下落/显式通行及 board/arrive → 落地速度校验与 actorlanded → 接触/区域/踩板 → 支撑和门 → 终点/边界。接触动作若移除当前支撑，主角改为 falling，下一 tick 产生竖直位移。每个实体自身的接触规则先于自身默认致命效果；实体和规则均按声明顺序执行，后续可观察前面的修改。after 不取消，到期动作按顺序生效。

固定 60 tick/秒。重置清空持有、联系状态、输入、延迟、楼层和方向；回放记录输入 tick，与同一关卡产生同一模拟结果。草稿和模拟互不修改。

上限：64 个实体、64 段平台、128 条规则；每实体 16 个行为；每列表 1～32 动作、after 最深 4 层、关卡总动作 512；每 tick 1,024 动作、256 个待执行计时器、调用深度 32、每局 36,000 tick。超过运行预算明确失败，可重置。未知能力、无效状态和悬空引用加载前拒绝。

文件导入上限 1 MiB，草稿工作区上限 2 MiB。编辑中几何可以暂时不完整，但引用保持有效；试玩前进行完整验证。产品只内置 `src/editor/first-level.js` 这一关；`tests/fixtures/` 中的旧场景仅为内核回归素材，不进入发布包。

## 资源场景

可选 `scene` 与逻辑定义分离；模拟器不读取其图片变换。`background` 为六位十六进制颜色，`assets` 为最多24张内嵌自定义图片，`nodes` 为最多600个可编辑图层。内置资源标识见 `assets/library.json`，许可见 `assets/CREDITS.md`。旧关卡没有 scene 时仍可导入，并使用兼容的程序化表现。

```json
{"scene":{"background":"#1b204b","assets":[],"nodes":[
  {"id":"flower-art","label":"花盆贴图","asset":"flowerPot",
   "x":-5,"y":-55,"width":40,"height":55,"layer":25,
   "bind":{"type":"entity","id":"pot"},
   "variants":{"inactive":{"opacity":0.4}}}
]}}
```

图层必填 id、label、asset、x、y、width、height、layer。width/height 为图片显示尺寸，与实体宽高完全独立；layer 范围 -100～100，同层按声明顺序绘制。可选 rotation 为 -180～180 度、opacity 为0～1、flipX/visible 为布尔值。tile 的 width/height 定义8～512的平铺单元尺寸。

`bind` 可为 `{"type":"actor"}`、`{"type":"goal"}`、`{"type":"entity","id":"pot"}` 或 `{"type":"platform","index":0}`。绑定时 x/y 是逻辑基点的局部偏移，跟随对象实际姿态绕支点旋转；图片自己的附加角度绕左上角旋转。未绑定为独立布景。多个图片可绑定同一实体。删除逻辑对象清除关联图片；删除路面还会修正后续绑定索引。删除图片不改变逻辑。

`variants` 按实际实体状态覆盖变换或图片，未设置的字段继承基础图层。编辑器可单独预览/拖动状态图片。`animation:{"frames":["travelerWalk1","travelerWalk2"],"fps":8}` 支持1～24帧及1～30 fps，按 `floor(tick*fps/60)` 选择帧；暂停和回放确定。状态可覆盖 animation，设为 null 使用静态图；状态直接换 asset 且未配置 animation 时也显示静态图。`flipWithDirection:true` 随对象实际朝向翻转。

自定义图片仅接受 data:image/png、jpeg、webp 的 base64；单张最多256 KiB、2048×2048，所有图片总计512 KiB。禁止引用远程图片或导入 SVG，避免离线依赖与可执行内容。内置受信 SVG 随库内嵌。图片数据、图层及状态动画与逻辑共用历史、草稿和 JSON；离线编辑器内嵌内置素材，用户草稿需另行导出 JSON。
