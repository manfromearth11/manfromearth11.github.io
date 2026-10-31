document.getElementById('recover-drafts').onclick = () => {
  const request = indexedDB.open('jaehun-working-notes');
  request.onsuccess = () => {
    const db = request.result;
    if(!db.objectStoreNames.contains('drafts')) { document.getElementById('recover-status').textContent='No local drafts found.';db.close();return; }
    const query=db.transaction('drafts').objectStore('drafts').getAll();
    query.onsuccess=()=>{
      for(const draft of query.result) {
        const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,draft})],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download=`note-${draft.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
      }
      document.getElementById('recover-status').textContent=`Found ${query.result.length} local drafts. Your browser may ask to allow multiple downloads.`;db.close();
    };
  };
  request.onerror=()=>{document.getElementById('recover-status').textContent='Could not read local drafts.';};
};
