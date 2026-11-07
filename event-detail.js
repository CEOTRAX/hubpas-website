const eventId = location.pathname.match(/^\/events\/([A-Za-z0-9_-]{1,80})\/?$/)?.[1] || new URLSearchParams(location.search).get('id');
const eventPage = document.querySelector('#main');
const eventStatus = document.querySelector('#event-status');
const eventContent = document.querySelector('#event-content');
const eventDateFormat = new Intl.DateTimeFormat('en-SL', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  timeZone: 'Africa/Freetown',
});
const moneyFormat = new Intl.NumberFormat('en-SL', {maximumFractionDigits: 2, minimumFractionDigits: 0});

function setText(selector, value) {
  document.querySelector(selector).textContent = value || '';
}

function addTag(value, className = '') {
  if (!value) return;
  const tag = document.createElement('span');
  tag.textContent = value;
  if (className) tag.className = className;
  document.querySelector('#event-tags').append(tag);
}

function addMeta(icon, text) {
  if (!text) return;
  const row = document.createElement('p');
  const symbol = document.createElement('span');
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = icon;
  row.append(symbol, document.createTextNode(text));
  document.querySelector('#event-meta').append(row);
}

function addAccessGroup(title, tiers, kind) {
  if (!tiers.length) return;
  const group = document.createElement('div');
  group.className = 'access-group';
  const heading = document.createElement('h3');
  heading.textContent = title;
  group.append(heading);
  tiers.forEach(tier => {
    const item = document.createElement('div');
    item.className = 'access-item';
    const label = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = tier.name;
    label.append(name);
    if (tier.description || tier.soldOut || tier.openAmount) {
      const detail = document.createElement('small');
      detail.textContent = tier.soldOut ? 'Sold out' : tier.openAmount ? 'Choose your amount in Hubpas' : tier.description;
      label.append(detail);
    }
    const price = document.createElement('span');
    price.className = 'access-price';
    price.textContent = tier.openAmount ? 'Any amount' : tier.amount == null && kind === 'donation' ? 'See in app' :
      `Le ${moneyFormat.format(kind === 'donation' ? tier.amount : tier.price)}`;
    item.append(label, price);
    group.append(item);
  });
  document.querySelector('#access-options').append(group);
}

function renderEvent(event) {
  document.title = `${event.title} — Hubpas`;
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = `https://www.hubpas.com/events/${encodeURIComponent(event.id)}`;
  document.head.append(canonical);
  setText('#event-title', event.title);
  if (event.shortDescription) {
    setText('#event-lead', event.shortDescription);
    document.querySelector('#event-lead').hidden = false;
  }
  addTag(event.category || 'Event');
  if (event.ageRating === '18+') addTag('18+', 'age-tag');
  addMeta('◷', eventDateFormat.format(new Date(event.dateTime)));
  addMeta('⌖', [event.venueName, event.district || event.location].filter(Boolean).join(' · '));
  if (event.image) {
    const image = document.createElement('img');
    image.src = event.image;
    image.alt = `${event.title} event artwork`;
    image.referrerPolicy = 'no-referrer';
    image.onerror = () => image.remove();
    document.querySelector('#event-cover').append(image);
  }
  setText('#event-description', event.description || event.shortDescription || 'More details are coming soon.');
  setText('#host-name', event.hostName || 'Hubpas host');
  if (event.hostPhoto) {
    const image = document.createElement('img');
    image.src = event.hostPhoto;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.onerror = () => image.remove();
    document.querySelector('#host-avatar').append(image);
  }
  if (!event.chatEnabled) setText('#conversation-copy', 'Join Hubpas to keep up with this event and connect with the host.');
  const tickets = Array.isArray(event.tickets) ? event.tickets : [];
  const tables = Array.isArray(event.tables) ? event.tables : [];
  const donations = Array.isArray(event.donations) ? event.donations : [];
  addAccessGroup('Tickets', tickets, 'ticket');
  addAccessGroup('Tables', tables, 'table');
  if (event.donationCampaign) {
    const heading = document.createElement('div');
    heading.className = 'access-group';
    const title = document.createElement('h3');
    title.textContent = event.donationCampaign.title || 'Support this event';
    heading.append(title);
    if (event.donationCampaign.description) {
      const copy = document.createElement('p');
      copy.className = 'access-empty';
      copy.textContent = event.donationCampaign.description;
      heading.append(copy);
    }
    document.querySelector('#access-options').append(heading);
  }
  addAccessGroup('Support the event', donations, 'donation');
  if (!tickets.length && !tables.length && !donations.length && !event.donationCampaign) {
    const empty = document.createElement('p');
    empty.className = 'access-empty';
    empty.textContent = 'Access details will be shared in Hubpas. Create an account to stay close to this event.';
    document.querySelector('#access-options').append(empty);
  }
  const location = [event.venueName, event.fullAddress || event.location, event.district].filter((part, index, items) => part && items.indexOf(part) === index);
  if (location.length) {
    setText('#location-copy', location.join('\n'));
    document.querySelector('#location-panel').hidden = false;
  }
  eventStatus.hidden = true;
  eventContent.hidden = false;
  eventPage.setAttribute('aria-busy', 'false');
}

async function loadEvent() {
  if (!eventId || !/^[A-Za-z0-9_-]{1,80}$/.test(eventId)) {
    eventStatus.textContent = 'This event link is unavailable. Explore upcoming events instead.';
    eventPage.setAttribute('aria-busy', 'false');
    return;
  }
  try {
    const response = await fetch(`/api/featured-events?id=${encodeURIComponent(eventId)}`, {headers: {Accept: 'application/json'}, credentials: 'omit'});
    if (response.status === 404) throw new Error('not-found');
    if (!response.ok) throw new Error('unavailable');
    const {event} = await response.json();
    if (!event || event.id !== eventId || !event.title || !event.dateTime) throw new Error('unavailable');
    renderEvent(event);
  } catch (error) {
    eventStatus.textContent = error.message === 'not-found'
      ? 'This event is no longer public or available. Explore upcoming events instead.'
      : 'Event details are taking a moment to load. Please try again soon.';
    eventPage.setAttribute('aria-busy', 'false');
  }
}

loadEvent();
