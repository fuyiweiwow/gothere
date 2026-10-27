# 内容模型 v0.4

视觉编辑器、JSON、未来文本 DSL 和程序生成器共用这个模型。继续使用 `schemaVersion: 1`，原有十关和旧草稿兼容。现阶段是有限事件、条件和动作的组合，尚无文本语法和任意脚本。

## 外观与能力

以下是通用物件；appearance 只负责画面：

```json
{
  "id": "tool", "kind": "object", "x": 230, "y": 440, "width": 48,
  "state": "active", "label": "通行小帮手",
  "appearance": {"skin": "axe"}
}
```

skin 可选 axe、crate、crocodile、orb；也可加 `image: "data:image/png;base64,..."`（JPEG/WebP 同样可用）。自定义图优先于 skin，解码失败时回退内置图；工坊换内置外观会清除自定义图。图片不改变命中范围，范围由 x、y、width 决定。

工坊上传上限 24,000 字节；序列化后单图上限 32,768 字符，一张地图的图片总和上限 98,304 字符。拒绝远程地址和 SVG，便于离线携带。文件导入上限 256 KiB，草稿工作区恢复上限 2 MiB；图片较多时应导出备份。

接触时拿起：

```json
{"on":{"type":"contact","source":"tool"},"actions":[{"type":"hold","target":"tool"}]}
```

接触时让主角受伤，只需换动作：

```json
{"on":{"type":"contact","source":"tool"},"actions":[{"type":"hurt","message":"斧子今天心情一般。"}]}
```

生物使用同一 object，可附加巡逻：

```json
"motion": {"type":"patrol","minX":490,"maxX":730,"speed":55}
```

巡逻界限是实体左侧 X 的范围；抵达边界折返，只在 active 且未被持有时移动。inactive 时停止巡逻和接触，但仍能点击，让规则重新启用。

## 事件、条件和动作

| 事件 | 来源 |
| --- | --- |
| contact | 所有实体，进入同层接触范围时一次 |
| click | switch、hazard、object |
| enter | plate，首次踩下 |
| board | lift，在本层轿厢到达并登上时 |
| arrive | ladder、lift，抵达另一层出口时 |

主角接触半径为 10，沿本 tick 的移动区间检测；巡逻物件也检测移动扫过的区间。不同脚底高度不接触。手持物不对持有者触发接触。contact 不会每帧重复；离开后再碰到可以再次触发。plate 的 enter 仍由 idle→pressed 控制。

条件为 AND 列表：`{entity, state}`、`{holding:"tool"}` 或 `{holding:null}`（空手）。规则按声明顺序执行，因此前一个规则拿起物品，后一个可立即检查持有状态。延迟条件在触发时判断，到期不重新判断。

| 动作 | 含义 |
| --- | --- |
| set | 设置实体状态，电梯 lower/upper 表示目标层 |
| hold | 同层、近处（24 单位容差）、active 的 object；仅一个手持槽，已有物品则忽略 |
| drop | 放在主角身后并设为 inactive，避免立即再次捡起；空手无影响 |
| hurt | 一次失败，可选 message，尚未实现血量系统 |
| after | ticks 后执行嵌套动作列表，沿用既有顺序和预算 |

携带物品通过门的组合：

```json
{"on":{"type":"contact","source":"door"},"if":[{"holding":"tool"}],
 "actions":[{"type":"set","target":"door","state":"open"}]}
```

接触规则先于门/风扇的默认失败检查，因此拿着合适物品可以开门再通过。放下巡逻物件后再次激活时，会先回到巡逻范围，再继续行走。

## 多层空间和通行

脚底 y 默认 440，可用范围 160～560，数值越小越高。actor、goal、platform 和实体都使用 y。主角 direction 为 1（向右，默认）或 -1（向左）。平台和桥只支撑匹配高度的主角；终点也必须同层。

```json
{"id":"stairs","kind":"ladder","x":260,"width":40,
 "y":520,"toY":350,"speed":100,"state":"enabled","label":"先爬一层",
 "upperDirection":1,"lowerDirection":-1}
```

y 为下层、toY 为上层，至少相差 40；两端中心点都必须有对应平台。行走跨过设施中心后自动进入，沿中心上下移动；抵达后按出口方向继续。方向省略则保持原方向。离开设施范围后才可再次进入，避免原地反复上下。

梯子 enabled 自动通行；disabled 不接受新进入，已经在爬的人完成这次通行。电梯 kind 为 lift，state 为 lower/upper；轿厢按 speed 向目标层移动。主角在入口等待轿厢，登车时触发 board，需要规则命令另一层才能出发：

```json
{"on":{"type":"board","source":"elevator"},
 "actions":[{"type":"set","target":"elevator","state":"upper"}]}
```

上下行可由不同入口/状态条件决定；运行途中命令可改变目的层，未抵达另一层前不会离车。上层的门和危险物不会影响下层主角。

跨层只走显式连接，没有自由跳跃、自动坠落到低层、刚体碰撞或路径搜索。角色在未支撑路段直接失败。这能让地图生成器先构造平台连通图，再安排通行和动作，并用同一模拟验证解法。

## 确定顺序与示例

每 tick：时钟 → 到期动作 → 点击 → 巡逻/电梯移动 → 主角行走或通行（登车/抵达事件）→ 接触/踩板 → 支撑/门/危险检查 → 终点。接触前后同步手持物位置。保持 60 tick/秒，规则/计时器预算不变。移动、携带、楼层、输入均能重置和回放。

`src/examples.js` 提供三张完整可编辑地图：拿物过门、点击让巡逻鳄鱼休息、携物爬梯再呼叫电梯到第三层。在「新机制试验场」选择，打开工坊即可查看全部规则。
