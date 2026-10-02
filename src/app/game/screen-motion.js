// Coordinates are fractions of the approved illustration, independent of its cover/contain crop.
// Each plume starts at a chimney; water rectangles stay inside visible water, away from people.
const scene = (ambience, values = {}) => ({ ambience, ...values });
export const SCREEN_MOTION = {
 'home-background': scene('river', { water: [[.53,.17,.12,.045],[.58,.22,.13,.05],[.43,.37,.07,.065],[.43,.94,.33,.05]], smoke: [[.793,.277,.085],[.818,.275,.08],[.84,.355,.055],[.47,.752,.06],[.807,.52,.045]], lights: [[.766,.483,.023],[.935,.218,.014],[.848,.497,.012],[.888,.433,.01],[.644,.424,.009],[.599,.701,.01]], birds: [.34,.06,.46,.12], motes: [.34,.47,.32,.28] }),
 'waiting-background': scene('evening', { water: [[.5,.70,.11,.075],[.41,.85,.22,.06],[.48,.92,.16,.055],[.55,.49,.1,.055]], smoke: [[.864,.40,.075],[.957,.38,.085],[.524,.553,.06],[.704,.758,.07]], lights: [[.954,.432,.024,'#6ef4ff'],[.809,.547,.023],[.858,.733,.018],[.908,.783,.018],[.257,.441,.014]], stars: true, motes: [.1,.62,.76,.28] }),
 'loading-background': scene('river', { water: [[.24,.75,.44,.12],[.34,.51,.23,.04]], smoke: [[.176,.462,.075],[.768,.28,.065]], birds: [.15,.02,.7,.1] }),
 mira: scene('workshop', { lights: [[.091,.498,.03],[.88,.71,.025]], motes: [.08,.17,.82,.65] }),
 marna: scene('forge', { lights: [[.91,.38,.04],[.587,.785,.022,'#68eff2']], embers: [.88,.48,.08,.22] }),
 silen: scene('garden', { water: [[.235,.472,.045,.025]], lights: [[.865,.354,.024,'#91ffee']], motes: [.24,.06,.62,.65] }),
 rowan: scene('winter', { snow: true, lights: [[.17,.176,.016,'#83f6ff'],[.89,.25,.014]] }),
 hana: scene('coast', { water: [[.765,.61,.12,.06],[.84,.69,.15,.04]], motes: [.65,.09,.3,.22] }),
 bron: scene('garden', { motes: [.61,.04,.31,.56], lights: [[.063,.424,.018]] }),
 'dawn-bakery': scene('forge', { lights: [[.945,.557,.065]], embers: [.924,.51,.07,.17], motes: [.06,.18,.25,.4] }),
 'orchard-harvest': scene('garden', { motes: [.04,.13,.94,.71], birds: [.05,.09,.36,.12] }),
 'dairy-morning': scene('garden', { motes: [.03,.13,.94,.71], birds: [.06,.06,.35,.12] }),
 'textile-looms': scene('workshop', { motes: [.03,.06,.34,.6], water: [[.10,.61,.15,.03]] }),
 'glass-furnace': scene('forge', { lights: [[.972,.63,.052],[.904,.776,.028]], embers: [.932,.62,.06,.22] }),
 'stone-quarry': scene('wind', { motes: [.02,.17,.95,.72], birds: [.05,.04,.62,.12] }),
 'mountain-mine': scene('winter', { snow: true, lights: [[.777,.391,.016],[.968,.595,.011]] }),
 'desert-oil': scene('wind', { motes: [.03,.17,.94,.7], lights: [[.805,.701,.011]] }),
 'oasis-market': scene('river', { water: [[.07,.52,.24,.12]], motes: [.05,.12,.36,.33] }),
 'wetland-ferry': scene('evening', { water: [[.03,.46,.35,.14],[.35,.75,.065,.08]], lights: [[.88,.20,.014]], motes: [.02,.34,.94,.56] }),
 'volcano-forge': scene('forge', { lights: [[.972,.49,.045],[.556,.802,.04]], embers: [.41,.78,.29,.24] }),
 'winter-delivery': scene('winter', { snow: true, lights: [[.94,.299,.033],[.909,.87,.017]] }),
 'coast-fishing': scene('coast', { water: [[.055,.58,.28,.17],[.89,.53,.06,.13]], birds: [.06,.08,.33,.13] }),
 'clinic-morning': scene('garden', { lights: [[.417,.12,.011]], motes: [.50,.025,.31,.5] }),
 'crystal-lab': scene('magic', { lights: [[.517,.644,.038,'#58ecff'],[.914,.904,.026,'#58ecff']], motes: [.4,.3,.55,.56] }),
 'airship-dock': scene('wind', { motes: [.02,.03,.23,.53], lights: [[.085,.164,.012]] }),
 'evening-market': scene('evening', { lights: [[.717,.14,.024],[.826,.784,.02],[.101,.534,.014]], motes: [.04,.33,.94,.49] }),
 'riverside-rest': scene('garden', { water: [[.01,.62,.13,.12]], motes: [.03,.19,.9,.7] }),
 'map-table': scene('room', { lights: [[.206,.333,.025]], motes: [.49,.09,.46,.25] }),
 'village-arrival': scene('garden', { motes: [.25,.24,.7,.6], birds: [.29,.04,.6,.10] }),
 'river-crossing': scene('river', { water: [[.47,.78,.49,.19],[.43,.45,.13,.20]], smoke: [[.746,.549,.075]], birds: [.33,.05,.57,.12] }),
 'records-room': scene('room', { lights: [[.893,.547,.055]], motes: [.37,.08,.53,.35] }),
};
const ART_IDS={'mira-workshop':'mira','marna-workshop':'marna','silen-greenhouse':'silen','rowan-rail':'rowan','hana-dispatch':'hana','bron-carpentry':'bron'};
export const motionId = src => { const name=src.split('/').pop()?.replace(/\.webp$/, '') || 'home-background';return ART_IDS[name]||name; };
export const screenAmbience = src => SCREEN_MOTION[motionId(src)]?.ambience || 'river';

export function sceneryRect(width, height, imageWidth, imageHeight, fit = 'cover', position = '50% 50%') {
 const scale = (fit === 'contain' ? Math.min : Math.max)(width / imageWidth, height / imageHeight);
 const [px, py = '50%'] = position.split(' '), w = imageWidth * scale, h = imageHeight * scale;
 return { x: (width - w) * parseFloat(px) / 100, y: (height - h) * parseFloat(py) / 100, w, h };
}

// Transparent, low-resolution pixel effects. The original art remains the static fallback.
export function drawScreenMotion(ctx, image, config, time) {
 const w = image.naturalWidth, h = image.naturalHeight, unit = w / 840;
 const pixel = (x, y, width, height, color, alpha) => {
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha)); ctx.fillStyle = color;
  ctx.fillRect(Math.round(x / unit) * unit, Math.round(y / unit) * unit, Math.max(unit,width), Math.max(unit,height));
 };
 for (const [rx,ry,rw,rh] of config.water || []) {
  const x=rx*w,y=ry*h,ww=rw*w,hh=rh*h;
  // Scanline refraction only inside authored water patches. Feather the edges to avoid seams.
  for(let row=0;row<hh;row+=unit*2){
   const fade=Math.sin(Math.PI*row/hh),shift=Math.sin(time*1.9+row/unit*.23)*unit*2;
   ctx.globalAlpha=.5*fade;ctx.drawImage(image,x,y+row,ww,unit*2,x+shift,y+row,ww,unit*2);
  }
  for(let i=0;i<12;i++){
   const p=(time/6+i*.618)%1,xx=x+ww*((i*.381)%1),yy=y+hh*p;
   pixel(xx,yy,unit*(2+i%5),unit,'#fff2c8',Math.sin(p*Math.PI)*.35);
  }
 }
 for (const [x,y,rise] of config.smoke || []) {
  for(let i=0;i<7;i++){
   const p=(time/5.6+i/7)%1,xx=x*w+p*w*.022+Math.sin(p*8+i)*unit*2,yy=(y-p*rise)*h,size=unit*(2+p*7);
   const alpha=Math.sin(p*Math.PI)*.34;
   pixel(xx-size/2,yy-size/2,size,size,'#efeee0',alpha);
   pixel(xx-size*.85,yy-size*.15,size*.55,size*.7,'#d9dfdd',alpha*.7);
  }
 }
 for(const [x,y,r,color='#ffbc57'] of config.lights||[]){
  const pulse=.5+.22*Math.sin(time*2.1+x*29)+.14*Math.sin(time*4.3+y*31),radius=r*w;
  // Stepped halo keeps the source's pixel edges; no CSS blur over the illustration.
  for(let i=4;i>0;i--)pixel(x*w-radius*i/4,y*h-radius*i/4,radius*i/2,radius*i/2,color,pulse*.045);
 }
 const particles = (box, kind) => {
  if(!box)return;const [x,y,ww,hh]=box;
  const count=kind==='snow'?44:kind==='embers'?13:18;
  for(let i=0;i<count;i++){
   const speed=kind==='snow'?14:kind==='embers'?2.7:12,p=(time/speed+i*.618033)%1,seed=(i*.381966)%1;
   const xx=(x+ww*((seed+Math.sin(time*.4+i)*.035+1)%1))*w;
   const yy=(y+hh*(kind==='snow'?p:1-p))*h;
   pixel(xx,yy,unit*(kind==='snow'?1.4:1),unit,kind==='snow'?'#e8f6ff':kind==='embers'?'#ffbf50':'#ffe7a4',Math.sin(p*Math.PI)*(kind==='snow'?.65:kind==='embers'?.75:.46));
  }
 };
 particles(config.motes,'motes');particles(config.embers,'embers');if(config.snow)particles([0,0,1,1],'snow');
 if(config.birds){
  const [x,y,ww,hh]=config.birds;
  for(let i=0;i<3;i++){
   const p=(time/32+i*.035)%1,xx=(x+p*ww)*w,yy=(y+hh*(.4+i*.17)+Math.sin(time*.5+i)*.004)*h,flap=Math.sin(time*6+i)>0?-unit:unit;
   const alpha=Math.min(1,p*18,(1-p)*18)*.6;
   pixel(xx,yy,unit*2,unit,'#173c48',alpha);pixel(xx-unit,yy+flap,unit,unit,'#173c48',alpha);pixel(xx+unit*2,yy+flap,unit,unit,'#173c48',alpha);
  }
 }
 if(config.stars)for(let i=0;i<15;i++)pixel(((i*.618)%1)*w,(.025+(i*.13)% .12)*h,unit,unit,'#fff4d8',(.5+.5*Math.sin(time*1.1+i))*.6);
 ctx.globalAlpha=1;
}
