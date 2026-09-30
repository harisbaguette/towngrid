import { BUILDINGS, RESOURCES } from './simulation.js';
import { unlockRank } from './world.js';
import { dispatchShipment } from './export-route.js';

export function reserveFor(sim, item) {
 const production = sim.buildings.filter(b => b.enabled !== false && b.health > 0)
  .reduce((n, b) => n + (sim.recipeOf(b).inputs?.[item] || 0) * 2, 0);
 const freight = (sim.campaign?.routes || []).filter(r => r.from === sim.siteId && r.enabled && r.item === item)
  .reduce((n, r) => n + r.amount, 0);
 // The open lord's order is kept back until its goods are on the road (contract shipments, export-route.js).
 const contract = sim.contract(), sent = sim.contractSent?.();
 return Math.max(sim.reserves?.[item] || 0, production) + freight + (contract.item === item && !sent ? contract.amount : 0);
}

export function purchase(sim, item, quantity) {
 if (!RESOURCES[item] || !Number.isInteger(quantity) || quantity < 1 || quantity > 100)
  return {ok:false,error:'1~100개의 수입 수량을 선택하세요'};
 // Any product a facility is permitted to make counts, alternative recipes included.
 if (!Object.entries(BUILDINGS).some(([id, d]) => unlockRank(id) <= sim.rank && (d.recipes || [d]).some(r => r.output === item && (r.unlock || 0) <= sim.rank)))
  return {ok:false,error:'생산 허가를 얻은 자원만 수입할 수 있습니다'};
 const incoming = sim.shipments.filter(sh => sh.kind === 'import' && sh.item === item).reduce((n, sh) => n + sh.amount, 0);
 if(sim.stock[item]+incoming+quantity>sim.storageCapacity)return {ok:false,error:'창고가 가득 찹니다. 재고를 팔거나 자재 보관소를 지으세요'};
 if (!sim.warehouse) return {ok:false,error:'창고가 있어야 수입품을 받을 수 있습니다'};
 const cost = Math.ceil(RESOURCES[item].price * 1.85) * quantity;
 const short = sim.moneyShort?.(cost, '수입 비용 '); if (short) return {ok:false,error:short};
 // Imports ride an export vehicle in from the terminal: paid when ordered, stocked when it reaches the warehouse.
 const error = dispatchShipment(sim, item, quantity, 0, false, {kind:'import', cost});
 if (error) return {ok:false,error};
 sim.money -= cost; sim.sound('dispatch'); sim.notify(`${RESOURCES[item].name} ${quantity}개 수입 주문 · 운송 수단이 싣고 옵니다`);
 return {ok:true,cost,incoming:true};
}

/** Game seconds a planted sapling takes to grow into a tree. */
export const SAPLING_GROW = 160;

export function plant(sim, x, z) {
 const t = sim.tile(x,z);
 if (!t || t.terrain === 'water' || !sim.ownedAt(x,z) || sim.at(x,z) || t.nature || sim.roads.has(`${x},${z}`))
  return {ok:false,error:'소유한 빈 땅에 묘목을 심으세요'};
 const short = sim.moneyShort?.(15, '조림 비용 '); if (short) return {ok:false,error:short};
 if ((sim.availableStock?.('water') ?? sim.stock.water) < 2) return {ok:false,error:'조림 비용 15G와 물 2개가 필요합니다'};
 sim.money -= 15; sim.stock.water -= 2; t.nature = 'sapling'; t.remaining = 0; t.growAt = sim.time + SAPLING_GROW;
 sim.revision++; sim.sound('plant'); return {ok:true};
}

/** Whether a recovery grant can be taken now: cash at or below RECOVERY_LIMIT and five days since the last one. */
export const RECOVERY_LIMIT = 150;
const lastRecovery = sim => sim.campaign?.treasury.lastRecoveryDay ?? sim.lastRecoveryDay ?? -10;
export const recoveryReady = sim => sim.money <= RECOVERY_LIMIT && sim.day - lastRecovery(sim) >= 5;
export function restructure(sim) {
 const last = lastRecovery(sim);
 if (sim.money > RECOVERY_LIMIT) return {ok:false,error:`보유 자금이 ${RECOVERY_LIMIT}G 이하일 때 회생 자금을 신청할 수 있습니다`};
 if (sim.day - last < 5) return {ok:false,error:`${5-(sim.day-last)}일 후 다시 신청할 수 있습니다`};
 const grant = 500 - sim.money;
 sim.money += grant; sim.debt += Math.ceil(grant * 1.3);
 if (sim.campaign) {sim.campaign.treasury.lastRecoveryDay = sim.day; sim.campaign.support = Math.max(10,sim.campaign.support-8);}
 else sim.lastRecoveryDay = sim.day;
 sim.notify(`회생 자금 ${grant}G 지급 · 채무 ${Math.ceil(grant*1.3)}G 추가`,'warning');
 return {ok:true};
}
