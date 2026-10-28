/** One source for the help sheet and editor commands. Text fields keep their native editing keys. */
export const EDITOR_SHORTCUTS = [
  ['Ctrl+N','新建草稿'],['Ctrl+O','打开 JSON 导入 / 导出'],['Ctrl+S','保存草稿'],
  ['Ctrl+Z','撤销'],['Ctrl+Y / Ctrl+Shift+Z','重做'],
  ['Ctrl+C / Ctrl+X / Ctrl+V','复制 / 剪切 / 粘贴物体'],['Ctrl+D','创建选中物体的副本'],
  ['Delete','删除选中物体或连线'],['F2','重命名选中物体'],
  ['方向键 / Shift+方向键','移动物体或缩放节点 1 / 10 单位'],['连线节点上的方向键','沿 10 单位网格移动'],
  ['V / W','选择工具 / 连线工具'],['Ctrl+F','搜索仓库'],
  ['Esc','取消当前拖拽、工具或选择；模拟时返回编辑'],
  ['F5','运行模拟','preview'],['Space','模拟运行 / 暂停','preview'],
  ['F10','暂停并单步','preview'],['Shift+F5','结束模拟并返回编辑','preview'],
  ['F1','快捷键速查'],
];

export function shortcutCommand(event,{typing=false,testing=false,diagram=true}={}) {
  if(event.isComposing||event.altKey)return null;
  const key=event.key.toLowerCase(),ctrl=event.ctrlKey||event.metaKey;
  if(ctrl&&key==='s'&&!event.shiftKey)return 'save';
  if(key==='f1'&&!ctrl)return 'help';
  if(diagram){
    if(key==='f5'&&!ctrl)return event.shiftKey?'stop':'run';
    if(key==='f10'&&!ctrl)return 'step';
  }
  if(typing)return null;
  if(key==='escape')return 'cancel';
  if(diagram){
    if(key===' '&&testing&&!ctrl)return 'toggle';
  }
  if(testing)return null;
  if(ctrl){
    if(key==='z')return event.shiftKey?'redo':'undo';
    if(key==='y')return 'redo';
    if(event.shiftKey)return null;
    return {n:'new',o:'data',c:'copy',x:'cut',v:'paste',d:'duplicate',f:'search'}[key]??null;
  }
  if(key.startsWith('arrow'))return 'nudge';
  return {delete:'delete',f2:'rename',v:'select',w:'wire'}[key]??null;
}

export function nudgeDelta(event) {
  const step=event.shiftKey?10:1;
  return {x:event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0,
    y:event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0};
}
