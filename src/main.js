const stage = document.getElementById('stage')
const bookWrap = document.getElementById('book-wrap')
const pageA = document.getElementById('page-a')
const pageB = document.getElementById('page-b')
const pageLabel = document.getElementById('page-label')
const chapterLabel = document.getElementById('chapter-label')
const prevBtn = document.getElementById('prev')
const nextBtn = document.getElementById('next')
const chaptersToggle = document.getElementById('chapters-toggle')
const fullscreenBtn = document.getElementById('fullscreen-btn')
const chapterRail = document.getElementById('chapter-rail')
const chapterList = document.getElementById('chapter-list')
const closeRail = document.getElementById('close-rail')
const installSheet = document.getElementById('install-sheet')
const installClose = document.getElementById('install-close')
const app = document.getElementById('app')

let manifest = null
let index = 0
let uiTimer = null
let scale = 1
let panX = 0
let panY = 0
let pointers = new Map()
let pinchStartDist = 0
let pinchStartScale = 1
let panStartX = 0
let panStartY = 0
let lastTap = 0
let swipeStartX = 0
let swipeStartY = 0
let swipeActive = false
const preloadCache = new Map()

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function applyTransform() {
  bookWrap.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`
}

function resetZoom() {
  scale = 1
  panX = 0
  panY = 0
  applyTransform()
}

function showUiTemporarily() {
  app.classList.remove('ui-hidden')
  clearTimeout(uiTimer)
  uiTimer = setTimeout(() => app.classList.add('ui-hidden'), 2800)
}

function chapterForPage(pageNum) {
  if (!manifest) return null
  let found = null
  for (const c of manifest.chapters) {
    if (pageNum >= c.page) found = c
  }
  return found
}

function preloadAround(i) {
  if (!manifest) return
  for (const offset of [-2, -1, 1, 2]) {
    const page = manifest.pages[i + offset]
    if (!page || preloadCache.has(page.src)) continue
    const img = new Image()
    img.src = page.src
    preloadCache.set(page.src, img)
  }
}

function setLeaf(el, { mode, src }) {
  el.classList.remove('is-left', 'is-right', 'is-full', 'is-blank')
  el.classList.add(mode)
  if (mode === 'is-blank' || !src) {
    el.style.backgroundImage = ''
    return
  }
  const absolute = new URL(src, window.location.href).href
  el.style.backgroundImage = `url("${absolute}")`
}

function renderSpread(page) {
  const src = page.src
  document.getElementById('book').classList.remove('is-cover')
  setLeaf(pageA, { mode: 'is-left', src })
  setLeaf(pageB, { mode: 'is-right', src })
}

function setPage(i, { reset = true } = {}) {
  if (!manifest) return
  index = clamp(i, 0, manifest.pages.length - 1)
  const page = manifest.pages[index]
  renderSpread(page)
  pageLabel.textContent = `${page.page} / ${manifest.pageCount}`
  const chapter = chapterForPage(page.page)
  chapterLabel.textContent = chapter ? `${chapter.label} · ${chapter.title}` : 'Cover'
  if (reset) resetZoom()
  updateChapterActive()
  preloadAround(index)
  history.replaceState(null, '', `#p=${page.page}`)
  showUiTemporarily()
}

function go(delta) {
  if (scale > 1.05) {
    resetZoom()
    return
  }
  setPage(index + delta)
}

function updateChapterActive() {
  const page = manifest.pages[index]
  const chapter = chapterForPage(page.page)
  for (const btn of chapterList.querySelectorAll('.chapter-btn')) {
    btn.classList.toggle('active', chapter && btn.dataset.id === chapter.id)
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
      setPage(c.page - 1)
      chapterRail.hidden = true
    })
    chapterList.appendChild(btn)
  }
}

function fitToVisualViewport() {
  const vv = window.visualViewport
  const height = vv ? Math.round(vv.height) : window.innerHeight
  const width = vv ? Math.round(vv.width) : window.innerWidth
  const top = vv ? Math.round(vv.offsetTop) : 0
  const left = vv ? Math.round(vv.offsetLeft) : 0
  app.style.width = `${width}px`
  app.style.height = `${height}px`
  app.style.transform = top || left ? `translate(${left}px, ${top}px)` : ''
  updateLayoutMode()
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

function isPortrait() {
  return window.innerWidth < window.innerHeight
}

function updateLayoutMode() {
  const portrait = isPortrait()
  document.documentElement.classList.toggle('is-portrait', portrait)
  document.documentElement.classList.toggle('is-landscape', !portrait)
}

function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null
  )
}

async function enterFullscreen() {
  const target = app
  try {
    if (target.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: 'hide' })
      return true
    }
    if (target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen()
      return true
    }
    if (target.webkitRequestFullScreen) {
      target.webkitRequestFullScreen()
      return true
    }
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      return true
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
    else if (document.webkitCancelFullScreen) document.webkitCancelFullScreen()
  } catch {
    /* ignore */
  }
}

function syncFullscreenUi() {
  const active = Boolean(getFullscreenElement()) || isStandalone()
  document.documentElement.classList.toggle('is-fullscreen', active)
  fullscreenBtn.classList.toggle('is-active', active)
  fullscreenBtn.textContent = active ? 'Exit full' : 'Full screen'
  fullscreenBtn.setAttribute('aria-pressed', active ? 'true' : 'false')
  fitToVisualViewport()
}

async function toggleFullscreen() {
  showUiTemporarily()
  if (getFullscreenElement()) {
    await exitFullscreen()
    syncFullscreenUi()
    return
  }
  if (isStandalone()) {
    syncFullscreenUi()
    return
  }
  if (isIos() && !document.fullscreenEnabled && !document.webkitFullscreenEnabled) {
    installSheet.hidden = false
    return
  }
  const ok = await enterFullscreen()
  if (!ok) {
    installSheet.hidden = false
    return
  }
  syncFullscreenUi()
}

function distance(a, b) {
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

function onPointerDown(e) {
  if (!installSheet.hidden || !chapterRail.hidden) return
  stage.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, e)
  showUiTemporarily()

  if (pointers.size === 1) {
    swipeActive = true
    swipeStartX = e.clientX
    swipeStartY = e.clientY
    panStartX = panX
    panStartY = panY

    const now = Date.now()
    if (now - lastTap < 280) {
      if (scale > 1.1) resetZoom()
      else {
        scale = 2.2
        panX = 0
        panY = 0
        applyTransform()
      }
      lastTap = 0
      swipeActive = false
      return
    }
    lastTap = now
  }

  if (pointers.size === 2) {
    swipeActive = false
    const [a, b] = [...pointers.values()]
    pinchStartDist = distance(a, b)
    pinchStartScale = scale
  }
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, e)

  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    const dist = distance(a, b)
    if (pinchStartDist > 0) {
      scale = clamp((dist / pinchStartDist) * pinchStartScale, 1, 4)
      if (scale <= 1.02) {
        scale = 1
        panX = 0
        panY = 0
      }
      applyTransform()
    }
    return
  }

  if (pointers.size === 1 && scale > 1.05) {
    panX = panStartX + (e.clientX - swipeStartX)
    panY = panStartY + (e.clientY - swipeStartY)
    applyTransform()
  }
}

function onPointerUp(e) {
  const wasSwipe = swipeActive && pointers.size === 1 && scale <= 1.05
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinchStartDist = 0
  if (!wasSwipe) return

  const dx = e.clientX - swipeStartX
  const dy = e.clientY - swipeStartY
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  if (isPortrait()) {
    if (absY > 48 && absY > absX * 1.15) go(dy < 0 ? 1 : -1)
  } else if (absX > 48 && absX > absY * 1.15) {
    go(dx < 0 ? 1 : -1)
  }
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

function resolveSrc(path) {
  if (!path) return path
  if (path.startsWith('http') || path.startsWith('data:')) return path
  const base = import.meta.env.BASE_URL || './'
  const clean = String(path).replace(/^\.\//, '').replace(/^\//, '')
  return `${base}${clean}`
}

async function init() {
  const res = await fetch(resolveSrc('manifest.json'))
  manifest = await res.json()
  for (const page of manifest.pages) {
    page.src = resolveSrc(page.src)
  }
  buildChapterRail()
  setPage(parseStartIndex())
  fitToVisualViewport()
  syncFullscreenUi()
  showUiTemporarily()
}

prevBtn.addEventListener('click', () => go(-1))
nextBtn.addEventListener('click', () => go(1))
fullscreenBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  toggleFullscreen()
})
chaptersToggle.addEventListener('click', () => {
  chapterRail.hidden = !chapterRail.hidden
})
closeRail.addEventListener('click', () => {
  chapterRail.hidden = true
})
chapterRail.addEventListener('click', (e) => {
  if (e.target === chapterRail) chapterRail.hidden = true
})
installClose.addEventListener('click', () => {
  installSheet.hidden = true
})
installSheet.addEventListener('click', (e) => {
  if (e.target === installSheet) installSheet.hidden = true
})

stage.addEventListener('pointerdown', onPointerDown)
stage.addEventListener('pointermove', onPointerMove)
stage.addEventListener('pointerup', onPointerUp)
stage.addEventListener('pointercancel', onPointerUp)
stage.addEventListener('lostpointercapture', onPointerUp)

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') go(1)
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(-1)
  if (e.key === 'Escape') {
    resetZoom()
    chapterRail.hidden = true
    installSheet.hidden = true
    if (getFullscreenElement()) exitFullscreen()
  }
  if (e.key.toLowerCase() === 'f') toggleFullscreen()
})

document.addEventListener('fullscreenchange', syncFullscreenUi)
document.addEventListener('webkitfullscreenchange', syncFullscreenUi)
window.addEventListener('orientationchange', fitToVisualViewport)
window.addEventListener('resize', fitToVisualViewport)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fitToVisualViewport)
  window.visualViewport.addEventListener('scroll', fitToVisualViewport)
}

init()
