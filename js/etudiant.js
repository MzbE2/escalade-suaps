// =====================================================================
//  etudiant.js — Application étudiant (téléphone, au pied du mur)
// =====================================================================
import * as DB from "./db.js";
import {
  SECTEURS, COULEURS, MODES, RESULTATS, RESSENTIS, libelle, rangCotation,
  fmtDate, fmtHeure, esc
} from "./topo.js";
import { maxTete, maxMoulinette, pyramide, jour } from "./stats.js";

const app = document.getElementById("app");
const CLE_CODE = "escalade-suaps-code";
const CLE_PREFS = "escalade-suaps-prefs";
const memo = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

let E = null;            // étudiant connecté
let topo = [];
let binomes = [];
let seance = null;       // séance ouverte de son groupe (en direct)
let passages = [];       // son carnet (en direct)
let onglet = "seance";
let saisie = null;       // { relais, voie, mode, resultat, assureur, ressenti }
let arrets = [];         // fonctions pour couper les écoutes en direct

if (DB.MODE_DEMO) document.getElementById("demo").classList.remove("cache");

function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
const puce = (couleur, grande) => `<span class="puce${grande ? " grande" : ""}" style="background:${COULEURS[couleur] || "#ccc"}" title="${esc(couleur)}"></span>`;
const clePrefs = () => CLE_PREFS + "-" + (E?.code || "");
const prefs = () => { try { return JSON.parse(memo.get(clePrefs())) || {}; } catch (e) { return {}; } };

// ---------------- Connexion ----------------
async function demarrer() {
  const url = new URL(location.href);
  const depuisLien = url.searchParams.get("c") || location.hash.replace("#", "");
  const code = depuisLien || memo.get(CLE_CODE);
  if (code && await connecter(code, false)) {
    if (depuisLien) { try { history.replaceState(null, "", location.pathname); } catch (e) {} }
    return;
  }
  vueConnexion();
}

function vueConnexion(erreur = "") {
  document.getElementById("btn-deco").classList.add("cache");
  app.innerHTML = `
    <div class="carte" style="margin-top:32px">
      <h1>Bienvenue 🧗</h1>
      <p class="muted">Entrez le code personnel donné par votre enseignant, ou scannez votre QR code.</p>
      <form id="f-code">
        <label for="code">Votre code</label>
        <input id="code" class="code-input" maxlength="6" autocomplete="off" autocapitalize="characters" required>
        ${erreur ? `<p class="small" style="color:var(--bad)">${esc(erreur)}</p>` : ""}
        <button class="primaire plein" style="margin-top:14px">Accéder à mon carnet</button>
      </form>
    </div>`;
  document.getElementById("f-code").onsubmit = async ev => {
    ev.preventDefault();
    const ok = await connecter(document.getElementById("code").value, true);
    if (!ok) vueConnexion("Code inconnu. Vérifiez auprès de votre enseignant.");
  };
}

async function connecter(code, interactif) {
  try {
    const e = await DB.getEtudiant(code);
    if (!e) return false;
    E = e;
    memo.set(CLE_CODE, E.code);
    [topo, binomes] = await Promise.all([DB.getTopo(), DB.getAnnuaire(E.groupe)]);
    binomes = binomes.filter(n => n !== DB.nomCourt(E));
    document.getElementById("btn-deco").classList.remove("cache");
    rendre();
    arrets.push(await DB.ecouterSeanceOuverte(E.groupe, s => { seance = s; majBandeau(); majSeance(); }));
    arrets.push(await DB.ecouterPassagesEtudiant(E.code, l => { passages = l; majSeance(); if (onglet === "progression") vueProgression(); }));
    return true;
  } catch (err) {
    console.error(err);
    if (interactif) toast("Connexion impossible : vérifiez le réseau.");
    return false;
  }
}

document.getElementById("btn-deco").onclick = () => {
  arrets.forEach(f => { try { f(); } catch (e) {} }); arrets = [];
  memo.del(CLE_CODE); E = null; seance = null; passages = []; saisie = null; vueConnexion();
};

// ---------------- Structure de la page ----------------
function rendre() {
  app.innerHTML = `
    <h2 style="margin-top:14px">${esc(E.prenom)} ${esc(E.nom)}</h2>
    <p class="muted small" style="margin:0">${esc(E.groupe || "")}</p>
    <div id="bandeau"></div>
    <nav class="onglets">
      ${[["seance", "Ma séance"], ["progression", "Progression"]]
        .map(([id, l]) => `<button data-o="${id}" class="${onglet === id ? "actif" : ""}">${l}</button>`).join("")}
    </nav>
    <section id="contenu"></section>`;
  app.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { onglet = b.dataset.o; rendre(); });
  majBandeau();
  if (onglet === "seance") vueSeance(); else vueProgression();
}

function majBandeau() {
  const b = document.getElementById("bandeau");
  if (!b) return;
  b.innerHTML = seance
    ? `<div class="bandeau-seance on"><span class="point-live"></span>Séance en cours · depuis ${fmtHeure(seance.debut)}</div>`
    : `<div class="bandeau-seance off">Aucune séance ouverte : vos voies sont enregistrées dans votre carnet.</div>`;
}

// ---------------- Onglet « Ma séance » ----------------
function vueSeance() {
  const c = document.getElementById("contenu");
  c.innerHTML = `<div id="zone-saisie"></div><div id="zone-liste"></div>`;
  vueSaisie();
  majSeance();
}

// Passages affichés : ceux de la séance ouverte, sinon ceux du jour
function passagesDuMoment() {
  if (seance) return passages.filter(p => p.seanceId === seance.id);
  const auj = jour(new Date().toISOString());
  return passages.filter(p => jour(p.date) === auj);
}

function majSeance() {
  const z = document.getElementById("zone-liste");
  if (!z) return;
  const liste = passagesDuMoment();
  const nbEnch = liste.filter(p => p.resultat === "enchaine").length;
  z.innerHTML = `
    <div class="carte">
      <div class="entete-carte"><h3>${seance ? "Voies de la séance" : "Voies du jour"}</h3><span class="pastille">${liste.length} voie${liste.length > 1 ? "s" : ""}</span></div>
      ${liste.length ? `
        <div class="grille g3" style="margin:6px 0 10px">
          <div class="stat"><div class="val num">${nbEnch}</div><div class="lbl">Enchaînées</div></div>
          <div class="stat accent"><div class="val">${maxTete(liste) || "—"}</div><div class="lbl">Max en tête</div></div>
          <div class="stat"><div class="val">${maxMoulinette(liste) || "—"}</div><div class="lbl">Max moulinette</div></div>
        </div>
        ${[...liste].reverse().map(ligneP).join("")}` : `<div class="vide">Aucune voie pour l'instant. Touchez « Ajouter une voie ».</div>`}
    </div>`;
  z.querySelectorAll("[data-annuler]").forEach(b => b.onclick = async () => {
    const p = passages.find(x => x.id === b.dataset.annuler);
    if (!p) return;
    try { await DB.supprimerPassage(p); toast("Voie retirée"); }
    catch (e) { console.error(e); toast("Trop tard pour annuler : demandez à votre enseignant."); }
  });
}

function ligneP(p) {
  const res = RESULTATS.find(r => r[0] === p.resultat) || [];
  const annulable = Date.now() - new Date(p.date).getTime() < 15 * 60 * 1000;
  return `<div class="passage">
    ${puce(p.couleur)}
    <span class="cot">${esc(p.cotation)}</span>
    <div class="info">
      <div><b>${esc(p.nomVoie)}</b> <span class="small muted">· R${p.relais}</span></div>
      <div class="small muted">${[libelle(MODES, p.mode), p.assureur ? "assuré·e par " + esc(p.assureur) : "", p.ressenti ? libelle(RESSENTIS, p.ressenti) : "", fmtHeure(p.date)].filter(Boolean).join(" · ")}</div>
    </div>
    <span class="pastille ${res[2] || ""}">${res[1] || ""}</span>
    ${annulable ? `<button class="lien" data-annuler="${p.id}" title="Annuler (15 min)">✕</button>` : ""}
  </div>`;
}

// ---------------- Saisie d'une voie : relais → voie → détails ----------------
function vueSaisie() {
  const z = document.getElementById("zone-saisie");
  if (!z) return;
  const actives = topo.filter(v => v.actif !== false);

  if (!saisie) {
    z.innerHTML = `<button class="primaire plein" id="btn-ajout" style="margin-top:14px">＋ Ajouter une voie</button>`;
    z.querySelector("#btn-ajout").onclick = () => { const p = prefs(); saisie = { mode: p.mode || "moulinette", assureur: p.assureur && p.assureur !== DB.nomCourt(E) ? p.assureur : "" }; vueSaisie(); };
    return;
  }

  const annuler = `<button class="lien" id="s-annuler">Annuler</button>`;

  // Étape 1 : choisir le relais
  if (!saisie.relais) {
    z.innerHTML = `<div class="carte">
      <div class="entete-carte"><h3>Quel relais ?</h3>${annuler}</div>
      ${SECTEURS.map(s => `<div class="secteur-titre">${s.nom}</div>
        <div class="relais-grille">${s.relais.map(r => {
          const vs = actives.filter(v => v.relais === r);
          return `<button class="relais-btn" data-r="${r}"><span class="n">${r}</span>
            <span class="puces">${vs.map(v => puce(v.couleur)).join("")}</span></button>`;
        }).join("")}</div>`).join("")}
    </div>`;
    z.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { saisie.relais = +b.dataset.r; vueSaisie(); });
  }
  // Étape 2 : choisir la voie (couleur)
  else if (!saisie.voie) {
    const vs = actives.filter(v => v.relais === saisie.relais).sort((a, b) => rangCotation(a.cotation) - rangCotation(b.cotation));
    z.innerHTML = `<div class="carte">
      <div class="entete-carte"><h3>Relais ${saisie.relais} : quelle voie ?</h3>${annuler}</div>
      ${vs.map(v => `<button class="voie-btn" data-v="${v.id}">${puce(v.couleur, true)}<span class="nom">${esc(v.nom)}<br><span class="small muted">${esc(v.couleur)}${v.photo ? " · 📷" : ""}</span></span><span class="cot">${esc(v.cotation)}</span></button>`).join("")
        || `<div class="vide">Aucune voie sur ce relais.</div>`}
      <button class="lien" id="s-retour">← Changer de relais</button>
    </div>`;
    z.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { saisie.voie = topo.find(v => v.id === b.dataset.v); vueSaisie(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    z.querySelector("#s-retour").onclick = () => { saisie.relais = null; vueSaisie(); };
  }
  // Étape 3 : détails
  else {
    const v = saisie.voie;
    const seg = (cle, liste) => `<div class="segment">${liste.map(([k, l, ton]) =>
      `<button type="button" data-seg="${cle}" data-val="${k}" class="${saisie[cle] === k ? "choisi " + (ton || "") : ""}">${l}</button>`).join("")}</div>`;
    z.innerHTML = `<div class="carte">
      <div class="entete-carte"><h3>Détails</h3>${annuler}</div>
      <div class="ligne" style="margin:4px 0 6px">${puce(v.couleur, true)}<div style="flex:1"><b>${esc(v.nom)}</b><br><span class="small muted">Relais ${v.relais} · ${esc(v.couleur)} · ${esc(v.secteur)}</span></div>
        <span class="presc"><span class="gros">${esc(v.cotation)}</span></span></div>
      <div id="s-photo"></div>
      <button class="lien" id="s-retour">← Changer de voie</button>
      <label>Mode</label>${seg("mode", MODES)}
      <label>Résultat</label>${seg("resultat", RESULTATS)}
      <label for="s-ass">Assuré·e par</label>
      <select id="s-ass">
        <option value="">— Choisir —</option>
        ${binomes.map(n => `<option ${saisie.assureur === n ? "selected" : ""}>${esc(n)}</option>`).join("")}
        <option ${saisie.assureur === "Enseignant·e" ? "selected" : ""}>Enseignant·e</option>
        <option ${saisie.assureur === "Autre" ? "selected" : ""}>Autre</option>
      </select>
      <label>Ressenti</label>${seg("ressenti", RESSENTIS)}
      <button class="primaire plein" id="s-ok" style="margin-top:18px" ${saisie.resultat ? "" : "disabled"}>Enregistrer</button>
      ${saisie.resultat ? "" : `<p class="small muted" style="text-align:center">Choisissez au moins le résultat.</p>`}
    </div>`;
    z.querySelectorAll("[data-seg]").forEach(b => b.onclick = () => { saisie[b.dataset.seg] = b.dataset.val; vueSaisie(); });
    z.querySelector("#s-ass").onchange = ev => { saisie.assureur = ev.target.value; };
    z.querySelector("#s-retour").onclick = () => { saisie.voie = null; vueSaisie(); };
    z.querySelector("#s-ok").onclick = enregistrer;
    if (v.photo) DB.getPhoto(v.id).then(data => {
      const ph = document.getElementById("s-photo");
      if (data && ph && saisie?.voie?.id === v.id)
        ph.innerHTML = `<img src="${data}" alt="Photo de la voie" style="width:100%;max-height:60vh;object-fit:contain;border-radius:10px;margin:8px 0;background:var(--surface-2)">`;
    }).catch(() => {});
  }
  const a = z.querySelector("#s-annuler");
  if (a) a.onclick = () => { saisie = null; vueSaisie(); };
}

async function enregistrer() {
  const btn = document.getElementById("s-ok");
  btn.disabled = true;
  const v = saisie.voie;
  try {
    await DB.ajouterPassage(E, seance?.id, {
      voieId: v.id, relais: v.relais, couleur: v.couleur, cotation: v.cotation, nomVoie: v.nom, secteur: v.secteur,
      mode: saisie.mode, resultat: saisie.resultat, assureur: saisie.assureur || "", ressenti: saisie.ressenti || ""
    });
    memo.set(clePrefs(), JSON.stringify({ mode: saisie.mode, assureur: saisie.assureur }));
    toast(`${v.cotation} ${v.couleur} enregistrée ✔`);
    saisie = null; vueSaisie();
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    toast("Enregistrement impossible : vérifiez le réseau.");
  }
}

// ---------------- Onglet « Progression » ----------------
function vueProgression() {
  const c = document.getElementById("contenu");
  if (!c) return;
  const jours = [...new Set(passages.map(p => jour(p.date)))].sort().reverse();
  const pyr = pyramide(passages);
  const maxBarre = Math.max(1, ...pyr.map(([, n]) => n.tete + n.moulinette));
  c.innerHTML = `
    <div class="grille g2" style="margin-top:14px">
      <div class="stat accent"><div class="val">${maxTete(passages) || "—"}</div><div class="lbl">Meilleure en tête</div></div>
      <div class="stat"><div class="val">${maxMoulinette(passages) || "—"}</div><div class="lbl">Meilleure en moulinette</div></div>
      <div class="stat"><div class="val num">${passages.length}</div><div class="lbl">Voies grimpées</div></div>
      <div class="stat"><div class="val num">${jours.length}</div><div class="lbl">Séances</div></div>
    </div>
    <div class="carte">
      <h3>Pyramide des voies enchaînées</h3>
      <div style="margin:4px 0 10px"><span class="leg"><i style="background:var(--accent)"></i>En tête</span><span class="leg"><i style="background:var(--ink-2)"></i>Moulinette</span></div>
      ${pyr.length ? `<div class="pyramide">${pyr.map(([cot, n]) => `
        <b>${esc(cot)}</b>
        <div class="barre"><span style="width:${n.tete / maxBarre * 100}%;background:var(--accent)"></span><span style="width:${n.moulinette / maxBarre * 100}%;background:var(--ink-2)"></span></div>
        <span class="num small">${n.tete + n.moulinette}</span>`).join("")}</div>` : `<div class="vide">Enchaînez une voie pour démarrer votre pyramide.</div>`}
    </div>
    <div class="carte">
      <h3>Historique</h3>
      ${jours.length ? jours.map(j => {
        const l = passages.filter(p => jour(p.date) === j);
        return `<div class="secteur-titre">${fmtDate(j)} · ${l.length} voie${l.length > 1 ? "s" : ""}</div>${[...l].reverse().map(ligneP).join("")}`;
      }).join("") : `<div class="vide">Aucune voie enregistrée.</div>`}
    </div>`;
  c.querySelectorAll("[data-annuler]").forEach(b => b.onclick = async () => {
    const p = passages.find(x => x.id === b.dataset.annuler);
    try { await DB.supprimerPassage(p); toast("Voie retirée"); } catch (e) { toast("Trop tard pour annuler."); }
  });
}

demarrer();
