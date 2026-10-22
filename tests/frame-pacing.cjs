// Exercise the actual animation gate against display refresh timestamps.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../shared/penthouse-scene.js'),'utf8');
const gate=source.slice(source.indexOf('    const budget=flight?'),source.indexOf('    const dt=Math.min(clock.getDelta()',source.indexOf('  function animate(now)')));
assert(gate,'Animation timing gate is present');
function simulate(hz,lite,flight=false){const step=new Function('lite','flight','let lastFrame=0;return now=>{'+gate+';return true;};')(lite,flight);let count=0;for(let i=1;i<=hz*10;i++)if(step(i*1000/hz))count++;return count/10;}
for(const hz of [60,90,120,144]){const desktop=simulate(hz,false),touch=simulate(hz,true);assert(desktop>=59&&desktop<=60.1,`${hz} Hz desktop should sustain60 frames/s when GPU has capacity, got${desktop}`);assert(touch>=29&&touch<=30.1,`${hz} Hz mobile should retain30 frames/s, got${touch}`);assert.equal(simulate(hz,false,true),hz,'Camera flights follow every animation callback');}
console.log('PASS frame pacing at60/90/120/144Hz; desktop60fps, touch30fps, flights unthrottled.');
