const stack = document.getElementById('stack')
const pageLabel = document.getElementById('page-label')
const chapterLabel = document.getElementById('chapter-label')
const chaptersToggle = document.getElementById('chapters-toggle')
const fullscreenBtn = document.getElementById('fullscreen-btn')
const chapterRail = document.getElementById('chapter-rail')
const chapterList = document.getElementById('chapter-list')
const closeRail = document.getElementById('close-rail')
const installSheet = document.getElementById('install-sheet')
const installClose = document.getElementById('install-close')
const app = document.getElementById('app')

let manifest = null
let currentIndex = 0
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
  currentIndex = index
  const page = manifest.pages[index]
  pageLabel.textContent = `${page.page} / ${manifest.pageCount}`
  const chapter = chapterForPage(page.page)
  chapterLabel.textContent = chapter ? `${chapter.label} · ${chapter.title}` : 'Cover'
  history.replaceState(null, '', `#p=${page.page}`)
  for (const btn of chapterList.querySelectorAll('.chapter-btn')) {
    btn.classList.toggle('active', chapter && btn.dataset.id === chapter.id)
  }
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

function syncFromScroll() {
  const top = window.scrollY + window.innerHeight * 0.2
  let active = 0
  for (let i = 0; i < spreadEls.length; i += 1) {
    const el = spreadEls[i]
    if (el.offsetTop <= top) active = i
    else break
  }
  if (active !== currentIndex) updateLabels(active)
}

function onScroll() {
  showUiTemporarily()
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(syncFromScroll)
}

function parseStartIndex() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const params = new URLSearchParams(location.search)
  const chapter = params.get('c') || hash.get('c')
  if (chapter) {
    const id = chapter.padStart(2, '0')
    const found = manifest.chapters.find((c) => c.id === id || c.label.startsWith(id))
    if (found) return found.page - 1
  }
  const page = Number(params.get('p') || hash.get('p') || 1)
  if (Number.isFinite(page) && page >= 1) return page - 1
  return 0
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  )
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null
}

function fullscreenEnabled() {
  return Boolean(
    document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.documentElement.requestFullscreen ||
      document.documentElement.webkitRequestFullscreen
  )
}

async function enterFullscreen() {
  const target = document.documentElement
  try {
    if (target.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: 'hide' })
      return Boolean(getFullscreenElement())
    }
    if (target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen()
      return true
    }
    if (app.requestFullscreen) {
      await app.requestFullscreen({ navigationUI: 'hide' })
      return Boolean(getFullscreenElement())
    }
  } catch {
    return false
  }
  return false
}

async function exitFullscreen() {
  try {
    if (document.exitFullscreen) await document.exitFullscreen()
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
  } catch {
    /* ignore */
  }
}

/** Nudge document scroll so Safari collapses its chrome (best-effort). */
function collapseSafariChrome() {
  const y = window.scrollY
  window.scrollTo(0, y + 1)
  requestAnimationFrame(() => {
    window.scrollTo(0, y + 2)
  })
}

function syncFullscreenUi() {
  const active = Boolean(getFullscreenElement()) || isStandalone()
  document.documentElement.classList.toggle('is-immersive', active)
  fullscreenBtn.classList.toggle('is-active', active)
  fullscreenBtn.textContent = active ? 'Exit full' : 'Full screen'
  fullscreenBtn.setAttribute('aria-pressed', active ? 'true' : 'false')
}

async function toggleFullscreen() {
  showUiTemporarily()

  if (getFullscreenElement()) {
    await exitFullscreen()
    syncFullscreenUi()
    return
  }

  // Already launched from Home Screen → already full screen
  if (isStandalone()) {
    syncFullscreenUi()
    return
  }

  // Try real Fullscreen API (Android / desktop / some newer iOS)
  if (fullscreenEnabled()) {
    const ok = await enterFullscreen()
    if (ok && getFullscreenElement()) {
      syncFullscreenUi()
      return
    }
  }

  // iPhone Safari tab: cannot fully hide chrome — guide Home Screen install.
  // Also scroll-nudge so the address bar at least shrinks.
  collapseSafariChrome()
  if (isIos()) {
    installSheet.hidden = false
  } else {
    installSheet.hidden = false
  }
  syncFullscreenUi()
}

async function init() {
  const res = await fetch(resolveSrc('manifest.json'))
  manifest = await res.json()
  for (const page of manifest.pages) {
    page.src = resolveSrc(page.src)
  }
  buildStack()
  buildChapterRail()
  syncFullscreenUi()

  if (isStandalone()) {
    document.documentElement.classList.add('is-immersive')
  }

  const start = parseStartIndex()
  updateLabels(start)
  requestAnimationFrame(() => goToPage(start, 'auto'))
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
fullscreenBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  toggleFullscreen()
})
installClose.addEventListener('click', () => {
  installSheet.hidden = true
  collapseSafariChrome()
})
installSheet.addEventListener('click', (e) => {
  if (e.target === installSheet) installSheet.hidden = true
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault()
    goToPage(currentIndex + 1)
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault()
    goToPage(currentIndex - 1)
  }
  if (e.key === 'Escape') {
    chapterRail.hidden = true
    installSheet.hidden = true
    if (getFullscreenElement()) exitFullscreen()
  }
  if (e.key.toLowerCase() === 'f') toggleFullscreen()
})

document.addEventListener('fullscreenchange', syncFullscreenUi)
document.addEventListener('webkitfullscreenchange', syncFullscreenUi)

init()
