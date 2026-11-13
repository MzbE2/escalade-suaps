// =====================================================================
//  article.js — Article de gazette (théorie S1) : sujets, choix, relectures
//  Partagé par l'espace étudiant et l'espace enseignant (onglet « Vue étudiante »)
// =====================================================================
import { esc } from "./topo.js";

export const NB_RELECT = 4;   // chaque article est relu par 4 étudiants

// Les 25 sujets (fichier « Article gazette Dec 2026 ») : [titre, description]
const LISTE = [
  ["L’escalade, bien plus qu’un sport", "Un sport qui demande force, équilibre, concentration et confiance."],
  ["Pourquoi l’escalade est-elle devenue si populaire ?", "L’essor des salles d’escalade et l’arrivée de la discipline aux Jeux olympiques."],
  ["Escalade en salle ou en extérieur : quelles différences ?", "Comparer les deux environnements."],
  ["L’escalade aux Jeux olympiques", "Découvrir les différentes disciplines olympiques et leur fonctionnement."],
  ["Le mental : l’arme secrète du grimpeur", "Gérer le stress, la peur et les difficultés."],
  ["Pourquoi les grimpeurs tombent-ils ?", "Comprendre les chutes et leur importance dans l’apprentissage."],
  ["Comment vaincre sa peur du vide ?", "Les techniques pour apprendre à gérer son appréhension."],
  ["Pourquoi les jambes sont-elles essentielles en escalade ?", "Montrer que l’escalade ne repose pas uniquement sur la force des bras."],
  ["Quels muscles utilise-t-on en escalade ?", "Découvrir les différentes parties du corps sollicitées."],
  ["Comment progresser rapidement en escalade ?", "Entraînement, technique, régularité et récupération."],
  ["Comment lire une voie d’escalade ?", "Observer les prises et imaginer ses mouvements avant de grimper."],
  ["Le matériel du grimpeur expliqué", "Chaussons, baudrier, corde, magnésie, dégaines, etc."],
  ["La sécurité en escalade : les règles essentielles", "Les bons réflexes pour grimper en toute sécurité."],
  ["Grimper à deux : une histoire de confiance", "Le rôle du partenaire et de la communication."],
  ["Les femmes dans le monde de l’escalade", "Portraits de grimpeuses et évolution de la pratique féminine."],
  ["Les enfants et l’escalade", "Pourquoi ce sport peut être particulièrement intéressant pour les jeunes."],
  ["L’escalade est-elle vraiment un sport dangereux ?", "Distinguer les risques réels des idées reçues."],
  ["7 idées reçues sur l’escalade", "Déconstruire les clichés sur ce sport."],
  ["Les plus beaux sites d’escalade au monde", "Voyage à travers quelques falaises et paysages mythiques."],
  ["Les grimpeurs face à la nature", "Comment pratiquer l’escalade en respectant l’environnement."],
  ["L’escalade et l’écologie", "Impact des pratiquants sur les falaises, la faune et la flore."],
  ["De débutant à expert : les différents niveaux en escalade", "Comprendre les cotations et les difficultés."],
  ["Une journée dans la vie d’un grimpeur", "Raconter une journée d’entraînement ou de compétition."],
  ["Quand l’escalade devient une aventure", "Présenter une ascension spectaculaire ou une expédition célèbre."],
  ["Pourquoi tombe-t-on amoureux de l’escalade ?", "Témoignages et raisons qui poussent les grimpeurs à continuer : liberté, défi, nature, sensations…"]
];
export const SUJETS = LISTE.map(([titre, desc], i) => ({ id: "s" + String(i + 1).padStart(2, "0"), num: i + 1, titre, desc }));

// ---------------------------------------------------------------------
// Vue « Article » de l'étudiant. Renvoie du HTML.
//   cfg     : { visibles, choixOuverts }
//   sujets  : liste des sujets, ou null si l'étudiant n'y a pas accès
//   ins     : son inscription (ou null)
//   apercu  : true dans l'espace prof (rien n'est cliquable)
// ---------------------------------------------------------------------
export function htmlArticle({ cfg = {}, sujets, ins, apercu = false }) {
  const dis = apercu ? "disabled" : "";
  if (!cfg.visibles || !sujets) {
    return `<div class="carte article-ferme"><h3>Article de gazette</h3>
      <p>🔒 Les sujets d'article ne sont pas encore disponibles.</p>
      <p class="small muted">Ton enseignant·e t'indiquera quand tu pourras les découvrir et choisir le tien.</p></div>`;
  }
  if (!ins) {
    const libres = sujets.filter(s => !s.pris);
    const ouvert = !!cfg.choixOuverts;
    return `<div class="carte">
        <h3>Choisis ton sujet d'article</h3>
        <p>${ouvert
          ? "Tu écris <b>seul·e</b> un article d'environ une page. <b>Le choix est définitif</b> : premier arrivé, premier servi."
          : "Voici les sujets. <b>Le choix n'est pas encore ouvert</b> : reviens quand ton enseignant·e te le dira."}</p>
        <div class="ligne"><span class="pastille ${libres.length ? "ok" : "bad"}">${libres.length} sujet${libres.length > 1 ? "s" : ""} disponible${libres.length > 1 ? "s" : ""}</span>
          <span class="small muted">sur ${sujets.length}</span></div>
      </div>
      <div class="sujets">${sujets.map(s => `
        <div class="sujet ${s.pris ? "pris" : ""}">
          <span class="num">Sujet ${s.num}</span>
          <b class="titre">${esc(s.titre)}</b>
          <span class="desc small">${esc(s.desc)}</span>
          ${s.pris
            ? `<span class="pastille">Déjà pris · ${esc(s.par)}</span>`
            : `<button class="primaire" data-choisir="${s.id}" ${ouvert && !apercu ? "" : "disabled"}>Choisir ce sujet</button>`}
        </div>`).join("")}</div>`;
  }
  const aRelire = ins.aRelire || [], relus = ins.relus || {};
  const nbRelus = aRelire.filter(a => relus[a.sujet]).length;
  return `
    <div class="carte">
      <p class="small muted" style="margin:0">Mon sujet</p>
      <h3 style="margin:4px 0">Sujet ${ins.num} · ${esc(ins.titre)}</h3>
      ${(sujets.find(s => s.id === ins.sujet) || {}).desc ? `<p class="small muted">${esc(sujets.find(s => s.id === ins.sujet).desc)}</p>` : ""}
    </div>
    <div class="carte">
      <h3>Mon article</h3>
      <label class="coche"><input type="checkbox" data-realise ${ins.realise ? "checked" : ""} ${dis}>
        <span>J'ai <b>réalisé</b> mon article</span></label>
    </div>
    <div class="carte">
      <h3>Articles à relire ${aRelire.length ? `<span class="pastille ${nbRelus === aRelire.length ? "ok" : ""}">${nbRelus}/${aRelire.length}</span>` : ""}</h3>
      ${aRelire.length ? aRelire.map(a => `
        <label class="coche"><input type="checkbox" data-relu="${esc(a.sujet)}" ${relus[a.sujet] ? "checked" : ""} ${dis}>
          <span>J'ai <b>relu</b> l'article de ${esc(a.nom)}<br><span class="small muted">Sujet ${a.num} : ${esc(a.titre)} · orthographe et mise en forme</span></span></label>`).join("")
        : `<p class="small muted">Ton enseignant·e n'a pas encore désigné les articles que tu dois relire.</p>`}
    </div>
    <div class="carte">
      <h3>Mon article est relu par</h3>
      ${(ins.relecteurs || []).length
        ? `<div class="ligne">${ins.relecteurs.map(n => `<span class="pastille accent">${esc(n)}</span>`).join("")}</div>`
        : `<p class="small muted">Tes relecteurs n'ont pas encore été désignés.</p>`}
    </div>`;
}
