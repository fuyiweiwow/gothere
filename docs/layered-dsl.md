# 二维分层与内外移动规范

版本：0.21.0 / DSL v3。本文描述已经接入编辑器和模拟的首版能力。

## 三个独立概念

| 含义 | 数据 | 对游戏的影响 |
| --- | --- | --- |
| 物体属于哪条街、哪个行走层 | `space.plane` | 支撑、接触、拾取及目标判断只在同层发生 |
| 真正离开地面多高 | `space.height` | 上坡、旋转承托、升降、失去支撑与下落 |
| 行走层放在画面哪里、画在谁前面 | `planes[].depth`、`order` | 二维构图和遮挡；不冒充真实高度 |

不把内外行走统一解释成高度变化。它们共用对象、行为、事件、编辑历史和动画系统，但保留各自语义。原横版 v1 和三轴实验 v2 继续按原含义读取，不能把旧坐标静默重新解释成行走层。

为复用已有坐标和资源绑定，v3 暂保留 `spatial`、`depth` 字段名。固定 `depthX:0, depthY:-1`；普通物体及节点的 depth 必须等于所属层的 depth，编辑器自动维护。使用者在面板中操作「行走层」「画面路面 Y」「实际高度」，不必逐物体输入 depth。

画面脚点为 `screenX=x`、`screenY=originY-depth-height`。例如后街在画面上方，但 height 仍可为 0。两条街只在同一张画上相邻，不会因此接通，也不会互相承接掉落。

## 连接是一项物体能力

以下省略其他必填关卡字段，展示一个局部连接：

```json
{
  "schemaVersion": 3,
  "spatial": {
    "mode": "layered",
    "projection": {"originY": 620, "depthX": 0, "depthY": -1},
    "planes": [
      {"id": "front", "label": "前街", "depth": 30, "order": 1},
      {"id": "back", "label": "后街", "depth": 220, "order": 0}
    ],
    "start": "entry",
    "nodes": [
      {"id": "entry", "x": 420, "plane": "front", "depth": 30, "height": 0, "next": "exit", "via": "alley"},
      {"id": "exit", "x": 500, "plane": "back", "depth": 220, "height": 0}
    ]
  },
  "entities": [{
    "id": "alley", "kind": "object", "label": "巷口", "state": "active",
    "x": 420, "width": 24, "height": 12,
    "space": {"plane": "front", "depth": 30, "height": 0, "depthSize": 20},
    "passage": {"from": "entry", "to": "exit", "distance": 200, "enabled": true}
  }]
}
```

规则如下：

- 首版连接为单向直线，两端属于不同层，实际高度相同；允许纯向里、向外或带左右位移。返回需要明确配置另一组入口、出口。
- 人物必须在入口得到真实支撑，且物体 active、passage.enabled 为 true 才能进入。条件不满足就沿原方向继续走，不等候、不瞬移。
- 按 `distance / 人物行走速度` 确定通行时间，连续插值入口到出口，保持真实高度。distance 是明确的逻辑通行距离，创建时写入，此后仅重新摆放行走层不改变它；美术构图不会悄悄改变操作时机。连接拥有这段通行，不与无关行走层的物体发生接触。
- 进入、离开产生 `board`、`arrive` 事件，可以连线触发行为、动画反馈和声音。
- `enable` 动作的 `capability:"passage"` 控制是否允许新进入。已进入者完成当前通行；关闭不会把人物弹回入口。
- 出口必须连接作者铺设的路面。没有支撑会在出口继续下落，连接不会补出隐藏平台。
- 同层上坡用路面的 height/heightEnd，升降用移动承托；不绕道借内外连接假装升降。

编辑时选中入口节点，选择异层的下一节点，会创建普通连接物体。选中它可检查入口出口、切换启用、添加行为和事件连线。连接不能同时当巡逻物体、旋转板或承托面。

图片可绑定这个物体并开启 `fitPassage:true`。图片按入口出口自动设置长度、角度，厚度和偏移仍由美术编辑决定；资源本身不决定能否通行。

连接物体图片可配置 `passage-enabled`、`passage-disabled` 变体，显示门开、门关等外观。未配置时沿用原 active/inactive 变体或基础图片；这些变体读取真实连接能力，不替代 enable 动作。

## 动画与动作如何关联

统一的是动画绑定方式，不是坐标：所有图片仍使用相同逐帧动画、状态变体、通用反馈和音效槽。

人物的动画状态由模拟快照推导：`walk-left`、`walk-right`、`inward`、`outward`、`falling`、`climbing`、`riding`、`lost`、`won`。向里向外取自连接入口到出口的方向，不由图片朝向猜测。普通行走可用 `walking` 变体作方向缺省；缺少特定方向时继续用基础资源。

```json
{
  "bind": {"type": "actor"},
  "asset": "commuteWorkerWalk1",
  "animation": {"frames": ["commuteWorkerWalk1", "commuteWorkerWalk2"], "fps": 8},
  "variants": {
    "inward": {"asset": "streetWalkIn1", "animation": {"frames": ["streetWalkIn1", "streetWalkIn2"], "fps": 8}},
    "outward": {"asset": "streetWalkOut1", "animation": {"frames": ["streetWalkOut1", "streetWalkOut2"], "fps": 8}}
  }
}
```

资源面板选中绑定主角的图片，在「人物动作动画」中选择方向后配置图片及帧序列。关动画只冻结显示，不冻结通行。行走帧按模拟时钟循环；暂停时冻结。首版没有脚步锁相、转身混合或根运动，路径速度不由动画帧数驱动。

## 持有物与接收对象

新增 `place` 动作：`{"type":"place","target":"breakfast","at":"bowl","range":105}`。必须真正持有 target、与接收对象同层、在指定范围内且不处于跨层通行，才会放下。随后在物品上产生 `placed` 事件，`other` 指向实际接收对象。

所以相同的早餐袋可以先放在狗碗旁触发生物行为，取回后交给门口的人。接收方的名字不进入引擎判断。条件、消耗、开门或移动全部由普通规则组合。

## 当前范围

首版支持最多8个行走层、单向直线连接、同层接触和下落、局部连接动画、普通物品交互。暂不支持连接中途放置另一条活动行走层、曲线路径、跨层掉落映射、自动双向寻路、骨骼动画或动画根运动。需要这些能力时扩展数据定义，不按具体关卡加例外。
