export const CATALOG = [
  {kind:'platform',name:'地面',group:'basic',icon:'━',description:'提供同层支撑。',keywords:'平台 地板 platform'},
  {kind:'object',name:'物件 / 生物',group:'objects',icon:'◇',description:'组合持有、巡逻、接触效果与行为。',keywords:'物品 生物 斧子 敌人 object'},
  {kind:'switch',name:'开关',group:'interaction',icon:'⊙',description:'点击发出事件。',keywords:'按钮 switch'},
  {kind:'zone',name:'区域触发器',group:'interaction',icon:'▧',description:'进入区域时发出事件，试玩时不可见。',keywords:'位置 感应 zone'},
  {kind:'plate',name:'压力板',group:'interaction',icon:'▱',description:'踩下时发出事件。',keywords:'踩踏 plate'},
  {kind:'gate',name:'小门',group:'traversal',icon:'Π',description:'关闭时阻挡，开启后可通过。',keywords:'门 gate'},
  {kind:'bridge',name:'木桥',group:'traversal',icon:'═',description:'展开时提供支撑。',keywords:'桥 bridge'},
  {kind:'ladder',name:'梯子',group:'traversal',icon:'≡',description:'连接上下两层。',keywords:'爬梯 ladder'},
  {kind:'lift',name:'电梯',group:'traversal',icon:'↕',description:'到位才能登车，登车事件可启动运输。',keywords:'升降 lift'},
];
export const CATEGORIES = [['all','全部'],['basic','基础'],['objects','物件'],['interaction','交互'],['traversal','通行']];
export function filterCatalog(query='',category='all') {
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return CATALOG.filter(item=>(category==='all'||item.group===category) &&
    terms.every(term=>(item.name+' '+item.kind+' '+item.keywords).toLowerCase().includes(term)));
}
