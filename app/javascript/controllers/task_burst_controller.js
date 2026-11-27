```javascript
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  complete(event) {
    const checkbox = event.target

    if (checkbox.type !== "checkbox") return
    if (this.pending) return

    this.pending = true

    if (checkbox.checked) {
      this.spawnParticles()
      setTimeout(() => this.element.requestSubmit(), 350)
    } else {
      this.element.requestSubmit()
    }
  }

  spawnParticles() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const rect = this.element.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const emojis = ["💸", "💵", "💸", "💰"]
    const count = 14

    for (let i = 0; i < count; i++) {
      const particle = document.createElement("span")

      particle.className = "task-burst-particle"
      particle.setAttribute("aria-hidden", "true")
      particle.textContent = emojis[Math.floor(Math.random() * emojis.length)]

      particle.style.left = `${centerX}px`
      particle.style.top = `${centerY}px`
      particle.style.fontSize = `${0.9 + Math.random() * 0.6}rem`

      document.body.appendChild(particle)

      const angle = Math.random() * Math.PI * 2
      const distance = 55 + Math.random() * 100
      const x = Math.cos(angle) * distance
      const y = Math.sin(angle) * distance

      particle.animate(
        [
          {
            transform: "translate(-50%, -50%) scale(0.3) rotate(0deg)",
            opacity: 0
          },
          {
            transform: "translate(-50%, -50%) scale(1) rotate(90deg)",
            opacity: 0.9,
            offset: 0.2
          },
          {
            transform: `translate(${x}px, ${y}px) scale(0.7) rotate(220deg)`,
            opacity: 0
          }
        ],
        {
          duration: 550 + Math.random() * 200,
          easing: "ease-out",
          fill: "forwards"
        }
      ).onfinish = () => particle.remove()
    }
  }
}
```
