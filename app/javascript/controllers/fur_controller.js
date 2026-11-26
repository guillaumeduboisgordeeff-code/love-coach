import { Controller } from "@hotwired/stimulus"
import { mountFur } from "lib/fur"

// Pelage sur un élément quelconque (l'élément doit avoir une taille).
//
//   <div data-controller="fur"
//        data-fur-shape-value="heart"
//        data-fur-color-value="#FF6AA0"
//        style="width:220px;height:220px"></div>
export default class extends Controller {
  static values = {
    color: String, shape: String, text: String,
    path: String, fluff: Number, density: Number,
    mess: Number, seed: Number, padColor: String,
    pettable: { type: Boolean, default: true },
  }

  connect() {
    this.cleanup = mountFur(this.element, {
      color:    this.colorValue    || undefined,
      shape:    this.shapeValue    || "folder",
      text:     this.textValue     || undefined,
      path:     this.pathValue     || undefined,
      fluff:    this.fluffValue    || 1,
      density:  this.densityValue  || 1,
      mess:     this.hasMessValue  ? this.messValue : 0.5,
      seed:     this.seedValue     || 7,
      padColor: this.padColorValue || undefined,
      pettable: this.pettableValue,
    })
  }

  disconnect() { this.cleanup?.() }
}
