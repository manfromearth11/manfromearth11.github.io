const viewer=document.getElementById('figure-viewer');
document.querySelectorAll('.zoom-figure').forEach(link=>link.addEventListener('click',event=>{
 if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();const image=document.getElementById('expanded-figure');image.src=link.href;image.alt=link.querySelector('img').alt;viewer.showModal();
}));
document.getElementById('close-figure').onclick=()=>viewer.close();
viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close();});
document.getElementById('copy-citation').onclick=async()=>{
 const text=document.getElementById('bibtex').textContent;
 try{await navigator.clipboard.writeText(text);document.getElementById('copy-status').textContent='BibTeX copied.';}catch{document.getElementById('copy-status').textContent='Select the citation above to copy it.';}
};
if(window.Vditor) Vditor.mathRender(document.querySelector('.project-page'),{cdn:'https://cdn.jsdelivr.net/npm/vditor@4.0.1',math:{engine:'KaTeX'}});
