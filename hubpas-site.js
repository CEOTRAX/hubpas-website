const menu = document.querySelector('.nav-toggle');
const nav = document.querySelector('#public-nav');
function closeMenu(){nav?.classList.remove('is-open');menu?.setAttribute('aria-expanded','false');}
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav?.classList.toggle('is-open',open);});
nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
document.querySelectorAll('[data-year]').forEach(node=>node.textContent=new Date().getFullYear());
document.querySelector('[data-print]')?.addEventListener('click',()=>window.print());

// An SPA fallback can return HTML with status 200 for a missing APK. Only enable
// the download when this exact URL serves an Android package/binary response.
const androidDownload = document.querySelector('[data-android-download]');
if (androidDownload) {
  fetch('/downloads/Hubpas.apk', {method:'HEAD', cache:'no-store'})
    .then(response => {
      const type = (response.headers.get('content-type') || '').split(';')[0];
      const length = response.headers.get('content-length');
      if (!response.ok || !['application/vnd.android.package-archive','application/octet-stream'].includes(type) || (length !== null && !(Number(length) > 0))) return;
      const link = document.createElement('a');
      link.className = 'button dark';
      link.href = '/downloads/Hubpas.apk';
      link.download = 'Hubpas.apk';
      link.dataset.androidDownload = '';
      link.textContent = 'Download Hubpas for Android ↓';
      androidDownload.replaceWith(link);
      document.querySelector('#android-download-title')?.closest('article').querySelector('.download-note')?.replaceChildren(document.createTextNode('Android APK · direct download to your device.'));
    })
    .catch(() => { /* Keep an unavailable download clearly labelled. */ });
}
