const stage = document.getElementById('stage')
const spreadWrap = document.getElementById('spread-wrap')
const spread = document.getElementById('spread')
const pageLabel = document.getElementById('page-label')
const chapterLabel = document.getElementById('chapter-label')
const prevBtn = document.getElementById('prev')
const nextBtn = document.getElementById('next')
const chaptersToggle = document.getElementById('chapters-toggle')
const chapterRail = document.getElementById('chapter-rail')
const chapterList = document.getElementById('chapter-list')
const closeRail = document.getElementById('close-rail')
const rotateCue = document.getElementById('rotate-cue')
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
  spreadWrap.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`
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

function setPage(i, { reset = true } = {}) {
  if (!manifest) return
  index = clamp(i, 0, manifest.pages.length - 1)
  const page = manifest.pages[index]
  spread.src = page.src
  spread.alt = `RED ZONE spread ${page.page}`
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

function updateRotateCue() {
  const portrait = window.matchMedia('(orientation: portrait)').matches
  const narrow = window.innerWidth < 900
  rotateCue.hidden = !(portrait && narrow)
}

function distance(a, b) {
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

function onPointerDown(e) {
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
        scale = 2.4
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
    const dx = e.clientX - swipeStartX
    const dy = e.clientY - swipeStartY
    panX = panStartX + dx
    panY = panStartY + dy
    applyTransform()
  }
}

function onPointerUp(e) {
  const wasSwipe = swipeActive && pointers.size === 1 && scale <= 1.05
  const start = pointers.get(e.pointerId)
  pointers.delete(e.pointerId)

  if (pointers.size < 2) {
    pinchStartDist = 0
  }

  if (!wasSwipe || !start) return

  const dx = e.clientX - swipeStartX
  const dy = e.clientY - swipeStartY
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
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
  updateRotateCue()
  showUiTemporarily()
}

prevBtn.addEventListener('click', () => go(-1))
nextBtn.addEventListener('click', () => go(1))
chaptersToggle.addEventListener('click', () => {
  chapterRail.hidden = !chapterRail.hidden
})
closeRail.addEventListener('click', () => {
  chapterRail.hidden = true
})
chapterRail.addEventListener('click', (e) => {
  if (e.target === chapterRail) chapterRail.hidden = true
})

stage.addEventListener('pointerdown', onPointerDown)
stage.addEventListener('pointermove', onPointerMove)
stage.addEventListener('pointerup', onPointerUp)
stage.addEventListener('pointercancel', onPointerUp)
stage.addEventListener('lostpointercapture', onPointerUp)

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ') go(1)
  if (e.key === 'ArrowLeft') go(-1)
  if (e.key === 'Escape') {
    resetZoom()
    chapterRail.hidden = true
  }
})

window.addEventListener('orientationchange', updateRotateCue)
window.addEventListener('resize', updateRotateCue)

init()
