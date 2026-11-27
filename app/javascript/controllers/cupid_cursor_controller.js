import { Controller } from "@hotwired/stimulus"

// Curseur Cupidon dessiné en JS : une image suit la souris avec un léger retard.
// (Un curseur CSS de 64 px clignote dans Chrome, qui masque les curseurs > 32 px.)
// Actif uniquement avec une souris : sur écran tactile, rien ne change.

// Point de clic, en proportion de l'image (48, 10 sur l'image d'origine 64 × 64) :
// reste juste si on change la taille dans _cupid_cursor.scss
const HOTSPOT_X = 48 / 64
const HOTSPOT_Y = 10 / 64
const SMOOTHING = 0.3 // part du chemin parcourue à chaque frame : plus bas = plus de retard

// Gardé entre deux pages Turbo pour que le Cupidon ne saute pas à (0, 0)
let last = null

export default class extends Controller {
  static targets = ["image"]

  connect() {
    this.finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    if (!this.finePointer.matches) return

    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    this.target = last ? { ...last } : null
    this.current = last ? { ...last } : null
    this.frame = null

    document.documentElement.classList.add("has-cupid-cursor")
    if (this.current) {
      this.imageTarget.hidden = false // nouvelle page Turbo : la souris est toujours là
      this.render() // après hidden = false : render() lit la taille affichée
    }

    this.onMove = this.onMove.bind(this)
    this.onLeave = this.onLeave.bind(this)
    document.addEventListener("pointermove", this.onMove, { passive: true })
    document.documentElement.addEventListener("pointerleave", this.onLeave)
  }

  disconnect() {
    if (!this.onMove) return
    document.removeEventListener("pointermove", this.onMove)
    document.documentElement.removeEventListener("pointerleave", this.onLeave)
    cancelAnimationFrame(this.frame)
    // la classe reste sur <html> : la page suivante reconnecte le contrôleur
  }

  onMove(event) {
    if (event.pointerType !== "mouse") return

    this.target = { x: event.clientX, y: event.clientY }
    last = this.target
    if (!this.current || this.reducedMotion) this.current = { ...this.target }

    this.imageTarget.hidden = false
    if (!this.frame) this.frame = requestAnimationFrame(() => this.tick())
  }

  onLeave() {
    this.imageTarget.hidden = true
  }

  tick() {
    const dx = this.target.x - this.current.x
    const dy = this.target.y - this.current.y

    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
      this.current = { ...this.target }
      this.render()
      this.frame = null
      return
    }

    this.current.x += dx * SMOOTHING
    this.current.y += dy * SMOOTHING
    this.render()
    this.frame = requestAnimationFrame(() => this.tick())
  }

  render() {
    const size = this.imageTarget.offsetWidth || 64
    const x = this.current.x - size * HOTSPOT_X
    const y = this.current.y - size * HOTSPOT_Y
    this.imageTarget.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }
}
