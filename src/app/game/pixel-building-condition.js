// Individual buildings keep their own original textures when sections collapse.
// No intact building is rotated; the foundation stays on its one-tile footprint.
const plots=new Set(['field','cottonfield','herbgarden','sugarfield','saltfield','vineyard','cocoafarm','berryfield','mintfield','pumpkinpatch','oakfarm','pond','pasture','clover','clayfield','sandpit']);
const towers=new Set(['magetower','leyrelay','windturbine','windpump','arcanepower','blastfurnace','oilpump','ironmine','coppermine']);
const yards=new Set(['dock','coastport','polarport','riverport','lakeport','ferrydock','polarferry','canaldock','streamdock','airport','airterminal','solarpanel']);
export function buildingDamageProfile(type) {
 const seed=[...type].reduce((v,c)=>v+c.charCodeAt(0),0);
 const kind=plots.has(type)?'plot':towers.has(type)?'tower':yards.has(type)?'yard':'structure';
 return {id:type,kind,split:kind==='plot'?[.52,.72,.86]:kind==='tower'?[.30,.53,.78]:[.36,.59,.80],
  lean:(seed%2?1:-1)*(.10+(seed%4)*.02)};
}
export function clipPixelPart(layer,rect) {
 const u=layer.userData;u.crop=rect;
 u.sprite.material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 fragmentUV;\n'+shader.vertexShader.replace('void main() {','void main() {\n fragmentUV=uv;');
  shader.fragmentShader='varying vec2 fragmentUV;\n'+shader.fragmentShader.replace('void main() {',
   `void main() {\n vec2 q=vec2(fragmentUV.x,1.0-fragmentUV.y);if(q.x<${rect[0].toFixed(6)}||q.y<${rect[1].toFixed(6)}||q.x>${rect[2].toFixed(6)}||q.y>${rect[3].toFixed(6)})discard;`);
 };
 u.sprite.material.customProgramCacheKey=()=>`building-piece-${rect.join(',')}`;
 u.sprite.material.needsUpdate=true;
}
export function attachBuildingCondition(type,group,{part,position,setFrame,atlas}) {
 const u=group.userData,profile=buildingDamageProfile(type),cuts=[0,...profile.split,1];
 let pieces=null;
 const makePieces=()=>cuts.slice(0,-1).map((top,i)=>{
  const bottom=cuts[i+1],cy=(top+bottom)/2;
  const layer=part('structure-piece-'+i,0,1.4,atlas);
  layer.userData.structurePiece=true;layer.userData.sprite.center.set(.5,1-cy);
  clipPixelPart(layer,[0,top,1,bottom]);layer.visible=false;
  return {layer,cy};
 });
 u.damageProfile=profile;
 let lastHealth=null,repairStart=-Infinity,repairFrom=0,amount=0,broken=false;
 return (time,building,view)=>{
  const health=building.health??100;
  const previous=u.previousConditionHealth??lastHealth;
  if(previous!==null&&health>previous){
   repairStart=time;repairFrom=previous===lastHealth?amount:previous<=0?1:Math.max(0,(50-previous)/50*.35);
  }
  const target=health<=0?1:health<50?(50-health)/50*.35:0;
  const rebuild=Math.max(0,1-(time-repairStart)/1.2);
  amount=target+(repairFrom-target)*rebuild;
  if(rebuild===0)amount=target;
  u.damageAmount=amount;u.repairProgress=rebuild>0?1-rebuild:null;
  u.sprite.visible=amount<.001;
  if(amount>=.001&&!pieces){pieces=makePieces();u.layers=[...pieces.map(p=>p.layer),...u.layers.filter(l=>!l.userData.structurePiece)];}
  for(const [i,{layer,cy}] of (pieces||[]).entries()){
   layer.visible=amount>=.001;setFrame(layer,0,view);layer.userData.sprite.position.set(0,0,0);
   const fixed=i===3,side=(i%2?1:-1)*(view<2?1:-1),baseline=profile.split[2]*192;
   const compression=1-(profile.kind==='plot'?.24:profile.kind==='tower'?.58:.52)*amount;
   layer.userData.sprite.scale.set(1.4,1.4*(fixed?1:compression),1);layer.userData.sprite.renderOrder=.5;
   position(layer,96+(fixed?0:side*2*amount),fixed?cy*192:baseline-(baseline-cy*192)*compression+3*amount,fixed?0:profile.lean*.45*side*amount);
  }
  if(broken&&health>0)for(const layer of u.layers)if(layer.userData.preBreakVisible!==undefined){layer.visible=layer.userData.preBreakVisible;delete layer.userData.preBreakVisible;}
  if(health<=0)for(const layer of u.layers)if(!layer.userData.structurePiece&&!['damage-cracks','damage-rubble','repair-needed','condition-effect'].includes(layer.name)){
   if(layer.userData.preBreakVisible===undefined)layer.userData.preBreakVisible=layer.visible;
   layer.visible=false;
  }
  for(const line of u.ropes||[])if(health<=0)line.visible=false;
  if(u.rope)u.rope.visible=health>0;
  broken=health<=0;lastHealth=health;
 };
}
