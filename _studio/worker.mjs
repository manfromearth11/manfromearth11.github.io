import sanitizeHtml from 'sanitize-html';
const now=()=>Math.floor(Date.now()/1000);
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const cookies=request=>Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(x=>x.trim().split('=')));
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const redirect=(url,headers={})=>new Response(null,{status:302,headers:{Location:url,'Cache-Control':'no-store',...headers}});
async function session(request,env){const id=cookies(request)['__Host-studio'];if(!id)return null;return env.DB.prepare('SELECT * FROM sessions WHERE id=? AND expires>? AND owner=?').bind(await digest(id),now(),env.OWNER_ID).first();}
async function gh(env,token,path,body,method){const response=await fetch(`https://api.github.com/${path}`,{method:method||(body?'POST':'GET'),headers:{Authorization:`Bearer ${token}`,'User-Agent':'jaehun-studio','Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!response.ok)throw new Error(`GitHub request failed (${response.status}). Please sign in again or retry.`);return response.status===204?null:response.json();}
async function owner(env,token){const user=await gh(env,token,'user');return String(user.id)===env.OWNER_ID;}
export function cleanHTML(html){return sanitizeHtml(html,{allowedTags:[...sanitizeHtml.defaults.allowedTags,'img','video','source','section','article','figure','figcaption','input'],allowedAttributes:{'*':['class','id'],section:['class','data-note-id','data-note-text','data-note-mode','data-note-width'],img:['src','alt','width','height'],video:['src','controls','playsinline','preload','width','height'],source:['src','type'],a:['href','title'],code:['class'],input:['type','checked','disabled']},allowedSchemes:['https','http','mailto'],allowedSchemesByTag:{img:['https','http','data']}});}
async function publish(request,env,auth){
 if(Number(request.headers.get('Content-Length'))>16*1024*1024)return json({error:'Note exceeds the 16 MB publishing limit.'},413);
 const raw=await request.text();if(raw.length>16*1024*1024)return json({error:'Note exceeds the 16 MB publishing limit.'},413);
 const data=JSON.parse(raw);
 if(!/^[a-f0-9-]{36}$/.test(data.id)||typeof data.title!=='string'||!data.title.trim()||data.title.length>200||typeof data.html!=='string')return json({error:'A title and valid note are required.'},400);
 if(!await owner(env,auth.token))return json({error:'Owner access required.'},403);
 const repo=`repos/${env.REPOSITORY}`,slug=`note-${data.id}`;
 let html=cleanHTML(data.html);const tree=[],seen=new Map();let index=0;
 for(const match of [...html.matchAll(/data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)/g)]){
   if(seen.has(match[0]))continue;
   const path=`assets/notes/${slug}/figure-${++index}.${match[1]==='jpeg'?'jpg':match[1]}`;
   const blob=await gh(env,auth.token,`${repo}/git/blobs`,{content:match[2],encoding:'base64'});
   tree.push({path,mode:'100644',type:'blob',sha:blob.sha});seen.set(match[0],'/'+path);
 }
 for(const [source,path]of seen)html=html.replaceAll(source,path);
 // Literal Liquid tags in a note must never execute during the Jekyll build.
 html=html.replaceAll('{%','&#123;%').replaceAll('{{','&#123;{');
 const contents=`---\nlayout: note\ntitle: ${JSON.stringify(data.title.trim())}\npermalink: /posts/${slug}/\n---\n${html}\n`;
 tree.push({path:`_notes/${slug}.html`,mode:'100644',type:'blob',content:contents});
 const ref=await gh(env,auth.token,`${repo}/git/ref/heads/master`);
 const parent=await gh(env,auth.token,`${repo}/git/commits/${ref.object.sha}`);
 const newTree=await gh(env,auth.token,`${repo}/git/trees`,{base_tree:parent.tree.sha,tree});
 const commit=await gh(env,auth.token,`${repo}/git/commits`,{message:`Publish note: ${data.title.trim()}`,tree:newTree.sha,parents:[ref.object.sha]});
 await gh(env,auth.token,`${repo}/git/refs/heads/master`,{sha:commit.sha,force:false},'PATCH');
 return json({url:`${env.SITE_ORIGIN}/posts/${slug}/`,commit:commit.sha});
}
async function handle(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/health')return json({ready:!!(env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET)});
 if(request.method==='OPTIONS'&&['/api/identity','/api/bridge'].includes(path))return new Response(null,{status:204});
 if(path==='/auth/start'&&request.method==='GET'){
   if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET)return new Response('Owner sign-in is awaiting GitHub OAuth configuration.',{status:503});
   const state=random(),verifier=random();
   await env.DB.prepare('INSERT INTO oauth_states VALUES (?,?,?)').bind(await digest(state),verifier,now()+600).run();
   const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
   const target=new URL('https://github.com/login/oauth/authorize');
   target.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:url.origin+'/auth/callback',scope:'public_repo',state,code_challenge:challenge,code_challenge_method:'S256'});
   return redirect(target.href,{'Set-Cookie':cookie('__Host-oauth',state,600)});
 }
 if(path==='/auth/callback'&&request.method==='GET'){
   const state=url.searchParams.get('state'),code=url.searchParams.get('code');
   if(!state||!code||cookies(request)['__Host-oauth']!==state)return json({error:'Invalid sign-in state. Start again.'},403);
   const record=await env.DB.prepare('DELETE FROM oauth_states WHERE id=? AND expires>? RETURNING verifier').bind(await digest(state),now()).first();
   if(!record)return json({error:'Sign-in expired. Start again.'},403);
   const response=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:url.origin+'/auth/callback',code_verifier:record.verifier})});
   const data=await response.json();if(!response.ok||!data.access_token)return json({error:'GitHub sign-in failed.'},403);
   if(!await owner(env,data.access_token))return json({error:'This workspace is restricted to its owner.'},403);
   const id=random(),ticket=random(),expires=now()+43200;
   await env.DB.batch([env.DB.prepare('INSERT INTO sessions VALUES (?,?,?,?,?)').bind(await digest(id),data.access_token,random(),env.OWNER_ID,expires),env.DB.prepare('INSERT INTO bridges VALUES (?,?,?)').bind(await digest(ticket),await digest(id),now()+120)]);
   const result=redirect(env.SITE_ORIGIN+'/login/#ticket='+ticket);result.headers.append('Set-Cookie',cookie('__Host-studio',id,43200));result.headers.append('Set-Cookie',cookie('__Host-oauth','',0));return result;
 }
 if(path==='/api/bridge'&&request.method==='POST'){
   if(request.headers.get('Origin')!==env.SITE_ORIGIN)return json({error:'Forbidden origin.'},403);
   const {ticket}=await request.json();if(typeof ticket!=='string'||ticket.length!==64)return json({error:'Invalid ticket.'},400);
   const bridge=await env.DB.prepare('DELETE FROM bridges WHERE id=? AND expires>? RETURNING session').bind(await digest(ticket),now()).first();
   if(!bridge)return json({error:'Expired ticket.'},401);
   const token=random();await env.DB.prepare('INSERT INTO navigation VALUES (?,?,?)').bind(await digest(token),bridge.session,now()+43200).run();return json({token});
 }
 if(path==='/api/identity'){
   if(request.headers.get('Origin')!==env.SITE_ORIGIN)return json({error:'Forbidden origin.'},403);
   const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token)return json({owner:false},401);
   const row=await env.DB.prepare('SELECT s.owner FROM navigation n JOIN sessions s ON n.session=s.id WHERE n.id=? AND n.expires>? AND s.expires>? AND s.owner=?').bind(await digest(token),now(),now(),env.OWNER_ID).first();return json({owner:!!row},row?200:401);
 }
 const auth=await session(request,env);
 if(!auth)return path.startsWith('/api/')?json({error:'Sign in required.'},401):redirect('/auth/start');
 if(request.method!=='GET'&&request.method!=='HEAD'){
   if(request.headers.get('Origin')!==url.origin||request.headers.get('X-CSRF-Token')!==auth.csrf)return json({error:'Forbidden request.'},403);
 }
 if(path==='/api/me'&&request.method==='GET')return json({owner:true,csrf:auth.csrf});
 if(path==='/api/logout'&&request.method==='POST'){
   await env.DB.batch([env.DB.prepare('DELETE FROM navigation WHERE session=?').bind(auth.id),env.DB.prepare('DELETE FROM bridges WHERE session=?').bind(auth.id),env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(auth.id)]);
   const response=json({ok:true});response.headers.set('Set-Cookie',cookie('__Host-studio','',0));return response;
 }
 if(path==='/api/publish'&&request.method==='POST')return publish(request,env,auth);
 if(path.startsWith('/api/'))return json({error:'Not found.'},404);
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const asset=await env.ASSETS.fetch(request);return new Response(asset.body,{status:asset.status,headers:asset.headers});
}
export default {
 async fetch(request,env){let response;try{response=await handle(request,env);}catch{response=json({error:'Request failed. Please retry or sign in again.'},500);}
 response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('X-Frame-Options','DENY');
 response.headers.set('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
 if(request.headers.get('Origin')===env.SITE_ORIGIN&&['/api/identity','/api/bridge'].includes(new URL(request.url).pathname)){response.headers.set('Access-Control-Allow-Origin',env.SITE_ORIGIN);response.headers.set('Vary','Origin');response.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');response.headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
 return response;
 },
 async scheduled(event,env){for(const table of ['oauth_states','sessions','bridges','navigation'])await env.DB.prepare(`DELETE FROM ${table} WHERE expires<?`).bind(now()).run();}
};
