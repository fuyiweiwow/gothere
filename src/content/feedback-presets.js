/** Shared, data-only choices used by the DSL, authoring UI and renderer. */
export const MOTIONS={none:'无本体动画',squash:'挤压回弹',shake:'抖动',hop:'轻跳',recoil:'后坐回弹',sway:'轻摆',pulse:'呼吸缩放',emerge:'浮现展开',fade:'淡出',fall:'倾倒'};
export const PARTICLES={none:'无特效',smoke:'烟雾',dust:'尘土',spark:'火花'};
export const SOUNDS={none:'无声音',puff:'喷气',clack:'机关轻响',pop:'弹出',thud:'落地',success:'抵达',fail:'失误'};
export function feedbackDefault(target,id='feedback-1') {
  return {id,label:'行为反馈',target,trigger:{type:'start'},motion:'squash',particles:'none',sound:'none',
    duration:48,delay:0,strength:1,loop:false,hold:false,policy:'restart',anchor:{x:.5,y:0},count:12,color:'#c4d7e3',direction:-90,volume:.25};
}
