// Stable packing order shared by world stockpiles and UI images.
export const RESOURCE_SOURCES = {
 wood:['productionParts',1], stone:['industrialGoods',0], water:['productionParts',0], grain:['productionParts',3], plank:['productionParts',2],
 flour:['industrialGoods',1], bread:['industrialGoods',2], fish:['industrialGoods',3], gear:['industrialGoods',4], iron:['industrialGoods',5],
 coal:['industrialGoods',6], steel:['industrialGoods',7], oil:['industrialGoods',8], fuel:['industrialGoods',9], polymer:['industrialGoods',10],
 mana:['industrialGoods',11], circuit:['industrialGoods',12], car:['industrialGoods',13], medicine:['industrialGoods',14],
 cotton:['expansionGoods',0], herb:['expansionGoods',1], egg:['expansionGoods',2], smokedfish:['expansionGoods',3], cloth:['expansionGoods',4],
 cake:['expansionGoods',5], brick:['expansionGoods',6], workwear:['expansionGoods',7], glass:['expansionGoods',8], copper:['expansionGoods',9],
 wire:['expansionGoods',10], concrete:['expansionGoods',11], canned:['expansionGoods',12], lamp:['expansionGoods',13], engine:['expansionGoods',14],
 mithril:['expansionGoods',15], airship:['expansionGoods',16],
};
export const RESOURCE_FRAMES = Object.fromEntries(Object.keys(RESOURCE_SOURCES).map((id,i)=>[id,i]));
export const SERVICE_ART = {power:0,horse:1,irrigation:2,ward:3,transit:4,health:5};
export const RESOURCE_ICONS = Object.fromEntries([...Object.keys(RESOURCE_SOURCES),...Object.keys(SERVICE_ART)].map(id=>[id,`/assets/pixel-environment/resources/${id}.png`]));
