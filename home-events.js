const eventGrid = document.querySelector('#featured-events');
const eventDateFormat = new Intl.DateTimeFormat('en-SL', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  timeZone: 'Africa/Freetown'
});

function eventCard(event) {
  const card = document.createElement('a');
  card.className = 'event-card';
  card.href = `https://dmap-50136.web.app/events/${encodeURIComponent(event.id)}`;
  card.setAttribute('aria-label', `View ${event.title} on Hubpas`);

  const imageWrap = document.createElement('div');
  imageWrap.className = 'event-image';
  if (event.image) {
    const image = document.createElement('img');
    image.src = event.image;
    image.alt = '';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.onerror = () => { image.remove(); imageWrap.textContent = '✳'; imageWrap.classList.add('event-image-fallback'); };
    imageWrap.append(image);
  } else {
    imageWrap.textContent = '✳';
    imageWrap.classList.add('event-image-fallback');
  }
  const info = document.createElement('div');
  info.className = 'event-info';
  const date = document.createElement('p');
  date.className = 'event-date';
  date.textContent = eventDateFormat.format(new Date(event.dateTime));
  const title = document.createElement('h3');
  title.textContent = event.title;
  info.append(date, title);
  if (event.location || event.ageRating) {
    const place = document.createElement('p');
    place.className = 'event-place';
    if (event.location) place.append(document.createTextNode(`⌖ ${event.location}`));
    if (event.ageRating === '18+') {
      const badge = document.createElement('span');
      badge.className = 'event-badge';
      badge.textContent = '18+';
      place.append(badge);
    }
    info.append(place);
  }
  card.append(imageWrap, info);
  return card;
}

async function showFeaturedEvents() {
  if (!eventGrid) return;
  try {
    const response = await fetch('/api/featured-events', {headers: {'Accept': 'application/json'}, credentials: 'omit'});
    if (!response.ok) throw new Error('The event feed is unavailable.');
    const payload = await response.json();
    if (!Array.isArray(payload.events)) throw new Error('Invalid event feed.');
    eventGrid.replaceChildren();
    const events = payload.events.filter(event => event && typeof event.id === 'string' && typeof event.title === 'string' && !Number.isNaN(Date.parse(event.dateTime)));
    if (events.length) eventGrid.append(...events.slice(0, 3).map(eventCard));
    else {
      const empty = document.createElement('p');
      empty.className = 'event-message';
      empty.textContent = 'No upcoming public events yet. Explore Hubpas for more.';
      eventGrid.append(empty);
    }
  } catch {
    const error = document.createElement('p');
    error.className = 'event-message';
    error.textContent = 'Events are taking a moment to load. Open Hubpas to explore.';
    eventGrid.replaceChildren(error);
  } finally {
    eventGrid.setAttribute('aria-busy', 'false');
  }
}

showFeaturedEvents();
