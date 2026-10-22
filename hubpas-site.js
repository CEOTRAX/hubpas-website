const menu = document.querySelector('.nav-toggle');
const nav = document.querySelector('#public-nav');
function closeMenu(){nav?.classList.remove('is-open');menu?.setAttribute('aria-expanded','false');}
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav?.classList.toggle('is-open',open);});
nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
document.querySelectorAll('[data-year]').forEach(node=>node.textContent=new Date().getFullYear());
document.querySelector('[data-print]')?.addEventListener('click',()=>window.print());

// An illustrative category sampler: no database reads or invented event listings.
const vibes = {
  music: ['♫', 'MUSIC & ENTERTAINMENT', 'One more song.', 'For the nights that turn into stories.'],
  sport: ['↗', 'SPORTS', 'Bring your game.', 'A little friendly competition. A lot of good energy.'],
  social: ['✳', 'SOCIAL', 'Your kind of people.', 'New faces. Familiar energy. Good company.'],
  learn: ['✎', 'LEARNING', 'Go in curious.', 'Come out with something worth sharing.'],
  community: ['♡', 'COMMUNITY', 'Better together.', 'Make a little room for your people.'],
  business: ['▥', 'BUSINESS', 'Good connections.', 'The next conversation could start something.'],
  faith: ['☀', 'FAITH', 'Find your fellowship.', 'A shared moment. A little more connection.'],
  charity: ['+', 'CHARITY', 'Show up for good.', 'Small acts. Shared purpose. Real community.']
};
const vibePreview = document.querySelector('.vibe-preview');
document.querySelectorAll('[data-vibe]').forEach(button => {
  button.addEventListener('click', () => {
    const selected = vibes[button.dataset.vibe];
    if (!selected || !vibePreview) return;
    document.querySelectorAll('[data-vibe]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    vibePreview.dataset.scene = button.dataset.vibe;
    ['.scene-symbol', '.scene-category', '.scene-copy h3', '.scene-copy p'].forEach((selector, i) => {
      vibePreview.querySelector(selector).textContent = selected[i];
    });
  });
});

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const motionToggle = document.querySelector('[data-motion-toggle]');
let motionPaused = reducedMotion?.matches || false;
function applyMotionPreference() {
  document.documentElement.classList.toggle('motion-paused', motionPaused);
  motionToggle?.setAttribute('aria-pressed', String(motionPaused));
  if (motionToggle) motionToggle.textContent = motionPaused ? 'Resume animations ▷' : 'Pause animations Ⅱ';
}
applyMotionPreference();
motionToggle?.addEventListener('click', () => { motionPaused = !motionPaused; applyMotionPreference(); });
reducedMotion?.addEventListener('change', event => { motionPaused = event.matches; applyMotionPreference(); });

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    entry.target.classList.toggle('motion-offscreen', !entry.isIntersecting);
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
  }), {threshold:0.08});
  document.querySelectorAll('.hero-art, .word-strip, .vibe-panel, .feature, .host-art, .spotlight-art, .kindness-art, .how-grid li').forEach(element => {
    if (!reducedMotion?.matches && !element.closest('.hero')) element.classList.add('js-reveal');
    observer.observe(element);
  });
}

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
