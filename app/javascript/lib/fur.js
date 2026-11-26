/*
 * Fur. Draws a coat of fur on any shape: folder, card, heart, a custom SVG
 * path, or a line of text. It's all tiny curved strands stroked onto one
 * canvas, plus a fringe around the edge so it reads as fur and not noise.
 * No images, no textures, no deps.
 *
 * Port vanilla JS du composant React fur.tsx : toute la logique est identique,
 * seul le composant <Fur> est devenu la fonction mountFur(el, opts), qui
 * renvoie une fonction de nettoyage.
 *
 * The shape gets rasterized to an alpha mask once. Inside checks are array
 * lookups and the fringe comes from walking the mask boundary (that's how
 * text grows fur, even inside letter holes).
 *
 * You can pet it. Drag over it and the strands bend, then spring back. The
 * loop only runs while something is still moving, so idle fur is free.
 */

// strand storage: one flat Float32Array, STRIDE floats per strand:
//   [x, y, a (rest angle), len, bend, d (pet deflection), v (deflection vel)]
// colour/width live on the buckets so strokes batch.
const STRIDE = 7

const CELL = 48
const SVG_NS = "http://www.w3.org/2000/svg"
// spring constants for the pet deflection (per 60fps frame)
const SPRING = 0.10
const DAMP = 0.88
const SETTLED = 0.004

function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// module-level caches, shared across every Fur instance

let hslProbe = null

/** normalize any CSS colour to HSL using the canvas fillStyle parser. */
function toHsl(color) {
  if (!hslProbe) {
    const cv = document.createElement("canvas")
    cv.width = cv.height = 1
    hslProbe = cv.getContext("2d")
  }
  const x = hslProbe
  x.fillStyle = "#000"
  x.fillStyle = color
  const std = x.fillStyle
  let r = 0
  let g = 0
  let b = 0
  if (std.startsWith("#")) {
    r = parseInt(std.slice(1, 3), 16)
    g = parseInt(std.slice(3, 5), 16)
    b = parseInt(std.slice(5, 7), 16)
  } else {
    const m = std.match(/[\d.]+/g)
    if (m) [r, g, b] = [Number(m[0]), Number(m[1]), Number(m[2])]
  }
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const dlt = max - min
  const s = l > 0.5 ? dlt / (2 - max - min) : dlt / (max + min)
  let h
  if (max === r) h = ((g - b) / dlt + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / dlt + 2) / 6
  else h = ((r - g) / dlt + 4) / 6
  return [h * 360, s * 100, l * 100]
}

function hsl(h, s, l, a = 1) {
  return `hsl(${h.toFixed(1)} ${Math.max(0, Math.min(100, s)).toFixed(1)}% ${Math.max(0, Math.min(98, l)).toFixed(1)}% / ${a})`
}

/** folder shape: tab top-left, slanted shoulder, rounded body. */
function folderD(w, h) {
  const r = Math.min(w, h) * 0.07
  const rt = r * 0.8
  const tabW = w * 0.4
  const tabH = h * 0.16
  const sl = tabH * 0.55
  return [
    `M 0 ${h - r}`,
    `L 0 ${rt}`,
    `Q 0 0 ${rt} 0`,
    `L ${tabW - rt} 0`,
    `Q ${tabW} 0 ${tabW + sl * 0.45} ${tabH * 0.45}`,
    `L ${tabW + sl} ${tabH * 0.82}`,
    `Q ${tabW + sl * 1.6} ${tabH} ${tabW + sl * 2.2} ${tabH}`,
    `L ${w - r} ${tabH}`,
    `Q ${w} ${tabH} ${w} ${tabH + r}`,
    `L ${w} ${h - r}`,
    `Q ${w} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`,
    `Q 0 ${h} 0 ${h - r}`,
    "Z",
  ].join(" ")
}

function cardD(w, h) {
  const r = Math.min(w, h) * 0.12
  return [
    `M ${r} 0`,
    `L ${w - r} 0`,
    `Q ${w} 0 ${w} ${r}`,
    `L ${w} ${h - r}`,
    `Q ${w} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`,
    `Q 0 ${h} 0 ${h - r}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0`,
    "Z",
  ].join(" ")
}

function heartD(w, h) {
  const X = (v) => (v * w).toFixed(2)
  const Y = (v) => (v * h).toFixed(2)
  return [
    `M ${X(0.5)} ${Y(0.3)}`,
    `C ${X(0.5)} ${Y(0.14)} ${X(0.38)} ${Y(0.05)} ${X(0.26)} ${Y(0.05)}`,
    `C ${X(0.1)} ${Y(0.05)} ${X(0.02)} ${Y(0.18)} ${X(0.02)} ${Y(0.33)}`,
    `C ${X(0.02)} ${Y(0.58)} ${X(0.25)} ${Y(0.78)} ${X(0.5)} ${Y(0.96)}`,
    `C ${X(0.75)} ${Y(0.78)} ${X(0.98)} ${Y(0.58)} ${X(0.98)} ${Y(0.33)}`,
    `C ${X(0.98)} ${Y(0.18)} ${X(0.9)} ${Y(0.05)} ${X(0.74)} ${Y(0.05)}`,
    `C ${X(0.62)} ${Y(0.05)} ${X(0.5)} ${Y(0.14)} ${X(0.5)} ${Y(0.3)}`,
    "Z",
  ].join(" ")
}

const TEXT_FONT = `ui-rounded, 'Hiragino Maru Gothic ProN', Quicksand, 'Segoe UI', system-ui, sans-serif`

/** bounding box of a path, measured with a throwaway SVG element so
 *  getBBox handles relative commands and odd coordinates. cached per
 *  d-string so any path auto-fits without the caller passing a pathBox. */
const bboxCache = new Map()

function getPathBBox(d) {
  const hit = bboxCache.get(d)
  if (hit) return hit
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"
  const el = document.createElementNS(SVG_NS, "path")
  el.setAttribute("d", d)
  svg.appendChild(el)
  document.body.appendChild(svg)
  let box
  try {
    box = el.getBBox()
  } finally {
    svg.remove()
  }
  if (bboxCache.size > 24) bboxCache.clear()
  bboxCache.set(d, box)
  return box
}

// a silhouette is an alpha mask, the canvas it was drawn on (reused as the
// stencil for the base coat), and its boundary with outward normals. walking
// the mask boundary instead of an SVG path is what lets text with letter
// holes grow a fringe, and it never touches the DOM so rebuilds stay cheap.
// cached per key.
//   { mask, stencil, solidStencil, peri: [{ x, y, nx, ny, hole }], insideCount }

const silCache = new Map()

function getSilhouette(key, w, h, draw) {
  const hit = silCache.get(key)
  if (hit) return hit
  const cv = document.createElement("canvas")
  cv.width = Math.max(1, w)
  cv.height = Math.max(1, h)
  const ctx = cv.getContext("2d", { willReadFrequently: true })
  ctx.fillStyle = "#000"
  draw(ctx)
  const mask = ctx.getImageData(0, 0, cv.width, cv.height).data
  const W = cv.width
  const H = cv.height
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[(y * w + x) * 4 + 3])

  // flood fill "outside" from the border through transparent pixels. anything
  // not reached is interior, either shape or a hole. run before the perimeter
  // scan so each boundary pixel can tell an outer edge from a hole.
  const outside = new Uint8Array(W * H)
  const stack = []
  const pushIf = (i) => {
    if (i >= 0 && i < W * H && !outside[i] && mask[i * 4 + 3] <= 8) {
      outside[i] = 1
      stack.push(i)
    }
  }
  for (let x = 0; x < W; x++) {
    pushIf(x)
    pushIf((H - 1) * W + x)
  }
  for (let y = 0; y < H; y++) {
    pushIf(y * W)
    pushIf(y * W + W - 1)
  }
  while (stack.length) {
    const i = stack.pop()
    const x = i % W
    if (x > 0) pushIf(i - 1)
    if (x < W - 1) pushIf(i + 1)
    pushIf(i - W)
    pushIf(i + W)
  }
  const isOutside = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? true : outside[y * W + x] === 1)

  const peri = []
  let insideCount = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (at(x, y) <= 8) continue
      insideCount++
      const l = at(x - 1, y) > 8
      const r = at(x + 1, y) > 8
      const u = at(x, y - 1) > 8
      const dn = at(x, y + 1) > 8
      if (l && r && u && dn) continue
      // outward normal points at the missing neighbours
      const nx = (l ? 0 : -1) + (r ? 0 : 1)
      const ny = (u ? 0 : -1) + (dn ? 0 : 1)
      if (!nx && !ny) continue
      const m = Math.hypot(nx, ny)
      // probe a couple px along the normal. lands in true outside means
      // outer edge; lands in a not-outside gap means rim of an interior hole
      const hole = !isOutside(Math.round(x + (nx / m) * 2), Math.round(y + (ny / m) * 2))
      peri.push({ x, y, nx: nx / m, ny: ny / m, hole })
    }
  }

  const solidCv = document.createElement("canvas")
  solidCv.width = W
  solidCv.height = H
  const sctx = solidCv.getContext("2d")
  const solidImg = sctx.createImageData(W, H)
  const sd = solidImg.data
  for (let i = 0; i < W * H; i++) {
    if (!outside[i]) {
      sd[i * 4] = sd[i * 4 + 1] = sd[i * 4 + 2] = 0
      sd[i * 4 + 3] = 255
    }
  }
  sctx.putImageData(solidImg, 0, 0)

  if (silCache.size > 8) {
    const oldest = silCache.keys().next().value
    if (oldest !== undefined) silCache.delete(oldest)
  }
  const sil = { mask, stencil: cv, solidStencil: solidCv, peri, insideCount }
  silCache.set(key, sil)
  return sil
}

// palette sizes per layer (under / mid / highlight)
const N0 = 10
const N1 = 12
const N2 = 8
const NBUCKETS = N0 + N1 + N2

function buildCoat(w, h, opts, prev) {
  const rng = mulberry32(opts.seed)
  const [bh, bs, bl] = toHsl(opts.color)

  // resolve the shape in element px
  let sil
  if (opts.text) {
    const text = opts.text
    sil = getSilhouette(`t|${text}|${w}x${h}`, w, h, (c) => {
      // a little letter-spacing keeps glyphs from merging once the fringe
      // grows around them. the 0.9 width fit leaves some room
      try {
        c.letterSpacing = `${Math.round(h * 0.04)}px`
      } catch {
        /* older browsers: no letter-spacing, still legible */
      }
      c.font = `900 100px ${TEXT_FONT}`
      const tw = Math.max(1, c.measureText(text).width)
      const size = Math.min(((w * 0.9) / tw) * 100, h * 0.86)
      c.font = `900 ${size.toFixed(1)}px ${TEXT_FONT}`
      c.textAlign = "center"
      c.textBaseline = "middle"
      c.fillText(text, w / 2, h / 2)
    })
  } else if (opts.path) {
    // custom path: auto-fit and centre it, keeping aspect. pathBox is used
    // if given (scale to that box from origin), otherwise the measured bbox
    // drives the fit so a path at any coordinates works.
    const d = opts.path
    let m
    if (opts.pathBox) {
      m = new DOMMatrix([w / opts.pathBox.width, 0, 0, h / opts.pathBox.height, 0, 0])
    } else {
      const bb = getPathBBox(d)
      const pad = 0.92
      const sc = Math.min((w * pad) / bb.width, (h * pad) / bb.height)
      m = new DOMMatrix([sc, 0, 0, sc, (w - bb.width * sc) / 2 - bb.x * sc, (h - bb.height * sc) / 2 - bb.y * sc])
    }
    sil = getSilhouette(`p|${d}|${w}x${h}`, w, h, (c) => {
      const scaled = new Path2D()
      scaled.addPath(new Path2D(d), m)
      c.fill(scaled) // nonzero fill so overlapping subpaths read solid
    })
  } else {
    const d = opts.shape === "card" ? cardD(w, h) : opts.shape === "heart" ? heartD(w, h) : folderD(w, h)
    sil = getSilhouette(`s|${d}|${w}x${h}`, w, h, (c) => c.fill(new Path2D(d)))
  }
  const mask = sil.mask
  const inside = (x, y) => {
    const xi = x | 0
    const yi = y | 0
    return xi >= 0 && yi >= 0 && xi < w && yi < h && mask[(yi * w + xi) * 4 + 3] > 8
  }

  const minDim = Math.min(w, h)
  // text wears shorter fur. long strands swallow the letters, so keep the
  // pile reading as a coat on the glyphs instead of burying them
  const lenScale = opts.text ? 0.62 : 1
  const baseLen = Math.max(4, Math.min(22, minDim * 0.06)) * opts.fluff * lenScale
  const bleed = Math.ceil(baseLen * 1.6) + 4
  const mess = Math.max(0, Math.min(1, opts.mess))
  const headroom = Math.max(6, 94 - bl)

  // direction field: combed down and out from a cowlick near the top, the
  // way pile fur lies on an upright surface. two slow sine fields give it the
  // wave of a brushed coat. jitter stays small so it reads combed, and mess
  // turns that back up.
  const cowX = w * (0.46 + rng() * 0.08)
  const cowY = h * 0.28
  // clumpScale > 1 : ondulations plus larges (texture moins répétitive)
  const clumpScale = opts.clumpScale || 1
  const f1 = (0.035 + rng() * 0.02) / clumpScale
  const f2 = (0.03 + rng() * 0.02) / clumpScale
  const p1 = rng() * Math.PI * 2
  const p2 = rng() * Math.PI * 2
  const restAngle = (x, y) => {
    const fromCow = Math.atan2(y - cowY, x - cowX)
    const clump = (Math.sin(x * f1 + p1) + Math.cos(y * f2 + p2)) * 0.3
    const dn = Math.PI / 2
    let a = fromCow + (((dn - fromCow + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 0.5
    a += clump * (0.5 + mess) + (rng() - 0.5) * (0.3 + mess * 1.6)
    return a
  }

  // tuft shadows and sheen spots, the depth pockets where pile parts. these
  // sit under the strands and do most of the work making it read plush.
  const blots = []
  const blotCount = Math.round(sil.insideCount / 1800)
  let blotTries = blotCount * 6
  while (blots.length < blotCount && blotTries-- > 0) {
    const x = rng() * w
    const y = rng() * h
    if (!inside(x, y)) continue
    const dark = rng() < 0.68
    blots.push({
      x,
      y,
      r: baseLen * (1.3 + rng() * 1.6),
      c: dark
        ? hsl(bh + (rng() - 0.5) * 4, bs + 8, bl - 18 - rng() * 8, 0.16)
        : hsl(bh, bs * 0.9, bl + headroom * 0.2, 0.11),
    })
  }

  // capacity and reusable buffers. density counts strands per px2 of actual
  // shape area, so text (which fills a fraction of its box) gets the same
  // pile as a solid folder
  const interior = Math.min(20000, Math.round(sil.insideCount * 0.16 * opts.density))
  const densityClamped = Math.max(0.5, Math.min(1.5, opts.density))
  const stride = 1.4 / densityClamped
  const edgeMax = Math.ceil(sil.peri.length / (stride * 0.7)) + 4
  const cap = interior + edgeMax

  let S
  let order
  if (prev && prev.S.length >= cap * STRIDE) {
    S = prev.S
    order = prev.order.length >= cap ? prev.order : new Int32Array(cap)
  } else {
    S = new Float32Array(cap * STRIDE)
    order = new Int32Array(cap)
  }
  // scratch: which bucket each strand is in, rebuilt every time
  const bucketOf = new Uint8Array(cap)

  // palettes. the whole coat stays in a narrow lightness band around the
  // base; wide bands read as tinsel. shadows go saturated, tips lighten only
  // into the headroom so pale coats don't blow out. a few variants per layer
  // look the same as per-strand jitter and let same-colour strands stroke as
  // one path.
  const palC = []
  const palTip = []
  const palW = []
  // strandWidth > 1 : poils plus épais
  const sw = opts.strandWidth || 1
  for (let v = 0; v < N0; v++) {
    palC.push(hsl(bh + (rng() - 0.5) * 5, bs + 6, bl - 12 - rng() * 9, 0.6))
    palTip.push("")
    palW.push((1.5 + rng() * 1.1) * sw)
  }
  for (let v = 0; v < N1; v++) {
    const jh = bh + (rng() - 0.5) * 5
    const js = bs + (rng() - 0.5) * 8
    const l = bl - 5 + rng() * 8
    palC.push(hsl(jh, js, l, 0.8))
    palTip.push(hsl(jh, js * 0.92, l + headroom * (0.12 + rng() * 0.1), 0.8))
    palW.push((0.8 + rng() * 0.6) * sw)
  }
  for (let v = 0; v < N2; v++) {
    palC.push(hsl(bh + (rng() - 0.5) * 5, (bs + (rng() - 0.5) * 8) * 0.85, bl + headroom * (0.25 + rng() * 0.12), 0.55))
    palTip.push("")
    palW.push((0.6 + rng() * 0.5) * sw)
  }

  // strands, written straight into the flat buffer
  let count = 0
  const place = (x, y, a, edge, lenMul = 1) => {
    const roll = rng()
    const layer = roll < 0.4 ? 0 : roll < 0.92 ? 1 : 2
    let len = baseLen * (0.7 + rng() * 0.6) * (edge ? 0.9 : 1) * (layer === 0 ? 0.8 : 1) * lenMul
    // interior strands shouldn't stray onto a pad or past the rim, so pull
    // the tip back inside the shape to keep pad edges crisp. only the outer
    // fringe is allowed past the boundary. cheap: a couple of mask lookups,
    // and only edge-adjacent strands actually shorten.
    if (!edge) {
      const dx = Math.cos(a)
      const dy = Math.sin(a)
      let guard = 0
      while (len > baseLen * 0.3 && !inside(x + dx * len, y + dy * len) && guard++ < 6) {
        len *= 0.78
      }
    }
    const o = count * STRIDE
    S[o] = x
    S[o + 1] = y
    S[o + 2] = a
    S[o + 3] = len
    S[o + 4] = (rng() - 0.5) * len * (0.7 + mess * 0.7)
    S[o + 5] = 0
    S[o + 6] = 0
    bucketOf[count] =
      layer === 0 ? (rng() * N0) | 0 : layer === 1 ? N0 + ((rng() * N1) | 0) : N0 + N1 + ((rng() * N2) | 0)
    count++
  }

  // interior roots, rejection sampled against the mask. a plush pile is many
  // fine hairs, not a few bold ones, so go dense. the attempt budget scales
  // with how little of the box the shape covers.
  const coverage = Math.max(0.05, sil.insideCount / (w * h))
  let attempts = Math.ceil((interior / coverage) * 1.6)
  let placed = 0
  while (placed < interior && attempts-- > 0) {
    const x = rng() * w
    const y = rng() * h
    if (inside(x, y)) {
      place(x, y, restAngle(x, y), false)
      placed++
    }
  }

  // edge fringe, rooted on the boundary, pointing out along the normal but
  // drooping toward gravity. short and dense so the shape keeps its outline
  // with a soft halo instead of going tinsel. hole rims (pads) get only
  // short sparse wisps pointing inward, a few tufts over the pad edge rather
  // than a long fringe that would bury them.
  const fringePad = !!opts.padColor
  for (let fi = rng() * stride; fi < sil.peri.length && count < cap; fi += stride * (0.7 + rng() * 0.6)) {
    const p = sil.peri[fi | 0]
    const padRim = fringePad && p.hole
    if (padRim && rng() > 0.32) continue
    const out = Math.atan2(p.ny, p.nx)
    const dn = Math.PI / 2
    let a = out + (((dn - out + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 0.25
    a += (rng() - 0.5) * (0.35 + mess * (padRim ? 1.6 : 1.1))
    place(p.x, p.y, a, true, padRim ? 0.5 : 1)
  }

  // group strands by bucket with a counting sort, no per-strand pushes
  const bucketCount = new Int32Array(NBUCKETS)
  for (let i = 0; i < count; i++) bucketCount[bucketOf[i]]++
  const bucketStart = new Int32Array(NBUCKETS)
  let acc = 0
  for (let b = 0; b < NBUCKETS; b++) {
    bucketStart[b] = acc
    acc += bucketCount[b]
  }
  const cursor = bucketStart.slice()
  for (let i = 0; i < count; i++) order[cursor[bucketOf[i]]++] = i

  // draw order: undercoat (baked), midcoat bodies, lit tips, highlights
  // bucket = { c, w, tip, under, start, end }
  const buckets = []
  for (let v = 0; v < N0; v++) {
    if (bucketCount[v]) buckets.push({ c: palC[v], w: palW[v], tip: false, under: true, start: bucketStart[v], end: bucketStart[v] + bucketCount[v] })
  }
  for (let v = N0; v < N0 + N1; v++) {
    if (bucketCount[v]) buckets.push({ c: palC[v], w: palW[v], tip: false, under: false, start: bucketStart[v], end: bucketStart[v] + bucketCount[v] })
  }
  for (let v = N0; v < N0 + N1; v++) {
    if (bucketCount[v]) buckets.push({ c: palTip[v], w: palW[v] * 0.8, tip: true, under: false, start: bucketStart[v], end: bucketStart[v] + bucketCount[v] })
  }
  for (let v = N0 + N1; v < NBUCKETS; v++) {
    if (bucketCount[v]) buckets.push({ c: palC[v], w: palW[v], tip: false, under: false, start: bucketStart[v], end: bucketStart[v] + bucketCount[v] })
  }

  // coarse spatial grid for pointer lookup. only dynamic strands go in; the
  // undercoat is baked into the base and can't be petted, which also makes
  // each pet frame about 40% cheaper. cells are reused when possible.
  const cols = Math.max(1, Math.ceil((w + bleed * 2) / CELL))
  const rows = Math.max(1, Math.ceil((h + bleed * 2) / CELL))
  let grid
  if (prev && prev.cols === cols && prev.rows === rows) {
    grid = prev.grid
    for (const cellArr of grid) cellArr.length = 0
  } else {
    grid = Array.from({ length: cols * rows }, () => [])
  }
  for (let i = 0; i < count; i++) {
    if (bucketOf[i] < N0) continue // undercoat: static
    const o = i * STRIDE
    const rch = S[o + 3] + Math.abs(S[o + 4]) + 2
    const x0 = Math.max(0, Math.floor((S[o] - rch + bleed) / CELL))
    const x1 = Math.min(cols - 1, Math.floor((S[o] + rch + bleed) / CELL))
    const y0 = Math.max(0, Math.floor((S[o + 1] - rch + bleed) / CELL))
    const y1 = Math.min(rows - 1, Math.floor((S[o + 1] + rch + bleed) / CELL))
    for (let gy = y0; gy <= y1; gy++)
      for (let gx = x0; gx <= x1; gx++) grid[gy * cols + gx].push(i)
  }

  return { S, count, order, buckets, stencil: sil.stencil, solidStencil: sil.solidStencil, padColor: opts.padColor ?? null, grid, cols, rows, cell: CELL, bleed, w, h, base: [bh, bs, bl], blots }
}

/** bare-skin pads: the filled shape painted in padColor with a vertical
 *  shade so the pads read as rounded skin rather than flat fills. */
function drawPads(ctx, coat, padColor) {
  const [ph, ps, pl] = toHsl(padColor)
  ctx.drawImage(coat.solidStencil, 0, 0, coat.w, coat.h)
  ctx.globalCompositeOperation = "source-atop"
  const g = ctx.createLinearGradient(0, 0, 0, coat.h)
  g.addColorStop(0, hsl(ph, ps, pl + 6))
  g.addColorStop(1, hsl(ph, ps + 4, pl - 12))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, coat.w, coat.h)
  ctx.globalCompositeOperation = "source-over"
}

function drawBase(ctx, coat) {
  const [bh, bs, bl] = coat.base
  ctx.drawImage(coat.stencil, 0, 0, coat.w, coat.h)
  ctx.globalCompositeOperation = "source-atop"
  const g = ctx.createLinearGradient(0, 0, 0, coat.h)
  g.addColorStop(0, hsl(bh, bs * 0.9, bl - 8))
  g.addColorStop(1, hsl(bh, bs * 0.95, bl - 20))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, coat.w, coat.h)
  for (const b of coat.blots) {
    const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
    rg.addColorStop(0, b.c)
    rg.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = rg
    ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2)
  }
  // belly light: a soft glow up top so the coat reads round
  const r = Math.max(coat.w, coat.h) * 0.55
  const rg = ctx.createRadialGradient(coat.w / 2, coat.h * 0.42, r * 0.1, coat.w / 2, coat.h * 0.42, r)
  rg.addColorStop(0, "rgba(255,255,255,0.14)")
  rg.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, coat.w, coat.h)
  ctx.globalCompositeOperation = "source-over"
}

/** stroke one tier of buckets. under = the baked base pass, the rest are
 *  live frames. */
function strokeBuckets(ctx, coat, under) {
  ctx.lineCap = "round"
  const S = coat.S
  const order = coat.order
  for (const b of coat.buckets) {
    if (b.under !== under) continue
    ctx.strokeStyle = b.c
    ctx.lineWidth = b.w
    ctx.beginPath()
    if (b.tip) {
      for (let k = b.start; k < b.end; k++) {
        const o = order[k] * STRIDE
        const x = S[o]
        const y = S[o + 1]
        const len = S[o + 3]
        const a = S[o + 2] + S[o + 5]
        const ca = S[o + 2] + S[o + 5] * 0.55
        const cxp = x + Math.cos(ca) * len * 0.55 - Math.sin(ca) * S[o + 4]
        const cyp = y + Math.sin(ca) * len * 0.55 + Math.cos(ca) * S[o + 4]
        const tx = x + Math.cos(a) * len
        const ty = y + Math.sin(a) * len
        // the quad midpoint at t=0.5, restroke only the lit outer half
        ctx.moveTo((x + 2 * cxp + tx) / 4, (y + 2 * cyp + ty) / 4)
        ctx.quadraticCurveTo((cxp + tx) / 2, (cyp + ty) / 2, tx, ty)
      }
    } else {
      for (let k = b.start; k < b.end; k++) {
        const o = order[k] * STRIDE
        const x = S[o]
        const y = S[o + 1]
        const len = S[o + 3]
        const a = S[o + 2] + S[o + 5]
        const ca = S[o + 2] + S[o + 5] * 0.55
        const cxp = x + Math.cos(ca) * len * 0.55 - Math.sin(ca) * S[o + 4]
        const cyp = y + Math.sin(ca) * len * 0.55 + Math.cos(ca) * S[o + 4]
        ctx.moveTo(x, y)
        ctx.quadraticCurveTo(cxp, cyp, x + Math.cos(a) * len, y + Math.sin(a) * len)
      }
    }
    ctx.stroke()
  }
}

/** repaint the live coat. always full; partial clipped repaints leave
 *  hairline seams. the base (undercoat baked in) just blits. */
function paint(ctx, coat, base) {
  ctx.clearRect(-coat.bleed, -coat.bleed, coat.w + coat.bleed * 2, coat.h + coat.bleed * 2)
  ctx.drawImage(base, -coat.bleed, -coat.bleed, coat.w + coat.bleed * 2, coat.h + coat.bleed * 2)
  strokeBuckets(ctx, coat, false)
}

/**
 * Pose un pelage sur l'élément `wrap` (qui doit avoir une taille).
 * Remplace le composant React <Fur> : même options, mêmes valeurs par défaut.
 *
 * opts: { color, shape: 'folder'|'card'|'heart', path, pathBox: {width, height},
 *         text, fluff, density, mess, seed, padColor, pettable,
 *         strandWidth (épaisseur des poils, 1 par défaut),
 *         clumpScale (taille des ondulations du pelage, 1 par défaut) }
 *
 * Renvoie une fonction de nettoyage (retire le canvas et les écouteurs).
 */
export function mountFur(wrap, opts = {}) {
  const {
    color = "#f5a8c9",
    shape = "folder",
    path,
    pathBox,
    text,
    fluff = 1,
    density = 1,
    mess = 0.5,
    seed = 7,
    padColor,
    pettable = true,
    strandWidth = 1,
    clumpScale = 1,
  } = opts

  // remplace le <canvas> que rendait le composant React
  const canvas = document.createElement("canvas")
  canvas.className = "fur-canvas"
  canvas.setAttribute("aria-hidden", "true")
  wrap.classList.add("fur")
  wrap.appendChild(canvas)

  // plain context. a desynchronized one shaves input latency on chromium
  // but on some mobile browsers it composites as opaque black until the
  // first user repaint, which flashes a black box behind the fur
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    canvas.remove()
    return () => {}
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  let coat = null
  let baseCv = null
  let raf = 0
  let running = false
  let lastT = 0
  // strands currently springing back, by index
  const active = new Set()
  let lastPX = null
  let lastPY = null

  let lastW = 0
  let lastH = 0
  const rebuild = () => {
    // offsetWidth/Height plutôt que getBoundingClientRect : on veut la taille
    // de mise en page, sans les transform (scale au survol, bouton enfoncé…)
    const w = Math.round(wrap.offsetWidth)
    const h = Math.round(wrap.offsetHeight)
    if (w < 4 || h < 4) return
    lastW = w
    lastH = h
    coat = buildCoat(w, h, { color, shape, path, pathBox, text, fluff, density, mess, seed, padColor, strandWidth, clumpScale }, coat)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const bw = (w + coat.bleed * 2) * dpr
    const bhh = (h + coat.bleed * 2) * dpr
    // setting canvas.width reallocates the backing store, skip if unchanged
    if (canvas.width !== bw || canvas.height !== bhh) {
      canvas.width = bw
      canvas.height = bhh
      canvas.style.inset = `${-coat.bleed}px`
      canvas.style.width = `${w + coat.bleed * 2}px`
      canvas.style.height = `${h + coat.bleed * 2}px`
    }
    ctx.setTransform(dpr, 0, 0, dpr, coat.bleed * dpr, coat.bleed * dpr)
    // pre-render base and undercoat once. pet frames blit it back and
    // restroke only the top coat
    if (!baseCv || baseCv.width !== bw || baseCv.height !== bhh) {
      baseCv = document.createElement("canvas")
      baseCv.width = bw
      baseCv.height = bhh
    }
    const bctx = baseCv.getContext("2d")
    bctx.setTransform(dpr, 0, 0, dpr, coat.bleed * dpr, coat.bleed * dpr)
    bctx.clearRect(-coat.bleed, -coat.bleed, w + coat.bleed * 2, h + coat.bleed * 2)
    if (coat.padColor) {
      // pads fill the holes, the coat composites over them (transparent in
      // the holes) so the pads show through and the fringe overlaps their
      // edges, like a real paw
      drawPads(bctx, coat, coat.padColor)
      const tmp = document.createElement("canvas")
      tmp.width = bw
      tmp.height = bhh
      const tctx = tmp.getContext("2d")
      tctx.setTransform(dpr, 0, 0, dpr, coat.bleed * dpr, coat.bleed * dpr)
      drawBase(tctx, coat)
      strokeBuckets(tctx, coat, true)
      bctx.save()
      bctx.setTransform(1, 0, 0, 1, 0, 0)
      bctx.drawImage(tmp, 0, 0)
      bctx.restore()
    } else {
      drawBase(bctx, coat)
      strokeBuckets(bctx, coat, true)
    }
    active.clear()
    paint(ctx, coat, baseCv)
  }

  const frame = (now) => {
    if (!coat || !baseCv) {
      running = false
      return
    }
    const f = Math.max(0.25, Math.min(3, (now - lastT) / 16.7))
    lastT = now
    const S = coat.S
    let any = false
    for (const i of active) {
      const o = i * STRIDE
      let v = S[o + 6]
      let dd = S[o + 5]
      v += -SPRING * dd * f
      v *= Math.pow(DAMP, f)
      dd = Math.max(-1.1, Math.min(1.1, dd + v * f))
      if (Math.abs(dd) < SETTLED && Math.abs(v) < SETTLED) {
        dd = 0
        v = 0
        active.delete(i)
      }
      S[o + 5] = dd
      S[o + 6] = v
      any = true
    }
    if (any) paint(ctx, coat, baseCv)
    if (active.size > 0) raf = requestAnimationFrame(frame)
    else running = false
  }

  const wake = () => {
    if (running) return
    running = true
    lastT = performance.now()
    raf = requestAnimationFrame(frame)
  }

  const onMove = (e) => {
    if (!coat) return
    const r = wrap.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    if (lastPX !== null && lastPY !== null) {
      const vx = px - lastPX
      const vy = py - lastPY
      const speed = Math.hypot(vx, vy)
      if (speed > 0.5) {
        const S = coat.S
        const R = Math.max(24, Math.min(coat.w, coat.h) * 0.16)
        const R2 = R * R
        // candidate strands from the cells the pointer circle covers
        const x0 = Math.max(0, Math.floor((px - R + coat.bleed) / coat.cell))
        const x1 = Math.min(coat.cols - 1, Math.floor((px + R + coat.bleed) / coat.cell))
        const y0 = Math.max(0, Math.floor((py - R + coat.bleed) / coat.cell))
        const y1 = Math.min(coat.rows - 1, Math.floor((py + R + coat.bleed) / coat.cell))
        for (let gy = y0; gy <= y1; gy++) {
          for (let gx = x0; gx <= x1; gx++) {
            for (const i of coat.grid[gy * coat.cols + gx]) {
              const o = i * STRIDE
              const dx = S[o] - px
              const dy = S[o + 1] - py
              const d2 = dx * dx + dy * dy
              if (d2 > R2) continue
              const g = 1 - d2 / R2
              // torque = stroke velocity across the strand direction
              const push = (vx * -Math.sin(S[o + 2]) + vy * Math.cos(S[o + 2])) / S[o + 3]
              S[o + 6] += push * g * 0.55
              active.add(i)
            }
          }
        }
        if (active.size > 0) wake()
      }
    }
    lastPX = px
    lastPY = py
  }
  const onLeave = () => {
    lastPX = null
    lastPY = null
  }

  rebuild()

  let resizeRaf = 0
  const ro = new ResizeObserver(() => {
    // RO fires once on observe with the current size. only a real size
    // change should tear the coat down, coalesced to one rebuild per frame
    if (Math.round(wrap.offsetWidth) === lastW && Math.round(wrap.offsetHeight) === lastH) return
    cancelAnimationFrame(raf)
    running = false
    cancelAnimationFrame(resizeRaf)
    resizeRaf = requestAnimationFrame(() => rebuild())
  })
  ro.observe(wrap)

  const pets = pettable && !reduce
  if (pets) {
    wrap.addEventListener("pointermove", onMove)
    wrap.addEventListener("pointerleave", onLeave)
  }

  // ancien cleanup du useEffect + retrait du canvas
  return () => {
    ro.disconnect()
    cancelAnimationFrame(raf)
    cancelAnimationFrame(resizeRaf)
    if (pets) {
      wrap.removeEventListener("pointermove", onMove)
      wrap.removeEventListener("pointerleave", onLeave)
    }
    canvas.remove()
    wrap.classList.remove("fur")
  }
}
