// =====================================================================
//  stats.js — Calculs de progression (partagés étudiant / enseignant)
// =====================================================================
import { rangCotation } from "./topo.js";

// Meilleure cotation parmi les passages qui vérifient le filtre
export function meilleure(passages, filtre = () => true) {
  let best = null;
  for (const p of passages) if (filtre(p) && rangCotation(p.cotation) > rangCotation(best)) best = p.cotation;
  return best;
}
export const enchaine = p => p.resultat === "enchaine";
export const maxTete = l => meilleure(l, p => enchaine(p) && p.mode === "tete");
export const maxMoulinette = l => meilleure(l, p => enchaine(p) && p.mode === "moulinette");
export const jour = iso => iso.slice(0, 10);

// Comptage par cotation pour la pyramide : { "5b": { tete: 2, moulinette: 3 } }
export function pyramide(passages) {
  const r = {};
  for (const p of passages.filter(enchaine)) {
    const c = String(p.cotation).toLowerCase();
    (r[c] ||= { tete: 0, moulinette: 0 })[p.mode === "tete" ? "tete" : "moulinette"]++;
  }
  return Object.entries(r).sort((a, b) => rangCotation(b[0]) - rangCotation(a[0]));
}
