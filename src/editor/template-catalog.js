import {createBusStopLevel} from './bus-stop-level.js';
import {captureTemplate,placeTemplate} from './templates.js';

/** Built-in packs use the exact same capture/placement path as copied instances. */
export function sceneTemplates(){
  const l=createBusStopLevel(),all=l.scene.nodes;
  const make=(id,label,nodes,entities=[],origin={x:0,y:0},placement='point')=>({...captureTemplate(l,{id,label,nodes:nodes.map(n=>n.id),entities,origin}),placement});
  return [
    make('street-backdrop','晨间街景 · 完整背景',all.filter(n=>!n.bind),[],{x:0,y:0},'canvas'),
    make('corner-building','转角早餐铺',all.filter(n=>n.id==='stop-left'),[],{x:-26,y:423}),
    make('apartment-building','老公寓',all.filter(n=>n.id==='stop-middle'),[],{x:328,y:423}),
    make('bus-encounter','公交与候车队伍 · 含动作',all.filter(n=>n.bind?.type==='entity'),l.entities.map(e=>e.id),{x:680,y:490}),
  ];
}

export function createTemplatePractice(id){
  const source=createBusStopLevel(),l=structuredClone(source);
  l.id=id;l.name='街景模板练习';l.description='背景已铺好。在资源面板的模板页放入公交与队伍，再展开修改部件。';
  l.hint='放入公交模板后，运行并点击公交开门。';l.entities=[];l.rules=[];
  l.scene={background:source.scene.background,assets:[],nodes:[],sounds:[],feedback:[]};
  placeTemplate(l,sceneTemplates()[0]);
  const player=source.scene.nodes.find(n=>n.bind?.type==='actor');l.scene.nodes.push(player);
  l.scene.feedback.push(...source.scene.feedback.filter(f=>f.target===player.id));
  return l;
}
