import {parentPort,workerData} from 'node:worker_threads';
import {verifyTrialReplay} from '../src/app/game/trial-replay.js';
try{parentPort.postMessage({result:verifyTrialReplay(workerData)});}catch(error){parentPort.postMessage({error:error.message});}
