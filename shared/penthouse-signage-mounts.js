/* Physical tenant-sign housings. All fitting happens once while the city loads.
 * Boxes are appended to the existing architectural instance batch, not drawn
 * by a separate sign renderer. Coordinates are unscaled city metres. */
(function () {
  'use strict';
  var CASE_DEPTH=.26,FACE_GAP=.04,WALL_GAP=.08,LIP=.08,EMBED=.10,MAX_PROJECTION=3.5,MAX_BRACKET=3.2;
  function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
  function axes(rotation){
    var r=rotation||[0,0,0],a=Math.cos(r[0]),b=Math.sin(r[0]),c=Math.cos(r[1]),d=Math.sin(r[1]),e=Math.cos(r[2]),f=Math.sin(r[2]);
    // Columns of the same XYZ Euler matrix used by the city's instance writer.
    return [[c*e,a*f+b*d*e,b*f-a*d*e],[-c*f,a*e-b*d*f,b*e+a*d*f],[d,-b*c,a*c]];
  }
  function frame(ry){return{u:[Math.cos(ry),0,-Math.sin(ry)],v:[0,1,0],n:[Math.sin(ry),0,Math.cos(ry)]};}
  function projectBox(part,f,kind,index){
    var axis=axes(part.rotation),center=[part.x,part.y,part.z],half=[part.w/2,part.h/2,part.d/2];
    function extent(dir){return Math.abs(dot(axis[0],dir))*half[0]+Math.abs(dot(axis[1],dir))*half[1]+Math.abs(dot(axis[2],dir))*half[2];}
    var u=dot(center,f.u),v=part.y,n=dot(center,f.n),eu=extent(f.u),ev=extent(f.v),en=extent(f.n);
    return{part:part,kind:kind,index:index,axis:axis,center:center,half:half,u0:u-eu,u1:u+eu,v0:v-ev,v1:v+ev,n0:n-en,n1:n+en};
  }
  function raySurface(p,u,v,f){
    var origin=[f.u[0]*u,f.v[1]*v,f.u[2]*u],delta=[origin[0]-p.center[0],origin[1]-p.center[1],origin[2]-p.center[2]];
    var q=p.axis.map(function(a){return dot(delta,a);}),dir=p.axis.map(function(a){return dot(f.n,a);}),lo=-Infinity,hi=Infinity;
    function clip(min,max,x,speed){
      if(Math.abs(speed)<1e-10)return x>=min-1e-7&&x<=max+1e-7;
      var a=(min-x)/speed,b=(max-x)/speed;if(a>b){var temp=a;a=b;b=temp;}lo=Math.max(lo,a);hi=Math.min(hi,b);return lo<=hi+1e-7;
    }
    for(var j=0;j<3;j++)if(!clip(-p.half[j],p.half[j],q[j],dir[j]))return null;
    if(p.kind==='towers'&&p.part.shape==='round'){
      var rx=p.half[0],rz=p.half[2],aa=dir[0]*dir[0]/(rx*rx)+dir[2]*dir[2]/(rz*rz),bb=2*(q[0]*dir[0]/(rx*rx)+q[2]*dir[2]/(rz*rz)),cc=q[0]*q[0]/(rx*rx)+q[2]*q[2]/(rz*rz)-1,dis=bb*bb-4*aa*cc;
      if(dis<0||aa<1e-10)return null;var root=Math.sqrt(dis);lo=Math.max(lo,(-bb-root)/(2*aa));hi=Math.min(hi,(-bb+root)/(2*aa));
    }else if(p.kind==='towers'){
      // The occupied mesh uses four chamfer planes, not an uncut box.
      for(var sx=-1;sx<=1;sx+=2)for(var sz=-1;sz<=1;sz+=2){
        var value=sx*q[0]/p.part.w+sz*q[2]/p.part.d,slope=sx*dir[0]/p.part.w+sz*dir[2]/p.part.d;
        if(Math.abs(slope)<1e-10){if(value>.955+1e-7)return null;}else if(slope>0)hi=Math.min(hi,(.955-value)/slope);else lo=Math.max(lo,(.955-value)/slope);
      }
    }
    return lo<=hi+1e-7?hi:null;
  }
  function prepare(options){
    options=options||{};var groups={},directions=[frame(0),frame(Math.PI/2),frame(-Math.PI/2)];
    ['towers','structure','ribs'].forEach(function(kind){(options[kind]||[]).forEach(function(part,index){
      if(part.buildingId===undefined||part.signMount)return;
      var g=groups[part.buildingId]||(groups[part.buildingId]=[[],[],[]]);
      for(var k=0;k<3;k++)g[k].push(projectBox(part,directions[k],kind,index));
    });});
    return {fit:function(s,t){
      if(!t||t.shape==='round'||s.buildingId!==t.buildingId||!Number.isFinite(s.w+s.h+s.y+s.x+s.z+s.ry+(s.tilt||0))||s.w<=0||s.h<=0)return false;
      var k=Math.abs(s.ry)<1e-6?0:s.ry>0?1:2;if(k&&Math.abs(Math.abs(s.ry)-Math.PI/2)>1e-6)return false;
      var f=directions[k],list=groups[t.buildingId]&&groups[t.buildingId][k];if(!list)return false;
      var u=s.x*f.u[0]+s.z*f.u[2],v=s.y,ownerU=t.x*f.u[0]+t.z*f.u[2],face=dot([t.x,t.y,t.z],f.n)+(k?t.w:t.d)/2;
      var co=Math.cos(s.tilt||0),si=Math.sin(s.tilt||0),ew=Math.abs(co)*(s.w/2+LIP)+Math.abs(si)*(s.h/2+LIP),eh=Math.abs(si)*(s.w/2+LIP)+Math.abs(co)*(s.h/2+LIP);
      // Keep the complete tilted cabinet on the owner's flat face; signs never
      // bridge an open corner or masquerade as a freestanding hologram.
      if(Math.abs(u-ownerU)+ew>(k?t.d:t.w)*.455-.025||v-eh<t.y-t.h/2+.08||v+eh>t.y+t.h/2-.08)return false;
      var outer=face;
      for(var i=0;i<list.length;i++){
        var p=list[i];if(p.u1<u-ew||p.u0>u+ew||p.v1<v-eh||p.v0>v+eh||p.n1<face-.1)continue;
        outer=Math.max(outer,p.n1);
      }
      if(outer-face>MAX_PROJECTION)return false;
      var front=outer+WALL_GAP+CASE_DEPTH+FACE_GAP,back=front-FACE_GAP-CASE_DEPTH,anchors=[];
      for(var side=-1;side<=1;side+=2){
        var au=u+co*s.w*.32*side,av=v+si*s.w*.32*side,surface=-Infinity,support=null;
        // The owning facade is guaranteed by the flat-face bound above. Use
        // the nearest real surface under each bracket, including rotated piers.
        for(var j=0;j<list.length;j++){
          var q=list[j];if(q.u0>au||q.u1<au||q.v0>av||q.v1<av||q.n1<surface)continue;
          var hit=raySurface(q,au,av,f);if(hit!==null&&hit>surface){surface=hit;support=q;}
        }
        if(!support||back-surface>MAX_BRACKET||surface>back+.001)return false;
        anchors.push({u:au,v:av,surface:surface,kind:support.kind,index:support.index});
      }
      s.x=f.u[0]*u+f.n[0]*front;s.z=f.u[2]*u+f.n[2]*front;
      s.mount={face:face,outer:outer,front:front,back:back,u:u,v:v,anchors:anchors,normal:f.n,axis:f.u,caseDepth:CASE_DEPTH,faceGap:FACE_GAP};
      return true;
    }};
  }
  function parts(signs){
    var result=[];
    function box(s,u,v,n,w,h,d,role){
      var m=s.mount;result.push({x:m.axis[0]*u+m.normal[0]*n,y:v,z:m.axis[2]*u+m.normal[2]*n,w:w,h:h,d:d,
        rotation:[0,s.ry,s.tilt||0],family:role==='cabinet'?0:4,buildingId:s.buildingId,seed:s.seed,collision:false,signMount:true,signId:s.d&&s.d.id,mountRole:role});
    }
    signs.forEach(function(s){
      var m=s.mount;if(!m)return;
      // One enlarged cabinet supplies the solid back, side walls and visible
      // perimeter lip. Its front stays behind the luminous artwork plane.
      box(s,m.u,m.v,m.front-FACE_GAP-CASE_DEPTH/2,s.w+LIP*2,s.h+LIP*2,CASE_DEPTH,'cabinet');
      m.anchors.forEach(function(a){var low=a.surface-EMBED,high=m.back+.05;
        box(s,a.u,a.v,(low+high)/2,.22,Math.min(.36,s.h*.22),high-low,'wall bracket');
      });
    });
    return result;
  }
  window.PenthouseSignageMounts={prepare:prepare,parts:parts};
}());
