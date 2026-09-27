import { Simulation } from './simulation.js';
import { NATIONS, unlockRank } from './world.js';

// A disposable, prebuilt early village. Normal new-game rules and saves do not
// use this fixture. Free placement only seeds it; play uses real production.
export function createStarterShowcase(nation = 'estern', race = NATIONS[nation].race) {
 const sim = new Simulation(NATIONS[nation].region, null, { nation, race });
 sim.rank = Math.max(...['warehouse', 'house', 'well', 'field', 'lumber', 'sawmill'].map(unlockRank));
 sim.money = 2500;
 sim.nextEvent = 999999;
 sim.autoSell = { grain: true, plank: true };
 const layout = [
  ['warehouse', 11, 12], ['house', 10, 14], ['house', 12, 14], ['house', 14, 14],
  ['lumber', 9, 10], ['sawmill', 10, 10], ['well', 13, 10], ['field', 12, 9], ['field', 14, 9],
 ];
 for (const [type, x, z] of layout) {
  const result = sim.build(type, x, z, true);
  if (!result.ok) throw new Error(`초반 마을 ${type}: ${result.error}`);
 }
 for (let x = 8; x < 16; x++) sim.build('road', x, 11, true);
 for (let x = 9; x < 15; x++) sim.build('road', x, 13, true);
 for (const z of [9, 10]) sim.build('road', 11, z, true);
 for (const b of sim.buildings) {
  if (b.type === 'house') b.level = 2;
  for (const [resource, count] of Object.entries(sim.effectiveInputs(b))) b.inputs[resource] = count * 2;
 }
 const fields = sim.buildings.filter(b => b.type === 'field');
 fields[0].progress = .15;fields[1].progress = .65;
 sim.syncWorkers();sim.revision++;
 // Start with genuine activity already visible, rather than forcing working flags.
 for (let i = 0; i < 12; i++) sim.tick(.1);
 sim.soundEvents = [];sim.notices = [];
 return sim;
}
