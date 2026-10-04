// Ecology is saved on a layout. Missing ecology means the existing terrain/resource rules.
// The world-grid neighbours remain authoritative for ports and map-edge connections.
export const BIOMES={
 snow:{name:'눈 덮인 설원',frame:0,color:'#edf5f5',summary:'설원·침엽수 · 극지 운송',detail:'눈 덮인 땅과 침엽수림입니다. 밭과 우물은 느리며 극지 항과 스노모빌을 이용합니다.',fertility:[25,50],moisture:[25,50],ore:[55,90],mana:[30,65],tree:.17,rock:.13,wood:90,stone:120},
 meadow:{name:'비옥한 평야',frame:1,color:'#a8b75c',summary:'높은 비옥도 · 넓은 경작지',detail:'나무와 바위가 적어 넓게 경작할 수 있습니다. 비옥도가 높으며 담수 옆에서는 물 운반도 줄어듭니다.',fertility:[80,100],moisture:[60,90],ore:[30,60],mana:[30,65],tree:.10,rock:.06,wood:90,stone:90},
 forest:{name:'울창한 숲',frame:2,color:'#527e4f',summary:'풍부한 목재 · 습한 숲 토양',detail:'성목이 밀집한 숲입니다. 자연림의 나무 한 그루에는 목재가 150개 있으며, 개간하면 시설을 지을 수 있습니다.',fertility:[55,80],moisture:[65,90],ore:[35,65],mana:[50,85],tree:.52,rock:.07,wood:150,stone:90},
 basin:{name:'광산 분지',frame:3,color:'#928779',summary:'높은 광물량 · 산악 채굴',detail:'산으로 둘러싸인 분지에 광석과 바위가 많습니다. 산 타일의 채석장·광산에는 추가 생산 보정이 적용됩니다.',fertility:[30,55],moisture:[30,55],ore:[75,100],mana:[40,75],tree:.08,rock:.38,wood:90,stone:180},
 desert:{name:'사막과 유전',frame:4,color:'#d8b16c',summary:'유전 · 오아시스 주변 농업',detail:'검은 원유가 드러난 지점은 유정 효율이 높습니다. 모래에서는 농사와 취수가 느리고, 오아시스 주변은 비옥하고 습합니다.',fertility:[15,35],moisture:[10,30],ore:[40,70],mana:[30,65],tree:.04,rock:.12,wood:90,stone:90},
 coast:{name:'모래 해안',frame:5,color:'#dfd09b',summary:'어업 · 연안항 · 해안 교역',detail:'모래사장과 야자수가 바다로 이어집니다. 어업과 연안항에 유리하며, 바닷물은 밭을 관개하지 않습니다.',fertility:[45,75],moisture:[55,80],ore:[30,65],mana:[30,65],tree:.12,rock:.07,wood:90,stone:90},
 marsh:{name:'갈대 습지',frame:6,color:'#818e54',summary:'풍부한 담수 · 농업·약초',detail:'작은 담수 웅덩이와 갈대가 이어지는 습지입니다. 수분과 비옥도가 높고 물가 관개를 활용할 수 있습니다.',fertility:[70,95],moisture:[85,100],ore:[25,55],mana:[55,85],tree:.22,rock:.05,wood:100,stone:90},
 volcanic:{name:'화산 고원',frame:7,color:'#686475',summary:'검은 암반 · 광물·마력',detail:'검은 화산암에 광물과 마력이 풍부합니다. 농사와 취수에는 불리한 땅입니다.',fertility:[30,50],moisture:[20,45],ore:[80,100],mana:[75,100],tree:.06,rock:.40,wood:90,stone:180}
};
export const biomeHash=(x,z,seed=0)=>{const v=Math.sin(x*127.1+z*311.7+seed*17.3+91)*43758.5453;return v-Math.floor(v);};
export function ecologyOf(layout){
 if(layout.biome==='ice')return 'snow';if(layout.biome==='desert')return 'desert';
 const e=Object.values(layout.edges),mountains=e.filter(k=>k==='mountain').length,[x,z]=layout.cell||[0,0];
 if(mountains>=2)return (x+z)%5===0?'volcanic':'basin';
 if(mountains===1&&(x+z)%3!==0)return 'basin';
 if(e.includes('coast'))return 'coast';
 if(layout.biome==='forest')return 'forest';
 if(e.filter(k=>['river','lake','stream','canal'].includes(k)).length>=1&&(e.includes('lake')||(x+z)%4===0))return 'marsh';
 return 'meadow';
}
export const biomeOf=layout=>Object.hasOwn(BIOMES,layout?.ecology)?BIOMES[layout.ecology]:null;
