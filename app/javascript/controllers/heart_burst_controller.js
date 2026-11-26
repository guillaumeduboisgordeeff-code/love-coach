import { Controller } from "@hotwired/stimulus"

// Au clic sur le cœur : explosion d'emojis billets + cœurs roses,
// puis envoi du POST vers l'URL du lien (création d'un nouveau chat).
//
// Utilisation :
//   <a href="/chats" data-controller="heart-burst" data-action="heart-burst#explode">…</a>
export default class extends Controller {
  static values = {
    emojis: { type: Array, default: ["💸", "💸", "💵", "🩷", "💖", "💗"] },
    count: { type: Number, default: 40 },
    duration: { type: Number, default: 900 } // ms avant de changer de page
  }

  explode(event) {
    event.preventDefault()
    if (this.exploding) return // évite les doubles clics
    this.exploding = true

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!reduceMotion) this.spawnParticles()

    setTimeout(() => this.submit(), reduceMotion ? 0 : this.durationValue)
  }

  spawnParticles() {
    const rect = this.element.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    for (let i = 0; i < this.countValue; i++) {
      const particle = document.createElement("span")
      particle.className = "heart-burst-particle"
      particle.setAttribute("aria-hidden", "true")
      particle.textContent = this.emojisValue[Math.floor(Math.random() * this.emojisValue.length)]
      particle.style.left = `${centerX}px`
      particle.style.top = `${centerY}px`
      particle.style.fontSize = `${1.5 + Math.random() * 2.5}rem`
      document.body.appendChild(particle)

      // Direction et distance au hasard, avec un peu de gravité à la fin
      const angle = Math.random() * Math.PI * 2
      const distance = 150 + Math.random() * 350
      const x = Math.cos(angle) * distance
      const y = Math.sin(angle) * distance
      const spin = (Math.random() - 0.5) * 720

      particle.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.2) rotate(0deg)", opacity: 1 },
          { transform: `translate(calc(-50% + ${x * 0.8}px), calc(-50% + ${y * 0.8}px)) scale(1.2) rotate(${spin * 0.7}deg)`, opacity: 1, offset: 0.6 },
          { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y + 120}px)) scale(0.9) rotate(${spin}deg)`, opacity: 0 }
        ],
        {
          duration: this.durationValue + Math.random() * 300,
          easing: "cubic-bezier(0.15, 0.7, 0.4, 1)",
          fill: "forwards"
        }
      ).onfinish = () => particle.remove()
    }
  }

  // Équivalent de data-turbo-method="post" : un formulaire POST envoyé via Turbo
  submit() {
    const form = document.createElement("form")
    form.method = "post"
    form.action = this.element.href
    form.hidden = true

    const token = document.querySelector('meta[name="csrf-token"]')?.content
    if (token) {
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = "authenticity_token"
      input.value = token
      form.appendChild(input)
    }

    document.body.appendChild(form)
    form.requestSubmit()
  }
}
