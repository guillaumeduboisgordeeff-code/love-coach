import { Controller } from "@hotwired/stimulus"

// Joue un son quand le coach (LLM) répond dans le chat.
// Branché sur la page chats/show, les URL des sons sont passées en values.
//
//   - proposition finale (carte "masterplan prêt") → validation (rire)
//   - autres messages → talk, talkReverse ou question au hasard,
//     jamais deux fois le même son d'affilée
//
// Seuls les messages qui ARRIVENT pendant la visite font du bruit
// (pas l'historique affiché au chargement de la page).
export default class extends Controller {
  static values = {
    talk: String,
    talkReverse: String,
    question: String,
    validation: String,
  }

  connect() {
    this.messages = this.element.querySelector("#messages")
    if (!this.messages) return

    // préchargement des sons
    this.sounds = {
      talk: this.load(this.talkValue),
      talkReverse: this.load(this.talkReverseValue),
      question: this.load(this.questionValue),
      validation: this.load(this.validationValue),
    }

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => this.onMessageAdded(node))
      }
    })
    this.observer.observe(this.messages, { childList: true })
  }

  disconnect() {
    this.observer?.disconnect()
  }

  onMessageAdded(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    if (!node.matches(".message--assistant")) return
    // bulle temporaire "…" pendant que le coach réfléchit : pas de son
    if (node.hasAttribute("data-pending")) return

    this.play(this.soundFor(node))
  }

  soundFor(message) {
    // proposition finale (carte "masterplan prêt") : le rire de validation
    if (message.querySelector(".message__bubble--masterplan")) return this.sounds.validation

    // sinon, un des 3 autres sons au hasard, jamais deux fois le même d'affilée
    const voices = [this.sounds.talk, this.sounds.talkReverse, this.sounds.question]
      .filter((sound) => sound && sound !== this.lastVoice)
    this.lastVoice = voices[Math.floor(Math.random() * voices.length)]
    return this.lastVoice
  }

  load(url) {
    if (!url) return null
    const audio = new Audio(url)
    audio.preload = "auto"
    return audio
  }

  play(audio) {
    if (!audio) return
    audio.currentTime = 0
    // le navigateur peut refuser la lecture (pas d'interaction utilisateur) : on ignore
    audio.play().catch(() => {})
  }
}
