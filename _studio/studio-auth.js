window.studioSession=fetch('/api/me',{cache:'no-store'}).then(async r=>{if(!r.ok){location.href='/auth/start';throw new Error('Sign in required.');}return r.json();});
window.studioPublish=async draft=>{
 const session=await window.studioSession;
 const html=await Vditor.md2html(draft.markdown,{cdn:'https://cdn.jsdelivr.net/npm/vditor@4.0.1',markdown:{sanitize:true,inlineMath:true}});
 const r=await fetch('/api/publish',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({...draft,html})});
 const result=await r.json();if(!r.ok)throw new Error(result.error||'Publishing failed.');return result;
};
window.studioLogout=async()=>{const session=await window.studioSession;await fetch('/api/logout',{method:'POST',headers:{'X-CSRF-Token':session.csrf}});location.href='https://manfromearth11.github.io/';};
