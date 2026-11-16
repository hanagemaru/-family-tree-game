import test from 'node:test';
import assert from 'node:assert/strict';
import {pinchCamera} from '../src/pinch-camera.js';
test('pinch is absolute and remains stable regardless of interleaved pointer updates',()=>{
 const start={x:45,y:-30,scale:.8};
 const a={x:60,y:80},b={x:160,y:80};
 const outcome=pinchCamera(start,a,b,{x:45,y:95},{x:195,y:95});
 const midway=pinchCamera(start,a,b,{x:45,y:95},b);
 assert.ok(midway.scale>0,'partial move does not produce invalid scale');
 assert.equal(outcome.scale,1.2);
 // Pinch center at (110,80) corresponds to one stable world point.
 const anchorX=(110-start.x)/start.scale,anchorY=(80-start.y)/start.scale;
 assert.ok(Math.abs(outcome.x+anchorX*outcome.scale-120)<1e-8);
 assert.ok(Math.abs(outcome.y+anchorY*outcome.scale-95)<1e-8);
 assert.deepEqual(outcome,pinchCamera(start,a,b,{x:45,y:95},{x:195,y:95}));
});
test('pinch handles zero-distance or invalid inputs and caps extreme zoom',()=>{
 const start={x:2,y:3,scale:.7};
 assert.deepEqual(pinchCamera(start,{x:0,y:0},{x:0,y:0},{x:1,y:1},{x:10,y:1}),start);
 const capped=pinchCamera(start,{x:0,y:0},{x:100,y:0},{x:0,y:0},{x:1000,y:0});
 assert.equal(capped.scale,1.8);
 const floored=pinchCamera(start,{x:0,y:0},{x:100,y:0},{x:0,y:0},{x:1,y:0});
 assert.equal(floored.scale,.18);
});
