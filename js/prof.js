// =====================================================================
//  prof.js — Espace enseignant (PC)
// =====================================================================
import * as DB from "./db.js";
import {
  SECTEURS, COULEURS, COTATIONS, TOUTES_PRISES, CRENEAUX, MODES, RESULTATS, RESSENTIS, OBJECTIFS, libelle, rangCotation,
  fmtDate, fmtHeure, esc
} from "./topo.js";
import { maxTete, maxMoulinette, pyramide, jour, meilleure, enchaine } from "./stats.js";
import { SEMESTRES, BAREMES, NIVEAUX, pointsBareme, noteCritere, notePartie, nbItems, niveauxSaisis, fmtNote } from "./evaluation.js";

const app = document.getElementById("app");
const modal = document.getElementById("modal");

let etudiants = [], topo = [];
let onglet = "direct", filtreGroupe = "", recherche = "", groupeQR = "";
let ouvertes = [], seanceSuivie = null, passagesLive = [], vusIds = new Set();
let arretSeances = null, arretPassages = null, minuterie = null;

if (DB.MODE_DEMO) document.getElementById("demo").classList.remove("cache");

function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
const urlEtudiant = code => new URL("index.html#" + code, location.href).href;
const puce = c => `<span class="puce" style="background:${COULEURS[c] || "#ccc"}" title="${esc(c)}"></span>`;
const groupes = () => CRENEAUX;
// Cases à cocher Jeudi / Vendredi (au moins une)
const casesCreneaux = (prefixe, coches = []) => `<div class="ligne" style="gap:14px;min-height:44px">${CRENEAUX.map(g =>
  `<label class="small" style="margin:0;font-weight:600;font-size:1rem;display:inline-flex;align-items:center;gap:6px"><input type="checkbox" class="${prefixe}" value="${g}" style="width:auto" ${coches.includes(g) ? "checked" : ""}> ${g}</label>`).join("")}</div>`;
const creneauxCoches = (zone, prefixe) => [...zone.querySelectorAll(`input.${prefixe}:checked`)].map(i => i.value);
const dansGroupe = (e, g) => DB.groupesDe(e).includes(g);
const sansAccent = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
// Retrouver un étudiant déjà inscrit (même nom + prénom) pour éviter les doublons
const dejaInscrit = (nom, prenom) => etudiants.find(e => sansAccent(e.nom) === sansAccent(nom) && sansAccent(e.prenom) === sansAccent(prenom));
const pastillesGroupes = e => DB.groupesDe(e).map(g => `<span class="pastille accent">${esc(g)}</span>`).join(" ") || `<span class="muted">—</span>`;
const ilYa = iso => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : `il y a ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};

function demander(message, libelleBtn = "Confirmer") {
  return new Promise(res => {
    const d = document.createElement("div");
    d.className = "modal-fond"; d.style.zIndex = 70;
    d.innerHTML = `<div class="modal" style="max-width:420px"><p>${esc(message)}</p>
      <div class="ligne" style="justify-content:flex-end;margin-top:16px">
        <button id="cf-non">Annuler</button><button class="primaire" id="cf-oui">${esc(libelleBtn)}</button></div></div>`;
    document.body.appendChild(d);
    d.querySelector("#cf-non").onclick = () => { d.remove(); res(false); };
    d.querySelector("#cf-oui").onclick = () => { d.remove(); res(true); };
  });
}

// ---------------- Connexion ----------------
DB.surEtatProf(async (connecte, user) => {
  if (!connecte) return vueConnexion();
  await entrer(user);
});

async function entrer(user) {
  try {
    await charger();
  } catch (e) {
    console.error(e);
    await DB.profDeconnexion();
    return vueConnexion(`Le compte ${user?.email || ""} n'est pas autorisé. Connectez-vous avec le compte Gmail enseignant.`);
  }
  document.getElementById("btn-deco").classList.remove("cache");
  arretSeances = await DB.ecouterSeancesOuvertes(l => {
    ouvertes = l.sort((a, b) => b.debut.localeCompare(a.debut));
    if (seanceSuivie && !ouvertes.find(s => s.id === seanceSuivie.id)) suivre(null);
    if (!seanceSuivie && ouvertes.length) suivre(ouvertes[0]);
    if (onglet === "direct") vueDirect();
  });
  minuterie = setInterval(() => { if (onglet === "direct" && seanceSuivie) majDirect(); }, 30000);
  rendre();
}

function vueConnexion(err = "") {
  document.getElementById("btn-deco").classList.add("cache");
  app.innerHTML = `
    <div class="carte" style="max-width:420px;margin:40px auto">
      <h2>Connexion enseignant</h2>
      <p class="muted small">Connectez-vous avec votre compte Gmail enseignant.</p>
      ${err ? `<p class="small" style="color:var(--bad)">${esc(err)}</p>` : ""}
      <button id="btn-google" class="primaire plein" style="margin-top:14px">Se connecter avec Google</button>
    </div>`;
  document.getElementById("btn-google").onclick = async () => {
    try {
      await DB.profConnexion();
      if (DB.MODE_DEMO) await entrer();
    } catch (e) {
      console.error(e);
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
      vueConnexion(e.code === "auth/unauthorized-domain"
        ? "Ce site n'est pas autorisé dans Firebase (Authentication > Paramètres > Domaines autorisés)."
        : "Connexion impossible. Réessayez.");
    }
  };
}
document.getElementById("btn-deco").onclick = async () => {
  [arretSeances, arretPassages].forEach(f => { try { f && f(); } catch (e) {} });
  clearInterval(minuterie);
  await DB.profDeconnexion(); vueConnexion();
};

async function charger() {
  [etudiants, topo] = await Promise.all([DB.listerEtudiants(), DB.getTopo()]);
  etudiants.sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom, "fr"));
}

// ---------------- Rendu ----------------
function rendre() {
  app.innerHTML = `
    <nav class="onglets no-print">
      ${[["direct", "● En direct"], ["seances", "Séances"], ["etudiants", `Étudiants (${etudiants.length})`], ["evaluation", "Évaluation"], ["qr", "QR codes"], ["topo", "Topo"]]
        .map(([id, l]) => `<button data-o="${id}" class="${onglet === id ? "actif" : ""}">${l}</button>`).join("")}
    </nav>
    <section id="contenu"></section>`;
  app.querySelectorAll("[data-o]").forEach(b => b.onclick = () => {
    if (b.dataset.o === "evaluation" && onglet !== "evaluation") evals = null;   // recharge (nouvelles voies, nouveaux étudiants)
    onglet = b.dataset.o; rendre();
  });
  ({ direct: vueDirect, seances: vueSeances, etudiants: vueEtudiants, evaluation: vueEvaluation, qr: vueQR, topo: vueTopo })[onglet]();
}
const contenu = () => document.getElementById("contenu");

// ================= EN DIRECT =================
async function suivre(s) {
  if (arretPassages) { try { arretPassages(); } catch (e) {} arretPassages = null; }
  seanceSuivie = s; passagesLive = []; vusIds = new Set();
  if (!s) return;
  let premier = true;
  arretPassages = await DB.ecouterPassagesSeance(s.id, l => {
    passagesLive = l;
    if (premier) { l.forEach(p => vusIds.add(p.id)); premier = false; }
    if (onglet === "direct") majDirect();
  });
}

function vueDirect() {
  const c = contenu();
  if (!c || onglet !== "direct") return;
  const gs = groupes();
  c.innerHTML = `
    <div class="carte no-print">
      <div class="entete-carte">
        <div class="ligne">
          ${ouvertes.length ? ouvertes.map(s => `<button data-suivre="${s.id}" class="${seanceSuivie?.id === s.id ? "primaire" : ""}"><span class="point-live"></span>${esc(s.groupe)} · ${fmtHeure(s.debut)}</button>`).join("")
            : `<span class="muted">Aucune séance ouverte.</span>`}
          ${seanceSuivie ? `<button class="danger-plein" id="btn-cloturer">■ Clôturer la séance ${esc(seanceSuivie.groupe)}</button>` : ""}
        </div>
        <form id="f-ouvrir" class="ligne">
          <select id="o-groupe" style="width:220px" required>
            <option value="">Groupe…</option>${gs.map(g => `<option>${esc(g)}</option>`).join("")}
          </select>
          <button class="primaire">Ouvrir une séance</button>
        </form>
      </div>
      ${gs.length ? "" : `<p class="small muted">Ajoutez d'abord des étudiants avec leur groupe (onglet Étudiants).</p>`}
    </div>
    <div id="direct"></div>`;
  c.querySelectorAll("[data-suivre]").forEach(b => b.onclick = async () => { await suivre(ouvertes.find(s => s.id === b.dataset.suivre)); vueDirect(); });
  c.querySelector("#f-ouvrir").onsubmit = async ev => {
    ev.preventDefault();
    const g = c.querySelector("#o-groupe").value;
    if (!g) return;
    if (ouvertes.find(s => s.groupe === g)) return toast("Une séance est déjà ouverte pour ce groupe");
    const s = await DB.ouvrirSeance(g);
    await suivre(s);
    vueDirect();
    toast(`Séance ouverte pour ${g}`);
  };
  const clot = c.querySelector("#btn-cloturer");
  if (clot) clot.onclick = async () => {
    const s = seanceSuivie;
    if (!(await demander(`Clôturer la séance « ${s.groupe} » ? Les étudiants ne pourront plus y ajouter de voies (elles iront dans leur carnet).`, "Clôturer"))) return;
    await DB.cloturerSeance(s.id); toast("Séance clôturée");
  };
  majDirect();
}

function majDirect() {
  const z = document.getElementById("direct");
  if (!z) return;
  const s = seanceSuivie;
  if (!s) { z.innerHTML = ""; return; }
  const inscrits = etudiants.filter(e => dansGroupe(e, s.groupe));
  const parCode = {};
  for (const p of passagesLive) (parCode[p.code] ||= []).push(p);
  const etat = l => {
    if (!l?.length) return ["absent", "Pas encore de voie"];
    const m = (Date.now() - new Date(l[l.length - 1].date).getTime()) / 60000;
    return m < 15 ? ["actif", "Actif"] : ["calme", `Rien depuis ${Math.round(m)} min`];
  };
  const parRelais = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [i + 1, 0]));
  passagesLive.forEach(p => { if (parRelais[p.relais] !== undefined) parRelais[p.relais]++; });
  const maxR = Math.max(1, ...Object.values(parRelais));
  const actifs = inscrits.filter(e => etat(parCode[e.code])[0] === "actif").length;
  const presents = inscrits.filter(e => parCode[e.code]?.length).length;

  z.innerHTML = `
    <div class="grille g3" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <div class="stat accent"><div class="val num">${presents}/${inscrits.length}</div><div class="lbl">Ont grimpé</div></div>
      <div class="stat"><div class="val num">${actifs}</div><div class="lbl">Actifs (15 min)</div></div>
      <div class="stat"><div class="val num">${passagesLive.length}</div><div class="lbl">Voies</div></div>
      <div class="stat"><div class="val">${maxTete(passagesLive) || "—"}</div><div class="lbl">Max en tête</div></div>
    </div>
    <div class="live-grille">
      <div>
        <div class="carte">
          <div class="entete-carte">
            <h3>${esc(s.groupe)} · depuis ${fmtHeure(s.debut)}</h3>
            <button id="btn-csv-live">⬇ CSV</button>
          </div>
          <div class="table-scroll"><table>
            <thead><tr><th>Étudiant</th><th class="num">Voies</th><th class="num">Ench.</th><th>Max tête</th><th>Max moul.</th><th>Dernière voie</th></tr></thead>
            <tbody>${inscrits.map(e => {
              const l = parCode[e.code] || [], [cl, txt] = etat(l), der = l[l.length - 1];
              return `<tr data-voir="${e.code}" style="cursor:pointer">
                <td><span class="etat ${cl}" title="${esc(txt)}"></span><b>${esc(e.prenom)}</b> ${esc(e.nom)}</td>
                <td class="num">${l.length || "<span class=muted>0</span>"}</td>
                <td class="num">${l.filter(p => p.resultat === "enchaine").length}</td>
                <td><b>${maxTete(l) || "—"}</b></td><td>${maxMoulinette(l) || "—"}</td>
                <td class="small">${der ? `${puce(der.couleur)} <b>${esc(der.cotation)}</b> R${der.relais} · ${libelle(RESULTATS, der.resultat)} <span class="muted">· ${ilYa(der.date)}</span>` : `<span class="muted">${esc(txt)}</span>`}</td>
              </tr>`;
            }).join("") || `<tr><td colspan="6" class="vide">Aucun étudiant dans ce groupe.</td></tr>`}</tbody>
          </table></div>
        </div>
        <div class="carte">
          <h3>Fréquentation du mur</h3>
          <div class="mur-relais">${Object.entries(parRelais).map(([r, n]) =>
            `<div style="background:color-mix(in srgb, var(--accent) ${Math.round(n / maxR * 70)}%, var(--surface-2))"><b>${r}</b>${n}</div>`).join("")}</div>
          <p class="small muted" style="margin-top:6px">${SECTEURS.map(x => `${x.nom} : R${x.relais[0]}–${x.relais[x.relais.length - 1]}`).join(" · ")}</p>
        </div>
      </div>
      <div class="carte">
        <div class="entete-carte"><h3>Fil en direct</h3><span class="point-live" title="Mise à jour automatique"></span></div>
        <div class="fil">${[...passagesLive].reverse().map(p => {
          const res = RESULTATS.find(r => r[0] === p.resultat) || [];
          const neuf = !vusIds.has(p.id);
          return `<div class="passage${neuf ? " nouveau" : ""}">${puce(p.couleur)}<span class="cot">${esc(p.cotation)}</span>
            <div class="info"><div><b>${esc(p.etudiant)}</b> <span class="small muted">· R${p.relais} ${libelle(MODES, p.mode).toLowerCase()}</span></div>
            <div class="small muted">${p.objectif ? `<b class="txt-objectif ${p.objectif}">${libelle(OBJECTIFS, p.objectif)}</b> · ` : ""}${fmtHeure(p.date)}${p.assureur ? " · ass. " + esc(p.assureur) : ""}${p.ressenti ? " · " + libelle(RESSENTIS, p.ressenti) : ""}</div></div>
            <span class="pastille ${res[2] || ""}">${res[1] || ""}</span>
            <button class="lien icone" data-edit="${p.id}" title="Corriger cette voie">✎</button></div>`;
        }).join("") || `<div class="vide">Les voies apparaîtront ici dès qu'un étudiant les enregistre.</div>`}</div>
      </div>
    </div>`;
  passagesLive.forEach(p => vusIds.add(p.id));
  z.querySelectorAll("[data-voir]").forEach(tr => tr.onclick = () => ficheEtudiant(tr.dataset.voir));
  z.querySelector("#btn-csv-live").onclick = () => exporterPassages(passagesLive, `seance-${s.groupe}-${jour(s.debut)}`);
  // Correction depuis le fil (la vue se met à jour seule grâce à l'écoute en direct)
  z.querySelectorAll("[data-edit]").forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const p = passagesLive.find(x => x.id === b.dataset.edit);
    if (p) ouvrirEdition(p);
  });
}

// ================= SÉANCES (historique) =================
async function vueSeances() {
  const c = contenu();
  c.innerHTML = `<div class="vide">Chargement…</div>`;
  const liste = await DB.listerSeances();
  c.innerHTML = `
    <div class="carte">
      <h3>Historique des séances</h3>
      <div class="table-scroll" style="margin-top:8px">${liste.length ? `<table>
        <thead><tr><th>Date</th><th>Groupe</th><th>Horaire</th><th>État</th><th></th></tr></thead>
        <tbody>${liste.map(s => `<tr>
          <td>${fmtDate(s.debut)}</td><td><b>${esc(s.groupe)}</b></td>
          <td class="small">${fmtHeure(s.debut)}${s.fin ? " – " + fmtHeure(s.fin) : ""}</td>
          <td>${s.ouverte ? `<span class="pastille ok">Ouverte</span>` : `<span class="pastille">Clôturée</span>`}</td>
          <td><button class="lien" data-voir-s="${s.id}">Voir</button></td></tr>`).join("")}</tbody></table>`
        : `<div class="vide">Aucune séance. Ouvrez-en une depuis l'onglet « En direct ».</div>`}</div>
    </div>`;
  c.querySelectorAll("[data-voir-s]").forEach(b => b.onclick = () => ficheSeance(liste.find(s => s.id === b.dataset.voirS)));
}

async function ficheSeance(s, vue) {
  const l = await DB.listerPassagesSeance(s.id);
  vue ||= s.ouverte ? "detail" : "synthese";   // séance clôturée : on ouvre sur la synthèse
  modal.innerHTML = `
    <div class="modal-fond"><div class="modal" style="max-width:960px">
      <div class="entete-carte">
        <div><h2>${esc(s.groupe)}</h2><p class="muted small">${fmtDate(s.debut)} · ${fmtHeure(s.debut)}${s.fin ? " – " + fmtHeure(s.fin) : ""} · ${l.length} voies · ${new Set(l.map(p => p.code)).size} étudiants</p></div>
        <button id="fermer">✕</button>
      </div>
      <nav class="onglets" style="margin-top:4px">
        <button data-vue="synthese" class="${vue === "synthese" ? "actif" : ""}">Synthèse par étudiant</button>
        <button data-vue="detail" class="${vue === "detail" ? "actif" : ""}">Détail des voies (modifiable)</button>
      </nav>
      <div id="vue-seance">${vue === "synthese" ? syntheseSeance(s, l) : tablePassages(l, true, true)}</div>
      <div class="ligne espace no-print" style="margin-top:16px">
        <button class="danger" id="suppr-s">Supprimer la séance</button>
        <div class="ligne">${s.ouverte ? `<button id="clot-s">Clôturer</button>` : ""}<button id="print-s">🖨 Imprimer</button><button class="primaire" id="csv-s">⬇ Export CSV</button></div>
      </div>
    </div></div>`;
  const fermer = () => { modal.innerHTML = ""; };
  modal.querySelector("#fermer").onclick = fermer;
  modal.querySelector(".modal-fond").onclick = ev => { if (ev.target.classList.contains("modal-fond")) fermer(); };
  modal.querySelectorAll("[data-vue]").forEach(b => b.onclick = () => ficheSeance(s, b.dataset.vue));
  brancherEdition(modal, l, () => ficheSeance(s, vue));
  modal.querySelector("#csv-s").onclick = () => exporterPassages(l, `seance-${s.groupe}-${jour(s.debut)}`);
  modal.querySelector("#print-s").onclick = () => window.print();
  const clot = modal.querySelector("#clot-s");
  if (clot) clot.onclick = async () => { await DB.cloturerSeance(s.id); fermer(); toast("Séance clôturée"); vueSeances(); };
  modal.querySelector("#suppr-s").onclick = async () => {
    if (!(await demander("Supprimer cette séance ? Les voies restent dans le carnet des étudiants.", "Supprimer"))) return;
    await DB.supprimerSeance(s.id); fermer(); toast("Séance supprimée"); vueSeances();
  };
}

// Synthèse d'une séance : pour chaque étudiant, ce qu'il a réussi (sans l'assureur)
function syntheseSeance(s, l) {
  const parCode = {};
  for (const p of l) (parCode[p.code] ||= []).push(p);
  const inscrits = etudiants.filter(e => dansGroupe(e, s.groupe));
  // étudiants du groupe + éventuels passages d'étudiants qui n'y sont plus
  const lignes = inscrits.map(e => ({ nom: `${e.prenom} ${e.nom}`, tri: e.nom + e.prenom, l: parCode[e.code] || [] }));
  for (const code of Object.keys(parCode)) if (!inscrits.find(e => e.code === code))
    lignes.push({ nom: parCode[code][0].etudiant, tri: parCode[code][0].etudiant, l: parCode[code] });
  lignes.sort((a, b) => (b.l.length > 0) - (a.l.length > 0) || a.tri.localeCompare(b.tri, "fr"));
  const parCot = arr => [...arr].sort((a, b) => rangCotation(b.cotation) - rangCotation(a.cotation));
  const chip = p => `<span class="voie-chip">${puce(p.couleur)}<b>${esc(p.cotation)}</b> ${esc(p.nomVoie)} <span class="m">R${p.relais} · ${p.mode === "tete" ? "tête" : "moul."}</span></span>`;
  const resume = arr => parCot(arr).map(p => `${esc(p.cotation)} ${esc(p.nomVoie)} (${p.mode === "tete" ? "tête" : "moul."})`).join(", ");
  if (!lignes.length) return `<p class="muted">Aucun étudiant.</p>`;
  return `<div class="synthese">${lignes.map(({ nom, l: v }) => {
    if (!v.length) return `<div class="synth-etu"><div class="tete"><b>${esc(nom)}</b><span class="muted small">Aucune voie enregistrée</span></div></div>`;
    const ok = v.filter(p => p.resultat === "enchaine"), pose = v.filter(p => p.resultat === "pose"), ko = v.filter(p => p.resultat === "echec");
    return `<div class="synth-etu">
      <div class="tete"><b>${esc(nom)}</b>
        <div class="chiffres"><span><b>${ok.length}</b>/${v.length} enchaînée${ok.length > 1 ? "s" : ""}</span>
          <span>Max tête <b>${maxTete(v) || "—"}</b></span><span>Max moulinette <b>${maxMoulinette(v) || "—"}</b></span></div></div>
      ${ok.length ? `<div class="voies-chips">${parCot(ok).map(chip).join("")}</div>` : `<div class="sous">Aucune voie enchaînée.</div>`}
      ${pose.length ? `<div class="sous"><span class="pastille warn">Avec pose</span> ${resume(pose)}</div>` : ""}
      ${ko.length ? `<div class="sous"><span class="pastille bad">Pas au sommet</span> ${resume(ko)}</div>` : ""}
    </div>`;
  }).join("")}</div>`;
}

function tablePassages(l, avecNom, modifiable = false) {
  if (!l.length) return `<p class="muted">Aucune voie.</p>`;
  return `<div class="table-scroll"><table>
    <thead><tr><th>Heure</th>${avecNom ? "<th>Étudiant</th>" : "<th>Date</th>"}<th>Voie</th><th>Cot.</th><th>Exercice</th><th>Mode</th><th>Résultat</th><th>Assureur</th><th>Ressenti</th>${modifiable ? `<th class="no-print"></th>` : ""}</tr></thead>
    <tbody>${[...l].reverse().map(p => {
      const res = RESULTATS.find(r => r[0] === p.resultat) || [];
      return `<tr><td class="small">${fmtHeure(p.date)}</td>
        <td>${avecNom ? `<b>${esc(p.etudiant)}</b>` : `<span class="small">${fmtDate(p.date)}</span>`}</td>
        <td>${puce(p.couleur)} R${p.relais} · ${esc(p.nomVoie)}</td><td><b>${esc(p.cotation)}</b></td>
        <td>${p.objectif ? `<span class="pastille exo ${p.objectif}">${libelle(OBJECTIFS, p.objectif)}</span>` : `<span class="muted">—</span>`}</td>
        <td>${libelle(MODES, p.mode)}</td><td><span class="pastille ${res[2] || ""}">${res[1] || ""}</span></td>
        <td class="small">${esc(p.assureur || "—")}</td><td class="small">${p.ressenti ? libelle(RESSENTIS, p.ressenti) : "—"}</td>
        ${modifiable ? `<td class="no-print"><button class="icone" data-edit="${p.id}" title="Corriger ou supprimer cette voie">✎ Modifier</button></td>` : ""}</tr>`;
    }).join("")}</tbody></table></div>`;
}

// Branche les boutons ✎ d'une zone sur la fenêtre de correction
function brancherEdition(zone, l, apres) {
  zone.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
    const p = l.find(x => x.id === b.dataset.edit);
    if (p) ouvrirEdition(p, apres);
  });
}

// Fenêtre de correction d'un passage par l'enseignant
function ouvrirEdition(p, apres) {
  const nomsGroupe = etudiants.filter(e => dansGroupe(e, p.groupe)).map(DB.nomCourt).filter(n => n !== p.etudiant)
    .sort((a, b) => a.localeCompare(b, "fr"));
  const assureurs = [...new Set([...nomsGroupe, "Enseignant·e", "Autre", ...(p.assureur ? [p.assureur] : [])])];
  const voies = topo.filter(v => v.actif !== false || v.id === p.voieId)
    .sort((a, b) => a.relais - b.relais || rangCotation(a.cotation) - rangCotation(b.cotation));
  const opt = (liste, val) => liste.map(([k, lib]) => `<option value="${k}" ${k === val ? "selected" : ""}>${esc(lib)}</option>`).join("");
  const d = document.createElement("div");
  d.className = "modal-fond"; d.style.zIndex = 60;
  d.innerHTML = `<div class="modal" style="max-width:560px">
    <div class="entete-carte"><div><h3>Corriger la voie de ${esc(p.etudiant)}</h3>
      <p class="muted small">${fmtDate(p.date)} · ${fmtHeure(p.date)}</p></div><button id="e-fermer">✕</button></div>
    <div class="form-edit">
      <div class="large"><label for="e-voie">Voie</label>
        <select id="e-voie">${voies.some(v => v.id === p.voieId) ? ""
            : `<option value="" selected>R${p.relais} · ${esc(p.nomVoie)} — ${esc(p.cotation)} · ${esc(p.couleur)} (inchangée)</option>`}
          ${voies.map(v => `<option value="${esc(v.id)}" ${v.id === p.voieId ? "selected" : ""}>R${v.relais} · ${esc(v.nom)} — ${esc(v.cotation)} · ${esc(v.couleur)}</option>`).join("")}</select></div>
      <div><label for="e-obj">Type d'exercice</label><select id="e-obj"><option value="">—</option>${opt(OBJECTIFS, p.objectif)}</select></div>
      <div><label for="e-mode">Mode</label><select id="e-mode">${opt(MODES, p.mode)}</select></div>
      <div><label for="e-res">Résultat</label><select id="e-res">${opt(RESULTATS, p.resultat)}</select></div>
      <div><label for="e-ass">Assuré·e par</label><select id="e-ass"><option value="">—</option>${assureurs.map(n => `<option ${n === p.assureur ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
      <div><label for="e-ress">Ressenti</label><select id="e-ress"><option value="">—</option>${opt(RESSENTIS, p.ressenti)}</select></div>
    </div>
    <div class="ligne espace" style="margin-top:18px">
      <button class="danger" id="e-suppr">🗑 Supprimer cette voie</button>
      <div class="ligne"><button id="e-annuler">Annuler</button><button class="primaire" id="e-ok">Enregistrer</button></div></div>
  </div>`;
  document.body.appendChild(d);
  const fermer = () => d.remove();
  d.querySelector("#e-fermer").onclick = fermer;
  d.querySelector("#e-annuler").onclick = fermer;
  d.onclick = ev => { if (ev.target === d) fermer(); };
  d.querySelector("#e-suppr").onclick = async () => {
    if (!(await demander(`Supprimer définitivement « ${p.nomVoie} » (${p.cotation}) de ${p.etudiant}, du ${fmtDate(p.date)} à ${fmtHeure(p.date)} ? Elle disparaît de son carnet et de la séance.`, "Supprimer"))) return;
    try {
      await DB.supprimerPassage(p);
      fermer(); toast("Voie supprimée");
      if (apres) apres();
    } catch (e) { console.error(e); toast("Suppression impossible : vérifiez la connexion."); }
  };
  d.querySelector("#e-ok").onclick = async ev => {
    const champs = {
      objectif: d.querySelector("#e-obj").value,
      mode: d.querySelector("#e-mode").value,
      resultat: d.querySelector("#e-res").value,
      assureur: d.querySelector("#e-ass").value,
      ressenti: d.querySelector("#e-ress").value
    };
    const v = topo.find(x => x.id === d.querySelector("#e-voie").value);
    if (v && v.id !== p.voieId)
      Object.assign(champs, { voieId: v.id, relais: v.relais, couleur: v.couleur, cotation: v.cotation, nomVoie: v.nom, secteur: v.secteur });
    ev.target.disabled = true;
    try {
      await DB.modifierPassage(p, champs);
      Object.assign(p, champs);
      fermer(); toast("Voie corrigée ✔");
      if (apres) apres();
    } catch (e) {
      console.error(e); ev.target.disabled = false;
      toast("Modification impossible : vérifiez la connexion.");
    }
  };
}

function exporterPassages(l, nom) {
  const entete = ["Date", "Heure", "Étudiant", "Code", "Groupe", "Secteur", "Relais", "Couleur", "Voie", "Cotation", "Type d'exercice", "Mode", "Résultat", "Assureur", "Ressenti"];
  const rows = l.map(p => [fmtDate(p.date), fmtHeure(p.date), p.etudiant, p.code, p.groupe, p.secteur, p.relais, p.couleur, p.nomVoie, p.cotation,
    p.objectif ? libelle(OBJECTIFS, p.objectif) : "", libelle(MODES, p.mode), libelle(RESULTATS, p.resultat), p.assureur, p.ressenti ? libelle(RESSENTIS, p.ressenti) : ""]);
  const csv = [entete, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `escalade-${nom}.csv`.replace(/[^\w.-]+/g, "_");
  a.click();
}

// ================= ÉVALUATION =================
// Les données détaillées restent côté enseignant ; l'étudiant ne reçoit que les grands critères, après publication.
let evals = null, maxParCode = {};
let evSem = "s1", evPartie = "inv", evCode = null, evGroupe = "";
const minuteurs = {};

async function chargerEvaluation() {
  const [ev, cfg, ...carnets] = await Promise.all([
    DB.listerEvaluations(), DB.getConfigEvaluation(), ...etudiants.map(e => DB.listerPassagesEtudiant(e.code))]);
  evals = ev;
  // Les notes ne sont jamais montrées aux étudiants : on efface ce qu'une ancienne version aurait publié
  if (Object.values(cfg?.publie || {}).some(Boolean)) {
    await Promise.all(etudiants.map(e => DB.supprimerNotesPubliees(e.code)));
    await DB.saveConfigEvaluation({ publie: {} });
  }
  etudiants.forEach((e, i) => {
    maxParCode[e.code] = { toutes: meilleure(carnets[i], enchaine), tete: maxTete(carnets[i]), moulinette: maxMoulinette(carnets[i]) };
  });
}
const ctxEval = e => ({ sexe: e.sexe, maxEnchaine: maxParCode[e.code] || {} });
const etatsDe = (code, sem, partie) => ((evals[code] ||= {})[sem] ||= {})[partie] ||= {};
// Actif = a enregistré une voie dans la séance suivie il y a moins de 15 min
const actifs = () => new Set(passagesLive.filter(p => Date.now() - new Date(p.date) < 15 * 60000).map(p => p.code));

function sauverEval(code) {
  const statut = document.getElementById("ev-statut");
  if (statut) statut.textContent = "Enregistrement…";
  clearTimeout(minuteurs[code]);
  const donnees = evals[code];   // la version à enregistrer, même si l'onglet est rechargé entre-temps
  minuteurs[code] = setTimeout(async () => {
    try {
      await DB.saveEvaluation(code, donnees);
      const st = document.getElementById("ev-statut"); if (st) st.textContent = "✓ Enregistré";
    } catch (err) {
      console.error(err);
      const st = document.getElementById("ev-statut"); if (st) st.textContent = "⚠ Non enregistré";
      toast("Évaluation non enregistrée : vérifiez la connexion.");
    }
  }, 600);
}

async function vueEvaluation() {
  const c = contenu();
  if (!evals) {
    c.innerHTML = `<div class="carte"><p class="muted">Chargement des évaluations…</p></div>`;
    try { await chargerEvaluation(); } catch (e) { console.error(e); c.innerHTML = `<div class="carte"><p>Impossible de charger les évaluations.</p></div>`; return; }
    if (onglet !== "evaluation") return;
  }
  const liste = etudiants.filter(e => !evGroupe || dansGroupe(e, evGroupe));
  if (!liste.find(e => e.code === evCode)) evCode = liste[0]?.code || null;
  const S = SEMESTRES[evSem], act = actifs();
  c.innerHTML = `
    <div class="carte ev-barre no-print">
      <div class="segment">${Object.entries(SEMESTRES).map(([k, v]) => `<button data-sem="${k}" class="${k === evSem ? "actif" : ""}">${v.court}</button>`).join("")}</div>
      <select id="ev-groupe" style="width:auto"><option value="">Jeudi + Vendredi</option>${CRENEAUX.map(g => `<option ${g === evGroupe ? "selected" : ""}>${g}</option>`).join("")}</select>
      <button id="ev-recap">📋 Récapitulatif</button>
      <button class="danger" id="ev-raz-tous">Remettre à zéro tous les étudiants</button>
    </div>
    ${liste.length ? `<div class="ev-grille">
      <aside class="carte ev-liste">
        <select id="ev-choix" class="ev-choix-mobile">${liste.map(e => `<option value="${e.code}" ${e.code === evCode ? "selected" : ""}>${esc(e.prenom)} ${esc(e.nom)}</option>`).join("")}</select>
        <div class="ev-liste-noms">${liste.map(e => {
          const ctx = ctxEval(e);
          return `<button class="ev-nom ${e.code === evCode ? "actif" : ""}" data-ev="${e.code}">
            <span class="n">${act.has(e.code) ? `<span class="pt-actif" title="Grimpe en ce moment"></span>` : ""}${esc(e.prenom)} <b>${esc(e.nom)}</b></span>
            <span class="mini">${S.parties.map(pa => { const np = notePartie(pa, evals[e.code]?.[evSem]?.[pa.id], ctx);
              return `<i class="${np.complet ? "ok" : np.notes ? "part" : ""}" title="${esc(pa.titre)}">${np.notes ? fmtNote(np.total) : "–"}</i>`; }).join("")}</span>
          </button>`; }).join("")}</div>
        <p class="small muted" style="margin:8px 4px 0">Colonnes : ${S.parties.map(p => p.court).join(" · ")}. <span class="pt-actif"></span> = a grimpé il y a moins de 15 min.</p>
      </aside>
      <div id="ev-panneau"></div>
    </div>` : `<div class="carte vide">Aucun étudiant${evGroupe ? " sur ce créneau" : ""}.</div>`}`;
  c.querySelectorAll("[data-sem]").forEach(b => b.onclick = () => { evSem = b.dataset.sem; vueEvaluation(); });
  c.querySelector("#ev-groupe").onchange = ev => { evGroupe = ev.target.value; vueEvaluation(); };
  c.querySelectorAll("[data-ev]").forEach(b => b.onclick = () => { evCode = b.dataset.ev; vueEvaluation(); });
  const ch = c.querySelector("#ev-choix"); if (ch) ch.onchange = () => { evCode = ch.value; vueEvaluation(); };
  c.querySelector("#ev-recap").onclick = () => recapEvaluation();
  // Effacer les notes du semestre affiché pour tous les étudiants de la liste
  c.querySelector("#ev-raz-tous").onclick = async () => {
    const qui = evGroupe ? `du créneau ${evGroupe}` : "(Jeudi et Vendredi)";
    if (!(await demander(`Effacer TOUTES les notes du ${S.titre} pour les ${liste.length} étudiants ${qui} ? Couleurs, ajustements et commentaires de ce semestre seront supprimés. C'est définitif.`, "Tout effacer"))) return;
    if (!(await demander(`Dernière confirmation : effacer l'évaluation du ${S.titre} de ${liste.length} étudiants ?`, "Oui, effacer"))) return;
    try {
      await Promise.all(liste.map(e => { clearTimeout(minuteurs[e.code]); if (evals[e.code]) delete evals[e.code][evSem]; return DB.saveEvaluation(e.code, evals[e.code] || {}); }));
      toast(`Évaluation du ${S.court} remise à zéro`);
    } catch (err) { console.error(err); toast("Effacement impossible : vérifiez la connexion."); }
    vueEvaluation();
  };
  if (evCode) panneauEval();
}

function panneauEval() {
  const z = document.getElementById("ev-panneau");
  const liste = etudiants.filter(e => !evGroupe || dansGroupe(e, evGroupe));
  const i = liste.findIndex(e => e.code === evCode), e = liste[i];
  if (!z || !e) return;
  const S = SEMESTRES[evSem], ctx = ctxEval(e), mx = maxParCode[e.code] || {};
  const partie = S.parties.find(p => p.id === evPartie) || S.parties[0];
  const etats = etatsDe(e.code, evSem, partie.id);
  const np = notePartie(partie, etats, ctx);
  z.innerHTML = `
    <div class="carte ev-tete">
      <div class="ligne espace" style="align-items:center">
        <button class="ev-nav" id="ev-prec" ${i <= 0 ? "disabled" : ""} title="Étudiant précédent">◀</button>
        <div style="flex:1;text-align:center">
          <h2 style="margin:0">${esc(e.prenom)} ${esc(e.nom)}</h2>
          <div class="small muted">${DB.groupesDe(e).join(" · ")} · max enchaîné : moulinette <b>${mx.moulinette || "—"}</b> · tête <b>${mx.tete || "—"}</b></div>
        </div>
        <button class="ev-nav" id="ev-suiv" ${i >= liste.length - 1 ? "disabled" : ""} title="Étudiant suivant">▶</button>
      </div>
      <div class="ligne" style="justify-content:center;gap:8px;margin-top:8px">
        <span class="small muted">Barème :</span>
        <div class="segment petit">${[["F", "Fille"], ["G", "Garçon"]].map(([k, l]) => `<button data-sexe="${k}" class="${e.sexe === k ? "actif" : ""}">${l}</button>`).join("")}</div>
        <span id="ev-statut" class="small muted" style="min-width:90px"></span>
      </div>
    </div>
    <nav class="onglets ev-parties">${S.parties.map(pa => { const n = notePartie(pa, evals[e.code]?.[evSem]?.[pa.id], ctx);
      return `<button data-partie="${pa.id}" class="${pa.id === partie.id ? "actif" : ""}">${pa.court} <span class="pastille ${n.complet ? "ok" : ""}">${n.notes ? fmtNote(n.total) : "–"}/20</span></button>`; }).join("")}</nav>
    <div class="ev-legende">${NIVEAUX.map((n, l) => `<span><i class="niv l${l}"></i>${esc(n)}</span>`).join("")}</div>
    ${partie.note ? `<p class="small muted" style="margin:4px 2px 10px">${esc(partie.note)}</p>` : ""}
    <div class="ev-crits">${np.detail.map(({ cr, n }) => carteCritere(cr, etats[cr.id] || {}, n, ctx)).join("")}</div>
    <div class="carte ev-total ligne espace">
      <span><b>${partie.titre}</b>${np.complet ? "" : ` <span class="small muted">· ${np.notes}/${np.attendus} critères notés</span>`}</span>
      <span class="ev-total-val">${np.notes ? fmtNote(np.total) : "—"} <small>/ 20</small></span>
    </div>
    <div class="carte no-print">
      <label for="ev-comment" style="margin-top:0">Commentaire (privé, jamais montré à l'étudiant) · ${S.court}</label>
      <textarea id="ev-comment" rows="3" placeholder="Remarques, rappels de sécurité, points à revoir…">${esc(evals[e.code]?.[evSem]?.commentaire || "")}</textarea>
    </div>
    <div class="ligne no-print" style="justify-content:flex-end;margin:-4px 0 10px">
      <button class="lien danger" id="ev-raz">Remettre à zéro l'évaluation ${S.court} de ${esc(e.prenom)}</button>
    </div>
    <div class="ligne espace no-print" style="margin-top:4px">
      <button id="ev-prec2" ${i <= 0 ? "disabled" : ""}>◀ Précédent</button>
      <button class="primaire" id="ev-suiv2" ${i >= liste.length - 1 ? "disabled" : ""}>Étudiant suivant ▶</button>
    </div>`;
  const aller = d => { const n = liste[i + d]; if (n) { evCode = n.code; vueEvaluation(); } };
  ["ev-prec", "ev-prec2"].forEach(id => z.querySelector("#" + id).onclick = () => aller(-1));
  ["ev-suiv", "ev-suiv2"].forEach(id => z.querySelector("#" + id).onclick = () => aller(1));
  z.querySelectorAll("[data-partie]").forEach(b => b.onclick = () => { evPartie = b.dataset.partie; panneauEval(); });
  z.querySelectorAll("[data-sexe]").forEach(b => b.onclick = async () => {
    e.sexe = b.dataset.sexe;
    try { await DB.majEtudiant(e.code, { sexe: e.sexe }); } catch (err) { console.error(err); toast("Non enregistré : vérifiez la connexion."); }
    sauverEval(e.code); vueEvaluation();
  });
  // Modifications d'un critère
  const maj = (id, f) => { const et = (etats[id] ||= {}); f(et); sauverEval(e.code); rafraichir(); };
  const rafraichir = () => { const y = window.scrollY; vueEvaluation(); window.scrollTo(0, y); };
  // Une couleur par sous-critère ; re-toucher la même couleur l'efface
  z.querySelectorAll("[data-niv]").forEach(b => b.onclick = () => maj(b.dataset.crit, et => {
    const k = b.dataset.item, l = +b.dataset.niv;
    et.l ||= {};
    if (et.l[k] === l) delete et.l[k]; else et.l[k] = l;
    delete et.c;   // ancien format (cases à cocher)
    et.p = null;   // la note suit les couleurs
  }));
  z.querySelector("#ev-raz").onclick = async () => {
    if (!(await demander(`Effacer toute l'évaluation du ${S.titre} de ${e.prenom} ${e.nom} (Investissement, Pratique, Théorie et commentaire) ? C'est définitif.`, "Effacer"))) return;
    clearTimeout(minuteurs[e.code]);
    if (evals[e.code]) delete evals[e.code][evSem];
    try { await DB.saveEvaluation(e.code, evals[e.code] || {}); toast(`Évaluation de ${e.prenom} remise à zéro`); }
    catch (err) { console.error(err); toast("Effacement impossible : vérifiez la connexion."); }
    vueEvaluation();
  };
  const com = z.querySelector("#ev-comment");
  com.oninput = () => {
    ((evals[e.code] ||= {})[evSem] ||= {}).commentaire = com.value;
    sauverEval(e.code);
  };
  z.querySelectorAll("[data-pas]").forEach(b => b.onclick = () => maj(b.dataset.crit, et => {
    const cr = partie.criteres.find(x => x.id === b.dataset.crit);
    const actuel = noteCritere(cr, et, ctx)?.pts ?? 0;
    et.p = Math.min(cr.max, Math.max(0, actuel + +b.dataset.pas));
  }));
  z.querySelectorAll("[data-auto]").forEach(b => b.onclick = () => maj(b.dataset.crit, et => { et.p = null; }));
}

function carteCritere(cr, et, n, ctx) {
  const niv = et.l || {}, nb = niveauxSaisis(et).length;
  const source = !n ? "Pas encore noté" : n.source === "manuel" ? "Note ajustée à la main"
    : n.source === "bareme" ? "Calculée avec le barème" : `Moyenne de ${nb}/${nbItems(cr)} sous-critère${nb > 1 ? "s" : ""} évalué${nb > 1 ? "s" : ""}`;
  let k = -1, bareme = "";
  if (cr.auto || cr.indice) {
    const b = BAREMES[cr.auto || cr.indice], cot = ctx.maxEnchaine?.[b.mode];
    const pts = pointsBareme(cr.auto || cr.indice, cot, ctx.sexe);
    bareme = `<div class="ev-bareme">${!ctx.sexe ? "⚠ Choisissez Fille / Garçon en haut pour appliquer le barème."
      : `${b.titre} : meilleure voie enchaînée${b.mode === "tete" ? " en tête" : ""} <b>${cot || "aucune"}</b> → <b>${fmtNote(pts ?? 0)} / 4</b>${cr.indice ? " (indicatif)" : ""}`}</div>`;
  }
  return `<div class="carte ev-crit ${n ? "note" : ""}">
    <div class="ev-crit-tete">
      <div><b>${esc(cr.titre)}</b><div class="small muted">${source}${n && n.source === "manuel" ? ` · <button class="lien" data-auto data-crit="${cr.id}">↺ revenir au calcul</button>` : ""}</div></div>
      <div class="ev-pts">
        <button data-pas="-0.5" data-crit="${cr.id}" aria-label="Retirer un demi-point" title="Ajuster à la main">−</button>
        <span><b>${n ? fmtNote(n.pts) : "—"}</b>/${cr.max}</span>
        <button data-pas="0.5" data-crit="${cr.id}" aria-label="Ajouter un demi-point" title="Ajuster à la main">+</button>
      </div>
    </div>
    ${bareme}
    ${cr.sections.map(([titre, items]) => `
      ${titre ? `<div class="ev-section">${esc(titre)}</div>` : ""}
      ${items.map(t => { k++;
        if (cr.auto) return `<div class="ev-ligne"><span class="muted">${esc(t)}</span></div>`;
        const cur = niv[k];
        return `<div class="ev-ligne"><span>${esc(t)}</span><span class="niveaux">${[0, 1, 2, 3, 4].map(l =>
          `<button class="niv l${l} ${cur === l ? "on" : ""}" data-niv="${l}" data-item="${k}" data-crit="${cr.id}" title="${esc(NIVEAUX[l])}" aria-label="${esc(t)} : ${esc(NIVEAUX[l])}"></button>`).join("")}</span></div>`;
      }).join("")}`).join("")}
    ${cr.reperes ? `<p class="ev-aide">Repères : ${cr.reperes.map(([a, b, t]) => `<b>${a === b ? a : a + "–" + b}</b> ${esc(t)}`).join(" · ")}</p>` : ""}
  </div>`;
}

// Tableau récapitulatif d'un semestre + export CSV détaillé
function recapEvaluation() {
  const S = SEMESTRES[evSem];
  const liste = etudiants.filter(e => !evGroupe || dansGroupe(e, evGroupe));
  const lignes = liste.map(e => {
    const ctx = ctxEval(e);
    return { e, mx: maxParCode[e.code] || {}, parties: S.parties.map(pa => notePartie(pa, evals[e.code]?.[evSem]?.[pa.id], ctx)) };
  });
  modal.innerHTML = `
    <div class="modal-fond"><div class="modal" style="max-width:1000px">
      <div class="entete-carte"><div><h2>Récapitulatif · ${S.titre}</h2>
        <p class="muted small">${evGroupe || "Jeudi + Vendredi"} · ${liste.length} étudiants · notes en italique = partie incomplète</p></div><button id="fermer">✕</button></div>
      <div class="table-scroll"><table>
        <thead><tr><th>Étudiant</th><th>Créneau(x)</th><th>F/G</th><th>Max moul.</th><th>Max tête</th>${S.parties.map(p => `<th>${p.court} /20</th>`).join("")}</tr></thead>
        <tbody>${lignes.map(({ e, mx, parties }) => `<tr>
          <td><b>${esc(e.nom)}</b> ${esc(e.prenom)}</td><td class="small">${DB.groupesDe(e).join(" · ")}</td><td>${e.sexe || "—"}</td>
          <td>${mx.moulinette || "—"}</td><td>${mx.tete || "—"}</td>
          ${parties.map(np => `<td>${np.notes ? (np.complet ? `<b>${fmtNote(np.total)}</b>` : `<i>${fmtNote(np.total)}</i>`) : "—"}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
      <div class="ligne no-print" style="justify-content:flex-end;margin-top:16px">
        <button id="print-r">🖨 Imprimer</button><button class="primaire" id="csv-r">⬇ Export CSV détaillé</button></div>
    </div></div>`;
  const fermer = () => { modal.innerHTML = ""; };
  modal.querySelector("#fermer").onclick = fermer;
  modal.querySelector(".modal-fond").onclick = ev => { if (ev.target.classList.contains("modal-fond")) fermer(); };
  modal.querySelector("#print-r").onclick = () => window.print();
  modal.querySelector("#csv-r").onclick = () => {
    const entete = ["Nom", "Prénom", "Code", "Créneaux", "F/G", "Max moulinette", "Max tête"];
    S.parties.forEach(pa => { pa.criteres.forEach(cr => entete.push(`${pa.court} · ${cr.titre} /${cr.max}`)); entete.push(`${pa.court} /20`); });
    const rows = lignes.map(({ e, mx, parties }) => {
      const r = [e.nom, e.prenom, e.code, DB.groupesDe(e).join(" + "), e.sexe || "", mx.moulinette || "", mx.tete || ""];
      parties.forEach(np => { np.detail.forEach(({ n }) => r.push(n ? fmtNote(n.pts) : "")); r.push(np.notes ? fmtNote(np.total) : ""); });
      return r;
    });
    const csv = [entete, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `escalade-evaluation-${evSem}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };
}

// ================= ÉTUDIANTS =================
function vueEtudiants() {
  const c = contenu();
  const liste = etudiants.filter(e =>
    (!filtreGroupe || dansGroupe(e, filtreGroupe)) &&
    (!recherche || (e.nom + " " + e.prenom + " " + e.code).toLowerCase().includes(recherche.toLowerCase())));
  c.innerHTML = `
    <div class="grille g2 no-print">
      <div class="carte">
        <h3>Ajouter un étudiant</h3>
        <form id="f-add" class="grille g3" style="align-items:end">
          <div><label>Nom</label><input id="a-nom" required></div>
          <div><label>Prénom</label><input id="a-prenom" required></div>
          <div><label>Créneau(x)</label>${casesCreneaux("a-cr")}</div>
          <div><button class="primaire">Ajouter</button></div>
        </form>
      </div>
      <div class="carte">
        <h3>Import en liste</h3>
        <p class="small muted">Une ligne par étudiant : <code>Nom;Prénom;Groupe</code> (copier-coller depuis un tableur, tabulations acceptées). Groupe = <code>Jeudi</code> ou <code>Vendredi</code> (sans heure), ou les deux : <code>DUPONT;Léa;Jeudi;Vendredi</code>. Un étudiant déjà inscrit n'est pas recréé : ses nouveaux créneaux sont ajoutés à son profil.</p>
        <textarea id="import" rows="3" placeholder="DUPONT;Léa;Jeudi"></textarea>
        <button id="btn-import" style="margin-top:8px">Importer</button>
      </div>
    </div>
    <div class="carte">
      <div class="entete-carte">
        <div class="ligne">
          <input id="rech" placeholder="Rechercher…" value="${esc(recherche)}" style="width:220px">
          <select id="fg" style="width:200px"><option value="">Tous les groupes</option>
            ${groupes().map(g => `<option ${g === filtreGroupe ? "selected" : ""}>${esc(g)}</option>`).join("")}</select>
        </div>
        <button id="btn-csv">⬇ Export CSV de toutes les voies</button>
      </div>
      <div class="table-scroll" style="margin-top:12px">
        ${liste.length ? `<table>
          <thead><tr><th>Nom</th><th>Prénom</th><th>Groupe(s)</th><th>Code</th><th></th></tr></thead>
          <tbody>${liste.map(e => `<tr>
            <td><b>${esc(e.nom)}</b></td><td>${esc(e.prenom)}</td><td>${pastillesGroupes(e)}</td>
            <td><code>${esc(e.code)}</code></td><td><button class="lien" data-voir="${e.code}">Voir</button></td></tr>`).join("")}</tbody></table>`
        : `<div class="vide">Aucun étudiant${etudiants.length ? " pour ce filtre" : ". Ajoutez-en ci-dessus."}</div>`}
      </div>
    </div>`;

  c.querySelector("#f-add").onsubmit = async ev => {
    ev.preventDefault();
    const nom = c.querySelector("#a-nom").value, prenom = c.querySelector("#a-prenom").value;
    const nouveaux = creneauxCoches(c, "a-cr");
    if (!nouveaux.length) return toast("Cochez Jeudi, Vendredi ou les deux");
    const existant = dejaInscrit(nom, prenom);
    if (existant) {
      // pas de doublon : on ajoute le créneau à son profil existant (même code, même carnet)
      const actuels = DB.groupesDe(existant);
      const ajout = nouveaux.filter(g => !actuels.includes(g));
      if (!ajout.length) return toast(`${existant.prenom} ${existant.nom} est déjà inscrit·e sur ${actuels.join(" + ")}`);
      if (!(await demander(`${existant.prenom} ${existant.nom} a déjà un profil (${actuels.join(" + ") || "sans groupe"}, code ${existant.code}). Ajouter « ${ajout.join(" + ")} » à ce profil plutôt que de créer un doublon ?`, "Ajouter au profil"))) return;
      await DB.modifierGroupes(existant.code, [...actuels, ...ajout]);
      await apresChangement();
      return toast(`${existant.prenom} : créneau ajouté, même code ${existant.code}`);
    }
    const e = await DB.creerEtudiant({ nom, prenom, groupes: nouveaux });
    await apresChangement();
    toast(`${e.prenom} ajouté·e : code ${e.code}`);
  };
  c.querySelector("#btn-import").onclick = async () => {
    const lignes = c.querySelector("#import").value.split("\n").map(l => l.split(/[;\t,]/).map(s => s.trim())).filter(l => l[0] && l[1]);
    if (!lignes.length) return toast("Rien à importer");
    let crees = 0, completes = 0;
    const refusees = [];
    for (const [nom, prenom, ...reste] of lignes) {
      const gs = DB.lireGroupes(reste);
      if (!gs.length) { refusees.push(`${prenom} ${nom}`); continue; }   // ni Jeudi ni Vendredi
      const existant = dejaInscrit(nom, prenom);
      if (existant) {
        const actuels = DB.groupesDe(existant), ajout = gs.filter(g => !actuels.includes(g));
        if (ajout.length) { existant.groupes = [...actuels, ...ajout]; await DB.modifierGroupes(existant.code, existant.groupes); completes++; }
      } else {
        etudiants.push(await DB.creerEtudiant({ nom, prenom, groupes: gs }));   // évite un doublon dans la même liste
        crees++;
      }
    }
    await apresChangement();
    toast(`${crees} étudiant(s) créé(s)${completes ? ` · ${completes} profil(s) complété(s) avec un nouveau créneau` : ""}`);
    if (refusees.length) setTimeout(() => demander(`Non importé(s), le groupe doit être exactement « Jeudi » ou « Vendredi », sans heure : ${refusees.join(", ")}.`, "OK"), 300);
  };
  const rech = c.querySelector("#rech");
  rech.oninput = () => { recherche = rech.value; vueEtudiants(); const r = contenu().querySelector("#rech"); r.focus(); r.setSelectionRange(r.value.length, r.value.length); };
  c.querySelector("#fg").onchange = ev => { filtreGroupe = ev.target.value; vueEtudiants(); };
  c.querySelector("#btn-csv").onclick = async () => {
    toast("Préparation de l'export…");
    const tous = [];
    for (const e of liste) tous.push(...await DB.listerPassagesEtudiant(e.code));
    exporterPassages(tous.sort((a, b) => a.date.localeCompare(b.date)), `toutes-voies-${new Date().toISOString().slice(0, 10)}`);
  };
  c.querySelectorAll("[data-voir]").forEach(b => b.onclick = () => ficheEtudiant(b.dataset.voir));
}

// Après un ajout/suppression : recharger et mettre à jour la liste des binômes
async function apresChangement() {
  await charger();
  await DB.majAnnuaire(etudiants);
  rendre();
}

async function ficheEtudiant(code) {
  const e = await DB.getEtudiant(code);
  if (!e) return;
  const l = await DB.listerPassagesEtudiant(code);
  const pyr = pyramide(l);
  const maxB = Math.max(1, ...pyr.map(([, n]) => n.tete + n.moulinette));
  modal.innerHTML = `
    <div class="modal-fond"><div class="modal" style="max-width:900px">
      <div class="entete-carte">
        <div><h2>${esc(e.prenom)} ${esc(e.nom)}</h2><p class="muted small">code <b>${esc(e.code)}</b> · ${pastillesGroupes(e)}</p></div>
        <button id="fermer">✕</button>
      </div>
      <div class="ligne no-print" style="align-items:end;gap:8px;margin:6px 0 4px">
        <div style="flex:1;min-width:240px"><label>Créneaux de pratique</label>${casesCreneaux("f-cr", DB.groupesDe(e))}</div>
        <button id="f-groupes-ok">Enregistrer les créneaux</button>
      </div>
      <p class="small muted no-print" style="margin:0 0 6px">Jeudi, Vendredi ou les deux. L'étudiant garde son code et son carnet : ses voies du jeudi et du vendredi sont réunies ici.</p>
      <div class="ligne" style="align-items:flex-start;gap:18px;margin:10px 0">
        <div id="qr-fiche"></div>
        <div class="grille g2" style="flex:1;min-width:260px">
          <div class="stat estime" style="grid-column:1 / -1"><div class="val">${e.niveauEstime ? esc(e.niveauEstime.toUpperCase()) : "—"}</div>
            <div class="lbl">Niveau max estimé par l'étudiant${e.niveauEstime && e.niveauEstimeLe ? ` · le ${fmtDate(e.niveauEstimeLe)}` : ""}</div></div>
          <div class="stat accent"><div class="val">${maxTete(l) || "—"}</div><div class="lbl">Max en tête</div></div>
          <div class="stat"><div class="val">${maxMoulinette(l) || "—"}</div><div class="lbl">Max moulinette</div></div>
          <div class="stat"><div class="val num">${l.length}</div><div class="lbl">Voies</div></div>
          <div class="stat"><div class="val num">${new Set(l.map(p => jour(p.date))).size}</div><div class="lbl">Séances</div></div>
        </div>
      </div>
      <h3 style="margin-top:14px">Pyramide des enchaînements</h3>
      <div style="margin:4px 0 8px"><span class="leg"><i style="background:var(--accent)"></i>En tête</span><span class="leg"><i style="background:var(--ink-2)"></i>Moulinette</span></div>
      ${pyr.length ? `<div class="pyramide">${pyr.map(([cot, n]) => `<b>${esc(cot)}</b>
        <div class="barre"><span style="width:${n.tete / maxB * 100}%;background:var(--accent)"></span><span style="width:${n.moulinette / maxB * 100}%;background:var(--ink-2)"></span></div>
        <span class="num small">${n.tete + n.moulinette}</span>`).join("")}</div>` : `<p class="muted">Aucune voie enchaînée.</p>`}
      <h3 style="margin-top:18px">Carnet (${l.length})</h3>
      ${tablePassages(l, false, true)}
      <div class="ligne espace" style="margin-top:20px">
        <button class="danger" id="suppr">Supprimer cet étudiant</button>
        <a class="btn" href="${urlEtudiant(e.code)}" target="_blank">Ouvrir sa vue étudiant ↗</a>
      </div>
    </div></div>`;
  try { new QRCode(document.getElementById("qr-fiche"), { text: urlEtudiant(e.code), width: 96, height: 96 }); } catch (err) {}
  const fermer = () => { modal.innerHTML = ""; };
  modal.querySelector("#fermer").onclick = fermer;
  modal.querySelector(".modal-fond").onclick = ev => { if (ev.target.classList.contains("modal-fond")) fermer(); };
  brancherEdition(modal, l, () => ficheEtudiant(code));
  modal.querySelector("#f-groupes-ok").onclick = async () => {
    const gs = creneauxCoches(modal, "f-cr");
    if (!gs.length) return toast("Cochez Jeudi, Vendredi ou les deux");
    await DB.modifierGroupes(code, gs);
    await charger(); await DB.majAnnuaire(etudiants);
    toast(`Créneaux enregistrés : ${gs.join(" + ")}`);
    ficheEtudiant(code);
    if (onglet !== "direct") rendre();
  };
  modal.querySelector("#suppr").onclick = async () => {
    if (!(await demander(`Supprimer définitivement ${e.prenom} ${e.nom} et tout son carnet ?`, "Supprimer"))) return;
    await DB.supprimerEtudiant(e.code); fermer(); toast("Étudiant supprimé"); await apresChangement();
  };
}

// ================= QR CODES =================
function vueQR() {
  const c = contenu();
  const liste = etudiants.filter(e => !groupeQR || dansGroupe(e, groupeQR));
  c.innerHTML = `
    <div class="carte no-print">
      <div class="entete-carte">
        <div class="ligne"><label style="margin:0">Groupe</label>
          <select id="gqr" style="width:220px"><option value="">Tous</option>${groupes().map(g => `<option ${g === groupeQR ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></div>
        <button class="primaire" onclick="window.print()">🖨 Imprimer les cartes</button>
      </div>
      <p class="small muted">Chaque étudiant scanne sa carte une fois : son téléphone s'en souvient ensuite. Ses voies s'enregistrent automatiquement dans la séance ouverte de son groupe.</p>
    </div>
    <div class="qr-grille">${liste.map(e => `
      <div class="qr-carte">
        <div style="font-weight:600">${esc(e.prenom)} ${esc(e.nom)}</div>
        <div class="small" style="color:#666">${esc(DB.groupesDe(e).join(" · "))} · Escalade</div>
        <div class="qr" data-qr="${e.code}"></div>
        <div class="code">${esc(e.code)}</div>
        <div class="small" style="color:#666;word-break:break-all">${esc(new URL("index.html", location.href).href)}</div>
      </div>`).join("") || `<div class="vide">Aucun étudiant.</div>`}</div>`;
  c.querySelector("#gqr").onchange = ev => { groupeQR = ev.target.value; vueQR(); };
  c.querySelectorAll("[data-qr]").forEach(d => {
    try { new QRCode(d, { text: urlEtudiant(d.dataset.qr), width: 130, height: 130 }); } catch (e) { d.textContent = "(QR indisponible)"; }
  });
}

// ================= TOPO =================
function vueTopo() {
  const c = contenu();
  const optCouleurs = sel => Object.keys(COULEURS).map(k => `<option ${k === sel ? "selected" : ""}>${k}</option>`).join("");
  const optCot = sel => `<option value="" ${sel ? "" : "selected"}>à coter</option>` + COTATIONS.map(k => `<option ${k === sel ? "selected" : ""}>${k}</option>`).join("");
  const sansToutePrise = SECTEURS.flatMap(s => s.relais).filter(r => !topo.some(v => v.relais === r && v.couleur === TOUTES_PRISES && v.actif !== false));
  const aCoter = topo.filter(v => v.actif !== false && !v.cotation).length;
  c.innerHTML = `
    <div class="carte">
      <div class="entete-carte">
        <div><h3>Topo du mur de Suchet</h3>
        <p class="small muted">${topo.filter(v => v.actif !== false).length} voies en place · ${topo.filter(v => v.actif === false).length} démontées (gardées pour l'historique des étudiants)</p></div>
        <div class="ligne"><label class="small" style="margin:0"><input type="checkbox" id="voir-demontees" style="width:auto"> Voir les voies démontées</label>
          ${sansToutePrise.length ? `<button id="btn-toutes-prises" title="Relais sans voie toute prise : ${sansToutePrise.join(", ")}">＋ Voie toute prise sur chaque relais</button>` : ""}
          <button class="primaire" id="btn-save-topo">Enregistrer le topo</button></div>
      </div>
      ${aCoter ? `<p class="small" style="color:var(--warn);font-weight:600">⚠ ${aCoter} voie${aCoter > 1 ? "s" : ""} en place à coter : choisissez la cotation puis « Enregistrer le topo ».</p>` : ""}
      <p class="small muted">📷 Sur téléphone, « ＋ Photo » permet de photographier la voie directement au pied du mur.<br>
        🔁 Une voie a été modifiée ? Cliquez sur « ↻ Remplacer » : l'ancienne passe en « démontée » (l'historique des étudiants est conservé) et une nouvelle ligne apparaît en tête du relais, à compléter. Tout un relais rééquipé ? « Démonter le relais », puis « ＋ Ajouter une voie ». N'oubliez pas « Enregistrer le topo ».</p>
    </div>
    ${SECTEURS.map(s => `
      <div class="carte">
        <h3>${s.nom}</h3>
        ${s.relais.map(r => `
          <div class="entete-carte" style="margin-top:12px"><div class="secteur-titre" style="margin:0">Relais ${r}</div>
            <div class="ligne"><button class="lien" data-demonter="${r}">Démonter le relais</button><button class="lien" data-ajout="${r}">＋ Ajouter une voie</button></div></div>
          <div class="table-scroll"><table><tbody>
          ${topo.map((v, i) => [v, i]).filter(([v]) => v.relais === r).sort((a, b) => rangCotation(a[0].cotation) - rangCotation(b[0].cotation)).map(([v, i]) => `
            <tr data-i="${i}" class="${v.actif === false ? "demontee" : ""}" style="${v.actif === false ? "opacity:.55" : ""}">
              <td style="width:34px">${puce(v.couleur)}</td>
              <td style="width:110px;white-space:nowrap">${v.photo ? `<button class="lien" data-photo-voir="${i}">📷 Voir</button>` : `<label class="lien small" style="margin:0;cursor:pointer;color:var(--accent)">＋ Photo<input type="file" accept="image/*" data-photo-ajout="${i}" hidden></label>`}</td>
              <td><input class="t-nom" value="${esc(v.nom)}"></td>
              <td style="width:155px"><select class="t-coul">${optCouleurs(v.couleur)}</select></td>
              <td style="width:118px"><select class="t-cot">${optCot(v.cotation)}</select></td>
              <td style="width:110px;white-space:nowrap"><label class="small" style="margin:0"><input type="checkbox" class="t-actif" style="width:auto" ${v.actif !== false ? "checked" : ""}> En place</label></td>
              <td style="width:110px;white-space:nowrap">${v.nouvelle ? `<button class="lien danger" data-suppr="${i}" title="Retirer cette ligne non enregistrée">✕ Retirer</button>`
                : v.actif !== false ? `<button class="lien" data-remplacer="${i}" title="Démonter cette voie et en créer une nouvelle sur le même relais">↻ Remplacer</button>` : ""}</td>
            </tr>`).join("")}
          </tbody></table></div>`).join("")}
      </div>`).join("")}`;

  const voirDem = c.querySelector("#voir-demontees");
  const appliquerFiltre = () => c.querySelectorAll("tr.demontee").forEach(tr => tr.style.display = voirDem.checked ? "" : "none");
  voirDem.onchange = appliquerFiltre; appliquerFiltre();

  const lire = () => {
    c.querySelectorAll("tr[data-i]").forEach(tr => {
      const v = topo[+tr.dataset.i];
      v.nom = tr.querySelector(".t-nom").value.trim() || "Sans nom";
      v.couleur = tr.querySelector(".t-coul").value;
      v.cotation = tr.querySelector(".t-cot").value;
      v.actif = tr.querySelector(".t-actif").checked;
    });
  };
  c.querySelectorAll("[data-ajout]").forEach(b => b.onclick = () => {
    lire();
    const r = +b.dataset.ajout;
    topo.push({ id: "n" + Date.now().toString(36), secteur: SECTEURS.find(s => s.relais.includes(r)).nom, relais: r,
      nom: "Nouvelle voie", cotation: "5a", couleur: "Rouge", oblyk: null, actif: true, nouvelle: true, ouverteLe: new Date().toISOString() });
    vueTopo();
  });
  // « Voie toute prise » sur chaque relais qui n'en a pas encore (cotation à renseigner)
  const btnTP = c.querySelector("#btn-toutes-prises");
  if (btnTP) btnTP.onclick = () => {
    lire();
    sansToutePrise.forEach((r, k) => topo.push({ id: "n" + Date.now().toString(36) + k, secteur: SECTEURS.find(s => s.relais.includes(r)).nom, relais: r,
      nom: "Voie toute prise", cotation: "", couleur: TOUTES_PRISES, oblyk: null, actif: true, nouvelle: true, ouverteLe: new Date().toISOString() }));
    vueTopo();
    toast(`${sansToutePrise.length} voies toute prise ajoutées : renseignez les cotations puis enregistrez`);
  };
  // Remplacer une voie : l'ancienne est démontée, une nouvelle (même relais, même couleur) est ajoutée
  c.querySelectorAll("[data-remplacer]").forEach(b => b.onclick = () => {
    lire();
    const ancienne = topo[+b.dataset.remplacer];
    ancienne.actif = false;
    topo.push({ id: "n" + Date.now().toString(36), secteur: ancienne.secteur, relais: ancienne.relais,
      nom: "Nouvelle voie", cotation: "", couleur: ancienne.couleur, oblyk: null, actif: true, nouvelle: true, ouverteLe: new Date().toISOString() });
    vueTopo();
    toast(`« ${ancienne.nom} » démontée : complétez la nouvelle voie du relais ${ancienne.relais}`);
  });
  c.querySelectorAll("[data-demonter]").forEach(b => b.onclick = async () => {
    if (!(await demander(`Marquer toutes les voies du relais ${b.dataset.demonter} comme démontées ?`, "Démonter"))) return;
    lire();
    topo.forEach(v => { if (v.relais === +b.dataset.demonter) v.actif = false; });
    vueTopo();
  });
  // Photos : enregistrées tout de suite (avec les modifications en cours du topo)
  const envoyerPhoto = async (i, fichier) => {
    if (!fichier) return;
    lire();
    const v = topo[i];
    try {
      toast("Compression de la photo…");
      const data = await DB.compresserImage(fichier);
      await DB.savePhoto(v.id, data);
      v.photo = true;
      topo.forEach(x => delete x.nouvelle);
      await DB.saveTopo(topo);
      toast(`Photo enregistrée pour « ${v.nom} »`);
      vueTopo();
    } catch (e) { console.error(e); toast("Photo impossible à enregistrer"); }
  };
  c.querySelectorAll("[data-photo-ajout]").forEach(inp => inp.onchange = () => envoyerPhoto(+inp.dataset.photoAjout, inp.files[0]));
  c.querySelectorAll("[data-photo-voir]").forEach(b => b.onclick = async () => {
    const i = +b.dataset.photoVoir, v = topo[i];
    const data = await DB.getPhoto(v.id);
    modal.innerHTML = `
      <div class="modal-fond"><div class="modal">
        <div class="entete-carte"><div><h2>${esc(v.nom)}</h2><p class="muted small">Relais ${v.relais} · ${esc(v.couleur)} · ${esc(v.cotation)}</p></div><button id="fermer">✕</button></div>
        ${data ? `<img src="${data}" alt="Photo de la voie" style="width:100%;border-radius:10px;margin-top:10px">` : `<p class="muted">Photo introuvable.</p>`}
        <div class="ligne espace" style="margin-top:14px">
          <button class="danger" id="ph-suppr">Supprimer la photo</button>
          <label class="btn primaire" style="margin:0">Remplacer<input type="file" accept="image/*" id="ph-remp" hidden></label>
        </div>
      </div></div>`;
    const fermer = () => { modal.innerHTML = ""; };
    modal.querySelector("#fermer").onclick = fermer;
    modal.querySelector(".modal-fond").onclick = ev => { if (ev.target.classList.contains("modal-fond")) fermer(); };
    modal.querySelector("#ph-remp").onchange = ev => { fermer(); envoyerPhoto(i, ev.target.files[0]); };
    modal.querySelector("#ph-suppr").onclick = async () => {
      if (!(await demander("Supprimer la photo de cette voie ?", "Supprimer"))) return;
      lire();
      await DB.supprimerPhoto(v.id);
      v.photo = false;
      await DB.saveTopo(topo);
      fermer(); toast("Photo supprimée"); vueTopo();
    };
  });
  c.querySelectorAll("[data-suppr]").forEach(b => b.onclick = () => { lire(); topo.splice(+b.dataset.suppr, 1); vueTopo(); });
  c.querySelector("#btn-save-topo").onclick = async () => {
    lire();
    topo.forEach(v => delete v.nouvelle);
    await DB.saveTopo(topo);
    toast("Topo enregistré");
    vueTopo();
  };
}
