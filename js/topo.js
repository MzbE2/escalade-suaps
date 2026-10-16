// =====================================================================
//  topo.js — Topo du mur de Suchet (source : Oblyk, octobre 2026)
//  Sert de topo initial ; ensuite le topo se modifie depuis l'espace prof.
// =====================================================================
export const SECTEURS = [
  { nom: "Dévers", relais: [1, 2, 3, 4, 5, 6] },
  { nom: "Vertical", relais: [7, 8, 9, 10, 11] },
  { nom: "Dalle", relais: [12, 13, 14] }
];

export const COULEURS = {
  Rouge: "#e3241b", Orange: "#ff7a00", Jaune: "#ffcc00", Vert: "#2ca02c", Bleu: "#1f5fd4",
  Violet: "#a640c8", Noir: "#1a1a1a", Gris: "#999999", Blanc: "#f2f2f2", Beige: "#efe6c8",
  Saumon: "#ffbfa0", Rose: "#ff6fb5", Marron: "#8b5a2b"
};

export const COTATIONS = ["3a","3b","3c","4a","4b","4c","5a","5b","5c","6a","6b","6c","7a","7b","7c","8a"]
  .flatMap(c => [c, c + "+"]);
export const rangCotation = c => COTATIONS.indexOf(String(c || "").trim().toLowerCase());

export const MODES = [["moulinette", "Moulinette"], ["tete", "En tête"]];
export const RESULTATS = [["enchaine", "Enchaîné", "ok"], ["pose", "Avec pose", "warn"], ["echec", "Pas au sommet", "bad"]];
export const RESSENTIS = [["facile", "Facile"], ["adapte", "Adapté"], ["difficile", "Difficile"], ["tropdur", "Trop dur"]];
export const libelle = (liste, cle) => (liste.find(x => x[0] === cle) || [, cle || "—"])[1];

export const TOPO_INITIAL = [
  {"id": "v73073", "secteur": "Dévers", "relais": 1, "nom": "L'1 portant", "cotation": "5b", "couleur": "Gris", "oblyk": "73073", "actif": true},
  {"id": "v73075", "secteur": "Dévers", "relais": 1, "nom": "Zapito", "cotation": "6a", "couleur": "Rouge", "oblyk": "73075", "actif": true},
  {"id": "v73076", "secteur": "Dévers", "relais": 1, "nom": "Blue block", "cotation": "6b", "couleur": "Bleu", "oblyk": "73076", "actif": true},
  {"id": "v88047", "secteur": "Dévers", "relais": 1, "nom": "Le coup de la panne", "cotation": "7a+", "couleur": "Jaune", "oblyk": "88047", "actif": true},
  {"id": "v81267", "secteur": "Dévers", "relais": 2, "nom": "Athl-éthique", "cotation": "5a+", "couleur": "Noir", "oblyk": "81267", "actif": true},
  {"id": "v73078", "secteur": "Dévers", "relais": 2, "nom": "Le pendule de tournesol", "cotation": "5b", "couleur": "Vert", "oblyk": "73078", "actif": true},
  {"id": "v96462", "secteur": "Dévers", "relais": 2, "nom": "Le sauna", "cotation": "6b", "couleur": "Violet", "oblyk": "96462", "actif": true},
  {"id": "v73079", "secteur": "Dévers", "relais": 2, "nom": "Oulalala", "cotation": "7a", "couleur": "Orange", "oblyk": "73079", "actif": true},
  {"id": "v73081", "secteur": "Dévers", "relais": 3, "nom": "La peau rouge", "cotation": "5b+", "couleur": "Rouge", "oblyk": "73081", "actif": true},
  {"id": "v73082", "secteur": "Dévers", "relais": 3, "nom": "Le grand bain", "cotation": "5c", "couleur": "Bleu", "oblyk": "73082", "actif": true},
  {"id": "v73083", "secteur": "Dévers", "relais": 3, "nom": "Ice slide", "cotation": "6a+", "couleur": "Blanc", "oblyk": "73083", "actif": true},
  {"id": "v73084", "secteur": "Dévers", "relais": 3, "nom": "The projet", "cotation": "7b", "couleur": "Jaune", "oblyk": "73084", "actif": true},
  {"id": "v73117", "secteur": "Dévers", "relais": 4, "nom": "Grey worm", "cotation": "5b+", "couleur": "Gris", "oblyk": "73117", "actif": true},
  {"id": "v93073", "secteur": "Dévers", "relais": 4, "nom": "Le ventre crawlé", "cotation": "5c", "couleur": "Violet", "oblyk": "93073", "actif": true},
  {"id": "v73116", "secteur": "Dévers", "relais": 4, "nom": "Oh! Oh! Oh! Géant vert", "cotation": "6b+", "couleur": "Vert", "oblyk": "73116", "actif": true},
  {"id": "v81290", "secteur": "Dévers", "relais": 5, "nom": "C'est la même", "cotation": "5a+", "couleur": "Noir", "oblyk": "81290", "actif": true},
  {"id": "v73119", "secteur": "Dévers", "relais": 5, "nom": "La traction", "cotation": "5c+", "couleur": "Saumon", "oblyk": "73119", "actif": true},
  {"id": "v73120", "secteur": "Dévers", "relais": 5, "nom": "Moyenne tension", "cotation": "6c", "couleur": "Bleu", "oblyk": "73120", "actif": true},
  {"id": "v73127", "secteur": "Dévers", "relais": 6, "nom": "Plug and play", "cotation": "5a", "couleur": "Jaune", "oblyk": "73127", "actif": true},
  {"id": "v81291", "secteur": "Dévers", "relais": 6, "nom": "En diagonale", "cotation": "5b+", "couleur": "Violet", "oblyk": "81291", "actif": true},
  {"id": "v73186", "secteur": "Dévers", "relais": 6, "nom": "L'invertimbre", "cotation": "5c", "couleur": "Rouge", "oblyk": "73186", "actif": true},
  {"id": "v88262", "secteur": "Dévers", "relais": 6, "nom": "Karaneige", "cotation": "6b", "couleur": "Blanc", "oblyk": "88262", "actif": true},
  {"id": "v88263", "secteur": "Vertical", "relais": 7, "nom": "Misty gris", "cotation": "5a", "couleur": "Noir", "oblyk": "88263", "actif": true},
  {"id": "v73095", "secteur": "Vertical", "relais": 7, "nom": "seul o monde", "cotation": "5c+", "couleur": "Beige", "oblyk": "73095", "actif": true},
  {"id": "v81295", "secteur": "Vertical", "relais": 7, "nom": "Barre à droite toute", "cotation": "6a+", "couleur": "Bleu", "oblyk": "81295", "actif": true},
  {"id": "v26", "secteur": "Vertical", "relais": 7, "nom": "Le hammam", "cotation": "6b+", "couleur": "Vert", "oblyk": null, "actif": true},
  {"id": "v27", "secteur": "Vertical", "relais": 8, "nom": "Quasi-mire", "cotation": "5b", "couleur": "Jaune", "oblyk": null, "actif": true},
  {"id": "v28", "secteur": "Vertical", "relais": 8, "nom": "Le petit poux sait", "cotation": "5c", "couleur": "Blanc", "oblyk": null, "actif": true},
  {"id": "v29", "secteur": "Vertical", "relais": 8, "nom": "La lune à Dèr", "cotation": "6a", "couleur": "Violet", "oblyk": null, "actif": true},
  {"id": "v30", "secteur": "Vertical", "relais": 8, "nom": "Le air-fryer", "cotation": "7a", "couleur": "Rouge", "oblyk": null, "actif": true},
  {"id": "v31", "secteur": "Vertical", "relais": 9, "nom": "La canicule", "cotation": "4c", "couleur": "Gris", "oblyk": null, "actif": true},
  {"id": "v32", "secteur": "Vertical", "relais": 9, "nom": "La VIP", "cotation": "4c+", "couleur": "Gris", "oblyk": null, "actif": true},
  {"id": "v33", "secteur": "Vertical", "relais": 9, "nom": "La myopie sélective", "cotation": "5c", "couleur": "Bleu", "oblyk": null, "actif": true},
  {"id": "v34", "secteur": "Vertical", "relais": 9, "nom": "All you need", "cotation": "6b", "couleur": "Beige", "oblyk": null, "actif": true},
  {"id": "v35", "secteur": "Vertical", "relais": 9, "nom": "Vert, feu !!", "cotation": "6c+", "couleur": "Vert", "oblyk": null, "actif": true},
  {"id": "v36", "secteur": "Vertical", "relais": 10, "nom": "Le bélier", "cotation": "5a+", "couleur": "Noir", "oblyk": null, "actif": true},
  {"id": "v37", "secteur": "Vertical", "relais": 10, "nom": "La reprise", "cotation": "5b", "couleur": "Rouge", "oblyk": null, "actif": true},
  {"id": "v38", "secteur": "Vertical", "relais": 10, "nom": "Au clair de la lune", "cotation": "5c", "couleur": "Gris", "oblyk": null, "actif": true},
  {"id": "v39", "secteur": "Vertical", "relais": 10, "nom": "La voix romaine", "cotation": "6b", "couleur": "Violet", "oblyk": null, "actif": true},
  {"id": "v40", "secteur": "Vertical", "relais": 10, "nom": "La claustrophobie des orteils", "cotation": "7a", "couleur": "Jaune", "oblyk": null, "actif": true},
  {"id": "v41", "secteur": "Vertical", "relais": 11, "nom": "Le bleu de tes yeux", "cotation": "5a+", "couleur": "Bleu", "oblyk": null, "actif": true},
  {"id": "v42", "secteur": "Vertical", "relais": 11, "nom": "Lumbago printanier", "cotation": "5b", "couleur": "Saumon", "oblyk": null, "actif": true},
  {"id": "v43", "secteur": "Vertical", "relais": 11, "nom": "Mon royaume pour une clim", "cotation": "5c", "couleur": "Vert", "oblyk": null, "actif": true},
  {"id": "v44", "secteur": "Dalle", "relais": 12, "nom": "Tagada", "cotation": "5a", "couleur": "Rouge", "oblyk": null, "actif": true},
  {"id": "v45", "secteur": "Dalle", "relais": 12, "nom": "The Upside down", "cotation": "5b", "couleur": "Jaune", "oblyk": null, "actif": true},
  {"id": "v73092", "secteur": "Dalle", "relais": 12, "nom": "La mûre ail de chine", "cotation": "5b+", "couleur": "Violet", "oblyk": "73092", "actif": true},
  {"id": "v47", "secteur": "Dalle", "relais": 12, "nom": "Le dôme de chaleur", "cotation": "6a", "couleur": "Violet", "oblyk": null, "actif": true},
  {"id": "v48", "secteur": "Dalle", "relais": 12, "nom": "Aphrodisiaque", "cotation": "6c", "couleur": "Blanc", "oblyk": null, "actif": true},
  {"id": "v49", "secteur": "Dalle", "relais": 13, "nom": "La maximum plaisir", "cotation": "4b", "couleur": "Blanc", "oblyk": null, "actif": true},
  {"id": "v50", "secteur": "Dalle", "relais": 13, "nom": "La fournaise", "cotation": "5a", "couleur": "Saumon", "oblyk": null, "actif": true},
  {"id": "v51", "secteur": "Dalle", "relais": 13, "nom": "Presse citron", "cotation": "5c", "couleur": "Vert", "oblyk": null, "actif": true},
  {"id": "v52", "secteur": "Dalle", "relais": 13, "nom": "Mangez des paumes", "cotation": "5c", "couleur": "Jaune", "oblyk": null, "actif": true},
  {"id": "v53", "secteur": "Dalle", "relais": 13, "nom": "Petit +", "cotation": "6a+", "couleur": "Noir", "oblyk": null, "actif": true},
  {"id": "v54", "secteur": "Dalle", "relais": 13, "nom": "La souplesse", "cotation": "6a+", "couleur": "Bleu", "oblyk": null, "actif": true},
  {"id": "v55", "secteur": "Dalle", "relais": 14, "nom": "La pépite", "cotation": "3c", "couleur": "Rouge", "oblyk": null, "actif": true},
  {"id": "v56", "secteur": "Dalle", "relais": 14, "nom": "L'échelle", "cotation": "4b", "couleur": "Violet", "oblyk": null, "actif": true},
  {"id": "v72521", "secteur": "Dalle", "relais": 14, "nom": "La mythique kebab", "cotation": "5b", "couleur": "Orange", "oblyk": "72521", "actif": true}
];

export function genererCode(longueur = 6) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(longueur);
  crypto.getRandomValues(arr);
  return Array.from(arr, v => alphabet[v % alphabet.length]).join("");
}
export const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
export const fmtHeure = iso => iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
