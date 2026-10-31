const menu = document.querySelector('.nav-toggle');
const nav = document.querySelector('#public-nav');
function closeMenu(){nav?.classList.remove('is-open');menu?.setAttribute('aria-expanded','false');}
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav?.classList.toggle('is-open',open);});
nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
document.querySelectorAll('[data-year]').forEach(node=>node.textContent=new Date().getFullYear());
document.querySelector('[data-print]')?.addEventListener('click',()=>window.print());

// Anonymous daily totals only. Local previews, opted-out browsers and the app
// itself are excluded. No URL parameters, referrers or visitor IDs are sent.
const trackProduction = location.protocol === 'https:' && ['dmap-50136.web.app','dmap-50136.firebaseapp.com','www.hubpas.com','hubpas.com'].includes(location.hostname) && navigator.doNotTrack !== '1' && navigator.globalPrivacyControl !== true;
const trackedPage = location.pathname === '/privacy.html' ? 'privacy' : /^(?:\/(?:index\.html)?|\/website(?:\/(?:index\.html)?)?)$/.test(location.pathname) ? 'website' : null;
if (trackProduction && trackedPage) {
  const sendCount = (type, visit = false) => {
    const data=JSON.stringify({type,page:trackedPage,id:crypto.randomUUID(),visit});
    try {
      if (navigator.sendBeacon?.('/api/site-metrics',new Blob([data],{type:'text/plain'}))) return;
    } catch { /* A blocked beacon must never interrupt the page or download. */ }
    fetch('/api/site-metrics',{method:'POST',headers:{'Content-Type':'text/plain'},body:data,keepalive:true,credentials:'omit'}).catch(()=>{});
  };
  let counted = false, lastDownload = 0;
  const pageView = () => {
    if(counted || document.visibilityState !== 'visible')return;
    counted=true;const now=Date.now();let visit=true;
    try {const previous=Number(sessionStorage.getItem('hubpas-site-last-activity')||0);visit=!previous || now-previous>30*60*1000;sessionStorage.setItem('hubpas-site-last-activity',String(now));} catch { /* Count this view without persisting a session marker. */ }
    sendCount('pageview',visit);
  };
  pageView();document.addEventListener('visibilitychange',pageView);
  window.addEventListener('pageshow',event=>{if(event.persisted){counted=false;pageView();}});
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[data-android-download]');
    if(!link || Date.now()-lastDownload<2000)return;
    lastDownload=Date.now();sendCount('androidDownload');
    try {sessionStorage.setItem('hubpas-site-last-activity',String(lastDownload));}catch{}
  });
}
// An illustrative category sampler: no database reads or invented event listings.
const vibes = {
  music: ['♫', 'MUSIC & ENTERTAINMENT', 'One more song.', 'For the nights that turn into stories.'],
  sport: ['↗', 'SPORTS', 'Bring your game.', 'A little friendly competition. A lot of good energy.'],
  social: ['✳', 'SOCIAL & CONNECTION', 'Your kind of people.', 'New faces. Familiar energy. Good company.'],
  learn: ['✎', 'LEARNING', 'Go in curious.', 'Come out with something worth sharing.'],
  community: ['♡', 'COMMUNITY', 'Better together.', 'Make a little room for your people.'],
  business: ['▥', 'BUSINESS & CONFERENCES', 'Ideas meet people.', 'Conferences. Conversations. New connections.'],
  faith: ['☀', 'FAITH & FELLOWSHIP', 'Gather with purpose.', 'Programmes that bring your faith community together.'],
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

// A small depth shift on decorative layers. Keep it bounded and stop it for
// reduced-motion visitors or when the site's motion toggle is paused.
const parallaxLayers = [
  ['.hero-art .access-pass', 0.055],
  ['.hero-art .floating-ticket', -0.075],
  ['.vibe-preview .scene-stamp', 0.06],
  ['.host-art .host-sticker', -0.065],
  ['.spotlight-art .boost-label', 0.07],
  ['.closing-star', -0.05]
].map(([selector, depth]) => ({element: document.querySelector(selector), depth})).filter(({element}) => element);
let parallaxFrame = 0;
function updateParallax() {
  parallaxFrame = 0;
  const enabled = !motionPaused && !reducedMotion?.matches;
  const midpoint = window.innerHeight / 2;
  for (const {element, depth} of parallaxLayers) {
    const rect = element.getBoundingClientRect();
    const distance = rect.top + rect.height / 2 - midpoint;
    const shift = enabled && rect.bottom >= 0 && rect.top <= window.innerHeight
      ? Math.max(-26, Math.min(26, Math.round(-distance * depth))) : 0;
    element.style.setProperty('--parallax-y', shift + 'px');
  }
}
function requestParallax() {
  if (!parallaxFrame) parallaxFrame = window.requestAnimationFrame(updateParallax);
}
if (parallaxLayers.length) {
  window.addEventListener('scroll', requestParallax, {passive:true});
  window.addEventListener('resize', requestParallax, {passive:true});
  motionToggle?.addEventListener('click', requestParallax);
  reducedMotion?.addEventListener('change', requestParallax);
  requestParallax();
}

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    entry.target.classList.toggle('motion-offscreen', !entry.isIntersecting);
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
  }), {threshold:0.08});
  document.querySelectorAll('.hero-art, .word-strip, .vibe-panel, .feature, .host-art, .access-journey, .spotlight-art, .kindness-art, .how-grid li').forEach(element => {
    if (!reducedMotion?.matches && !element.closest('.hero')) element.classList.add('js-reveal');
    observer.observe(element);
  });
}
