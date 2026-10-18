/* Original city massing, informed by the stepped piers, service decks and occupied
 * crowns in Wētā's BR2049 miniature photographs. See artwork/penthouse/REFERENCES.md.
 * Units are metres; every occupied volume is also a traffic-clearance obstacle. */
(function () {
  'use strict';
  window.PenthouseArchitecture = {
    populate: function (options) {
      var T=options.THREE,lite=options.lite,random=options.random,range=options.range,block=options.block;
      var towers=options.towers,structure=options.structure,ribs=options.ribs;
      var cyan=options.cyan,magenta=options.magenta,beacons=options.beacons;
      var base=-112,buildings=[],familyCounts=[0,0,0,0,0],shapeCounts={};
      // family controls the facade palette, not geometry: graphite, stone,
      // bronze, ceramic, industrial. All pieces of one address share a seed.
      function identity(family,shape,x,z) {
        var building={id:buildings.length,seed:random(),family:family,shape:shape,x:x,z:z};
        building.useClass=family===4?0:family===1||family===3?1:2;
        building.skin=family===4?0:family===1?1:family===2?2:3;
        buildings.push(building);familyCounts[family]++;shapeCounts[shape]=(shapeCounts[shape]||0)+1;
        return building;
      }
      function add(list,b,x,y,z,w,h,d) {
        if(w<=0||h<=0||d<=0)return;
        block(list,x,y,z,w,h,d,b.seed);
        var item=list[list.length-1];item.seed=b.seed;item.family=b.family;
        item.buildingId=b.id;item.archetype=b.shape;item.useClass=b.useClass;item.skin=b.skin;
        return item;
      }
      function volume(b,x,z,w,d,low,high) {return add(towers,b,x,(low+high)/2,z,w,high-low,d);}
      function cap(b,x,z,w,d,y,thickness) {add(structure,b,x,y,z,w+.22,thickness||.42,d+.22);}
      function parapet(b,x,z,w,d,y) {
        add(structure,b,x,y,z+d/2,w,.55,.25);
        add(structure,b,x-w/2,y,z,.25,.55,d);add(structure,b,x+w/2,y,z,.25,.55,d);
      }
      function machinery(b,x,z,w,d,y) {
        var units=lite?2:3;
        for(var i=0;i<units;i++)add(structure,b,x+(i-(units-1)/2)*w*.22,y+.55,z,w*.14,1.1,d*.28);
      }
      function mast(b,x,z,y,height) {
        add(ribs,b,x,y+height/2,z,.18,height,.18);beacons.push(new T.Vector3(x,y+height,z));
      }
      function piers(b,x,z,w,d,low,high,count) {
        // Piers extend forward from the curtain wall; large blank slabs would
        // erase its depth and turn every side into the same featureless box.
        for(var i=0;i<count;i++)add(ribs,b,x-w/2+(i+.5)*w/count,(low+high)/2,z+d/2+.19,.22,high-low,.44);
      }
      function accent(b,x,z,w,d,y) {
        var list=b.family===3?magenta:cyan;
        add(list,b,x,y,z+d/2+.15,w*.83,.12,.13);
      }
      function ziggurat(x,z,w,d,top,family) {
        var b=identity(family===undefined?1:family,'stepped ziggurat',x,z),height=top-base;
        var levels=[0,.49,.73,.89,1],scales=[1,.81,.62,.43];
        for(var i=0;i<4;i++) {
          var xx=x+(i%2?-.035:.025)*w,zz=z-i*d*.035;
          volume(b,xx,zz,w*scales[i],d*scales[i],base+height*levels[i],base+height*levels[i+1]);
          cap(b,xx,zz,w*scales[i],d*scales[i],base+height*levels[i+1]);
          if(i<3&&z>-175)parapet(b,xx,zz,w*scales[i],d*scales[i],base+height*levels[i+1]+.38);
        }
        machinery(b,x,z-d*.10,w*.45,d*.48,top+.3);
        if(b.seed>.63)accent(b,x-w*.035,z-d*.035,w*.81,d*.81,base+height*.73-.4);
        return b;
      }
      function split(x,z,w,d,top,family) {
        var b=identity(family===undefined?0:family,'split shafts and skybridge',x,z),height=top-base;
        var podium=base+height*.27,bridge=base+height*.73;
        volume(b,x,z,w,d,base,podium);cap(b,x,z,w,d,podium);
        volume(b,x-w*.29,z-d*.05,w*.39,d*.86,podium,top);
        volume(b,x+w*.30,z+d*.025,w*.37,d*.94,podium,top-height*.13);
        cap(b,x-w*.29,z-d*.05,w*.39,d*.86,top);
        cap(b,x+w*.30,z+d*.025,w*.37,d*.94,top-height*.13);
        volume(b,x,z,w*.98,d*.67,bridge-2.6,bridge+2.6);cap(b,x,z,w,d*.71,bridge-2.85,.6);
        add(ribs,b,x-w*.48,(podium+top)/2,z+d*.4,.30,top-podium,.55);
        if(b.seed>.5)accent(b,x,z,w*.96,d*.67,bridge+2.4);
        if(top>8)mast(b,x-w*.29,z-d*.05,top,range(3,7));
        return b;
      }
      function staggered(x,z,w,d,top,family) {
        var b=identity(family===undefined?3:family,'staggered cantilever slabs',x,z),height=top-base;
        // The continuous rear core carries three offset occupied volumes.
        add(structure,b,x-w*.25,(base+top)/2,z-d*.30,w*.28,height,d*.35);
        var bounds=[0,.45,.76,1],widths=[.88,.86,.65],offsets=[-.06,.08,-.13];
        for(var i=0;i<3;i++) {
          var xx=x+w*offsets[i],dd=d*(i===2?.78:1),zz=z+(i===1?d*.035:0);
          volume(b,xx,zz,w*widths[i],dd,base+height*bounds[i],base+height*bounds[i+1]);
          cap(b,xx,zz,w*widths[i],dd,base+height*bounds[i+1],.8);
        }
        if(b.seed>.48)accent(b,x+w*.08,z+d*.035,w*.86,d,base+height*.76-.55);
        machinery(b,x-w*.13,z,w*.65,d*.78,top+.5);
        return b;
      }
      function industrial(x,z,w,d,top,family) {
        var b=identity(family===undefined?4:family,'terraced industrial complex',x,z),height=top-base;
        var low=base+height*.58,high=base+height*.84;
        volume(b,x,z,w,d,base,low);cap(b,x,z,w,d,low,.9);
        volume(b,x-w*.18,z-d*.14,w*.64,d*.69,low,high);cap(b,x-w*.18,z-d*.14,w*.64,d*.69,high,.7);
        volume(b,x-w*.32,z-d*.24,w*.29,d*.42,high,top);cap(b,x-w*.32,z-d*.24,w*.29,d*.42,top,.7);
        // Detached service stacks and roof plant create an inhabited industrial
        // scale without another identically luminous office crown.
        add(structure,b,x+w*.35,base+height*.47,z-d*.26,w*.18,height*.94,d*.24);
        machinery(b,x+w*.16,z+d*.13,w*.45,d*.56,low+.5);
        machinery(b,x-w*.19,z-d*.13,w*.6,d*.65,high+.4);
        if(z>-145)for(var i=0;i<3;i++)add(ribs,b,x-w*.28+i*w*.23,low+1.25,z+d*.33,w*.13,1.2,d*.24);
        if(b.seed>.55)accent(b,x,z,w,d,low-.6);
        return b;
      }
      function slender(x,z,w,d,top,family) {
        var b=identity(family===undefined?2:family,'slender offset setbacks',x,z),height=top-base;
        var shoulder=base+height*.34,crown=base+height*.87;
        volume(b,x,z,w,d,base,shoulder);cap(b,x,z,w,d,shoulder);
        volume(b,x-w*.12,z-d*.06,w*.58,d*.68,shoulder,crown);
        volume(b,x-w*.17,z-d*.11,w*.39,d*.47,crown,top);cap(b,x-w*.17,z-d*.11,w*.39,d*.47,top);
        volume(b,x+w*.32,z+d*.09,w*.19,d*.65,shoulder,base+height*.70);
        cap(b,x+w*.32,z+d*.09,w*.19,d*.65,base+height*.70);
        if(z>-180)piers(b,x-w*.12,z-d*.06,w*.58,d*.68,shoulder,crown,3);
        if(top>4)mast(b,x-w*.17,z-d*.11,top,range(3,7));
        return b;
      }
      function oval(x,z,w,d,top) {
        var b=identity(0,'elliptical setback tower',x,z),height=top-base;
        var levels=[0,.48,.83,1],widths=[1,.81,.56],depths=[1,.78,.55];
        for(var i=0;i<3;i++) {
          var item=volume(b,x,z,w*widths[i],d*depths[i],base+height*levels[i],base+height*levels[i+1]);
          item.shape='round';
        }
        machinery(b,x,z,w*.42,d*.44,top+.1);
        if(top>4)mast(b,x,z,top+1.3,range(4,8));
        return b;
      }
      var shapes=[ziggurat,split,staggered,industrial,slender,oval];
      var heroFootprints=[[-30,-93,21,21],[22,-88,26,21],[-82,-165,30,26],[100,-190,29,25],[7,-216,28,24],[68,-133,17,17]];
      var rows=lite?6:8;
      for(var layer=0;layer<rows;layer++) {
        var pz=-49-layer*32,spacing=layer<2?26:25,extent=145+layer*25;
        for(var px=-extent;px<=extent;px+=spacing) {
          var bx=px+range(-3.5,3.5),bz=pz+range(-6,6),kind=Math.floor(random()*5);
          var bw=range(11,19),bd=range(10,19),top=range(-46,-6)+layer*3.3;
          // Low service blocks occupy the near streets. The horizon alternates
          // squat clusters with isolated spires rather than one uniform roofline.
          if(layer===0){top=range(-48,-25);if(random()>.44)kind=3;}
          else if(layer===1)top=Math.min(top,-10);
          else if(random()>.77){kind=4;top+=range(18,43);}
          if(kind===3){bw*=1.14;bd*=1.06;top-=range(9,21);}
          if(kind===1&&bw<14)bw=14;
          if(layer>1&&kind===4&&random()>.50)kind=5;
          var overlapsHero=heroFootprints.some(function(t){return Math.abs(bx-t[0])<(bw+t[2])/2+3.2&&Math.abs(bz-t[1])<(bd+t[3])/2+3.2;});
          if(!overlapsHero)shapes[kind](bx,bz,bw,bd,top);
        }
      }
      // AXL: bronze art-deco piers, narrow occupied shaft and three deliberate
      // crown setbacks. Small broad collars retain the existing ring/sign anchors.
      var axl=identity(2,'AXL stepped art-deco piers',-30,-93);
      volume(axl,-30,-93,18,18,base,-23);cap(axl,-30,-93,18.5,18.5,-23,.8);
      volume(axl,-30,-93.7,13.8,15.4,-23,26);
      [-1,1].forEach(function(sign){
        volume(axl,-30+sign*7.55,-93.5,1.9,13.2,-23,31);
        add(ribs,axl,-30+sign*7.55,6,-86.7,.57,50,.50);
      });
      volume(axl,-30,-93,18.45,18.45,-6.1,-2);cap(axl,-30,-93,18.6,18.6,-3.95,.6);
      volume(axl,-30,-93,18.65,19.8,15.1,20.8);cap(axl,-30,-93,18.8,18.8,17,.32);
      volume(axl,-30,-94.1,10.5,12.3,26,35.4);cap(axl,-30,-94.1,10.7,12.5,35.4,.55);
      volume(axl,-30,-94.5,7.1,9.1,35.4,42);cap(axl,-30,-94.5,7.3,9.3,42,.55);
      piers(axl,-30,-93.7,13.8,15.4,-23,26,5);
      [-1,1].forEach(function(sign){add(ribs,axl,-30+sign*4.5,35.7,-87.7,.44,15.6,.5);});
      mast(axl,-30,-94.5,42.3,7.8);
      accent(axl,-30,-94.1,10.5,12.3,35.2);

      // Prism: an open vertical slot, shafts of unequal height, a projecting
      // occupied bridge and a thin crown cap. The gap stays genuinely empty.
      var prism=identity(3,'Prism asymmetric twin shafts',22,-88);
      volume(prism,22,-88,21,17,base,-20);cap(prism,22,-88,21.5,17.5,-20,.8);
      volume(prism,16.4,-88.2,9.3,16.6,-20,55);
      volume(prism,28.7,-88,7.5,15.6,-20,43.5);
      volume(prism,22,-88.15,25.05,18.55,23.4,29.5);
      cap(prism,22,-88,25.1,19.9,29.7,.5);
      add(structure,prism,22,-3,-88,21.5,1.25,17.5);
      cap(prism,16.4,-88.2,10.0,17.3,55.3,.7);
      volume(prism,15.4,-90.4,6.0,10.5,55.5,60.2);cap(prism,15.4,-90.4,6.2,10.7,60.3,.5);
      cap(prism,28.7,-88,8.1,16.2,43.7,.65);
      add(ribs,prism,11.8,18.5,-79.5,.45,74,.65);
      add(ribs,prism,32.4,12,-80.0,.45,62,.65);
      accent(prism,16.4,-88.2,9.3,16.6,54.9);mast(prism,15.4,-90.4,60.6,5);

      // More distant landmarks each repeat a different structural language.
      var west=ziggurat(-82,-165,28,25,64,1);
      add(structure,west,-82,39.8,-165,29.5,.75,24.8);
      var east=split(100,-190,27,23,69,0);
      volume(east,100,-190,27.2,22.1,31.7,38.5);
      add(structure,east,100,44.6,-190,27.3,.8,22.6);
      var horizon=staggered(7,-216,27,23,72,4);
      mast(horizon,4,-220,72.5,8.4);
      // Base of the existing oval communications crown, rendered by city.js.
      var comm=identity(0,'communications service core',68,-133);
      var commShaft=volume(comm,68,-133,12,12,base,19);commShaft.shape='round';
      volume(comm,64.3,-133.8,3,10,base,10);
      // This is a substantial second skin: deep horizontal service floors and
      // full-height opaque load paths replace most of the exposed glass. The
      // occupied cores keep their seeded positions; the city has accumulated
      // asymmetric infrastructure around them over several construction eras.
      // All dimensions are metres. Small cladding is inside the traffic margin.
      function hash(n){var v=Math.sin(n*127.1+71.7)*43758.5453;return v-Math.floor(v);}
      function detail(list,b,x,y,z,w,h,d,material,rotation,solid){
        var v=add(list,b,x,y,z,w,h,d);if(!v)return;
        v.family=material===undefined?b.family:material;v.collision=!!solid;
        if(rotation)v.rotation=rotation;
        return v;
      }
      function beam(b,ax,ay,az,bx,by,bz,width,depth){
        var dx=bx-ax,dy=by-ay,dz=bz-az,len=Math.sqrt(dx*dx+dy*dy+dz*dz);
        // Every brace used here lies in a facade plane. Local Y is its axis.
        return detail(ribs,b,(ax+bx)/2,(ay+by)/2,(az+bz)/2,width,len,depth,4,[0,0,-Math.atan2(dx,dy)]);
      }
      function serviceDeck(b,x,y,z,w,d,side){
        detail(structure,b,x,y,z,w,.85,d,4,null,true);
        detail(ribs,b,x,y+1.20,z+d/2-.12,w,.12,.13,4);
        for(var q=0;q<4;q++)detail(ribs,b,x-w/2+(q+.15)*w/3.3,y+.66,z+d/2-.12,.11,1.15,.11,4);
        var lighting=b.family===3?magenta:cyan;
        // Broken recessed docking markers, never an unbroken luxury edge.
        for(var q=0;q<3;q++)if(hash(b.id*31+q)>.22)detail(lighting,b,x-w*.34+q*w*.31,y-.23,z+d/2+.025,w*.12,.11,.09,4);
        if(side)beam(b,x-w*.3,y-5,z-d*.24,x-w*.3,y-.6,z+d*.34,.45,.48);
      }
      var originalVolumes=towers.slice(),industrialVolumes=0,residentialVolumes=0,officeVolumes=0;
      originalVolumes.forEach(function(t,index){
        var b=buildings[t.buildingId],low=t.y-t.h/2,high=t.y+t.h/2;
        if(t.useClass===0)industrialVolumes++;else if(t.useClass===1)residentialVolumes++;else officeVolumes++;
        if(t.h<6||t.w<3.7||t.d<4)return;
        var near=t.z>-180&&Math.abs(t.x)<150,hero=b.id>=buildings.length-6;
        var metal=b.family===1?4:b.family===3?1:b.family;
        var outer=t.z+t.d/2,sideSign=t.x<0?1:-1,sideX=t.x+sideSign*t.w/2;
        var seed=b.seed*1000+index,skin=t.skin;
        if(t.shape==='round'){
          // Boiler-like segmented shells, deep vertical machinery spines and
          // independently replaced metal sectors break the cylindrical glass.
          var n=near?9:6;
          for(var k=0;k<n;k++){
            var a=k/n*Math.PI*2,rx=t.w*.5,rz=t.d*.5;
            detail(structure,b,t.x+Math.sin(a)*(rx+.36),t.y,t.z+Math.cos(a)*(rz+.36),t.w*.13,t.h,.95,metal,[0,a,0]);
          }
          for(var yy=low+6.4;yy<high-1;yy+=near?12.8:19.2){
            for(var k=0;k<8;k++){
              var a=k/8*Math.PI*2;
              detail(structure,b,t.x+Math.sin(a)*t.w*.48,yy,t.z+Math.cos(a)*t.d*.48,t.w*.42,2.1,1.15,4,[0,a,0]);
            }
          }
          return;
        }
        // Heavily asymmetric full-height service shafts and concrete piers.
        var pierCount=skin===0?3:2,pierWidth=t.w*(skin===0?.12:skin===1?.16:.14);
        for(var k=0;k<pierCount;k++){
          var px=t.x+t.w*(pierCount===2?(-.34+k*.67):(-.40+k*.37));
          var shift=(hash(seed+k*11)-.5)*.24;
          detail(structure,b,px+shift,t.y,outer+.44,pierWidth,t.h+.25,1.25+(k%2)*.55,metal);
          if(near&&k===1&&b.id%3===0)detail(ribs,b,px+pierWidth*.53,t.y,outer+1.12,.16,t.h,.21,4);
        }
        // One side is retrofitted with an opaque lift/service bay; it reads as
        // occupied infrastructure instead of another identical glazed face.
        detail(structure,b,sideX+sideSign*.48,t.y,t.z-t.d*.17,1.4,t.h,t.d*.35,4);
        detail(ribs,b,sideX+sideSign*1.22,t.y,t.z-t.d*.34,.24,t.h,.27,metal);
        // Deep interstitial floors interrupt the windows in multi-floor zones.
        var spacing=skin===0?16:skin===1?22.4:19.2;
        var start=Math.ceil((low+112)/spacing)*spacing-112;
        for(var yy=start;yy<high-1.4;yy+=spacing){
          if(yy<low+.8)continue;
          var beltHeight=skin===0?3.3:skin===1?2.4:2.8;
          detail(structure,b,t.x,yy,outer+.39,t.w+1.0,beltHeight,1.35,metal);
          detail(structure,b,sideX+sideSign*.39,yy,t.z,1.35,beltHeight,t.d+.42,metal);
          if(near){
            detail(ribs,b,t.x,yy-beltHeight*.43,outer+1.13,t.w+.8,.19,.38,4);
            // Shuttered ventilation clusters are physically recessed between
            // coarse ribs; subordinate slits are occasional maintenance lights.
            var count=lite?2:3;
            for(var q=0;q<count;q++){
              var px=t.x-t.w*.36+q*t.w*.72/Math.max(1,count-1);
              detail(ribs,b,px,yy+.10,outer+1.11,t.w*.085,beltHeight*.54,.16,4);
              if(q===1&&hash(seed+yy)>.76)detail(cyan,b,px,yy+.18,outer+1.22,t.w*.065,.10,.06,4);
            }
          }
        }
        if(!near)return;
        // Repair cladding covers a few complete bays, not noise scattered over
        // every window. Repeated blocks share a functional floor grouping.
        var patchY=low+t.h*(.3+hash(seed+10)*.42),patchH=Math.min(t.h*.25,12.4);
        detail(structure,b,t.x+t.w*(hash(seed+11)>.5?.26:-.28),patchY,outer+.25,t.w*.23,patchH,.7,(metal+3)%5);
        detail(ribs,b,t.x-t.w*.48,t.y,outer+1.19,.24,t.h,.25,4);
        // External conduits form paired runs with visible junction boxes.
        var conduitX=t.x+t.w*.43;
        for(var c=0;c<(b.id%3===0?2:1);c++)detail(ribs,b,conduitX-c*.32,t.y,outer+.89,.18,t.h,.22,2);
        for(var yy=low+8;yy<high;yy+=16)detail(structure,b,conduitX-.16,yy,outer+1.08,.9,1.05,.48,4);
        if(t.h>25&&hash(seed+28)>.70){
          var deckY=low+t.h*.65;
          serviceDeck(b,t.x+t.w*.12,deckY,outer+1.5,t.w*.64,3.5,true);
        }
        // Large diagonal load paths occur only on selected towers, avoiding a
        // universal repeating X motif across the skyline.
        if((b.id%7===0||hero)&&t.h>65&&t.w>13){
          for(var seg=0;seg<2;seg++){
            var ay=low+t.h*(seg*.44+.04),by=low+t.h*(seg*.44+.43);
            var flip=seg%2?1:-1;
            beam(b,t.x+flip*t.w*.43,ay,outer+1.35,t.x-flip*t.w*.43,by,outer+1.35,Math.max(.52,t.w*.044),.8);
          }
        }
      });
      // The two existing anchors keep their x/z and top heights, but acquire
      // unequal maintenance stacks, deep docks and suspended utility gantries.
      // Those silhouettes are materially different from their old office skins.
      detail(structure,axl,-37.8,4.5,-84.5,3.8,62,3.3,4,null,true);
      detail(structure,axl,-22.3,22,-90.8,3.4,28,4.5,1,null,true);
      serviceDeck(axl,-28.3,19.2,-80.5,18.7,5.8,true);
      detail(structure,axl,-32.2,38.5,-89.2,8.5,5.2,5.6,4,null,true);
      for(var k=0;k<3;k++)detail(ribs,axl,-35+k*2.0,42.5,-89.2,1.1,4.5,1.5,4,null,true);
      detail(structure,axl,-39.2,26,-89.4,7.0,1.6,2.7,4,null,true);
      beam(axl,-38,20,-88,-42.4,25.2,-88,.75,.85);
      detail(structure,prism,11.5,12.5,-78.8,3.2,78,3.0,4,null,true);
      detail(structure,prism,30.2,18,-78.6,4.9,39,2.9,1,null,true);
      serviceDeck(prism,25.5,28,-75.8,15.7,5.9,true);
      detail(structure,prism,15.8,49.6,-77.4,13.3,4.4,3.8,4,null,true);
      for(var k=0;k<4;k++)detail(structure,prism,12.2+k*2.2,53.1,-77.7,1.3,2.4,2.2,4,null,true);
      detail(structure,prism,21.1,38,-83,8.7,2.4,4.0,4,null,true);
      beam(prism,18,29,-80.4,24,37,-80.4,.9,1.1);
      // Street-level maintenance density supports the large shapes. Rooftop
      // clusters use existing caps so no new skyline-wide spire is introduced.
      buildings.forEach(function(b){
        var ts=originalVolumes.filter(function(v){return v.buildingId===b.id;});
        if(!ts.length||b.z< -190||Math.abs(b.x)>160)return;
        var top=ts.reduce(function(a,v){return v.y+v.h/2>a.y+a.h/2?v:a;},ts[0]);
        var yy=top.y+top.h/2;if(top.w<4)return;
        for(var k=0;k<(lite?2:3);k++){
          var xx=top.x+(k-1)*Math.min(top.w*.23,2.4),zz=top.z-top.d*.13;
          detail(structure,b,xx,yy+.85,zz,Math.min(1.6,top.w*.17),1.7,Math.min(2.8,top.d*.32),4,null,true);
          detail(ribs,b,xx,yy+1.8,zz,Math.min(1.8,top.w*.19),.18,Math.min(3,top.d*.34),4);
        }
      });
      // Low-level megastructure: enclosed skybridges and pipe racks span the
      // canyons between near towers. Everything sits below the traffic lanes
      // (tops < -26 m) so route clearance is unchanged.
      var spanCandidates=originalVolumes.filter(function(v){return v.z>-210&&v.z<-40&&Math.abs(v.x)<150&&v.h>30&&v.shape!=='round';});
      var spans=0,maxSpans=lite?8:20;
      spanCandidates.forEach(function(a,i){spanCandidates.forEach(function(c,j){
        if(j<=i||spans>=maxSpans||a.buildingId===c.buildingId)return;
        var left=a.x<c.x?a:c,right=a.x<c.x?c:a,gap=(right.x-right.w/2)-(left.x+left.w/2);
        if(gap<4||gap>34||Math.abs(a.z-c.z)>10)return;
        var lo=Math.max(a.y-a.h/2,c.y-c.h/2)+6,hi=Math.min(a.y+a.h/2,c.y+c.h/2,-26)-3;if(hi-lo<5)return;
        var bb=buildings[left.buildingId],y=lo+hash(i*13+j)*(hi-lo);
        var z=Math.min(left.z+left.d/2,right.z+right.d/2)-2.6-hash(i+j*7)*Math.min(left.d,right.d)*.3;
        var x0=left.x+left.w/2,x1=right.x-right.w/2,mx=(x0+x1)/2,len=x1-x0+1.4;
        if(hash(i*5+j)>.38){
          volume(bb,mx,z,len,4.2,y-1.7,y+1.7);
          detail(ribs,bb,mx,y+1.95,z,len+.4,.38,4.7,4);detail(ribs,bb,mx,y-1.95,z,len+.4,.45,4.9,4);
          for(var q=0;q<Math.floor(len/6);q++)detail(ribs,bb,x0+3+q*6,y,z+2.2,.3,3.6,.3,4);
          if(hash(i+j*3)>.55)for(var q=0;q<3;q++)if(hash(i*7+j+q)>.35)detail(bb.family===3?magenta:cyan,bb,mx-len*.3+q*len*.3,y-2.25,z+2.42,len*.12,.1,.08,4);
        }else{
          for(var k=0;k<3;k++)detail(ribs,bb,mx,y+k*.75,z+(k-1)*.7,len,.5,.5,k===1?2:4);
          detail(structure,bb,mx,y-.65,z,len,.28,2.6,4);
          for(var q=0;q<Math.floor(len/7);q++)detail(ribs,bb,x0+3.5+q*7,y-3,z,.22,4.6,.22,4);
        }
        spans++;
      });});
      // Distant crowns carry antenna clusters and relay masts; each top gets
      // an aviation light. Near crowns stay clear of the flying lanes.
      buildings.forEach(function(b){
        var ts=originalVolumes.filter(function(v){return v.buildingId===b.id;});if(!ts.length||b.z>-150)return;
        var top=ts.reduce(function(a,v){return v.y+v.h/2>a.y+a.h/2?v:a;},ts[0]),yy=top.y+top.h/2;if(yy<10||top.w<5)return;
        var n=2+Math.floor(hash(b.id*3.1)*3);
        for(var k=0;k<n;k++){var mh=5+hash(b.id*11+k)*13,mx=top.x+(hash(b.id+k*5)-.5)*top.w*.6,mz=top.z+(hash(b.id*2+k)-.5)*top.d*.6;
          add(ribs,b,mx,yy+mh/2,mz,.16+mh*.008,mh,.16+mh*.008);if(k===0)beacons.push(new T.Vector3(mx,yy+mh,mz));
          if(hash(b.id+k)>.6)add(structure,b,mx,yy+mh*.6,mz+.5,1.4,1.4,.25);}
      });
      return {buildings:buildings.length,families:familyCounts,shapes:shapeCounts,
        useClasses:{industrial:industrialVolumes,residential:residentialVolumes,office:officeVolumes},
        retrofitParts:structure.length+ribs.length,identity:'Layered utility city / heavy retrofit skins'};
    }
  };
}());
