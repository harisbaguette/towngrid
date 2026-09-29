// Building rows follow the four fixed camera views: SE, NE, NW, SW.
// Foliage reuses its radial silhouette; water lies on the world ground plane.
import { INDUSTRY_BUILDINGS } from './pixel-industry-data.js';
import { EXPANSION_BUILDINGS } from './pixel-expansion-data.js';
import { FARM_BUILDINGS } from './pixel-farm-data.js';
import { FARM_CROP_ATLASES, FARM_GOODS_ORDER, FARM_PART_FRAMES } from './pixel-farm-sockets.js';
import { NEW_VEHICLE_SIZES } from './vehicle-art.js';
import { RESOURCE_FRAMES } from './resource-art.js';
export const ENVIRONMENT_CELL = 192;
export const ENVIRONMENT_ASSETS = {
 ...Object.fromEntries(Object.entries(NEW_VEHICLE_SIZES).map(([id,size])=>[id,{scenery:true,sheet:`/assets/pixel-environment/${id}.png`,frames:1,directions:4,anchor:[.5,181/192],size}])),
 resourceGoods:{cutout:true,sheet:'/assets/pixel-environment/resourceGoods.png',frames:Object.keys(RESOURCE_FRAMES).length,anchor:[.5,.5],size:.4},
 supportArt:{cutout:true,sheet:'/assets/pixel-environment/supportArt.png',frames:12,anchor:[.5,.5],size:.4},
 biomeGround:{sheet:'/assets/pixel-environment/biomeGround.png',frames:8},
 ...Object.fromEntries(Object.entries({snowPine:1.9,forestTree:1.8,cactus:.9,oilSeep:.9,snowMountain:3.4,volcanicMountain:3.4}).map(([id,size])=>[id,{scenery:true,sheet:`/assets/pixel-environment/${id}.png`,frames:1,directions:4,anchor:[.5,181/192],size}])) ,
 mountain:{scenery:true,sheet:'/assets/pixel-environment/mountain.png',frames:1,directions:4,anchor:[.5,181/192],size:3.4},
 ...Object.fromEntries([...INDUSTRY_BUILDINGS,...EXPANSION_BUILDINGS,...FARM_BUILDINGS].map(id => [id, { building: true, sheet: `/assets/pixel-environment/${id}.png`, frames: 1, directions: 4, anchor: [.5, .69], size: 1.4 }])),
 expansionGoods: {cutout:true,sheet:'/assets/pixel-environment/expansionGoods.png',frames:20,anchor:[.5,.5],size:.4},
 cottonGrowth: {cutout:true,sheet:'/assets/pixel-environment/cottonGrowth.png',frames:4,anchor:[.5,.94],size:.4},
 herbGrowth: {cutout:true,sheet:'/assets/pixel-environment/herbGrowth.png',frames:4,anchor:[.5,.94],size:.4},
 ...Object.fromEntries(FARM_CROP_ATLASES.map(id=>[id,{cutout:true,sheet:`/assets/pixel-environment/${id}.png`,frames:4,anchor:[.5,.94],size:.4}])),
 farmGoods:{cutout:true,sheet:'/assets/pixel-environment/farmGoods.png',frames:FARM_GOODS_ORDER.length,anchor:[.5,.5],size:.4},
 farmParts:{cutout:true,sheet:'/assets/pixel-environment/farmParts.png',frames:Object.keys(FARM_PART_FRAMES).length,anchor:[.5,.5],size:.4},
 ...Object.fromEntries(Object.entries({rock:.95,mossrock:.95,oreRock:1.05,cliff:1.6,pine:1.9,willow:1.9,palm:1.9,bush:.65,reeds:.52,ruin:1.8,lighthouse:2.1,exportGate:1.4,cargoTruck:.8,cargoTrain:1.25,fishingBoat:1.15}).map(([id,size])=>[id,{scenery:true,sheet:`/assets/pixel-environment/${id}.png`,frames:1,directions:4,anchor:[.5,181/192],size}])),
 clouds:{scenery:true,sheet:'/assets/pixel-environment/clouds.png',frames:4,anchor:[.5,.5],size:3},
 birds:{scenery:true,sheet:'/assets/pixel-environment/birds.png',frames:4,anchor:[.5,.5],size:.30},
 ground:{sheet:'/assets/pixel-environment/ground.png',frames:8},
 networks:{sheet:'/assets/pixel-environment/networks.png',frames:8},
 infrastructureGround:{sheet:'/assets/pixel-environment/infrastructureGround.png',frames:8},
 henPeck:{cutout:true,sheet:'/assets/pixel-environment/henPeck.png',frames:4,anchor:[.5,.85],size:.25},
 ...Object.fromEntries(['creek','river','sea','lake'].map(id=>[id,{sheet:`/assets/pixel-environment/${id}.png`,frames:4}])),
 industrialTools: { cutout: true, sheet: '/assets/pixel-environment/industrialTools.png', frames: 16, anchor: [.5, .5], size: .4 },
 industrialGoods: { cutout: true, sheet: '/assets/pixel-environment/industrialGoods.png', frames: 16, anchor: [.5, .5], size: .4 },
 sawmill: { building: true, sheet: '/assets/pixel-environment/sawmill.png', frames: 1, directions: 4, anchor: [.5, .69], size: 1.4 },
 warehouse: { building: true, sheet: '/assets/pixel-environment/warehouse.png', frames: 1, directions: 4, anchor: [.5, .69], size: 1.4 },
 house: { building: true, sheet: '/assets/pixel-environment/house.png', frames: 1, directions: 4, anchor: [.5, .75], size: 1.4 },
 well: { building: true, sheet: '/assets/pixel-environment/well.png', frames: 1, directions: 4, anchor: [.5, .69], size: 1.4 },
 lumber: { building: true, sheet: '/assets/pixel-environment/lumber.png', frames: 1, directions: 4, anchor: [.5, .69], size: 1.4 },
 field: { building: true, sheet: '/assets/pixel-environment/field.png', frames: 1, directions: 4, anchor: [.5, .69], size: 1.4 },
 productionParts: { cutout: true, sheet: '/assets/pixel-environment/productionParts.png', frames: 8, anchor: [.5, .5], size: .4 },
 wheatGrowth: { cutout: true, sheet: '/assets/pixel-environment/wheatGrowth.png', frames: 4, anchor: [.5, .94], size: .4 },
 oak: { sheet: '/assets/pixel-environment/oak.png', frames: 7, anchor: [.5, .91], size: 1.68 },
 water: { sheet: '/assets/pixel-environment/water.png', frames: 4 },
};
export const PLANK_ICON = '/assets/pixel-environment/plank.png';
export const PIXEL_BUILDINGS = Object.keys(ENVIRONMENT_ASSETS).filter(id => ENVIRONMENT_ASSETS[id].building);

// Architecture never cycles. Tools, growing plants and output are separate
// layers; their state lives on the model's production/layers fields.
export function pixelBuildingFrame() { return 0; }

export function sawmillFrame(building, time) {
 return pixelBuildingFrame('sawmill', building, time);
}

export function oakFrame(tile, time, harvesting = false, phase = 0) {
 if (tile?.nature === 'sapling') return (tile.growAt ?? time + 160) - time > 80 ? 5 : 6;
 if (tile?.nature === null) return 4;
 const sequence = harvesting ? [0, 3, 1, 3] : [0, 1, 2, 1];
 return sequence[Math.floor(Math.max(0, time + phase) * (harvesting ? 6 : 2)) % sequence.length];
}

export function waterFrame(time) { return Math.floor(Math.max(0, time) * 3) % 4; }
