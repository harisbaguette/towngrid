// farm-v11/v12 provide refreshed artwork and separate crop/animal layers.
// Support facility sockets and parts are supplied by the farm generator.
import { FARM_SOCKETS, FARM_PART_FRAMES } from './pixel-farm-sockets.js';
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

const REFRESH_SOCKETS = {
 shallowmine:{pulley:[[137,94],[61,93],[129,96],[67,96]]},
 windpump:{rotor:[[125,54],[72,57],[124,51],[77,56]]},
 winery:{press:[[102,122],[48,105],[150,105],[88,113]]},
 feedmill:{wheel:[[133,124],[57,120],[129,124],[59,124]],steam:[[85,53],[80,59],[116,54],[110,55]]},
 sandpit:{pick:[[111,145],[112,145],[103,145],[111,145]]},
 clayfield:{pick:[[119,142],[112,145],[94,142],[95,146]]},
 chocolatier:{fire:[[32,127],null,[152,131],[161,128]],steam:[[33,92],[140,77],[151,98],[160,96]]},
 packshop:{belt:[[60,143],[146,139],[158,124],[147,143]]},
 solarpanel:{lamp:[[105,149],[75,150],[44,135],[148,116]]},
};
const at = (id, socket) => (REFRESH_SOCKETS[id]||FARM_SOCKETS[id])[socket];
const tool = (name, size, pos, motion = 'still', show = 'always', extra = {}) => ({ name, frame: INDUSTRIAL_TOOLS[name], size, pos, motion, show, ...extra });
const farmPart = (name, size, pos, motion, show, extra = {}) => ({ name, frame: FARM_PART_FRAMES[name], size, pos, motion, show, atlas: 'farmParts', ...extra });
const field = (crop, extra = {}) => ({ parts: [], crop,
 cropPos:[[96,110],[56,131],[136,131],[96,153]],
 outputPos:[[77,164],[96,174],[115,164]],outputSize:.18,...extra });

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
 winery: { parts: [{name:'press',frame:1,size:.13,pos:at('winery','press'),motion:'press',show:'work',atlas:'farmWorkParts'}], outputSize: .25 },
 chocolatier: { parts: [tool('fire', .17, at('chocolatier','fire'), 'flicker', 'work'), tool('steam', .20, at('chocolatier','steam'), 'steam', 'work')], outputSize: .24 },
 sheeppen: { parts: [], outputSize: .25 },
 milkbarn: { parts: [], outputSize: .24 },
 apiary: { parts: [], outputSize: .24 },
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
 shallowmine: { parts: [{name:'pulley',frame:2,size:.20,pos:at('shallowmine','pulley'),motion:'spin',show:'always',axis:'x',atlas:'farmWorkParts'}], outputSize: .26 },
 windpump: { parts: [farmPart('rotor', .36, at('windpump','rotor'), 'spin', 'always', { axis: 'z' })] },
};
