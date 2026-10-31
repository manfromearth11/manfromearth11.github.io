/* This token only controls owner navigation. Editing and publishing require
   the separate server's HttpOnly session and server-side owner checks. */
(async () => {
  const key='owner-navigation-session';
  const links=[...document.querySelectorAll('[data-owner-write]')];
  links.forEach(link=>link.hidden=true);
  const status=document.getElementById('login-status');
  const configured=document.querySelector('meta[name="studio-origin"]')?.content;
  if (!configured) {if(status) status.textContent='Owner sign-in is awaiting server configuration.';return;}
  let origin;
  try {origin=new URL(configured).origin;if(!origin.startsWith('https://')) throw new Error();} catch {if(status)status.textContent='Owner sign-in is unavailable.';return;}
  const signin=document.getElementById('github-signin');
  if(signin){signin.href=origin+'/auth/start';signin.hidden=false;}
  try {
    const ticket=new URLSearchParams(location.hash.slice(1)).get('ticket');
    if(ticket && location.pathname==='/login/') {
      history.replaceState(null,'','/login/');
      const response=await fetch(origin+'/api/bridge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket}),credentials:'omit'});
      if(!response.ok) throw new Error('Sign-in expired. Please try again.');
      const data=await response.json();sessionStorage.setItem(key,data.token);
    }
    const token=sessionStorage.getItem(key);
    if(!token){if(status)status.textContent='Sign in with the owner GitHub account.';return;}
    const response=await fetch(origin+'/api/identity',{headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store'});
    if(!response.ok){sessionStorage.removeItem(key);if(status)status.textContent='Please sign in again.';return;}
    const data=await response.json();
    if(data.owner !== true) return;
    links.forEach(link=>{link.href=origin+'/';link.hidden=false;});
    if(status)status.textContent='Signed in as manfromearth11.';
    if(signin)signin.hidden=true;
  } catch {if(status)status.textContent='Could not verify sign-in. Please try again.';}
})();
