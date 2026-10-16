// =====================================================================
//  db.js — Accès aux données (Firebase Firestore ou mode démo local)
//
//  Organisation Firestore :
//    config/topo                     { voies: [...] }            topo du mur
//    config/annuaire                 { groupes: { g: [noms] } }  liste des binômes possibles
//    etudiants/{code}                profil (le code sert de clé d'accès)
//    etudiants/{code}/passages/{id}  carnet de l'étudiant
//    seances/{id}                    séance ouverte/clôturée par l'enseignant
//    seances/{id}/passages/{id}      copie du passage, écoutée en direct par l'enseignant
//    photos/{voieId}                 photo compressée d'une voie (une par document)
// =====================================================================
import { firebaseConfig } from "./firebase-config.js";
import { TOPO_INITIAL, genererCode } from "./topo.js";

export const MODE_DEMO = String(firebaseConfig.apiKey || "").includes("COLLER");

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
let fs, au, db, auth;

async function fb() {
  if (db) return;
  const app = await import(FB + "firebase-app.js");
  fs = await import(FB + "firebase-firestore.js");
  au = await import(FB + "firebase-auth.js");
  const a = app.initializeApp(firebaseConfig);
  db = fs.getFirestore(a);
  auth = au.getAuth(a);
}

const clone = o => JSON.parse(JSON.stringify(o));
const maintenant = () => new Date().toISOString();
export const nomCourt = e => `${e.prenom} ${String(e.nom || "").charAt(0).toUpperCase()}.`;

// ---------- Stockage démo (navigateur, partagé entre onglets) ----------
const CLE = "escalade-suaps-demo";
let memoire = null;
const ecouteurs = new Set();
function lireDemo() {
  try { const lu = JSON.parse(localStorage.getItem(CLE)); if (lu) memoire = lu; } catch (e) { /* on garde la mémoire */ }
  if (!memoire) memoire = { etudiants: {}, passages: {}, seances: {}, photos: {}, topo: clone(TOPO_INITIAL), annuaire: { groupes: {} } };
  memoire.photos ||= {};
  return memoire;
}
function ecrireDemo() {
  try { localStorage.setItem(CLE, JSON.stringify(memoire)); } catch (e) { /* stockage indisponible */ }
  ecouteurs.forEach(f => f());
}
if (MODE_DEMO) {
  // un autre onglet (prof ou étudiant) a écrit : on prévient les vues en direct
  window.addEventListener("storage", ev => { if (ev.key === CLE) ecouteurs.forEach(f => f()); });
}
function ecouterDemo(f) { ecouteurs.add(f); f(); return () => ecouteurs.delete(f); }

// ---------- Authentification enseignant ----------
export async function profConnexion() {
  if (MODE_DEMO) { sess("set", "prof", "1"); return true; }
  await fb();
  const provider = new au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await au.signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
      await au.signInWithRedirect(auth, provider);
    } else throw e;
  }
  return true;
}
export async function profDeconnexion() {
  if (MODE_DEMO) { sess("del", "prof"); return; }
  await fb(); await au.signOut(auth);
}
export async function surEtatProf(cb) {
  if (MODE_DEMO) { cb(sess("get", "prof") === "1"); return; }
  await fb();
  au.onAuthStateChanged(auth, u => cb(!!u, u));
}
function sess(op, k, v) {
  try {
    if (op === "get") return sessionStorage.getItem(k);
    if (op === "set") sessionStorage.setItem(k, v);
    if (op === "del") sessionStorage.removeItem(k);
  } catch (e) { return null; }
}

// ---------- Topo ----------
export async function getTopo() {
  if (MODE_DEMO) return clone(lireDemo().topo);
  await fb();
  const s = await fs.getDoc(fs.doc(db, "config", "topo"));
  return s.exists() ? s.data().voies : clone(TOPO_INITIAL);
}
export async function saveTopo(voies) {
  if (MODE_DEMO) { lireDemo().topo = clone(voies); ecrireDemo(); return; }
  await fb();
  await fs.setDoc(fs.doc(db, "config", "topo"), { voies, majLe: maintenant() });
}

// ---------- Photos des voies ----------
const cachePhotos = {};
export async function getPhoto(voieId) {
  if (voieId in cachePhotos) return cachePhotos[voieId];
  let data = null;
  if (MODE_DEMO) data = lireDemo().photos[voieId] || null;
  else {
    await fb();
    const s = await fs.getDoc(fs.doc(db, "photos", voieId));
    data = s.exists() ? s.data().data : null;
  }
  return (cachePhotos[voieId] = data);
}
export async function savePhoto(voieId, data) {
  cachePhotos[voieId] = data;
  if (MODE_DEMO) { lireDemo().photos[voieId] = data; ecrireDemo(); return; }
  await fb();
  await fs.setDoc(fs.doc(db, "photos", voieId), { data, majLe: maintenant() });
}
export async function supprimerPhoto(voieId) {
  cachePhotos[voieId] = null;
  if (MODE_DEMO) { delete lireDemo().photos[voieId]; ecrireDemo(); return; }
  await fb();
  await fs.deleteDoc(fs.doc(db, "photos", voieId));
}

// Réduit une image (fichier ou photo prise au téléphone) en JPEG léger, < 400 Ko
export function compresserImage(fichier, cote = 1200) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let r = Math.min(1, cote / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      for (let essai = 0; essai < 6; essai++) {
        cv.width = Math.round(img.width * r); cv.height = Math.round(img.height * r);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        for (const q of [0.75, 0.6, 0.45]) {
          const data = cv.toDataURL("image/jpeg", q);
          if (data.length < 400000) return ok(data);
        }
        r *= 0.75;
      }
      ko(new Error("Image trop lourde"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("Image illisible")); };
    img.src = url;
  });
}

// ---------- Annuaire (noms affichés pour choisir son binôme) ----------
export async function getAnnuaire(groupe) {
  if (MODE_DEMO) return clone(lireDemo().annuaire.groupes[groupe] || []);
  await fb();
  const s = await fs.getDoc(fs.doc(db, "config", "annuaire"));
  return (s.exists() && s.data().groupes?.[groupe]) || [];
}
export async function majAnnuaire(etudiants) {
  const groupes = {};
  for (const e of etudiants) (groupes[e.groupe || "Sans groupe"] ||= []).push(nomCourt(e));
  Object.values(groupes).forEach(l => l.sort((a, b) => a.localeCompare(b, "fr")));
  if (MODE_DEMO) { lireDemo().annuaire = { groupes }; ecrireDemo(); return; }
  await fb();
  await fs.setDoc(fs.doc(db, "config", "annuaire"), { groupes });
}

// ---------- Étudiants ----------
export async function getEtudiant(code) {
  code = String(code || "").trim().toUpperCase();
  if (!code) return null;
  if (MODE_DEMO) { const e = lireDemo().etudiants[code]; return e ? clone(e) : null; }
  await fb();
  const s = await fs.getDoc(fs.doc(db, "etudiants", code));
  return s.exists() ? s.data() : null;
}

export async function creerEtudiant({ nom, prenom, groupe }) {
  let code;
  for (let i = 0; i < 10; i++) {
    code = genererCode(6);
    if (!(await getEtudiant(code))) break;
  }
  const e = { code, nom: nom.trim(), prenom: prenom.trim(), groupe: (groupe || "").trim(), creeLe: maintenant() };
  if (MODE_DEMO) { lireDemo().etudiants[code] = clone(e); ecrireDemo(); return e; }
  await fb();
  await fs.setDoc(fs.doc(db, "etudiants", code), e);
  return e;
}

export async function majEtudiant(code, champs) {
  if (MODE_DEMO) { Object.assign(lireDemo().etudiants[code], clone(champs)); ecrireDemo(); return; }
  await fb();
  await fs.updateDoc(fs.doc(db, "etudiants", code), champs);
}

export async function supprimerEtudiant(code) {
  if (MODE_DEMO) {
    const m = lireDemo();
    delete m.etudiants[code];
    for (const [id, p] of Object.entries(m.passages)) if (p.code === code) delete m.passages[id];
    ecrireDemo(); return;
  }
  await fb();
  const ss = await fs.getDocs(fs.collection(db, "etudiants", code, "passages"));
  for (const d of ss.docs) {
    const p = d.data();
    if (p.seanceId) await fs.deleteDoc(fs.doc(db, "seances", p.seanceId, "passages", d.id));
    await fs.deleteDoc(d.ref);
  }
  await fs.deleteDoc(fs.doc(db, "etudiants", code));
}

export async function listerEtudiants() {
  if (MODE_DEMO) return Object.values(clone(lireDemo().etudiants));
  await fb();
  const s = await fs.getDocs(fs.collection(db, "etudiants"));
  return s.docs.map(d => d.data());
}

// ---------- Séances ----------
export async function ouvrirSeance(groupe) {
  const s = { id: genererCode(12), groupe, debut: maintenant(), fin: null, ouverte: true };
  if (MODE_DEMO) { lireDemo().seances[s.id] = s; ecrireDemo(); return s; }
  await fb();
  await fs.setDoc(fs.doc(db, "seances", s.id), s);
  return s;
}
export async function cloturerSeance(id) {
  const champs = { ouverte: false, fin: maintenant() };
  if (MODE_DEMO) { Object.assign(lireDemo().seances[id], champs); ecrireDemo(); return; }
  await fb();
  await fs.updateDoc(fs.doc(db, "seances", id), champs);
}
export async function supprimerSeance(id) {
  if (MODE_DEMO) {
    const m = lireDemo();
    delete m.seances[id];
    for (const p of Object.values(m.passages)) if (p.seanceId === id) p.seanceId = null;
    ecrireDemo(); return;
  }
  await fb();
  const ss = await fs.getDocs(fs.collection(db, "seances", id, "passages"));
  for (const d of ss.docs) {
    // le passage reste dans le carnet de l'étudiant, mais n'est plus rattaché à une séance
    try { await fs.updateDoc(fs.doc(db, "etudiants", d.data().code, "passages", d.id), { seanceId: null }); } catch (e) { /* étudiant supprimé */ }
    await fs.deleteDoc(d.ref);
  }
  await fs.deleteDoc(fs.doc(db, "seances", id));
}
export async function listerSeances() {
  if (MODE_DEMO) return Object.values(clone(lireDemo().seances)).sort((a, b) => b.debut.localeCompare(a.debut));
  await fb();
  const s = await fs.getDocs(fs.query(fs.collection(db, "seances"), fs.orderBy("debut", "desc")));
  return s.docs.map(d => d.data());
}

// Une séance ouverte depuis plus de 6 h est considérée comme oubliée
const DUREE_MAX = 6 * 3600 * 1000;
const encoreValide = s => s.ouverte && Date.now() - new Date(s.debut).getTime() < DUREE_MAX;

// Écoute en direct de la séance ouverte d'un groupe (page étudiant)
export async function ecouterSeanceOuverte(groupe, cb) {
  const choisir = liste => cb(liste.filter(encoreValide).sort((a, b) => b.debut.localeCompare(a.debut))[0] || null);
  if (MODE_DEMO) return ecouterDemo(() => choisir(Object.values(clone(lireDemo().seances)).filter(s => s.groupe === groupe)));
  await fb();
  const q = fs.query(fs.collection(db, "seances"), fs.where("groupe", "==", groupe), fs.where("ouverte", "==", true));
  return fs.onSnapshot(q, s => choisir(s.docs.map(d => d.data())), e => { console.error(e); cb(null); });
}

// Écoute en direct des séances ouvertes (espace enseignant)
export async function ecouterSeancesOuvertes(cb) {
  if (MODE_DEMO) return ecouterDemo(() => cb(Object.values(clone(lireDemo().seances)).filter(s => s.ouverte)));
  await fb();
  const q = fs.query(fs.collection(db, "seances"), fs.where("ouverte", "==", true));
  return fs.onSnapshot(q, s => cb(s.docs.map(d => d.data())), e => console.error(e));
}

// ---------- Passages (une voie grimpée) ----------
export async function ajouterPassage(etudiant, seanceId, p) {
  const id = genererCode(16);
  const doc = { ...p, id, code: etudiant.code, etudiant: nomCourt(etudiant), groupe: etudiant.groupe, seanceId: seanceId || null, date: maintenant() };
  if (MODE_DEMO) { lireDemo().passages[id] = clone(doc); ecrireDemo(); return doc; }
  await fb();
  const b = fs.writeBatch(db);
  const avecTs = { ...doc, ts: fs.serverTimestamp() };
  b.set(fs.doc(db, "etudiants", etudiant.code, "passages", id), avecTs);
  if (seanceId) b.set(fs.doc(db, "seances", seanceId, "passages", id), avecTs);
  await b.commit();
  return doc;
}

export async function supprimerPassage(p) {
  if (MODE_DEMO) { delete lireDemo().passages[p.id]; ecrireDemo(); return; }
  await fb();
  const b = fs.writeBatch(db);
  b.delete(fs.doc(db, "etudiants", p.code, "passages", p.id));
  if (p.seanceId) b.delete(fs.doc(db, "seances", p.seanceId, "passages", p.id));
  await b.commit();
}

const parDate = l => l.sort((a, b) => a.date.localeCompare(b.date));

export async function listerPassagesEtudiant(code) {
  if (MODE_DEMO) return parDate(Object.values(clone(lireDemo().passages)).filter(p => p.code === code));
  await fb();
  const s = await fs.getDocs(fs.collection(db, "etudiants", code, "passages"));
  return parDate(s.docs.map(d => d.data()));
}

// Carnet de l'étudiant en direct (sa page se met à jour si l'enseignant corrige)
export async function ecouterPassagesEtudiant(code, cb) {
  if (MODE_DEMO) return ecouterDemo(() => cb(parDate(Object.values(clone(lireDemo().passages)).filter(p => p.code === code))));
  await fb();
  return fs.onSnapshot(fs.collection(db, "etudiants", code, "passages"), s => cb(parDate(s.docs.map(d => d.data()))), e => console.error(e));
}

// Tous les passages d'une séance, en direct (tableau de bord enseignant)
export async function ecouterPassagesSeance(seanceId, cb) {
  if (MODE_DEMO) return ecouterDemo(() => cb(parDate(Object.values(clone(lireDemo().passages)).filter(p => p.seanceId === seanceId))));
  await fb();
  return fs.onSnapshot(fs.collection(db, "seances", seanceId, "passages"), s => cb(parDate(s.docs.map(d => d.data()))), e => console.error(e));
}

export async function listerPassagesSeance(seanceId) {
  if (MODE_DEMO) return parDate(Object.values(clone(lireDemo().passages)).filter(p => p.seanceId === seanceId));
  await fb();
  const s = await fs.getDocs(fs.collection(db, "seances", seanceId, "passages"));
  return parDate(s.docs.map(d => d.data()));
}
