const toggle = document.querySelector('.menu-toggle')
const mobileNav = document.getElementById('mobile-nav')
const header = document.querySelector('.site-header')
const year = document.getElementById('year')
if (year) year.textContent = new Date().getFullYear()
if (toggle && mobileNav) {
  toggle.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open')
    toggle.setAttribute('aria-expanded', String(open))
  })
}

const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const internalLinks = Array.from(document.querySelectorAll('a[href^="#"]'))
internalLinks.forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href') || ''
    const id = href.replace('#', '')
    if (!id) return
    const target = document.getElementById(id)
    if (!target) return
    e.preventDefault()
    const headerH = header ? header.getBoundingClientRect().height : 0
    const top = window.scrollY + target.getBoundingClientRect().top - headerH - 12
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion ? 'auto' : 'smooth' })
    if (mobileNav && toggle) {
      mobileNav.classList.remove('open')
      toggle.setAttribute('aria-expanded', 'false')
    }
  })
})

const countdownRoot = document.querySelector('.waitlist-countdown[data-launch-date]')
if (countdownRoot) {
  const launchDate = new Date(countdownRoot.getAttribute('data-launch-date') || '')
  const daysNode = document.getElementById('countdown-days')
  const hoursNode = document.getElementById('countdown-hours')
  const minutesNode = document.getElementById('countdown-minutes')
  const secondsNode = document.getElementById('countdown-seconds')

  const updateCountdown = () => {
    if (!(launchDate instanceof Date) || Number.isNaN(launchDate.getTime())) return

    const diff = Math.max(0, launchDate.getTime() - Date.now())
    const totalSeconds = Math.floor(diff / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (daysNode) daysNode.textContent = String(days).padStart(2, '0')
    if (hoursNode) hoursNode.textContent = String(hours).padStart(2, '0')
    if (minutesNode) minutesNode.textContent = String(minutes).padStart(2, '0')
    if (secondsNode) secondsNode.textContent = String(seconds).padStart(2, '0')
  }

  updateCountdown()
  window.setInterval(updateCountdown, 1000)
}
