import type {Plugin} from 'vite';
// Local accounts and saves live outside the source tree in ignored work/.
export function community():Plugin{return {name:'towngrid-community',apply:'serve',async configureServer(server){
 const {createCommunity}=await import('../../server/community.mjs');let service:ReturnType<typeof createCommunity>|undefined;
 server.middlewares.use('/api/community',(req,res)=>{
  if(!service){const address=server.httpServer?.address(),port=typeof address==='object'&&address?address.port:5173;
   service=createCommunity(process.env.TOWNGRID_ORIGIN?{}:{origin:`http://localhost:${port}`,allowedOrigins:[`http://localhost:${port}`,`http://127.0.0.1:${port}`,`http://[::1]:${port}`]});}
  req.url='/api/community'+req.url;void service.handler(req,res);
 });server.httpServer?.once('close',()=>service?.close());
}};}
