import {typeScriptClient} from './typescript-client.js';
import {searchProject} from './authoring-changes.js';

/** File search and semantic object navigation share source locations, not filename guesses. */
export function createAuthoringNavigator({project,navigate,notice,onSelect=()=>{},isOpen}) {
  const $=id=>document.getElementById(id);let mode='files',items=[],ticket=0,timer,focused=null;
  const button=(text,where)=>{const element=document.createElement('button');element.type='button';element.textContent=text;element.title=where.path+':'+(where.line??'');element.onclick=()=>navigate(where.path,where.start);return element;};
  function select(item){focused=item.id??item.path+':'+item.start;onSelect(item.id);const panel=$('script-object-details');panel.replaceChildren();related(item,panel);}
  function related(item,container) {
    const title=document.createElement('strong');title.textContent=item.label;container.append(title);
    const link=(text,where)=>{const b=button(text,where);b.onclick=()=>{select(item);navigate(where.path,where.start);};return b;};
    container.append(link('定义 · '+item.className,item));
    for(const behavior of item.behaviors){const b=link('行为 · '+behavior.label,behavior);b.dataset.sourceBehavior=behavior.id??behavior.member;container.append(b);}
    for(const ref of item.references){const b=link(ref.category+' · '+ref.path+':'+ref.line,ref);b.title=ref.text;container.append(b);}
  }
  function inspect(id) {
    const matches=items.filter(item=>item.id===id);
    if(matches.length!==1){mode='objects';$('script-search').value=id;render();notice(matches.length?'存在多个同名声明，请选择具体对象。':'此对象没有唯一的静态声明；可用全文搜索定位，手写动态工厂不会按文件名猜测。');return;}
    const item=matches[0];select(item);mode='objects';$('script-search').value='';render();navigate(item.path,item.start);
  }
  function render() {
    const query=$('script-search').value.trim().toLowerCase();
    $('script-files-mode').setAttribute('aria-pressed',String(mode==='files'));$('script-objects-mode').setAttribute('aria-pressed',String(mode==='objects'));
    $('script-tree').hidden=mode!=='files';$('script-outline').hidden=mode!=='objects';$('script-search-results').hidden=!query;
    const outline=$('script-outline');outline.replaceChildren();
    for(const item of items.filter(item=>!query||[item.id,item.label,item.className,...item.behaviors.map(b=>b.label+' '+b.id)].join(' ').toLowerCase().includes(query))) {
      const group=document.createElement('details');group.className='script-outline-item';group.open=Boolean(query)||(item.id??item.path+':'+item.start)===focused;
      const summary=document.createElement('summary');summary.textContent=item.label;group.append(summary);related(item,group);outline.append(group);
    }
    if(!outline.children.length){const p=document.createElement('p');p.textContent=items.length?'没有匹配的对象':'暂无静态对象声明，可直接使用文件或全文搜索。';outline.append(p);}
    const list=$('script-search-results');list.replaceChildren();
    if(query){const result=searchProject(project(),query),label=document.createElement('strong');label.textContent=`全文 · ${result.total} 处${result.total>result.matches.length?'（显示前 '+result.matches.length+' 处）':''}`;list.append(label);
      for(const match of result.matches){const b=button(match.path+':'+match.line+'\n'+match.text,match);b.dataset.searchPath=match.path;list.append(b);}}
  }
  async function refresh({focusId}={}) {
    clearTimeout(timer);const request=++ticket,snapshot=project();if(!snapshot||!isOpen())return;
    try{const next=await typeScriptClient().request('outline',snapshot);if(request!==ticket||!isOpen())return;items=next;render();
      const selected=items.find(item=>(item.id??item.path+':'+item.start)===focused);if(selected)select(selected);else $('script-object-details').replaceChildren();
      if(focusId)inspect(focusId);}
    catch(error){if(request===ticket&&isOpen())notice('对象索引未更新：'+error.message+'；文件和全文搜索仍可使用。');}
  }
  $('script-files-mode').onclick=()=>{mode='files';render();};$('script-objects-mode').onclick=()=>{mode='objects';render();};
  $('script-search').addEventListener('input',render);
  return {refresh,inspect,render,
    changed(){clearTimeout(timer);ticket++;render();timer=setTimeout(()=>void refresh(),700);},
    reset(){items=[];focused=null;ticket++;clearTimeout(timer);mode='files';$('script-object-details').replaceChildren();render();},
    stop(){ticket++;clearTimeout(timer);},
    search(){mode='files';render();$('script-search').focus();$('script-search').select();},
  };
}
