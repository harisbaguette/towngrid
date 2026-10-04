import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {Worker} from 'node:worker_threads';
import {decodeSave} from '../src/app/game/persistence.js';
import {weeklyTrial,trialRule,currentTrialRound} from '../src/app/game/industry-trials.js';
const derive=promisify(scrypt),hash=value=>createHash('sha256').update(value).digest('hex');
const fault=(status,message)=>Object.assign(new Error(message),{status});
const passwordHash=async(password,salt)=>Buffer.from(await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}));
const validPassword=value=>typeof value==='string'&&value.length>=12&&value.length<=128;
const validName=value=>typeof value==='string'&&value.trim()===value&&/[\p{L}\p{N}]/u.test(value)&&/^[\p{L}\p{N}_ -]{3,24}$/u.test(value);
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
async function body(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8_000_000)throw fault(413,'8MB 이하의 자료만 전송할 수 있습니다.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fault(400,'요청 형식을 확인하세요.');}}
export function createCommunity({database=process.env.TOWNGRID_DATABASE||resolve('work/community.sqlite'),origin=process.env.TOWNGRID_ORIGIN||'http://localhost:5173',allowedOrigins=[origin],clock=()=>Date.now()}={}){
 if(database!==':memory:')mkdirSync(dirname(database),{recursive:true});const db=new DatabaseSync(database);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;');
 db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL COLLATE NOCASE UNIQUE,salt TEXT NOT NULL,password BLOB NOT NULL,recovery TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS saves(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,revision INTEGER NOT NULL,raw TEXT NOT NULL,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS guilds(id TEXT PRIMARY KEY,name TEXT NOT NULL,invite TEXT NOT NULL UNIQUE,owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS members(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS scores(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,round TEXT NOT NULL,score INTEGER NOT NULL,elapsed REAL NOT NULL,delivered INTEGER NOT NULL,status TEXT NOT NULL,guild_id TEXT,created INTEGER NOT NULL,PRIMARY KEY(user_id,round));`);
 const rates=new Map();let verifying=0,closed=false;
 const rate=(key,limit,window=60000)=>{const now=clock();for(const[k,v]of rates)if(v.until<=now)rates.delete(k);if(rates.size>10000)throw fault(429,'잠시 후 다시 시도하세요.');const v=rates.get(key)||{count:0,until:now+window};v.count++;rates.set(key,v);if(v.count>limit)throw fault(429,'요청이 많습니다. 잠시 후 다시 시도하세요.');};
 const tokenOf=req=>{const cookie=(req.headers.cookie||'').split(';').find(s=>s.trim().startsWith('tg_session='));return cookie?cookie.trim().slice(11):'';};
 const account=req=>db.prepare('SELECT u.id,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(hash(tokenOf(req)),clock());
 const login=(res,id)=>{db.prepare('DELETE FROM sessions WHERE expires<=?').run(clock());const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),id,clock()+7*86400000);res.setHeader('Set-Cookie',`tg_session=${token}; HttpOnly; SameSite=Strict; Path=/api/community; Max-Age=604800${origin.startsWith('https:')?'; Secure':''}`);};
 const leaderboard=round=>db.prepare('SELECT u.name,s.score,s.elapsed,s.delivered,s.status FROM scores s JOIN users u ON u.id=s.user_id WHERE s.round=? ORDER BY s.score DESC,s.elapsed ASC,s.created ASC LIMIT 100').all(round);
 const membership=id=>db.prepare('SELECT g.id,g.name,g.invite,g.owner FROM members m JOIN guilds g ON g.id=m.guild_id WHERE m.user_id=?').get(id)||null;
 const verify=replay=>new Promise((resolve,reject)=>{if(verifying>=2){reject(fault(429,'다른 기록을 확인하고 있습니다. 잠시 후 다시 제출하세요.'));return;}verifying++;const worker=new Worker(new URL('./verify-trial.mjs',import.meta.url),{workerData:replay,execArgv:[],resourceLimits:{maxOldGenerationSizeMb:192}});let done=false;
  const finish=(error,result)=>{if(done)return;done=true;verifying--;clearTimeout(timer);void worker.terminate();error?reject(error):resolve(result);};
  const timer=setTimeout(()=>finish(fault(422,'기록 검증 제한 시간을 넘었습니다.')),20000);worker.once('message',m=>finish(m.error?fault(422,m.error):null,m.result));worker.once('error',()=>finish(fault(422,'기록을 재현하지 못했습니다.')));worker.once('exit',code=>{if(!done)finish(fault(422,'기록 검증을 완료하지 못했습니다.'));});
 });
 const handler=async(req,res)=>{
  if(closed){send(res,503,{error:'서버가 종료되었습니다.'});return;}
  try{
   const url=new URL(req.url,'http://localhost'),path=url.pathname.replace(/^\/api\/community/,'');const write=!['GET','HEAD'].includes(req.method);
   if(write&&(!allowedOrigins.includes(req.headers.origin)||req.headers['x-towngrid']!=='1'||!(req.headers['content-type']||'').startsWith('application/json')))throw fault(403,'게임 화면에서 다시 요청하세요.');
   rate(req.socket.remoteAddress||'local',240);const user=account(req);
   if(req.method==='GET'&&path==='/session'){send(res,200,{user:user||null,guild:user?membership(user.id):null,round:weeklyTrial(currentTrialRound(clock())).id});return;}
   if(req.method==='GET'&&path==='/leaderboard'){const round=url.searchParams.get('round')||weeklyTrial().id;if(!trialRule(round))throw fault(400,'도전을 선택하세요.');const teams=db.prepare('SELECT g.name,SUM(s.score) score,COUNT(*) members FROM scores s JOIN guilds g ON g.id=s.guild_id WHERE s.round=? GROUP BY g.id ORDER BY score DESC LIMIT 50').all(round);send(res,200,{round,players:leaderboard(round),teams});return;}
   const input=write?await body(req):{};if(!input||typeof input!=='object'||Array.isArray(input))throw fault(400,'요청 형식을 확인하세요.');
   if(req.method==='POST'&&['/register','/login','/recover'].includes(path)){
    rate('auth:'+(req.socket.remoteAddress||'local'),12,600000);
    if(!validName(input.name)||!validPassword(input.password))throw fault(400,'이름은 3~24자, 비밀번호는 12~128자로 입력하세요.');
    const existing=db.prepare('SELECT * FROM users WHERE name=?').get(input.name);
    if(path==='/register'){
     if(existing)throw fault(409,'사용 중인 이름입니다.');const id=randomUUID(),salt=randomBytes(16).toString('hex'),password=await passwordHash(input.password,salt),recovery=randomBytes(24).toString('hex');
     const inserted=db.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?,?)').run(id,input.name,salt,password,hash(recovery));if(!inserted.changes)throw fault(409,'사용 중인 이름입니다.');login(res,id);send(res,201,{user:{id,name:input.name},recovery});return;
    }
    if(path==='/recover'){
     if(!existing||typeof input.recovery!=='string'||hash(input.recovery)!==existing.recovery)throw fault(401,'이름과 복구 코드를 확인하세요.');
     const salt=randomBytes(16).toString('hex'),password=await passwordHash(input.password,salt),recovery=randomBytes(24).toString('hex');const changed=db.prepare('UPDATE users SET salt=?,password=?,recovery=? WHERE id=? AND recovery=?').run(salt,password,hash(recovery),existing.id,existing.recovery);if(!changed.changes)throw fault(401,'이미 사용한 복구 코드입니다.');db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id);login(res,existing.id);send(res,200,{user:{id:existing.id,name:existing.name},recovery});return;
    }
    const actual=await passwordHash(input.password,existing?.salt||'00000000000000000000000000000000');
    if(!existing||!timingSafeEqual(actual,Buffer.from(existing.password)))throw fault(401,'이름 또는 비밀번호를 확인하세요.');login(res,existing.id);send(res,200,{user:{id:existing.id,name:existing.name}});return;
   }
   if(!user)throw fault(401,'로그인이 필요합니다.');
   if(req.method==='POST'&&path==='/logout'){db.prepare('DELETE FROM sessions WHERE token=?').run(hash(tokenOf(req)));res.setHeader('Set-Cookie','tg_session=; HttpOnly; SameSite=Strict; Path=/api/community; Max-Age=0');send(res,200,{ok:true});return;}
   if(req.method==='GET'&&path==='/save'){send(res,200,{save:db.prepare('SELECT revision,raw,updated FROM saves WHERE user_id=?').get(user.id)||null});return;}
   if(req.method==='PUT'&&path==='/save'){
    if(typeof input.raw!=='string'||!Number.isInteger(input.revision)||input.revision<0)throw fault(400,'저장 자료를 확인하세요.');try{decodeSave(input.raw);}catch{throw fault(400,'유효한 게임 저장 파일이 아닙니다.');}
    const current=db.prepare('SELECT revision FROM saves WHERE user_id=?').get(user.id);if((current?.revision||0)!==input.revision)throw fault(409,'다른 기기의 저장이 바뀌었습니다. 서버 저장을 다시 확인하세요.');
    const revision=input.revision+1;db.prepare('INSERT INTO saves VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,raw=excluded.raw,updated=excluded.updated').run(user.id,revision,input.raw,clock());send(res,200,{revision});return;
   }
   if(req.method==='POST'&&path==='/scores'){
    rate('score:'+user.id,6,600000);const rule=trialRule(input.replay?.id);if(rule?.version!==2)throw fault(400,'새 산업 도전의 플레이 기록만 제출할 수 있습니다.');
    if(rule.round!==undefined&&rule.round>currentTrialRound(clock()))throw fault(400,'아직 시작하지 않은 주간 도전입니다.');
    const result=await verify(input.replay);if(closed)throw fault(503,'서버를 다시 연결한 뒤 제출하세요.');const guild=membership(user.id),old=db.prepare('SELECT score,elapsed,guild_id FROM scores WHERE user_id=? AND round=?').get(user.id,result.id);
    if(!old||result.score>old.score||result.score===old.score&&result.elapsed<old.elapsed)db.prepare('INSERT INTO scores VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,round) DO UPDATE SET score=excluded.score,elapsed=excluded.elapsed,delivered=excluded.delivered,status=excluded.status').run(user.id,result.id,result.score,result.elapsed,result.delivered,result.status,old?.guild_id??guild?.id??null,clock());
    send(res,200,{result,players:leaderboard(result.id)});return;
   }
   if(req.method==='GET'&&path==='/guild'){const guild=membership(user.id);send(res,200,{guild,members:guild?db.prepare('SELECT u.name FROM members m JOIN users u ON u.id=m.user_id WHERE m.guild_id=? ORDER BY u.name').all(guild.id):[]});return;}
   if(req.method==='POST'&&path==='/guild'){
    if(membership(user.id))throw fault(409,'이미 상회에 참여하고 있습니다.');if(!validName(input.name))throw fault(400,'상회 이름을 3~24자로 입력하세요.');
    const id=randomUUID(),invite=randomBytes(12).toString('hex');db.exec('BEGIN');try{db.prepare('INSERT INTO guilds VALUES(?,?,?,?)').run(id,input.name,invite,user.id);db.prepare('INSERT INTO members VALUES(?,?)').run(user.id,id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}send(res,201,{guild:membership(user.id)});return;
   }
   if(req.method==='POST'&&path==='/guild/join'){
    if(membership(user.id))throw fault(409,'이미 상회에 참여하고 있습니다.');if(typeof input.invite!=='string')throw fault(400,'초대 코드를 입력하세요.');const guild=db.prepare('SELECT id FROM guilds WHERE invite=?').get(input.invite);if(!guild)throw fault(404,'초대 코드를 확인하세요.');if(db.prepare('SELECT COUNT(*) n FROM members WHERE guild_id=?').get(guild.id).n>=20)throw fault(409,'상회 정원은 20명입니다.');db.prepare('INSERT INTO members VALUES(?,?)').run(user.id,guild.id);send(res,200,{guild:membership(user.id)});return;
   }
   if(req.method==='POST'&&path==='/guild/leave'){const guild=membership(user.id);if(guild?.owner===user.id)throw fault(409,'상회장은 탈퇴 전에 상회를 해산해야 합니다.');db.prepare('DELETE FROM members WHERE user_id=?').run(user.id);send(res,200,{ok:true});return;}
   if(req.method==='DELETE'&&path==='/guild'){const guild=membership(user.id);if(guild?.owner!==user.id)throw fault(403,'상회장만 해산할 수 있습니다.');db.prepare('DELETE FROM guilds WHERE id=?').run(guild.id);send(res,200,{ok:true});return;}
   throw fault(404,'요청한 기능을 찾을 수 없습니다.');
  }catch(error){send(res,error.status||500,{error:error.status?error.message:'요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.'});}
 };
 return {handler,close:()=>{closed=true;db.close();},database};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const service=createCommunity(),server=createServer(service.handler);server.listen(Number(process.env.PORT||8788),process.env.HOST||'127.0.0.1',()=>console.log('TownGrid community: http://127.0.0.1:'+server.address().port));const stop=()=>server.close(()=>{service.close();process.exit();});process.on('SIGINT',stop);process.on('SIGTERM',stop);}
