import assert from 'node:assert/strict';
import {weatherState,daylight,ActionChanges} from '../src/app/game/effect-state.js';
import {Simulation} from '../src/app/game/simulation.js';

const sim=new Simulation('river',null,{nation:'estern',provinceId:'estern-3'});
const saved=JSON.stringify(sim.save());assert.deepEqual(weatherState(sim),{rain:0,mana:0});
const changes=new ActionChanges();assert.deepEqual(changes.read(sim),[]);assert.equal(JSON.stringify(sim.save()),saved);
sim.pendingEvent={type:'storm',at:20};sim.time=10;assert.equal(weatherState(sim).rain,.5);
sim.pendingEvent=null;sim.events.push({type:'storm',time:10});assert.equal(weatherState(sim).rain,1);
sim.time=24;assert.equal(weatherState(sim).rain,0);sim.outageUntil=30;assert.equal(weatherState(sim).mana,1);sim.time=30;assert.equal(weatherState(sim).mana,0);
assert.equal(daylight(0).night,0);assert.ok(daylight(44).night>.99);assert.ok(Math.abs(daylight(44).night-daylight(124).night)<1e-10);
const a={buildings:[{id:1,type:'well',x:9,z:9,health:100,cycles:4}]};assert.deepEqual(changes.read(a),[],'loading another site must not replay construction');
a.buildings[0].cycles++;assert.equal(changes.read(a)[0].kind,'complete');assert.deepEqual(changes.read(a),[],'a completed cycle must not replay every frame');
a.buildings[0].health=35;assert.equal(changes.read(a)[0].kind,'impact');a.buildings[0].health=100;assert.equal(changes.read(a)[0].kind,'repair');
a.buildings[0].x=12;assert.deepEqual(changes.read(a).map(e=>e.kind),['move','build']);
a.buildings.push({id:2,type:'well',x:11,z:11,health:100});assert.equal(changes.read(a)[0].kind,'build');
a.buildings.shift();assert.equal(changes.read(a)[0].kind,'demolish');
assert.deepEqual(changes.read({buildings:structuredClone(a.buildings)}),[],'saved-site restore has no fake action');
console.log('World effects: real event gating, expiry, daylight, one-shot actions, site reset and read-only save passed.');
