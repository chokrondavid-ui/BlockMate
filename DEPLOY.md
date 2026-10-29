# Mettre Blockmate en ligne

Compte environ 30 minutes, à faire une seule fois. Il te faut un compte GitHub, un compte Railway (railway.com, l'hébergeur), un compte Stripe et ton nom de domaine.

Le serveur n'a **aucune dépendance à installer**, il lui faut seulement Node 22.13 ou une version plus récente. Railway s'en occupe tout seul.

---

## 1. Mettre le code sur GitHub (5 min)

1. Sur github.com, clique **New repository**.
   - Nom : `blockmate`.
   - Coche **Private**.
   - Ne coche rien d'autre : pas de README, pas de .gitignore.
2. Ensuite, deux possibilités :
   - Tu dis à Claude « repo créé » : il pousse le code pour toi.
   - Ou tu le fais toi-même : dans le dossier du projet, `git remote add origin https://github.com/chokrondavid-ui/blockmate.git`, puis `git push -u origin main`.

## 2. Héberger sur Railway (10 min)

1. Sur railway.com, connecte-toi avec GitHub.
   - Prends le plan **Hobby** (5 $/mois).
   - L'essai gratuit suffit pour tester.
2. Clique **New Project**, puis **Deploy from GitHub repo**, et choisis `blockmate`.
3. Ajoute un **volume**, c'est-à-dire le disque où sont gardés les comptes des joueurs :
   - Ouvre le service, puis **Settings → Volumes → Add volume**.
   - Mount path : `/data`.
   - ⚠️ Sans volume, tous les comptes sont effacés à chaque mise à jour.
4. Ajoute les variables (**Variables → Raw editor**) en remplaçant par tes valeurs :
   ```
   NODE_ENV=production
   PUBLIC_URL=https://www.ton-domaine.com
   DB_FILE=/data/blockmate.db
   ```
   Les deux clés Stripe s'ajoutent à l'étape 4.
5. Va dans **Settings → Networking**, clique **Generate Domain** et ouvre l'adresse en `.up.railway.app` : le jeu tourne.
   - Sans clés Stripe, la boutique affiche « Payments open very soon ».
6. ⚠️ Laisse **1 seule instance** (Replicas = 1). Les parties en ligne vivent dans la mémoire du serveur.

## 3. Brancher ton nom de domaine (5 min, puis jusqu'à 1 h d'attente)

1. Dans Railway, va dans **Settings → Networking → Custom Domain** et tape `www.ton-domaine.com`.
   - Railway t'affiche une valeur **CNAME**, du type `xxxx.up.railway.app`.
2. Chez Hostinger, va dans **Domaines → ton domaine → DNS / Nameservers** et ajoute :
   - Type `CNAME`, Nom `www`, Cible = la valeur donnée par Railway.
   - Supprime l'ancien enregistrement `www` s'il en existe un.
3. Toujours chez Hostinger, ajoute une **redirection** de `ton-domaine.com` vers `https://www.ton-domaine.com`, pour que l'adresse sans « www » marche aussi.
4. Attends que Railway affiche une coche verte. Le cadenas HTTPS est automatique.
5. Vérifie que `PUBLIC_URL` correspond exactement à cette adresse, puis redémarre le service.

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
5. Dans Railway, ajoute les deux clés :
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
6. Fais un achat réel de 1,99 € pour vérifier que les Blockcoins arrivent, puis rembourse-le depuis Stripe.
   - Un remboursement ne retire pas les pièces automatiquement : il apparaît dans les logs Railway et se traite à la main.

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

La base est un seul fichier : `/data/blockmate.db`. Dans Railway, va dans **Volume → Backups** et active les sauvegardes automatiques.

## En cas de souci

- **Logs** : Railway → Deployments → View logs.
- **Santé du serveur** : `https://www.ton-domaine.com/healthz` doit répondre `{"ok":true}`.
- **Chiffres en direct** : `https://www.ton-domaine.com/api/stats` donne les joueurs en ligne, la file d'attente et les parties en cours.
