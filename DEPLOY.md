# Mettre Blockmate en ligne

Compte environ 30 minutes, à faire une seule fois. Il te faut un compte GitHub, un compte Render (render.com, l'hébergeur), un compte Stripe et ton nom de domaine.

Le serveur n'a **aucune dépendance à installer**, il lui faut seulement Node 22.13 ou une version plus récente. Render s'en occupe tout seul.

---

## 1. Mettre le code sur GitHub (5 min)

1. Sur github.com, clique **New repository**.
   - Nom : `blockmate`.
   - Coche **Private**.
   - Ne coche rien d'autre : pas de README, pas de .gitignore.
2. Ensuite, deux possibilités :
   - Tu dis à Claude « repo créé » : il pousse le code pour toi.
   - Ou tu le fais toi-même : dans le dossier du projet, `git remote add origin https://github.com/chokrondavid-ui/blockmate.git`, puis `git push -u origin main`.

## 2. Héberger sur Render (10 min)

Railway a fermé les inscriptions, donc on utilise Render, qui fait la même chose. Le fichier `render.yaml` du projet configure tout automatiquement.

1. Sur render.com, clique **Get Started** et inscris-toi avec **GitHub**.
2. Clique **New +**, puis **Blueprint**, et choisis le dépôt `blockmate`. Autorise Render à y accéder si on te le demande.
3. Render lit `render.yaml` et prépare tout seul :
   - un serveur « Starter » à Francfort, environ 7 $/mois ;
   - un disque de 1 Go sur `/data`, environ 0,25 $/mois ;
   - les réglages du site.
4. Render te demande `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`. Laisse-les **vides** pour l'instant et clique **Apply**.
5. Attends 2 à 3 minutes, puis ouvre l'adresse `https://blockmate-xxxx.onrender.com` : le jeu tourne.
   - Sans clés Stripe, la boutique affiche « Payments open very soon ».
6. ⚠️ Ne passe pas en plan Free : il n'a pas de disque, les comptes seraient effacés et le serveur s'endort.

## 3. Brancher dbcblockmate.com (5 min, puis jusqu'à 1 h d'attente)

1. Dans Render, ouvre le service `blockmate`, puis **Settings → Custom Domains → Add**, et tape `www.dbcblockmate.com`.
2. Render t'affiche une cible **CNAME**, du type `blockmate-xxxx.onrender.com`.
3. Chez Hostinger, va dans **Domaines → dbcblockmate.com → DNS / Nameservers** :
   - ajoute un enregistrement Type `CNAME`, Nom `www`, Cible = la valeur donnée par Render ;
   - supprime l'ancien `www` s'il existe ;
   - ne touche pas aux lignes `MX`, elles servent à ta boîte mail.
4. Chez Hostinger, ajoute une **redirection** de `dbcblockmate.com` vers `https://www.dbcblockmate.com`.
5. Dans Render, clique **Verify**. Le cadenas HTTPS s'active tout seul après quelques minutes.

## 4. Activer les paiements Stripe (10 min)

1. Sur dashboard.stripe.com, **active ton compte**.
   - Il te faut ton SIRET de micro-entreprise, ton IBAN et une pièce d'identité.
   - Activer le compte ne donne pas encore les clés live.
2. Ouvre **Développeurs → Clés API** et copie la **clé secrète** (`sk_live_…`).
   - Pour tester d'abord, utilise le mode Test : clé `sk_test_…`, et la carte de test `4242 4242 4242 4242`.
3. Ouvre **Développeurs → Webhooks → Ajouter un endpoint** :
   - URL : `https://www.ton-domaine.com/api/stripe/webhook`.
   - Événements à cocher :
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `invoice.paid`
     - `customer.subscription.deleted`
     - `charge.refunded`
   - Copie le **secret de signature** (`whsec_…`).
4. Ouvre **Paramètres → Facturation → Portail client** et active-le. C'est là que les abonnés Plus peuvent se désabonner.
5. Dans Render, onglet **Environment**, ajoute les deux clés :
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
6. Fais un achat réel de 1,99 € pour vérifier que les Blockcoins arrivent, puis rembourse-le depuis Stripe.
   - Un remboursement ne retire pas les pièces automatiquement : il apparaît dans les logs Render et se traite à la main.

## 5. Avant d'ouvrir au public

- Ouvre ces trois pages et remplace tout ce qui est **surligné en orange**, c'est-à-dire ton nom, ton SIRET, ton adresse, ton email de contact et un médiateur de la consommation :
  - `public/legal/mentions.html`
  - `public/legal/cgv.html`
  - `public/legal/privacy.html`
- Le **médiateur de la consommation** est obligatoire pour vendre à des particuliers. Exemples : CM2C, Medicys, environ 50 à 150 €/an.
- Fais **relire les CGV par un juriste**. Le modèle est sérieux, mais je ne suis pas avocat.
- Vérifie avec ton comptable :
  - le plafond de chiffre d'affaires de la micro-entreprise ;
  - la TVA : la vente de contenus numériques à des particuliers d'autres pays de l'UE suit des règles spéciales (guichet OSS au-delà de 10 000 €/an).

## Mettre à jour le jeu

Chaque `git push` sur la branche `main` redéploie automatiquement, en environ 1 minute. Les joueurs en pleine partie en ligne la perdent, alors évite les heures de pointe.

## Sauvegardes

La base est un seul fichier : `/data/blockmate.db`. Render fait une sauvegarde automatique quotidienne du disque, que tu retrouves dans **Disks → Snapshots**.

## En cas de souci

- **Logs** : Render → ton service → **Logs**.
- **Santé du serveur** : `https://www.ton-domaine.com/healthz` doit répondre `{"ok":true}`.
- **Chiffres en direct** : `https://www.ton-domaine.com/api/stats` donne les joueurs en ligne, la file d'attente et les parties en cours.
