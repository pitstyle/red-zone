const stack = document.getElementById('stack')
const contactPage = document.getElementById('contact-page')
const pageLabel = document.getElementById('page-label')
const chapterLabel = document.getElementById('chapter-label')
const chaptersToggle = document.getElementById('chapters-toggle')
const chapterRail = document.getElementById('chapter-rail')
const chapterList = document.getElementById('chapter-list')
const contactNav = document.getElementById('contact-nav')
const closeRail = document.getElementById('close-rail')
const app = document.getElementById('app')

let manifest = null
let currentIndex = 0
let onContact = false
let uiTimer = null
let scrollRaf = 0
const spreadEls = []

function showUiTemporarily() {
  app.classList.remove('ui-hidden')
  clearTimeout(uiTimer)
  uiTimer = setTimeout(() => app.classList.add('ui-hidden'), 2600)
}

function chapterForPage(pageNum) {
  let found = null
  for (const c of manifest.chapters) {
    if (pageNum >= c.page) found = c
  }
  return found
}

function resolveSrc(path) {
  if (!path) return path
  if (path.startsWith('http') || path.startsWith('data:')) return path
  const base = import.meta.env.BASE_URL || './'
  const clean = String(path).replace(/^\.\//, '').replace(/^\//, '')
  return `${base}${clean}`
}

function updateLabels(index) {
  onContact = false
  currentIndex = index
  contactNav.classList.remove('active')
  const page = manifest.pages[index]
  pageLabel.textContent = `${page.page} / ${manifest.pageCount}`
  const chapter = chapterForPage(page.page)
  chapterLabel.textContent = chapter ? `${chapter.label} · ${chapter.title}` : 'Cover'
  history.replaceState(null, '', `#p=${page.page}`)
  for (const btn of chapterList.querySelectorAll('.chapter-btn')) {
    btn.classList.toggle('active', chapter && btn.dataset.id === chapter.id)
  }
}

function setContactActive() {
  onContact = true
  pageLabel.textContent = 'Contact'
  chapterLabel.textContent = 'Tamara Wyrzykowska'
  history.replaceState(null, '', '#contact')
  for (const btn of chapterList.querySelectorAll('.chapter-btn')) {
    btn.classList.remove('active')
  }
  contactNav.classList.add('active')
}

function buildStack() {
  stack.innerHTML = ''
  spreadEls.length = 0
  for (const page of manifest.pages) {
    const img = document.createElement('img')
    img.className = 'spread'
    img.alt = `RED ZONE page ${page.page}`
    img.loading = page.index < 3 ? 'eager' : 'lazy'
    img.decoding = 'async'
    img.draggable = false
    img.dataset.index = String(page.index)
    img.src = page.src
    stack.appendChild(img)
    spreadEls.push(img)
  }
}

function buildChapterRail() {
  chapterList.innerHTML = ''
  for (const c of manifest.chapters) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'chapter-btn'
    btn.dataset.id = c.id
    btn.innerHTML = `<strong>${c.label}</strong><span>${c.title}</span>`
    btn.addEventListener('click', () => {
      chapterRail.hidden = true
      goToPage(c.page - 1)
    })
    chapterList.appendChild(btn)
  }
}

function goToPage(index, behavior = 'smooth') {
  const el = spreadEls[Math.max(0, Math.min(index, spreadEls.length - 1))]
  if (!el) return
  el.scrollIntoView({ behavior, block: 'start' })
  updateLabels(Number(el.dataset.index))
  showUiTemporarily()
}

function goToContact(behavior = 'smooth') {
  chapterRail.hidden = true
  contactPage.scrollIntoView({ behavior, block: 'start' })
  setContactActive()
  showUiTemporarily()
}

function syncFromScroll() {
  const top = window.scrollY + window.innerHeight * 0.25
  const contactTop = contactPage.offsetTop

  if (top >= contactTop - 40) {
    if (!onContact) setContactActive()
    return
  }

  let active = 0
  for (let i = 0; i < spreadEls.length; i += 1) {
    const el = spreadEls[i]
    if (el.offsetTop <= top) active = i
    else break
  }
  if (onContact || active !== currentIndex) updateLabels(active)
}

function onScroll() {
  showUiTemporarily()
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(syncFromScroll)
}

function parseStart() {
  const hash = location.hash.replace(/^#/, '')
  if (hash === 'contact') return { type: 'contact' }

  const params = new URLSearchParams(location.search)
  const hashParams = new URLSearchParams(hash.includes('=') ? hash : '')
  const chapter = params.get('c') || hashParams.get('c')
  if (chapter) {
    const id = chapter.padStart(2, '0')
    const found = manifest.chapters.find((c) => c.id === id || c.label.startsWith(id))
    if (found) return { type: 'page', index: found.page - 1 }
  }
  const page = Number(params.get('p') || hashParams.get('p') || (hash.startsWith('p=') ? hash.slice(2) : hash.replace(/^p=/, '')) || 1)
  if (Number.isFinite(page) && page >= 1) return { type: 'page', index: page - 1 }
  return { type: 'page', index: 0 }
}

async function init() {
  const res = await fetch(resolveSrc('manifest.json'))
  manifest = await res.json()
  for (const page of manifest.pages) {
    page.src = resolveSrc(page.src)
  }
  buildStack()
  buildChapterRail()

  const start = parseStart()
  requestAnimationFrame(() => {
    if (start.type === 'contact') goToContact('auto')
    else {
      updateLabels(start.index)
      goToPage(start.index, 'auto')
    }
  })
  showUiTemporarily()
}

window.addEventListener('scroll', onScroll, { passive: true })
window.addEventListener('pointerdown', showUiTemporarily, { passive: true })

chaptersToggle.addEventListener('click', () => {
  chapterRail.hidden = !chapterRail.hidden
})
closeRail.addEventListener('click', () => {
  chapterRail.hidden = true
})
chapterRail.addEventListener('click', (e) => {
  if (e.target === chapterRail) chapterRail.hidden = true
})
contactNav.addEventListener('click', () => goToContact())

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault()
    if (onContact) return
    if (currentIndex >= spreadEls.length - 1) goToContact()
    else goToPage(currentIndex + 1)
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault()
    if (onContact) goToPage(spreadEls.length - 1)
    else goToPage(currentIndex - 1)
  }
  if (e.key === 'Escape') {
    chapterRail.hidden = true
  }
})

init()
