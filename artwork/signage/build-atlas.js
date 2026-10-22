/* Offline authoring tool. Never loaded by the website. Open build-atlas.html,
 * then export #atlas-export JSON or use REA to capture its DOM. */
(async function () {
  'use strict';
  const L = window.PenthouseSignageDesigns;
  const designs = L.designs.filter(d => d.set === 'v2');
  const W = 2048, H = 2048, gutter = 8;
  const order = designs.slice().sort((a,b) => L.CELL[b.shape][1]-L.CELL[a.shape][1]);
  let scale = 1, packed;
  for (let attempt=0;attempt<40;attempt++) {
    let x=0,y=0,rowH=0; packed=[];
    for (const d of order) {
      const w=Math.max(2,Math.round(L.CELL[d.shape][0]*scale));
      const h=Math.max(2,Math.round(L.CELL[d.shape][1]*scale));
      const stride=w+gutter*2, boxW=stride*d.frames, boxH=h+gutter*2;
      if(x+boxW>W){x=0;y+=rowH;rowH=0;}
      packed.push({d,x:x+gutter,y:y+gutter,w,h,stride});x+=boxW;rowH=Math.max(rowH,boxH);
    }
    if(y+rowH<=H)break;
    scale*=.97;
    if(attempt===39)throw Error('Atlas packing overflow');
  }
  const atlas=document.createElement('canvas');atlas.width=W;atlas.height=H;
  const ctx=atlas.getContext('2d');
  const gallery=document.createElement('canvas');gallery.width=1440;gallery.height=Math.ceil(designs.length/6)*250;
  const g=gallery.getContext('2d');g.fillStyle='#101419';g.fillRect(0,0,gallery.width,gallery.height);
  const metadata=[];
  await document.fonts.ready;
  for(const p of packed){
    const d=p.d;
    for(let f=0;f<d.frames;f++){
      const image=L.render(d,f,scale),x=p.x+f*p.stride,y=p.y;
      ctx.drawImage(image,x,y,p.w,p.h);
      // Extrude the edge into each frame's own gutter. Frame boundaries never
      // share texels, including flip frames and the mobile half-size atlas.
      ctx.drawImage(image,0,0,1,image.height,x-gutter,y,gutter,p.h);
      ctx.drawImage(image,image.width-1,0,1,image.height,x+p.w,y,gutter,p.h);
      ctx.drawImage(image,0,0,image.width,1,x,y-gutter,p.w,gutter);
      ctx.drawImage(image,0,image.height-1,image.width,1,x,y+p.h,p.w,gutter);
      for(const [sx,sy,dx,dy] of [[0,0,x-gutter,y-gutter],[image.width-1,0,x+p.w,y-gutter],[0,image.height-1,x-gutter,y+p.h],[image.width-1,image.height-1,x+p.w,y+p.h]])ctx.drawImage(image,sx,sy,1,1,dx,dy,gutter,gutter);
    }
    const cell=L.CELL[d.shape],vis=L.visible(d);
    metadata.push({id:d.id,label:d.native,theme:d.theme,lang:d.lang,shape:d.shape,style:d.style,colors:d.colors,anim:d.anim,view:d.view,level:d.level,opaque:d.opaque,frames:d.frames,size:L.SIZE[d.shape],aspect:vis[0]/vis[1],rect:[p.x,p.y,p.w,p.h],stride:p.stride});
    const i=designs.indexOf(d),gx=(i%6)*240,gy=Math.floor(i/6)*250;
    g.fillStyle='#191f26';g.fillRect(gx+6,gy+6,228,238);
    const original=L.render(d,0,1),ratio=Math.min(208/vis[0],188/vis[1]);
    const vw=vis[0],vh=vis[1];g.drawImage(original,0,0,vw,vh,gx+(240-vw*ratio)/2,gy+12+(188-vh*ratio)/2,vw*ratio,vh*ratio);
    g.fillStyle='#dce7ec';g.font='13px system-ui';g.fillText(d.id,gx+14,gy+218);g.fillStyle='#7c8c98';g.font='10px system-ui';g.fillText(d.style+' · '+L.ANIM[d.anim],gx+14,gy+235);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  metadata.sort((a,b)=>designs.findIndex(d=>d.id===a.id)-designs.findIndex(d=>d.id===b.id));
  const data={version:'20261022-banners',width:W,height:H,gutter,scale,designs:metadata};
  document.body.append(gallery);
  const pre=document.createElement('pre');pre.id='atlas-export';
  pre.textContent=JSON.stringify({metadata:data,png:atlas.toDataURL('image/png'),gallery:gallery.toDataURL('image/png')});document.body.append(pre);
  document.getElementById('status').textContent=designs.length+' designs · 2048 × 2048 · scale '+scale.toFixed(3);
  document.body.dataset.atlasReady='true';
})().catch(error=>{document.getElementById('status').textContent=error.stack;console.error(error);});
