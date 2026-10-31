/* Local-only authoring. No credentials or publishing endpoints. */
(async () => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const status = (message) => { $('save-status').textContent = message; };
  const allowedImage = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
  let db, editor, current, timer, ready = false;
  const sample = '## Today’s question\n\nUse $Q(s,a)$ for inline math.\n\n$$\nQ(s,a) = r + \\gamma \\mathbb{E}_{s\u2032}[V(s\u2032)]\n$$\n\n';
  function transaction(mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', mode);
      const req = action(tx.objectStore('drafts'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Saving was interrupted.'));
    });
  }
  async function refresh() {
    const drafts = await transaction('readonly', s => s.getAll());
    $('drafts').replaceChildren(...drafts.sort((a,b) => b.updated-a.updated).map(d => {
      const option = document.createElement('option');
      option.value = d.id; option.textContent = d.title || 'Untitled note'; return option;
    }));
    $('drafts').value = current.id;
  }
  async function save() {
    clearTimeout(timer); timer = null;
    if (!ready) return;
    current.title = $('note-title').value;
    current.markdown = editor.getValue();
    current.updated = Date.now();
    await transaction('readwrite', s => s.put(current));
    await refresh();
    status('Saved in this browser · ' + new Date().toLocaleTimeString('en-US'));
  }
  function changed() {
    if (!ready) return;
    status('Saving…'); clearTimeout(timer);
    timer = setTimeout(() => save().catch(report), 350);
  }
  function report(error) { console.error(error); status('Operation failed. Download a backup to keep your work. ' + error.message); }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function makeDraft() { return {id: crypto.randomUUID(), title: '', markdown: '', updated: Date.now()}; }
  function load(draft) { ready = false; current = draft; $('note-title').value = draft.title; editor.setValue(draft.markdown); ready = true; }
  async function images(files) {
    const converted = [];
    for (const file of files) {
      if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
        status('Choose PNG, JPG, GIF, or WebP images up to 8 MB each.'); return null;
      }
      const data = await new Promise((resolve,reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
      });
      if (!allowedImage.test(data)) throw new Error('Unsupported image format.');
      converted.push(`![image](${data})`);
    }
    editor.insertValue('\n' + converted.join('\n\n') + '\n');
    await save(); return null;
  }
  try {
    if (!window.Vditor) throw new Error('Could not load the editor. Check your connection and reload.');
    db = await new Promise((resolve,reject) => {
      const request = indexedDB.open('jaehun-working-notes', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts', {keyPath:'id'});
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const drafts = await transaction('readonly', s => s.getAll());
    current = drafts.sort((a,b) => b.updated-a.updated)[0] || {...makeDraft(), markdown: sample};
    $('note-title').value = current.title;
    editor = new Vditor('note-editor', {
      cdn: 'https://cdn.jsdelivr.net/npm/vditor@4.0.1', lang: 'en_US', theme: 'dark', mode: 'ir',
      height: 600, cache: {enable: false}, value: current.markdown,
      toolbar: ['headings','bold','italic','strike','|','list','ordered-list','check','quote','|','code','inline-code','link','table','upload','|','undo','redo','|','edit-mode','both','preview','fullscreen'],
      preview: {math: {engine:'KaTeX'}, markdown:{inlineMath:true, sanitize:true}, theme:{current:'dark'}, hljs:{enable:true}},
      upload: {accept:'image/png,image/jpeg,image/gif,image/webp', handler: files => images(files).catch(e => {report(e); return null;})},
      input: changed,
      after: () => { ready = true; document.querySelectorAll('.write-page [disabled]').forEach(el => el.disabled = false); save().catch(report); }
    });
    $('note-title').addEventListener('input', changed);
    $('new-draft').onclick = async () => { try {await save(); load(makeDraft()); await save(); $('note-title').focus();} catch(e){report(e);} };
    $('drafts').onchange = async () => { const id = $('drafts').value; try {await save(); load(await transaction('readonly', s => s.get(id))); await refresh();} catch(e){report(e);} };
    $('backup').onclick = () => {
      const draft = {...current, title:$('note-title').value, markdown:editor.getValue()};
      download(new Blob([JSON.stringify({version:1, draft}, null, 2)], {type:'application/json'}), 'note-backup.json');
    };
    $('restore-button').onclick = () => $('restore').click();
    $('restore').onchange = async (event) => {
      try {
        const file = event.target.files[0]; if (!file) return;
        if(file.size > 100 * 1024 * 1024) throw new Error('The backup file is too large.');
        const data = JSON.parse(await file.text());
        if (data.version !== 1 || typeof data.draft?.markdown !== 'string' || typeof data.draft?.title !== 'string') throw new Error('This is not a valid backup file.');
        await save(); load({...makeDraft(), title:data.draft.title.slice(0,200), markdown:data.draft.markdown}); await save();
      } catch(e){report(e);} finally {event.target.value='';}
    };
    $('export').onclick = async () => {
      try {
        if (!window.JSZip) throw new Error('Could not load the ZIP tool. Reload and try again.');
        const zip = new JSZip(); let count = 0;
        const markdown = editor.getValue().replace(/data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)/g, (_, ext, data) => {
          const path = `images/figure-${++count}.${ext === 'jpeg' ? 'jpg' : ext}`;
          zip.file(path, data, {base64:true}); return path;
        });
        zip.file('note.md', '# ' + $('note-title').value.replace(/[\r\n]/g,' ') + '\n\n' + markdown);
        download(await zip.generateAsync({type:'blob'}), 'note-with-images.zip');
        status('Markdown and images exported. This note has not been published.');
      } catch(e){report(e);}
    };
    document.addEventListener('visibilitychange', () => {if(document.hidden) save().catch(report);});
    window.addEventListener('beforeunload', event => {if(timer){event.preventDefault(); event.returnValue='';}});
  } catch(e){ report(e); }
})();
