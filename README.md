# Escalade SUAPS — Guide d'installation

Application web gratuite pour le suivi des séances d'escalade au mur de Suchet :
- **`index.html`** : page étudiant (téléphone). Accès par code personnel ou QR code. L'étudiant enregistre chaque voie : relais, couleur, mode, résultat, binôme et ressenti.
- **`prof.html`** : espace enseignant (PC), avec connexion par compte Google. Suivi **en direct** de la séance, étudiants, QR codes, topo, historique, export CSV.

Hébergement : **GitHub Pages** (gratuit). Données : **Firebase Firestore** (offre gratuite Spark). Même architecture que l'appli Muscu SUAPS.

---

## Fonctionnement en séance

1. Sur le PC, onglet **En direct** : choisissez le groupe et cliquez sur **Ouvrir une séance**.
2. Les étudiants ouvrent l'appli sur leur téléphone. Leur carte QR n'est à scanner qu'une seule fois, car le téléphone s'en souvient.
   Le bandeau vert « Séance en cours » apparaît tout seul.
3. Pour chaque voie, l'étudiant touche **Relais**, puis **Voie**, puis renseigne les **détails** (mode, résultat, binôme, ressenti) et enregistre.
   Il peut annuler une saisie pendant 15 minutes.
4. Votre écran se met à jour **instantanément**. Il affiche un tableau par étudiant (voies, enchaînements, max en tête et en moulinette, dernière voie), un fil en direct et la fréquentation de chaque relais.
   Le point vert signale un étudiant actif. Le point orange signale qu'il n'a rien enregistré depuis 15 minutes.
5. En fin de cours, cliquez sur **Clôturer la séance**. Une séance oubliée se ferme d'elle-même côté étudiant au bout de 6 heures.

Si aucune séance n'est ouverte, l'étudiant peut quand même enregistrer ses voies : elles vont dans son carnet personnel.

---

## 0. Tester tout de suite (mode démo)

Si `js/firebase-config.js` contient `COLLER_ICI`, l'appli tourne en **mode démo**, avec des données stockées dans le navigateur.
Ouvrez `prof.html` et cliquez sur « Se connecter avec Google » : en démo, l'espace enseignant s'ouvre directement.
Importez quelques étudiants et ouvrez une séance. Ouvrez ensuite la fiche d'un étudiant, puis « Ouvrir sa vue étudiant » dans un autre onglet.
Les deux onglets se synchronisent en direct.

> ⚠️ Les fichiers utilisent des modules JavaScript : un double-clic sur `index.html` ne suffit pas. Utilisez GitHub Pages (étape 4).

---

## 1. Créer le projet Firebase

1. Allez sur <https://console.firebase.google.com> et cliquez sur **Ajouter un projet**. Nommez-le `escalade-suaps`. Google Analytics est inutile.
2. Allez dans **Build > Firestore Database**, puis *Créer une base de données*. Choisissez le mode **production** et l'emplacement **`europe-west9 (Paris)`**.
3. Allez dans **Build > Authentication**, cliquez sur *Commencer*, puis dans *Sign-in method* activez **Google**.
4. Ouvrez ⚙️ **Paramètres du projet**, section *Vos applications*. Cliquez sur l'icône **`</>`** (Web), nommez l'application `escalade` et copiez le bloc `firebaseConfig`.

## 2. Configurer les fichiers

✅ **Déjà fait pour le projet `escalade-suaps-32bc2`.**

- **`js/firebase-config.js`** contient la configuration du projet.
- **`firestore.rules`** autorise trois comptes enseignants : `aurelievigeon@gmail.com`, `mzubaloff@gmail.com` et `florianeude@gmail.com`.
  Pour ajouter un collègue, ajoutez son adresse en minuscules dans la liste, puis republiez les règles (étape 3) :
  ```
  && request.auth.token.email.lower() in ["aurelievigeon@gmail.com", "mzubaloff@gmail.com", "florianeude@gmail.com", "collegue@gmail.com"];
  ```

## 3. Publier les règles de sécurité

Dans la console Firebase, ouvrez **Firestore Database > Règles**. Collez tout le contenu de `firestore.rules`, puis cliquez sur **Publier**.

Ce que garantissent ces règles :
- seul un compte enseignant autorisé peut gérer les étudiants, les séances et le topo, et voir le suivi en direct ;
- un étudiant n'accède qu'à **son** carnet, grâce à son code (6 caractères) ;
- un étudiant ne peut ajouter une voie à une séance que si elle est **ouverte** et appartient à **son groupe** ;
- un étudiant peut annuler une saisie pendant 15 minutes. Au-delà, seul l'enseignant peut la corriger.

## 4. Mettre en ligne sur GitHub Pages

1. Créez un dépôt **public** sur GitHub, par exemple `escalade-suaps`.
2. Déposez-y tout le contenu du dossier, par glisser-déposer dans *Add file > Upload files*.
3. Allez dans **Settings > Pages**. Dans *Source*, choisissez `Deploy from a branch`, puis la branche `main` et le dossier `/ (root)`. Cliquez sur *Save*.
4. Après 1 à 2 minutes, le site est en ligne :
   - les étudiants utilisent `https://mzbe2.github.io/escalade-suaps/` (ou leur QR code) ;
   - vous utilisez `https://mzbe2.github.io/escalade-suaps/prof.html`.
5. ⚠️ Dans Firebase, ouvrez **Authentication > Paramètres > Domaines autorisés** et vérifiez que `mzbe2.github.io` y figure. Ajoutez-le sinon.

## 5. Première utilisation

1. **Étudiants** : collez votre liste `Nom;Prénom;Groupe` (ex. `DUPONT;Léa;Jeudi 12h`). Le groupe doit être écrit exactement pareil pour tous les étudiants d'un même créneau.
2. **QR codes** : filtrez par groupe et imprimez les cartes.
3. **Topo** : les 57 voies d'octobre 2026 (source Oblyk) sont préchargées. Vérifiez les couleurs claires (blanc, gris, beige), puis cliquez sur **Enregistrer le topo**.
4. **Photos** : dans l'onglet Topo, cliquez sur « ＋ Photo » à côté d'une voie. Sur téléphone, vous pouvez photographier la voie directement. La photo est compressée automatiquement, puis s'affiche pour l'étudiant quand il choisit la voie.
5. **En direct** : ouvrez votre première séance.

## Rééquipement du mur (2 fois par an)

Ouvrez l'onglet **Topo**. Cliquez sur **Démonter le relais** pour les anciennes voies, ou décochez « En place » voie par voie. Ajoutez ensuite les nouvelles voies avec **＋ Ajouter une voie**, puis enregistrez.
Les voies démontées restent dans l'historique : le carnet des étudiants reste lisible.

---

## Données personnelles

Seuls le nom, le prénom, le groupe et les voies grimpées sont stockés, sur un serveur européen. Aucune adresse e-mail étudiante n'est demandée.
Pour le choix du binôme, la liste « Prénom N. » de chaque groupe est lisible depuis l'appli.
Informez les étudiants et, si nécessaire, le DPO de l'université. Supprimez les profils en fin d'année depuis l'espace enseignant.

## Structure

```
index.html            page étudiant
prof.html             espace enseignant (connexion Google)
css/style.css         styles (clair / sombre automatique)
js/topo.js            topo initial, couleurs, cotations, libellés   ← à personnaliser
js/stats.js           calculs de progression (max, pyramide)
js/db.js              accès Firestore (temps réel, photos) / mode démo
js/etudiant.js        logique page étudiant
js/prof.js            logique espace enseignant
js/firebase-config.js clés Firebase                                 ← à remplir
firestore.rules       règles de sécurité                            ← adresses enseignants
```

## Quotas gratuits (offre Spark)

50 000 lectures et 20 000 écritures par jour. Une séance de 20 étudiants qui grimpent 10 voies chacun représente environ 400 écritures et quelques milliers de lectures, soit largement dans les limites.
