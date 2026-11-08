// =====================================================================
//  evaluation.js — Grille d'évaluation escalade (S1 moulinette, S2 tête)
//  Partagé espace enseignant / espace étudiant. Pour modifier un critère,
//  un barème ou un nombre de points : c'est ici, et nulle part ailleurs.
// =====================================================================
import { rangCotation } from "./topo.js";

// Chaque critère : id (ne pas changer une fois des notes saisies), titre, max,
// sections = [[titre de section ou null, [sous-critères à cocher]]],
// reperes = [[min, max, texte]] (facultatif), auto = calcul automatique (facultatif)
const INVESTISSEMENT = {
  id: "inv", titre: "Investissement", court: "Invest.",
  criteres: [
    { id: "assiduite", titre: "Assiduité et ponctualité", max: 5,
      sections: [[null, ["Présence régulière", "Respect des horaires", "Tenue adaptée"]]] },
    { id: "engagement", titre: "Participation et engagement", max: 5,
      sections: [[null, ["Implication dans les situations proposées", "Volonté de progresser", "Prise d'initiative dans les apprentissages"]]] },
    { id: "regles", titre: "Respect des règles de sécurité", max: 5,
      sections: [[null, ["Application rigoureuse des consignes", "Vigilance lors des manipulations", "Attitude responsable envers soi-même et les autres"]]] },
    { id: "cooperation", titre: "Coopération et progression", max: 5,
      sections: [[null, ["Qualité de l'assurage", "Aide apportée aux partenaires", "Écoute des conseils", "Progression observée durant le semestre"]]] }
  ]
};

export const SEMESTRES = {
  s1: {
    titre: "Semestre 1 · Moulinette", court: "S1 · Moulinette",
    parties: [
      INVESTISSEMENT,
      { id: "prat", titre: "Pratique — moulinette", court: "Pratique",
        criteres: [
          { id: "technique", titre: "Maîtrise technique et qualité des déplacements", max: 8,
            sections: [
              ["Utilisation des appuis", ["Recherche et précision des prises de pieds", "Les jambes comme moteur de progression", "Qualité des poussées"]],
              ["Équilibre et placement", ["Gestion du centre de gravité", "Maintien de l'équilibre", "Utilisation du mur pour se stabiliser"]],
              ["Coordination et fluidité", ["Enchaînement des mouvements", "Coordination bras-jambes", "Limitation des mouvements inutiles"]],
              ["Variété technique", ["Opposition", "Transfert d'appuis", "Croisés", "Changements de pied", "Placements selon le profil de la voie"]]],
            reperes: [[7, 8, "Fluides, précis, économes, adaptés"], [5, 6, "Globalement maîtrisées, quelques maladresses"], [3, 4, "En cours d'acquisition"], [0, 2, "Peu maîtrisés ou inefficaces"]] },
          { id: "lecture", titre: "Lecture de voie et adaptation", max: 4,
            sections: [[null, ["Observe la voie avant de grimper", "Identifie les passages clés", "Anticipe ses déplacements", "Modifie sa stratégie en cas de difficulté"]]],
            reperes: [[4, 4, "Lecture pertinente, adaptation efficace"], [2, 3, "Correcte mais parfois incomplète"], [0, 1, "Peu d'anticipation"]] },
          { id: "niveau", titre: "Réalisation de la voie / Niveau atteint", max: 4, auto: "bareme-s1",
            sections: [[null, ["Niveau de difficulté des voies réalisées", "Réussite de voies adaptées à son niveau", "Engagement dans la progression"]]],
            reperes: [[4, 4, "Avec aisance et engagement"], [2, 3, "Adaptées, quelques difficultés"], [0, 1, "Difficultés importantes"]] },
          { id: "securite", titre: "Sécurité et autonomie en moulinette", max: 4,
            sections: [
              ["Grimpeur", ["Vérifie son équipement", "Nœud d'encordement correct", "Communique avec son assureur"]],
              ["Assureur", ["Vérifications croisées", "Utilise correctement le système d'assurage", "Assure et descend en sécurité"]]],
            reperes: [[4, 4, "Autonomie complète, règles respectées"], [2, 3, "Quelques rappels, globalement sécurisé"], [0, 1, "Manquements répétés"]] }
        ] },
      { id: "theo", titre: "Théorie — article de presse", court: "Théorie", note: "Travail de groupe : article illustré de 1 à 2 pages.",
        criteres: [
          { id: "contenu", titre: "Pertinence et qualité du contenu", max: 5,
            sections: [[null, ["Répond à la thématique", "Informations fiables et pertinentes", "Idées essentielles mises en évidence", "Compréhension du sujet", "Respect des consignes"]]] },
          { id: "synthese", titre: "Capacité de synthèse et clarté du message", max: 5,
            sections: [[null, ["Va à l'essentiel", "Met en avant l'important", "Vocabulaire adapté", "Facilement compréhensible", "Se lit en 4 minutes environ"]]] },
          { id: "visuel", titre: "Qualité visuelle et mise en page", max: 5,
            sections: [[null, ["Attractif visuellement", "Organisation claire", "Titres, encadrés, illustrations efficaces", "Lecture fluide", "Principes de communication visuelle"]]] },
          { id: "collectif", titre: "Travail collaboratif et cohérence", max: 5,
            sections: [[null, ["Tâches réparties équitablement", "Production harmonieuse", "Cohérence entre les parties", "Délais et consignes respectés", "Document homogène"]]] }
        ] }
    ]
  },
  s2: {
    titre: "Semestre 2 · Tête", court: "S2 · Tête",
    parties: [
      INVESTISSEMENT,
      { id: "prat", titre: "Pratique — tête", court: "Pratique", note: "« Réussite et engagement » est un bonus de 2 pts : la note reste plafonnée à 20.",
        criteres: [
          { id: "realisation", titre: "Réalisation de la voie", max: 6, indice: "bareme-s2",
            sections: [[null, ["Niveau de difficulté atteint", "Fluidité", "Gestion de l'effort"]]] },
          { id: "technique", titre: "Technique et efficacité gestuelle", max: 4,
            sections: [[null, ["Placement", "Économie d'énergie", "Utilisation du corps"]]] },
          { id: "tete", titre: "Gestion de l'escalade en tête", max: 6,
            sections: [[null, ["Mousquetonne correctement", "Gère les zones de risque", "Anticipe son parcours", "Maintient sa concentration"]]] },
          { id: "securite", titre: "Sécurité et autonomie", max: 4,
            sections: [[null, ["Manipulations maîtrisées", "Communication efficace", "Respect des protocoles"]]] },
          { id: "bonus", titre: "Réussite et engagement dans plusieurs voies (bonus)", max: 2, bonus: true,
            sections: [[null, ["Nombre de voies réalisées", "Essaie des voies plus difficiles", "Persévérance face à l'échec"]]] }
        ] },
      { id: "theo", titre: "Théorie — podcast ou vidéo", court: "Théorie", note: "« Comment améliorer ma pratique de l'escalade ? »",
        criteres: [
          { id: "facteurs", titre: "Compréhension des facteurs de performance et de santé", max: 5,
            sections: [[null, ["Sommeil", "Récupération", "Alimentation", "Hydratation", "Activité physique complémentaire", "Gestion du stress", "Organisation personnelle", "Échauffement et récupération"]]] },
          { id: "analyse", titre: "Analyse personnelle et réflexion critique", max: 5,
            sections: [[null, ["Analyse ses habitudes actuelles", "Identifie ses points forts", "Identifie ses axes d'amélioration", "Propose des objectifs réalistes"]]] },
          { id: "solutions", titre: "Pertinence des solutions proposées", max: 5,
            sections: [[null, ["Améliorer son sommeil", "Mieux gérer son temps", "Activité complémentaire", "Routine d'échauffement", "Mobilité ou renforcement", "Meilleures habitudes de récupération"]]] },
          { id: "communication", titre: "Qualité de la communication", max: 5,
            sections: [[null, ["Structuré", "Clair et compréhensible", "Respecte la durée demandée", "Discours fluide", "Format (audio/vidéo) bien utilisé"]]] }
        ] }
    ]
  }
};

// Barèmes de performance : [points, cotation minimale filles, cotation minimale garçons]
export const BAREMES = {
  "bareme-s1": { titre: "Barème moulinette (S1)", mode: "toutes", lignes: [
    [4, "6b", "6c"], [3.5, "6a+", "6b+"], [3, "6a", "6b"], [2.5, "5c+", "6a+"],
    [2, "5c", "6a"], [1.5, "5b", "5c+"], [1, "5a", "5c"], [0.5, "4c", "5b"]] },
  "bareme-s2": { titre: "Barème tête (S2)", mode: "tete", lignes: [
    [4, "6a+", "6b+"], [3.5, "6a", "6b"], [3, "5c+", "6a+"], [2.5, "5c", "6a"],
    [2, "5b+", "5c+"], [1.5, "5b", "5c"], [1, "5a", "5b+"], [0.5, "4c", "5b"]] }
};

// Points du barème pour une cotation et un sexe ("F" / "G") ; null si inconnu
export function pointsBareme(cle, cotation, sexe) {
  const b = BAREMES[cle];
  if (!b || !cotation || !["F", "G"].includes(sexe)) return null;
  const r = rangCotation(cotation);
  for (const [pts, f, g] of b.lignes) if (r >= rangCotation(sexe === "F" ? f : g)) return pts;
  return 0;
}

export const nbItems = c => c.sections.reduce((n, [, l]) => n + l.length, 0);
const demiPoint = x => Math.round(x * 2) / 2;

// Note d'un critère. etat = { c: [indices cochés], p: note ajustée à la main ou null }
// ctx = { maxEnchaine } pour les calculs automatiques. Retourne { pts, source } ou null.
export function noteCritere(crit, etat = {}, ctx = {}) {
  if (typeof etat.p === "number") return { pts: Math.min(crit.max, Math.max(0, etat.p)), source: "manuel" };
  if (crit.auto && BAREMES[crit.auto]) {
    const b = pointsBareme(crit.auto, ctx.maxEnchaine?.[BAREMES[crit.auto].mode], ctx.sexe);
    return b === null ? null : { pts: b, source: "bareme" };
  }
  const coches = (etat.c || []).length;
  if (!coches) return null;
  return { pts: demiPoint(crit.max * coches / nbItems(crit)), source: "coches" };
}

// Note d'une partie (/20, bonus compris, plafonnée à 20)
export function notePartie(partie, etats = {}, ctx = {}) {
  let total = 0, notes = 0, attendus = 0;
  const detail = partie.criteres.map(cr => {
    const n = noteCritere(cr, etats[cr.id], ctx);
    if (!cr.bonus) attendus++;
    if (n) { total += n.pts; if (!cr.bonus) notes++; }
    return { cr, n };
  });
  return { total: Math.min(20, total), complet: notes === attendus, notes, attendus, detail };
}

// Résumé publié aux étudiants : seulement les grands critères, jamais les sous-critères
export function resumePublic(semestre, etatsSemestre = {}, ctx = {}) {
  const S = SEMESTRES[semestre];
  return {
    titre: S.titre,
    parties: S.parties.map(pa => {
      const np = notePartie(pa, etatsSemestre[pa.id], ctx);
      return {
        titre: pa.titre, total: np.notes ? np.total : null,
        criteres: np.detail.map(({ cr, n }) => ({ titre: cr.titre, max: cr.max, pts: n ? n.pts : null, bonus: !!cr.bonus }))
      };
    })
  };
}

export const fmtNote = x => (x === null || x === undefined) ? "—" : String(x).replace(".", ",");
