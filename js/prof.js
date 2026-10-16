// =====================================================================
//  prof.js — Espace enseignant (PC)
// =====================================================================
import * as DB from "./db.js";
import {
  SECTEURS, COULEURS, COTATIONS, MODES, RESULTATS, RESSENTIS, libelle, rangCotation,
  fmtDate, fmtHeure, esc
} from "./topo.js";
import { maxTete, maxMoulinette, pyramide, jour } from "./stats.js";

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
const groupes = () => [...new Set(etudiants.map(e => e.groupe).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
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
      ${[["direct", "● En direct"], ["seances", "Séances"], ["etudiants", `Étudiants (${etudiants.length})`], ["qr", "QR codes"], ["topo", "Topo"]]
        .map(([id, l]) => `<button data-o="${id}" class="${onglet === id ? "actif" : ""}">${l}</button>`).join("")}
    </nav>
    <section id="contenu"></section>`;
  app.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { onglet = b.dataset.o; rendre(); });
  ({ direct: vueDirect, seances: vueSeances, etudiants: vueEtudiants, qr: vueQR, topo: vueTopo })[onglet]();
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
    toast(`Séance ouverte pour ${g}`);
  };
  majDirect();
}

function majDirect() {
  const z = document.getElementById("direct");
  if (!z) return;
  const s = seanceSuivie;
  if (!s) { z.innerHTML = ""; return; }
  const inscrits = etudiants.filter(e => e.groupe === s.groupe);
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
            <div class="ligne"><button id="btn-csv-live">⬇ CSV</button><button class="danger" id="btn-cloturer">Clôturer la séance</button></div>
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
            <div class="small muted">${fmtHeure(p.date)}${p.assureur ? " · ass. " + esc(p.assureur) : ""}${p.ressenti ? " · " + libelle(RESSENTIS, p.ressenti) : ""}</div></div>
            <span class="pastille ${res[2] || ""}">${res[1] || ""}</span></div>`;
        }).join("") || `<div class="vide">Les voies apparaîtront ici dès qu'un étudiant les enregistre.</div>`}</div>
      </div>
    </div>`;
  passagesLive.forEach(p => vusIds.add(p.id));
  z.querySelectorAll("[data-voir]").forEach(tr => tr.onclick = () => ficheEtudiant(tr.dataset.voir));
  z.querySelector("#btn-csv-live").onclick = () => exporterPassages(passagesLive, `seance-${s.groupe}-${jour(s.debut)}`);
  z.querySelector("#btn-cloturer").onclick = async () => {
    if (!(await demander(`Clôturer la séance « ${s.groupe} » ? Les étudiants ne pourront plus y ajouter de voies (elles iront dans leur carnet).`, "Clôturer"))) return;
    await DB.cloturerSeance(s.id); toast("Séance clôturée");
  };
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

async function ficheSeance(s) {
  const l = await DB.listerPassagesSeance(s.id);
  modal.innerHTML = `
    <div class="modal-fond"><div class="modal" style="max-width:900px">
      <div class="entete-carte">
        <div><h2>${esc(s.groupe)}</h2><p class="muted small">${fmtDate(s.debut)} · ${fmtHeure(s.debut)}${s.fin ? " – " + fmtHeure(s.fin) : ""} · ${l.length} voies · ${new Set(l.map(p => p.code)).size} étudiants</p></div>
        <button id="fermer">✕</button>
      </div>
      ${tablePassages(l, true)}
      <div class="ligne espace" style="margin-top:16px">
        <button class="danger" id="suppr-s">Supprimer la séance</button>
        <div class="ligne">${s.ouverte ? `<button id="clot-s">Clôturer</button>` : ""}<button class="primaire" id="csv-s">⬇ Export CSV</button></div>
      </div>
    </div></div>`;
  const fermer = () => { modal.innerHTML = ""; };
  modal.querySelector("#fermer").onclick = fermer;
  modal.querySelector(".modal-fond").onclick = ev => { if (ev.target.classList.contains("modal-fond")) fermer(); };
  modal.querySelector("#csv-s").onclick = () => exporterPassages(l, `seance-${s.groupe}-${jour(s.debut)}`);
  const clot = modal.querySelector("#clot-s");
  if (clot) clot.onclick = async () => { await DB.cloturerSeance(s.id); fermer(); toast("Séance clôturée"); vueSeances(); };
  modal.querySelector("#suppr-s").onclick = async () => {
    if (!(await demander("Supprimer cette séance ? Les voies restent dans le carnet des étudiants.", "Supprimer"))) return;
    await DB.supprimerSeance(s.id); fermer(); toast("Séance supprimée"); vueSeances();
  };
}

function tablePassages(l, avecNom) {
  if (!l.length) return `<p class="muted">Aucune voie.</p>`;
  return `<div class="table-scroll"><table>
    <thead><tr><th>Heure</th>${avecNom ? "<th>Étudiant</th>" : "<th>Date</th>"}<th>Voie</th><th>Cot.</th><th>Mode</th><th>Résultat</th><th>Assureur</th><th>Ressenti</th></tr></thead>
    <tbody>${[...l].reverse().map(p => {
      const res = RESULTATS.find(r => r[0] === p.resultat) || [];
      return `<tr><td class="small">${fmtHeure(p.date)}</td>
        <td>${avecNom ? `<b>${esc(p.etudiant)}</b>` : `<span class="small">${fmtDate(p.date)}</span>`}</td>
        <td>${puce(p.couleur)} R${p.relais} · ${esc(p.nomVoie)}</td><td><b>${esc(p.cotation)}</b></td>
        <td>${libelle(MODES, p.mode)}</td><td><span class="pastille ${res[2] || ""}">${res[1] || ""}</span></td>
        <td class="small">${esc(p.assureur || "—")}</td><td class="small">${p.ressenti ? libelle(RESSENTIS, p.ressenti) : "—"}</td></tr>`;
    }).join("")}</tbody></table></div>`;
}

function exporterPassages(l, nom) {
  const entete = ["Date", "Heure", "Étudiant", "Code", "Groupe", "Secteur", "Relais", "Couleur", "Voie", "Cotation", "Mode", "Résultat", "Assureur", "Ressenti"];
  const rows = l.map(p => [fmtDate(p.date), fmtHeure(p.date), p.etudiant, p.code, p.groupe, p.secteur, p.relais, p.couleur, p.nomVoie, p.cotation,
    libelle(MODES, p.mode), libelle(RESULTATS, p.resultat), p.assureur, p.ressenti ? libelle(RESSENTIS, p.ressenti) : ""]);
  const csv = [entete, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `escalade-${nom}.csv`.replace(/[^\w.-]+/g, "_");
  a.click();
}

// ================= ÉTUDIANTS =================
function vueEtudiants() {
  const c = contenu();
  const liste = etudiants.filter(e =>
    (!filtreGroupe || e.groupe === filtreGroupe) &&
    (!recherche || (e.nom + " " + e.prenom + " " + e.code).toLowerCase().includes(recherche.toLowerCase())));
  c.innerHTML = `
    <div class="grille g2 no-print">
      <div class="carte">
        <h3>Ajouter un étudiant</h3>
        <form id="f-add" class="grille g3" style="align-items:end">
          <div><label>Nom</label><input id="a-nom" required></div>
          <div><label>Prénom</label><input id="a-prenom" required></div>
          <div><label>Groupe / créneau</label><input id="a-groupe" list="dl-groupes" placeholder="ex. Jeudi 12h" required></div>
          <datalist id="dl-groupes">${groupes().map(g => `<option value="${esc(g)}">`).join("")}</datalist>
          <div><button class="primaire">Ajouter</button></div>
        </form>
      </div>
      <div class="carte">
        <h3>Import en liste</h3>
        <p class="small muted">Une ligne par étudiant : <code>Nom;Prénom;Groupe</code> (copier-coller depuis un tableur, tabulations acceptées).</p>
        <textarea id="import" rows="3" placeholder="DUPONT;Léa;Jeudi 12h"></textarea>
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
          <thead><tr><th>Nom</th><th>Prénom</th><th>Groupe</th><th>Code</th><th></th></tr></thead>
          <tbody>${liste.map(e => `<tr>
            <td><b>${esc(e.nom)}</b></td><td>${esc(e.prenom)}</td><td>${esc(e.groupe)}</td>
            <td><code>${esc(e.code)}</code></td><td><button class="lien" data-voir="${e.code}">Voir</button></td></tr>`).join("")}</tbody></table>`
        : `<div class="vide">Aucun étudiant${etudiants.length ? " pour ce filtre" : ". Ajoutez-en ci-dessus."}</div>`}
      </div>
    </div>`;

  c.querySelector("#f-add").onsubmit = async ev => {
    ev.preventDefault();
    const e = await DB.creerEtudiant({ nom: c.querySelector("#a-nom").value, prenom: c.querySelector("#a-prenom").value, groupe: c.querySelector("#a-groupe").value });
    await apresChangement();
    toast(`${e.prenom} ajouté·e : code ${e.code}`);
  };
  c.querySelector("#btn-import").onclick = async () => {
    const lignes = c.querySelector("#import").value.split("\n").map(l => l.split(/[;\t,]/).map(s => s.trim())).filter(l => l[0] && l[1]);
    if (!lignes.length) return toast("Rien à importer");
    for (const [nom, prenom, groupe] of lignes) await DB.creerEtudiant({ nom, prenom, groupe });
    await apresChangement();
    toast(`${lignes.length} étudiant(s) importé(s)`);
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
        <div><h2>${esc(e.prenom)} ${esc(e.nom)}</h2><p class="muted small">${esc(e.groupe)} · code <b>${esc(e.code)}</b></p></div>
        <button id="fermer">✕</button>
      </div>
      <div class="ligne" style="align-items:flex-start;gap:18px;margin:10px 0">
        <div id="qr-fiche"></div>
        <div class="grille g2" style="flex:1;min-width:260px">
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
      ${tablePassages(l, false)}
      <div class="ligne espace" style="margin-top:20px">
        <button class="danger" id="suppr">Supprimer cet étudiant</button>
        <a class="btn" href="${urlEtudiant(e.code)}" target="_blank">Ouvrir sa vue étudiant ↗</a>
      </div>
    </div></div>`;
  try { new QRCode(document.getElementById("qr-fiche"), { text: urlEtudiant(e.code), width: 96, height: 96 }); } catch (err) {}
  const fermer = () => { modal.innerHTML = ""; };
  modal.querySelector("#fermer").onclick = fermer;
  modal.querySelector(".modal-fond").onclick = ev => { if (ev.target.classList.contains("modal-fond")) fermer(); };
  modal.querySelector("#suppr").onclick = async () => {
    if (!(await demander(`Supprimer définitivement ${e.prenom} ${e.nom} et tout son carnet ?`, "Supprimer"))) return;
    await DB.supprimerEtudiant(e.code); fermer(); toast("Étudiant supprimé"); await apresChangement();
  };
}

// ================= QR CODES =================
function vueQR() {
  const c = contenu();
  const liste = etudiants.filter(e => !groupeQR || e.groupe === groupeQR);
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
        <div class="small" style="color:#666">${esc(e.groupe)} · Escalade</div>
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
  const optCot = sel => COTATIONS.map(k => `<option ${k === sel ? "selected" : ""}>${k}</option>`).join("");
  c.innerHTML = `
    <div class="carte">
      <div class="entete-carte">
        <div><h3>Topo du mur de Suchet</h3>
        <p class="small muted">${topo.filter(v => v.actif !== false).length} voies en place · ${topo.filter(v => v.actif === false).length} démontées (gardées pour l'historique des étudiants)</p></div>
        <div class="ligne"><label class="small" style="margin:0"><input type="checkbox" id="voir-demontees" style="width:auto"> Voir les voies démontées</label>
          <button class="primaire" id="btn-save-topo">Enregistrer le topo</button></div>
      </div>
      <p class="small muted">📷 Sur téléphone, « ＋ Photo » permet de photographier la voie directement au pied du mur. Lors d'un rééquipement : décochez « En place » pour les anciennes voies (ou « Démonter le relais »), puis ajoutez les nouvelles. Ne supprimez pas une voie déjà grimpée : la démonter suffit.</p>
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
              <td style="width:120px"><select class="t-coul">${optCouleurs(v.couleur)}</select></td>
              <td style="width:95px"><select class="t-cot">${optCot(v.cotation)}</select></td>
              <td style="width:110px;white-space:nowrap"><label class="small" style="margin:0"><input type="checkbox" class="t-actif" style="width:auto" ${v.actif !== false ? "checked" : ""}> En place</label></td>
              <td style="width:40px">${v.nouvelle ? `<button class="lien danger" data-suppr="${i}" title="Retirer">✕</button>` : ""}</td>
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
