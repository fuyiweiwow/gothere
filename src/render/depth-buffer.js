// A small orthographic rasterizer. Depth is world depth, never screen y or an
// object's bounding-box order. Transparent fragments resolve after opaque ones.
export function createDepthBuffer(width,height) {
  const data=new Uint8ClampedArray(width*height*4),depths=new Float64Array(width*height),heads=new Int32Array(width*height);
  let capacity=65536,count=0,fragmentDepth=new Float64Array(capacity),colors=new Uint32Array(capacity),next=new Int32Array(capacity);
  const touched=[];
  function grow(){
    capacity*=2;
    const d=new Float64Array(capacity),c=new Uint32Array(capacity),n=new Int32Array(capacity);
    d.set(fragmentDepth);c.set(colors);n.set(next);fragmentDepth=d;colors=c;next=n;
  }
  function fragment(index,z,r,g,b,a,transparent){
    if(!a||(a<255)!==transparent||z>depths[index]+1e-8)return;
    if(!transparent){const k=index*4;depths[index]=z;data[k]=r;data[k+1]=g;data[k+2]=b;data[k+3]=255;return;}
    if(count===capacity)grow();
    const id=count++;fragmentDepth[id]=z;colors[id]=r|(g<<8)|(b<<16)|(a<<24);
    let prior=-1,current=heads[index];if(current===-1)touched.push(index);
    while(current!==-1&&fragmentDepth[current]>=z){prior=current;current=next[current];}
    next[id]=current;if(prior===-1)heads[index]=id;else next[prior]=id;
  }
  const edge=(a,b,x,y)=>(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);
  const topLeft=(a,b)=>b.y<a.y||(b.y===a.y&&b.x>a.x);
  const inside=(value,a,b)=>value>1e-8||(Math.abs(value)<=1e-8&&topLeft(a,b));
  function triangle(a,b,c,color,bias,transparent){
    let area=edge(a,b,c.x,c.y);if(Math.abs(area)<1e-8)return;
    if(area<0){const swap=b;b=c;c=swap;area=-area;}
    const left=Math.max(0,Math.ceil(Math.min(a.x,b.x,c.x)-.5)),right=Math.min(width-1,Math.floor(Math.max(a.x,b.x,c.x)-.5));
    const top=Math.max(0,Math.ceil(Math.min(a.y,b.y,c.y)-.5)),bottom=Math.min(height-1,Math.floor(Math.max(a.y,b.y,c.y)-.5));
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
      const u=edge(b,c,x+.5,y+.5),v=edge(c,a,x+.5,y+.5),w=edge(a,b,x+.5,y+.5);
      if(inside(u,b,c)&&inside(v,c,a)&&inside(w,a,b))fragment(y*width+x,(u*a.depth+v*b.depth+w*c.depth)/area+bias,...color,transparent);
    }
  }
  function raster(command,transparent){
    const {color,bias=0}=command;
    if(command.points){
      if((color[3]<255)!==transparent||!color[3])return;
      for(let i=1;i<command.points.length-1;i++)triangle(command.points[0],command.points[i],command.points[i+1],color,bias,transparent);
    }else if(command.data){
      const left=Math.max(0,command.x),right=Math.min(width,command.x+command.width),top=Math.max(0,command.y),bottom=Math.min(height,command.y+command.height);
      for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
        const k=((y-command.y)*command.width+x-command.x)*4,p=command.data;
        fragment(y*width+x,command.depth+(command.depthY??0)*(y+.5-command.y)+bias,p[k],p[k+1],p[k+2],p[k+3],transparent);
      }
    }else if(command.a){
      if((color[3]<255)!==transparent||!color[3])return;
      const {a,b}=command,dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy,radius=(command.width??1.5)/2;
      const left=Math.max(0,Math.floor(Math.min(a.x,b.x)-radius)),right=Math.min(width-1,Math.ceil(Math.max(a.x,b.x)+radius));
      const top=Math.max(0,Math.floor(Math.min(a.y,b.y)-radius)),bottom=Math.min(height-1,Math.ceil(Math.max(a.y,b.y)+radius));
      for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
        const t=length?Math.max(0,Math.min(1,((x+.5-a.x)*dx+(y+.5-a.y)*dy)/length)):0;
        if((x+.5-a.x-t*dx)**2+(y+.5-a.y-t*dy)**2<=radius*radius)fragment(y*width+x,a.depth+(b.depth-a.depth)*t+bias,...color,transparent);
      }
    }
  }
  return {width,height,data,render(commands){
    data.fill(0);depths.fill(Infinity);heads.fill(-1);count=0;touched.length=0;
    for(const transparent of [false,true])for(const command of commands)raster(command,transparent);
    for(const index of touched){
      const k=index*4;
      for(let id=heads[index];id!==-1;id=next[id]){
        const c=colors[id],a=(c>>>24)/255,oldAlpha=data[k+3]/255,alpha=a+oldAlpha*(1-a),keep=oldAlpha*(1-a);
        data[k]=((c&255)*a+data[k]*keep)/alpha;data[k+1]=((c>>>8&255)*a+data[k+1]*keep)/alpha;
        data[k+2]=((c>>>16&255)*a+data[k+2]*keep)/alpha;data[k+3]=alpha*255;
      }
    }
    return data;
  }};
}
