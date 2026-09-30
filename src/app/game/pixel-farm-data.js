// 2026-09-29 expansion facilities (docs/EXPANSION_20260929.md). Script-drawn
// four-view bodies from art-source/pixel-environment/farm-v9; animals and
// fixed equipment are in the body, crops/tools/output are separate layers.
import { FARM_SOCKETS, FARM_CROP_POSITIONS, FARM_PART_FRAMES } from './pixel-farm-sockets.js';
import { INDUSTRIAL_TOOLS } from './pixel-industry-data.js';

export const FARM_GROUPS = {
 farmcrops: ['sugarfield','saltfield','vineyard','cocoafarm'],
 farmfruits: ['berryfield','mintfield','pumpkinpatch','oakfarm'],
 ranch: ['sheeppen','milkbarn','apiary','duckhouse'],
 farmworks: ['feedmill','winery','chocolatier','packshop'],
 farmland: ['sandpit','clayfield','solarpanel'],
 farmterrain: ['pond','pasture','clover'],
 // Section 6 (2026-09-30): shallow mine and wind pump.
 farmsupport: ['shallowmine','windpump'],
};
export const FARM_BUILDINGS = Object.values(FARM_GROUPS).flat();

const at = (id, socket) => FARM_SOCKETS[id][socket];
const tool = (name, size, pos, motion = 'still', show = 'always', extra = {}) => ({ name, frame: INDUSTRIAL_TOOLS[name], size, pos, motion, show, ...extra });
const farmPart = (name, size, pos, motion, show, extra = {}) => ({ name, frame: FARM_PART_FRAMES[name], size, pos, motion, show, atlas: 'farmParts', ...extra });
const field = (crop, extra = {}) => ({ parts: [], crop, cropPos: FARM_CROP_POSITIONS, outputSize: .24, ...extra });

export const FARM_PROFILES = {
 sugarfield: field('sugarGrowth'),
 saltfield: field('saltGrowth', { cropSize: .34 }),
 // The planted variety follows the facility's current recipe output.
 vineyard: field({ grapered: 'grapeRedGrowth', grapewhite: 'grapeWhiteGrowth' }),
 cocoafarm: field('cocoaGrowth'),
 berryfield: field('strawberryGrowth', { cropSize: .34 }),
 mintfield: field('mintGrowth', { cropSize: .34 }),
 pumpkinpatch: field('pumpkinGrowth'),
 oakfarm: field('oakGrowth', { cropSize: .46 }),
 winery: { parts: [tool('ram', .24, at('winery','press'), 'press', 'work')], outputSize: .25 },
 chocolatier: { parts: [tool('fire', .17, at('chocolatier','fire'), 'flicker', 'work'), tool('steam', .20, at('chocolatier','steam'), 'steam', 'work')], outputSize: .24 },
 sheeppen: { parts: [], outputSize: .25 },
 milkbarn: { parts: [], outputSize: .24 },
 apiary: { parts: [farmPart('bees', .30, at('apiary','bees'), 'float', 'work')], outputSize: .24 },
 duckhouse: { parts: [], outputSize: .24 },
 feedmill: { parts: [tool('wheel', .22, at('feedmill','wheel'), 'spin'), tool('steam', .20, at('feedmill','steam'), 'steam', 'work')], outputSize: .25 },
 sandpit: { parts: [tool('pick', .30, at('sandpit','pick'), 'strike')], outputSize: .26 },
 clayfield: { parts: [tool('pick', .30, at('clayfield','pick'), 'strike')], outputSize: .26 },
 packshop: { parts: [{ name: 'parcel', frame: 15, size: .20, pos: at('packshop','belt'), motion: 'conveyor', show: 'work', atlas: 'industrialGoods' }], outputSize: .25 },
 solarpanel: { parts: [tool('lamp', .11, at('solarpanel','lamp'), 'still', 'supply')] },
 // Terrain facilities change their neighbours; they have no work cycle to animate.
 pond: { parts: [] },
 pasture: { parts: [] },
 clover: { parts: [] },
 // The winch pulley turns over the shaft while ore is hoisted; the wind wheel
 // turns in its own vertical plane whenever the pump supplies water.
 shallowmine: { parts: [tool('wheel', .2, at('shallowmine','pulley'), 'spin', 'always', { axis: 'x' })], outputSize: .26 },
 windpump: { parts: [farmPart('rotor', .36, at('windpump','rotor'), 'spin', 'always', { axis: 'z' })] },
};
