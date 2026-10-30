import {generateCandidates} from './batch.js';
import {drawDiagram} from '../render/diagram.js';

/** Candidate browsing stays outside the editor store; only an explicit import creates a draft. */
export function createGenerationUI({editor,changeDisplay,notify}) {
  const $=id=>document.getElementById(id),dialog=$('generation-dialog');let controller=null;
  function busy(value){dialog.dataset.busy=String(value);$('generate-candidates').disabled=value;$('cancel-generation').hidden=!value;
    $('generation-seed').disabled=value;$('generation-steps').disabled=value;}
  function close(){controller?.abort();dialog.close();}
  function node(tag,text,className){const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;}
  function importCandidate(entry,demo){
    if(!editor.isEditing())return;
    try{
      editor.importDocument(entry.candidate.level);changeDisplay('logic');close();
      if(demo)editor.preview({recording:entry.report.recording});
      notify(demo?'正在回放验证过的解法；返回编辑后可自由修改。':'候选已导入为新草稿，可以编辑和试玩。');
    }catch(error){$('generation-status').textContent=error.message;}
  }
  function render(entries){
    $('generation-results').replaceChildren();
    for(const [index,entry] of entries.entries()){
      const {candidate,report}=entry,card=node('article',null,'generation-card');
      card.dataset.candidate=String(index);card.dataset.signature=candidate.signature;card.dataset.seed=candidate.seed;
      card.append(node('h3','候选 '+(index+1)+' · '+candidate.fragments.length+' 次操作'));
      const canvas=node('canvas');canvas.width=1200;canvas.height=640;canvas.setAttribute('aria-label','候选 '+(index+1)+' 路面和机关预览');
      drawDiagram(canvas.getContext('2d'),candidate.level);card.append(canvas);
      const list=node('ol');
      for(const [i,p] of candidate.plan.entries()){
        const item=node('li'),detail=node('details');detail.append(node('summary',(p.tick/60).toFixed(1)+' 秒 · '+p.label),node('p',candidate.fragments[i].explanation));item.append(detail);list.append(item);
      }
      card.append(list,node('p','✓ 解法可通关 · 漏掉任一操作均失败 · 开场全点失败 · 单次 ±0.4 秒采样通过','generation-proof'),
        node('small','种子：'+candidate.seed+' / 变体 '+candidate.variant+' · 通关 '+(report.recording.untilTick/60).toFixed(1)+' 秒'));
      const actions=node('div',null,'generation-card-actions'),importButton=node('button','导入编辑器','button secondary'),demo=node('button','导入并演示解法','button primary');
      importButton.dataset.importCandidate=String(index);demo.dataset.demoCandidate=String(index);
      importButton.addEventListener('click',()=>importCandidate(entry,false));demo.addEventListener('click',()=>importCandidate(entry,true));
      actions.append(importButton,demo);card.append(actions);$('generation-results').append(card);
    }
  }
  async function generate(){
    if(controller)return;
    controller=new AbortController();const signal=controller.signal;busy(true);$('generation-results').replaceChildren();
    $('generation-status').textContent='正在组合机关并模拟验证…';
    try{
      const result=await generateCandidates({seed:$('generation-seed').value,steps:Number($('generation-steps').value),signal,
        onProgress:p=>{$('generation-status').textContent='已验证 '+p.accepted+' / '+p.total+' 个候选 · 已尝试 '+p.attempts+' 组';}});
      render(result.candidates);
      $('generation-status').textContent=result.candidates.length?'得到 '+result.candidates.length+' 个结构不同的候选，用时 '+(result.elapsedMs/1000).toFixed(1)+' 秒。':'本批没有通过验证的候选，请换一个种子。';
    }catch(error){$('generation-status').textContent=error.name==='AbortError'?'已取消，当前草稿保留。':error.message;}
    finally{controller=null;busy(false);}
  }
  $('open-generation').addEventListener('click',()=>{if(editor.isEditing()){editor.cancel();dialog.showModal();}});
  $('close-generation').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  $('generate-candidates').addEventListener('click',generate);$('cancel-generation').addEventListener('click',()=>controller?.abort());busy(false);
}
