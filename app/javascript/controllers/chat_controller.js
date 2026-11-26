import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="chat"
export default class extends Controller {
  static targets = ["messages", "input", "pending"]

  connect() {
    // on arrive en bas de la conversation
    this.scrollToBottom("instant")
    // à chaque changement dans #messages (ajout, ou bulle remplacée pendant le streaming)
    this.observer = new MutationObserver((mutations) => {
      // un vrai message est arrivé par le broadcast : on retire les bulles temporaires
      const realMessageAdded = mutations.some(m =>
        [...m.addedNodes].some(node => node.nodeType === Node.ELEMENT_NODE && !node.hasAttribute("data-pending"))
      )
      if (realMessageAdded) this.removePending()
      this.scrollToBottom("smooth")
    })
    this.observer.observe(this.messagesTarget, { childList: true })
  }

  disconnect() {
    // on arrête la surveillance en quittant la page
    this.observer?.disconnect()
  }

  showPending() {
    const text = this.inputTarget.value.trim()
    // message vide : pas de bulle
    if (text === "") return
    // on copie le template, on y met le texte (textContent : protection XSS) et on l'ajoute
    const clone = this.pendingTarget.content.cloneNode(true)
    clone.querySelector("[data-pending-content]").textContent = text
    this.messagesTarget.appendChild(clone)
    // on garde le texte et le placeholder pour les rendre si l'envoi échoue
    this.pendingText = text
    this.originalPlaceholder = this.inputTarget.placeholder
    // on vide et bloque le champ (Turbo a déjà copié les données du formulaire)
    this.inputTarget.value = ""
    this.inputTarget.disabled = true
    this.inputTarget.placeholder = "Le coach réfléchit…"
  }

  clearPending() {
    this.removePending()
    // champ encore bloqué = aucun stream n'est arrivé (erreur) : on rend la main
    if (this.inputTarget.disabled) {
      this.inputTarget.value = this.pendingText
      this.inputTarget.placeholder = this.originalPlaceholder
      this.inputTarget.disabled = false
    }
  }

  removePending() {
    // on supprime les bulles temporaires
    this.messagesTarget.querySelectorAll("[data-pending]").forEach(el => el.remove())
  }

  submitOnEnter(event) {
    // Maj+Entrée = retour à la ligne, isComposing = saisie d'un accent en cours
    if (event.shiftKey || event.isComposing) return
    event.preventDefault()
    // champ vide : on n'envoie rien
    if (this.inputTarget.value.trim() === "") return
    // on soumet comme un clic sur le bouton (déclenche Turbo et turbo_submits_with)
    const form = this.inputTarget.form
    form.requestSubmit(form.querySelector('[type="submit"]'))
  }

  scrollToBottom(behavior) {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior })
  }
}
