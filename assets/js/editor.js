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
    refreshFigures();
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
  const figurePattern = /<section\b[^>]*class="note-figure\s[^>]*>[\s\S]*?<\/section>/g;
  const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let figureId, figureImage = '', previewSequence = 0;
  function figureBlocks() { return [...editor.getValue().matchAll(figurePattern)].map(match => ({source:match[0], node:new DOMParser().parseFromString(match[0], 'text/html').querySelector('section')})); }
  function refreshFigures() {
    const selected = $('figure-list').value;
    $('figure-list').replaceChildren(...figureBlocks().map(({node}, index) => {
      const option = document.createElement('option'); option.value=node.dataset.noteId;
      option.textContent = node.querySelector('figcaption')?.textContent || `Figure ${index+1}`; return option;
    }));
    if ([...$('figure-list').options].some(o => o.value === selected)) $('figure-list').value=selected;
    $('figure-edit').disabled = !$('figure-list').options.length;
  }
  async function figureHTML() {
    if (!figureImage) return '';
    const mode = $('figure-mode').value, width = $('figure-width').value;
    const text = $('figure-text').value;
    const html = await Vditor.md2html(text, {cdn:'https://cdn.jsdelivr.net/npm/vditor@4.0.1', markdown:{sanitize:true,inlineMath:true}});
    return `<section class="note-figure note-figure--${mode} note-figure--${width}" data-note-id="${figureId}" data-note-text="${escapeHTML(encodeURIComponent(text))}" data-note-mode="${mode}" data-note-width="${width}"><figure><img src="${escapeHTML(figureImage)}" alt="${escapeHTML($('figure-alt').value)}"><figcaption>${escapeHTML($('figure-caption').value)}</figcaption></figure><article>${html}</article></section>`;
  }
  async function previewFigure() {
    const sequence = ++previewSequence;
    try {
      const html = await figureHTML(); if(sequence !== previewSequence) return;
      $('figure-preview').innerHTML = html;
      if (!html) $('figure-preview').textContent='Choose an image to preview the layout.';
      else Vditor.mathRender($('figure-preview'), {cdn:'https://cdn.jsdelivr.net/npm/vditor@4.0.1', math:{engine:'KaTeX'}});
      $('figure-width').disabled = $('figure-mode').value === 'full';
    } catch(e) { $('figure-status').textContent=e.message; }
  }
  function openFigure(block) {
    figureId = block?.node.dataset.noteId || crypto.randomUUID();
    figureImage = block?.node.querySelector('img')?.getAttribute('src') || '';
    $('figure-mode').value=block?.node.dataset.noteMode || 'columns';
    $('figure-width').value=block?.node.dataset.noteWidth || '45';
    $('figure-text').value=decodeURIComponent(block?.node.dataset.noteText || '');
    $('figure-alt').value=block?.node.querySelector('img')?.alt || '';
    $('figure-caption').value=block?.node.querySelector('figcaption')?.textContent || '';
    $('figure-status').textContent=block ? 'Editing this figure.' : 'New layouts are added at the end of your note.';
    $('figure-dialog').showModal(); previewFigure();
  }
  async function chooseFigureImage(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type) || file.size > 8*1024*1024) { $('figure-status').textContent='Choose a PNG, JPG, GIF, or WebP image up to 8 MB.'; return; }
    figureImage = await new Promise((resolve,reject) => {const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file);});
    if(!allowedImage.test(figureImage)) throw new Error('Unsupported image format.');
    $('figure-status').textContent='Image ready.'; await previewFigure();
  }
  function setupFigures() {
    $('figure-add').onclick=()=>openFigure();
    $('figure-edit').onclick=()=>{const block=figureBlocks().find(b=>b.node.dataset.noteId===$('figure-list').value); if(block) openFigure(block);};
    $('figure-cancel').onclick=()=>$('figure-dialog').close();
    $('figure-choose').onclick=()=>$('figure-file').click();
    $('figure-file').onchange=e=>{chooseFigureImage(e.target.files[0]).catch(report);e.target.value='';};
    $('figure-drop').ondragover=e=>e.preventDefault();
    $('figure-drop').ondrop=e=>{e.preventDefault();chooseFigureImage(e.dataTransfer.files[0]).catch(report);};
    $('figure-dialog').addEventListener('paste', e=>{const file=[...e.clipboardData.files].find(f=>f.type.startsWith('image/'));if(file){e.preventDefault();chooseFigureImage(file).catch(report);}});
    ['figure-mode','figure-width','figure-alt','figure-caption','figure-text'].forEach(id=>$(id).addEventListener('input',previewFigure));
    $('figure-form').onsubmit=async e=>{
      e.preventDefault();
      try {
        if(!figureImage){$('figure-status').textContent='Choose an image first.';return;}
        const html=await figureHTML(), block=figureBlocks().find(b=>b.node.dataset.noteId===figureId);
        const markdown=editor.getValue();
        editor.setValue(block ? markdown.replace(block.source,()=>html) : markdown+'\n\n'+html+'\n\n');
        await save(); $('figure-dialog').close();
      } catch(error){$('figure-status').textContent=error.message;}
    };
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
    setupFigures();
    function insertVideo(value) {
      try {
        const url = new URL(value, location.origin);
        if (url.protocol !== 'https:' && url.origin !== location.origin) throw new Error('Use an HTTPS video URL.');
        if (!/\.(mp4|webm)$/i.test(url.pathname)) throw new Error('Use a direct MP4 or WebM link, not a video sharing page.');
        editor.setValue(editor.getValue()+'\n\n<video controls playsinline preload="metadata" style="width:100%;height:auto" src="'+escapeHTML(url.href)+'"></video>\n\n');
        save().catch(report);
      } catch(e){report(e);}
    }
    $('video-insert').onclick=()=>insertVideo($('video-url').value);
    $('video-demo').onclick=()=>insertVideo('https://manfromearth11.github.io/assets/videos/rl-yai-seed10003.mp4');
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
        const cssResponse = await fetch($('figure-styles').href);
        if(!cssResponse.ok) throw new Error('Could not load layout styles for export.');
        const css = await cssResponse.text();
        zip.file('note-layout.css', css);
        const rendered = await Vditor.md2html(markdown, {cdn:'https://cdn.jsdelivr.net/npm/vditor@4.0.1', markdown:{sanitize:true,inlineMath:true}});
        zip.file('note.html', '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHTML($('note-title').value)+'</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vditor@4.0.1/dist/index.css"><link rel="stylesheet" href="note-layout.css"><body style="max-width:900px;margin:40px auto;padding:20px"><h1>'+escapeHTML($('note-title').value)+'</h1><main class="vditor-reset">'+rendered+'</main><script src="https://cdn.jsdelivr.net/npm/vditor@4.0.1/dist/index.min.js"></script><script>Vditor.mathRender(document.querySelector("main"),{cdn:"https://cdn.jsdelivr.net/npm/vditor@4.0.1",math:{engine:"KaTeX"}});</script></body></html>');
        zip.file('README.txt', 'Open note.html to see image layouts. Internet access is required for math rendering. note.md contains HTML layout blocks; Markdown-only viewers may not preserve these layouts. Keep note-layout.css and images/ alongside note.html.');
        zip.file('note.md', '# ' + $('note-title').value.replace(/[\r\n]/g,' ') + '\n\n' + markdown);
        download(await zip.generateAsync({type:'blob'}), 'note-with-images.zip');
        status('Markdown and images exported. This note has not been published.');
      } catch(e){report(e);}
    };
    document.addEventListener('visibilitychange', () => {if(document.hidden) save().catch(report);});
    window.addEventListener('beforeunload', event => {if(timer){event.preventDefault(); event.returnValue='';}});
  } catch(e){ report(e); }
})();
