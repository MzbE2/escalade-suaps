// =====================================================================
//  prof-article.js — Espace enseignant : article de gazette (théorie S1)
//  Onglets « Sujets & relecture », « Récap. sujets », « Vue étudiante », « Réglages »
//  (même principe que l'appli UE Danse)
// =====================================================================
import * as DB from "./db.js";
import { esc, fmtDate } from "./topo.js";
import { SUJETS, NB_RELECT, htmlArticle } from "./article.js";
import { SEMESTRES, notePartie, fmtNote } from "./evaluation.js";

let ctx = null;            // { contenu, etudiants, toast, demander, onglet }
let cfg = {}, sujets = [], ins = {}, rel = {}, evals = null;
let ecoute = false, apercuCode = "", filtre = "";

const nomDe = c => { const e = ctx.etudiants().find(x => x.code === c); return e ? `${e.prenom} ${e.nom}` : (ins[c]?.nom || "?"); };
const relecteursDe = a => (rel[a] || []).filter(r => r && ins[r]);
const aRelireDe = r => Object.keys(ins).filter(a => a !== r && relecteursDe(a).includes(r));
const aRelu = (r, a) => !!ins[r]?.relus?.[ins[a]?.sujet];
const theo = SEMESTRES.s1.parties.find(p => p.id === "theo");

// Une seule fois : écoutes en direct (sujets, inscriptions, relectures, réglages)
export async function initArticle(c) {
  ctx = c;
  if (ecoute) return;
  ecoute = true;
  const maj = () => { const o = ctx.onglet(); if (VUES[o]) VUES[o](); };
  await DB.ecouterConfigArticle(x => { cfg = x || {}; maj(); });
  await DB.ecouterSujets(l => { sujets = l || []; maj(); });
  await DB.ecouterInscriptions(x => { ins = x || {}; maj(); });
  await DB.ecouterRelectures(x => { rel = x || {}; maj(); });
}
export const ONGLETS_ARTICLE = [["sujets", "Sujets & relecture"], ["recapsujets", "Récap. sujets"], ["apercu", "Vue étudiante"], ["reglages", "Réglages"]];
export function vueArticle(id) { VUES[id](); }

const zone = () => ctx.contenu();
const erreur = e => { console.error(e); ctx.toast(e?.message && !/permission/i.test(e.message) ? e.message : "Action impossible : vérifiez la connexion."); };
const etatAcces = () => !cfg.visibles
  ? `<span class="pastille bad">🔒 Sujets cachés aux étudiants</span>`
  : cfg.choixOuverts ? `<span class="pastille ok">Sujets visibles · choix ouverts</span>` : `<span class="pastille warn">Sujets visibles · choix fermés</span>`;

// ================= Sujets & relecture =================
function vueSujets() {
  const z = zone(); if (!z) return;
  if (!sujets.length) {
    z.innerHTML = `<div class="carte"><h3>Sujets d'article</h3><p>Les ${SUJETS.length} sujets ne sont pas encore créés.</p>
      <button class="primaire" id="a-init">Créer les ${SUJETS.length} sujets</button>
      <p class="small muted">Ils restent cachés aux étudiants tant que vous n'ouvrez pas l'accès dans l'onglet Réglages.</p></div>`;
    z.querySelector("#a-init").onclick = creerSujets;
    return;
  }
  const etus = ctx.etudiants();
  const sansSujet = etus.filter(e => !ins[e.code]);
  const charge = Object.fromEntries(etus.map(e => [e.code, aRelireDe(e.code).length]));
  const desequ = etus.filter(e => ins[e.code] && charge[e.code] !== NB_RELECT);
  const nbPris = sujets.filter(s => s.pris).length;
  const ks = [...Array(NB_RELECT).keys()];
  const opts = sansSujet.map(e => `<option value="${esc(e.code)}">${esc(e.prenom + " " + e.nom)}</option>`).join("");
  z.innerHTML = `
    <div class="carte">
      <div class="ligne espace"><h3 style="margin:0">Sujets & relecture</h3>${etatAcces()}</div>
      <p>${nbPris}/${sujets.length} sujets pris · ${sansSujet.length} étudiant(s) sans sujet${sansSujet.length ? " : " + sansSujet.map(e => `<span class="pastille">${esc(e.prenom + " " + e.nom)}</span>`).join(" ") : ""}</p>
      <p class="small muted">Chaque étudiant écrit un article seul et relit ${NB_RELECT} articles d'autres étudiants. Choisissez les relecteurs dans les colonnes, ou utilisez la répartition automatique. Les coches ✓ sont faites par les étudiants.</p>
      <div class="ligne"><button class="primaire" id="a-auto">Répartir les relectures automatiquement</button>
        ${desequ.length ? `<span class="small muted">Pas exactement ${NB_RELECT} articles à relire : ${desequ.map(e => `<span class="pastille warn">${esc(e.prenom + " " + e.nom)} (${charge[e.code]})</span>`).join(" ")}</span>` : ""}</div>
    </div>
    <div class="carte"><div class="table-scroll"><table class="table-sujets">
      <thead><tr><th>N°</th><th>Sujet</th><th>Étudiant</th><th>Réalisé</th>${ks.map(k => `<th>Relecture ${k + 1}</th>`).join("")}</tr></thead>
      <tbody>${sujets.map(s => {
        const a = Object.keys(ins).find(c => ins[c].sujet === s.id);
        if (!a) return `<tr><td><b>${s.num}</b></td><td>${esc(s.titre)}</td>
          <td>${s.pris ? `<span class="pastille warn" title="Marqué pris sans inscription">${esc(s.par || "réservé")}</span> <button class="lien" data-liberer="${s.id}" title="Libérer">✕</button>`
            : opts ? `<select class="petit" data-attribuer="${s.id}"><option value="">+ Attribuer…</option>${opts}</select>` : `<span class="muted">libre</span>`}</td>
          <td></td>${ks.map(() => "<td></td>").join("")}</tr>`;
        const rl = rel[a] || [];
        return `<tr><td><b>${s.num}</b></td><td>${esc(s.titre)}</td>
          <td><b>${esc(nomDe(a))}</b> <button class="lien" data-liberer="${s.id}" data-code="${esc(a)}" title="Retirer du sujet">✕</button></td>
          <td>${ins[a].realise ? `<span class="pastille ok">✓</span>` : `<span class="muted">—</span>`}</td>
          ${ks.map(k => {
            const r = rl[k] && ins[rl[k]] ? rl[k] : "";
            return `<td><select class="petit" data-auteur="${esc(a)}" data-k="${k}"><option value="">—</option>${
              etus.filter(e => e.code !== a && ins[e.code]).map(e => `<option value="${esc(e.code)}" ${e.code === r ? "selected" : ""}>${esc(e.prenom + " " + e.nom)} (${charge[e.code]})</option>`).join("")}</select>
              ${r ? (aRelu(r, a) ? `<span class="pastille ok">✓ relu</span>` : `<span class="small muted">à relire</span>`) : ""}</td>`;
          }).join("")}</tr>`;
      }).join("")}</tbody></table></div>
      <p class="small muted">Le chiffre entre parenthèses = nombre d'articles que cet étudiant doit déjà relire. Seuls les étudiants ayant un sujet peuvent relire.</p></div>`;
  z.querySelector("#a-auto").onclick = autoRelectures;
  z.querySelectorAll("[data-attribuer]").forEach(sel => sel.onchange = async () => {
    const e = etus.find(x => x.code === sel.value); if (!e) return;
    try { await DB.choisirSujet(e, sel.dataset.attribuer, true); ctx.toast("Sujet attribué"); } catch (err) { erreur(err); }
  });
  z.querySelectorAll("[data-liberer]").forEach(b => b.onclick = async () => {
    const code = b.dataset.code;
    const msg = code ? `Retirer ${nomDe(code)} du sujet ? Le sujet redevient libre ; ses cases « réalisé », « relu » et ses relectures sont effacées.` : "Libérer ce sujet ?";
    if (!(await ctx.demander(msg, "Retirer"))) return;
    try {
      await DB.libererSujet(b.dataset.liberer, code);
      if (code) { const r2 = Object.fromEntries(Object.entries(rel).filter(([a2]) => a2 !== code).map(([a2, l]) => [a2, l.map(x => x === code ? "" : x)])); delete ins[code]; await DB.enregistrerRelectures(r2, ins); }
      ctx.toast("Sujet libéré");
    } catch (err) { erreur(err); }
  });
  z.querySelectorAll("[data-auteur]").forEach(sel => sel.onchange = async () => {
    const a = sel.dataset.auteur, k = +sel.dataset.k, r = sel.value;
    const arr = [...(rel[a] || [])]; while (arr.length < NB_RELECT) arr.push("");
    if (r && arr.includes(r) && arr[k] !== r) { ctx.toast(nomDe(r) + " relit déjà cet article."); vueSujets(); return; }
    arr[k] = r;
    try { await DB.enregistrerRelectures({ ...rel, [a]: arr }, ins); } catch (err) { erreur(err); }
  });
}

async function creerSujets() {
  try { const n = await DB.creerSujets(SUJETS); ctx.toast(`${n} sujet(s) créé(s)`); } catch (e) { erreur(e); }
}

async function autoRelectures() {
  const auteurs = ctx.etudiants().map(e => e.code).filter(c => ins[c]);
  if (auteurs.length < NB_RELECT + 1) { ctx.toast(`Il faut au moins ${NB_RELECT + 1} étudiants ayant un sujet.`); return; }
  const sans = ctx.etudiants().length - auteurs.length;
  const deja = auteurs.some(a => relecteursDe(a).length);
  if (!(await ctx.demander((deja ? "Les relecteurs déjà choisis seront remplacés. " : "") +
    `Chacun des ${auteurs.length} étudiants ayant un sujet relira ${NB_RELECT} articles et sera relu par ${NB_RELECT} personnes.` +
    (sans ? ` ${sans} étudiant(s) sans sujet ne sont pas inclus.` : ""), "Répartir"))) return;
  const ord = [...auteurs];
  for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
  const r = {};
  ord.forEach((a, i) => { r[a] = [...Array(NB_RELECT).keys()].map(k => ord[(i + k + 1) % ord.length]); });
  try { await DB.enregistrerRelectures(r, ins); ctx.toast("Relectures réparties"); } catch (e) { erreur(e); }
}

// ================= Récapitulatif des sujets =================
async function vueRecap() {
  const z = zone(); if (!z) return;
  if (!evals) {
    z.innerHTML = `<div class="vide">Chargement…</div>`;
    try { evals = await DB.listerEvaluations(); } catch (e) { console.error(e); evals = {}; }
    if (ctx.onglet() !== "recapsujets") return;
  }
  const lignes = ctx.etudiants().filter(e => !filtre || DB.groupesDe(e).includes(filtre)).map(e => {
    const i = ins[e.code], a = aRelireDe(e.code), r = relecteursDe(e.code);
    const n = notePartie(theo, evals[e.code]?.s1?.theo || {}, {});
    return { e, i, faits: a.filter(x => aRelu(e.code, x)).length, nA: a.length, recu: r.filter(x => aRelu(x, e.code)).length, nR: r.length, n };
  });
  const cell = (x, n) => n ? `<span class="pastille ${x === n ? "ok" : ""}">${x}/${n}</span>` : `<span class="muted">—</span>`;
  z.innerHTML = `
    <div class="carte">
      <div class="ligne espace"><h3 style="margin:0">Récapitulatif des sujets</h3>
        <div class="ligne"><select id="r-cr" style="width:auto"><option value="">Jeudi et Vendredi</option>${["Jeudi", "Vendredi"].map(g => `<option ${g === filtre ? "selected" : ""}>${g}</option>`).join("")}</select>
        <button class="primaire" id="r-csv">⬇ Export CSV</button></div></div>
      <p class="small muted">Note « Théorie S1 » : saisie dans l'onglet Évaluation (* = incomplète). Visible par vous seul·e.</p>
      <div class="table-scroll"><table>
        <thead><tr><th>Nom</th><th>Prénom</th><th>Créneau</th><th>Sujet</th><th>Réalisé</th><th>A relu</th><th>Relu par</th><th>Théorie S1 /20</th></tr></thead>
        <tbody>${lignes.map(({ e, i, faits, nA, recu, nR, n }) => `<tr>
          <td><b>${esc(e.nom)}</b></td><td>${esc(e.prenom)}</td><td class="small">${esc(DB.groupesDe(e).join(" + "))}</td>
          <td>${i ? `<b>${i.num}</b> · <span class="small">${esc(i.titre)}</span>` : `<span class="muted">—</span>`}</td>
          <td>${i ? (i.realise ? `<span class="pastille ok">✓</span>` : `<span class="muted">non</span>`) : ""}</td>
          <td>${cell(faits, nA)}</td><td>${cell(recu, nR)}</td>
          <td>${n.notes ? `<b>${fmtNote(n.total)}</b>${n.complet ? "" : "*"}` : `<span class="muted">—</span>`}</td></tr>`).join("")}</tbody>
      </table></div>
    </div>`;
  z.querySelector("#r-cr").onchange = ev => { filtre = ev.target.value; vueRecap(); };
  z.querySelector("#r-csv").onclick = () => {
    const rows = [["Nom", "Prénom", "Créneau", "N° sujet", "Sujet", "Réalisé", "Articles relus", "À relire", "Relu par (fait)", "Relecteurs", "Relecteurs (noms)", "Théorie S1 /20"],
      ...lignes.map(({ e, i, faits, nA, recu, nR, n }) => [e.nom, e.prenom, DB.groupesDe(e).join(" + "), i?.num || "", i?.titre || "", i ? (i.realise ? "oui" : "non") : "",
        faits, nA, recu, nR, relecteursDe(e.code).map(nomDe).join(", "), n.notes ? fmtNote(n.total) + (n.complet ? "" : "*") : ""])];
    const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `escalade-sujets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };
}

// ================= Vue étudiante (aperçu) =================
function vueApercu() {
  const z = zone(); if (!z) return;
  const etus = ctx.etudiants();
  z.innerHTML = `
    <div class="carte"><h3>Voir l'onglet « Article » comme un étudiant</h3>
      <select id="ap-sel" style="max-width:360px"><option value="">Choisissez un étudiant…</option>
        ${etus.map(e => `<option value="${esc(e.code)}" ${e.code === apercuCode ? "selected" : ""}>${esc(e.prenom + " " + e.nom)}${ins[e.code] ? " · sujet " + ins[e.code].num : ""}</option>`).join("")}</select>
      <p class="small muted">Aperçu en lecture seule : exactement ce que voit l'étudiant (rien n'est cliquable). ${etatAcces()}</p></div>
    <div class="apercu-tel" id="ap-zone">${apercuCode
      ? htmlArticle({ cfg, sujets: cfg.visibles ? sujets : null, ins: ins[apercuCode] || null, apercu: true })
      : `<div class="vide">Sélectionnez un étudiant ci-dessus.</div>`}</div>`;
  z.querySelector("#ap-sel").onchange = ev => { apercuCode = ev.target.value; vueApercu(); };
}

// ================= Réglages =================
function vueReglages() {
  const z = zone(); if (!z) return;
  z.innerHTML = `
    <div class="carte">
      <h3>Accès des étudiants aux sujets d'article</h3>
      <label class="coche"><input type="checkbox" id="cfg-vis" ${cfg.visibles ? "checked" : ""}>
        <span><b>Sujets visibles</b> : les étudiants peuvent voir la liste des sujets et ceux qui restent disponibles</span></label>
      <label class="coche"><input type="checkbox" id="cfg-choix" ${cfg.choixOuverts ? "checked" : ""} ${cfg.visibles ? "" : "disabled"}>
        <span><b>Choix ouverts</b> : les étudiants peuvent choisir leur sujet (un seul, définitif, premier arrivé premier servi)</span></label>
      <p class="small muted">Tant que « Sujets visibles » est décoché, les sujets sont <b>bloqués par les règles de sécurité Firebase</b> : aucun étudiant ne peut les lire, même en contournant l'appli. Fermez les choix une fois que tout le monde a choisi.</p>
    </div>
    <div class="carte">
      <h3>Sujets</h3>
      <p class="small muted">${sujets.length}/${SUJETS.length} sujets créés. Crée ceux qui manquent (les choix déjà faits ne sont pas modifiés).</p>
      <button id="cfg-init">Créer les sujets manquants</button>
    </div>
    <div class="carte">
      <h3>Notes</h3>
      <p class="small muted">Les notes (onglet Évaluation) ne sont <b>jamais</b> accessibles aux étudiants : les règles de sécurité les réservent aux comptes enseignants.</p>
    </div>`;
  const vis = z.querySelector("#cfg-vis"), ch = z.querySelector("#cfg-choix");
  vis.onchange = async () => {
    const champs = vis.checked ? { visibles: true } : { visibles: false, choixOuverts: false };
    try { await DB.saveConfigArticle(champs); ctx.toast(vis.checked ? "Sujets visibles par les étudiants" : "Sujets cachés aux étudiants"); } catch (e) { erreur(e); vis.checked = !vis.checked; }
  };
  ch.onchange = async () => {
    try { await DB.saveConfigArticle({ choixOuverts: ch.checked }); ctx.toast(ch.checked ? "Choix ouverts" : "Choix fermés"); } catch (e) { erreur(e); ch.checked = !ch.checked; }
  };
  z.querySelector("#cfg-init").onclick = creerSujets;
}

const VUES = { sujets: vueSujets, recapsujets: vueRecap, apercu: vueApercu, reglages: vueReglages };
// Après un changement dans l'onglet Évaluation, recharger la note de théorie
export function oublierEvals() { evals = null; }
