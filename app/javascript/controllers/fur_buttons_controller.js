import { Controller } from "@hotwired/stimulus"
import { mountFur } from "lib/fur"

// Pose automatiquement de la fourrure sur tous les boutons cliquables de la page
// (mêmes boutons que le style 3D de components/_button.scss) et sur les cœurs.
// Branché sur <body> dans le layout.
//
// Les boutons ajoutés après le chargement (ex. le formulaire du chat, remplacé
// par un Turbo Stream après chaque message) sont détectés par un MutationObserver.
const BUTTONS = [
  ".btn:not(.btn-close)",
  "button:not(.navbar-toggler):not(.btn-close)",
  ".navbar-lewagon .nav-link",
  ".btn-heart",
  ".masterplans-cta",
].join(", ")

// Boutons en forme de cœur : home (.btn-heart) et page masterplans (.masterplans-cta)
const HEARTS = ".btn-heart, .masterplans-cta"

const FUR_OPTIONS = {
  shape: "card",
  fluff: 2.6,        // poils plus longs
  density: 0.55,     // moins de poils, donc moins de "grain" répété
  strandWidth: 1.8,  // poils plus épais
  clumpScale: 2.5,   // ondulations plus larges
  mess: 0.55,
}

// Cœurs : même tracé que le cœur des boutons (viewBox 360 × 310 ; celui de la page
// masterplans est le même en 180 × 155), pour que le pelage épouse exactement la forme.
// Les poils dépassent du contour.
const HEART_PATH = "M 180 300 C 150 270 10 180 10 96 C 10 10 120 -10 180 70 C 240 -10 350 10 350 96 C 350 180 210 270 180 300 Z"

const HEART_FUR_OPTIONS = {
  path: HEART_PATH,
  pathBox: { width: 360, height: 310 },
  color: "#ff1f75",  // rose néon (le rendu est encore saturé en CSS : components/_fur.scss)
  fluff: 1.4,        // longs poils qui débordent du cœur
  density: 0.7,
  strandWidth: 1.8,
  clumpScale: 2.5,
  mess: 0.55,
}

export default class extends Controller {
  connect() {
    this.cleanups = new Map() // bouton -> fonction de nettoyage
    this.seed = 7
    this.furnish(this.element)

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) this.furnish(node)
        })
      }
      // libère les boutons retirés de la page
      for (const [button, cleanup] of this.cleanups) {
        if (!button.isConnected) {
          cleanup()
          this.cleanups.delete(button)
        }
      }
    })
    this.observer.observe(this.element, { childList: true, subtree: true })
  }

  disconnect() {
    this.observer?.disconnect()
    this.cleanups?.forEach((cleanup) => cleanup())
    this.cleanups?.clear()
  }

  // Pose la fourrure sur tous les boutons de `root` (root compris)
  furnish(root) {
    this.convertSubmitInputs(root)

    const buttons = [...root.querySelectorAll(BUTTONS)]
    if (root.matches(BUTTONS)) buttons.unshift(root)

    buttons.forEach((button) => {
      if (this.cleanups.has(button)) return
      // canvas resté dans un snapshot du cache Turbo : on l'enlève avant de repeindre
      button.querySelectorAll(":scope > .fur-canvas").forEach((canvas) => canvas.remove())

      button.classList.add("fur-button")
      const options = button.matches(HEARTS)
        // la longueur des poils dépend de la taille de l'élément : on compense
        // pour que les petits cœurs aient aussi de longs poils
        ? { ...HEART_FUR_OPTIONS, fluff: HEART_FUR_OPTIONS.fluff * Math.sqrt(Math.max(1, 310 / button.offsetHeight)) }
        // la fourrure prend la couleur de fond du bouton
        : { ...FUR_OPTIONS, color: getComputedStyle(button).backgroundColor }
      this.cleanups.set(button, mountFur(button, { ...options, seed: this.seed++ }))
    })
  }

  // Un <input type="submit"> ne peut pas contenir de canvas : on le remplace par
  // un <button type="submit"> équivalent (mêmes attributs, même texte).
  // Le formulaire envoie exactement les mêmes données (name/value).
  convertSubmitInputs(root) {
    const inputs = [...root.querySelectorAll('input[type="submit"]')]
    if (root.matches('input[type="submit"]')) inputs.unshift(root)

    inputs.forEach((input) => {
      const button = document.createElement("button")
      for (const { name, value } of input.attributes) button.setAttribute(name, value)
      button.textContent = input.value
      input.replaceWith(button)
    })
  }
}
