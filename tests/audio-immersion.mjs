import assert from 'node:assert/strict';
import {GameAudio} from '../src/app/game/audio.js';
import {daylight,localWeatherState} from '../src/app/game/effect-state.js';
import {createIndustryTrial,tickIndustryTrial,trialState} from '../src/app/game/industry-trials.js';

const a=new GameAudio();
for(const ecology of ['snow','desert','volcanic'])for(const time of [4,44]){
 a.ecology=ecology;a.clock=time;
 const mix=a.ambienceMix();assert.equal(mix['forest-ambience'],0,ecology+' has no forest birds');assert.equal(mix['amb-crickets'],0,ecology+' has no summer insects');
}
a.ecology='forest';a.clock=4;let mix=a.ambienceMix();
assert.equal(daylight(a.clock).night,0);assert.ok(mix['forest-ambience']>0);assert.equal(mix['amb-crickets'],0);
a.clock=44;mix=a.ambienceMix();
assert.equal(daylight(a.clock).night,1);assert.equal(mix['forest-ambience'],0);assert.ok(mix['amb-crickets']>0);
const sim={paused:false,region:'river',time:0,soundEvents:[],buildings:[],layout:{ecology:'snow'},events:[{type:'storm',time:0}]};
assert.equal(localWeatherState(sim,{x:12,z:12}).rain,1);
assert.equal(localWeatherState(sim,{x:120,z:120}).rain,0);
a.update(sim,{x:12,z:12},{span:55});mix=a.ambienceMix();
assert.equal(mix['amb-rain'],0,'snowfall does not use liquid rain');assert.ok(mix['amb-wind']>.75);
sim.layout.ecology='forest';a.update(sim,{x:12,z:12},{span:55});assert.ok(a.ambienceMix()['amb-rain']>0);
a.update(sim,{x:120,z:120},{span:55});mix=a.ambienceMix();
assert.equal(mix['amb-rain'],0,'local storm cannot follow the camera across the continent');
assert.ok(mix['forest-ambience']>0,'close-up remote forest keeps its biome ambience');
a.update(sim,{x:120,z:120},{span:1000});assert.deepEqual(a.ambienceMix(),{'amb-wind':.45});

// A brief menu visit preserves the phrase; remaining in the menu still starts its own score.
a.context={currentTime:1,state:'suspended'};a.setInterface('home');assert.equal(a.scene,'home');
a.setInterface('home','settings');a.context.currentTime+=.6;a.refreshScene();assert.equal(a.scene,'home');
a.setInterface('home');assert.equal(a.scene,'home');assert.equal(a.sceneCandidate,null);
a.setInterface('home','settings');a.context.currentTime+=1.3;a.refreshScene();assert.equal(a.scene,'settings');
a.setInterface('home',null,{loading:true});assert.equal(a.scene,'loading','real loading still switches immediately');
a.setInterface('home',null,{error:true});assert.equal(a.scene,'error','recovery still switches immediately');
const trial=createIndustryTrial('bread');trial.active.time=trialState(trial).duration;tickIndustryTrial(trial);tickIndustryTrial(trial);
assert.equal(trial.trial.status,'expired');assert.equal(trial.active.soundEvents.filter(e=>e.type==='trial-ended').length,1,'timed-out trial emits one result cue despite pausing');
console.log('PASS visual day/night alignment, biome wildlife, snow/rain, local storm distance, remote ambience and short-menu stability');
