export const VEHICLE_ART = {
 wagon:'cargoWagon', raft:'cargoRaft', truck:'cargoTruckEmpty', steamer:'cargoSteamer', rail:'cargoTrainEmpty',
 sled:'cargoSled', plane:'cargoPlane', airship:'cargoAirship', ship:'cargoShip', ferry:'cargoFerry',
};
export const NEW_VEHICLE_SIZES = {cargoWagon:1.18,cargoSled:.85,cargoPlane:1.35,cargoAirship:1.25,cargoRaft:.95,cargoSteamer:1.1,cargoShip:1.4,cargoFerry:1.05,cargoTruckEmpty:.8,cargoTrainEmpty:1.25};
// A water shipment is carried to the shore over land. Its boat must never drive
// through fields; old saves without a vehicle are horse-drawn wagons.
export function shipmentVehicle(sh,sim,pose){
 const kind=sh.vehicle||'wagon';
 const afloat=sim.tile(Math.round(pose.x),Math.round(pose.z))?.terrain==='water';
 if(kind==='truck'&&sim.layout?.ecology==='snow')return 'sled';
 return (kind==='raft'||kind==='steamer')&&!afloat?(kind==='raft'?'wagon':'truck'):kind;
}
export const shipmentLoaded=sh=>sh.kind==='import'?sh.phase==='back':sh.phase==='out';
export const PORT_VEHICLES={dock:'fishingBoat',ferrydock:'cargoFerry',canaldock:'cargoFerry',streamdock:'cargoFerry',polarferry:'cargoFerry',riverport:'cargoSteamer',lakeport:'cargoSteamer',coastport:'cargoShip',polarport:'cargoShip'};
