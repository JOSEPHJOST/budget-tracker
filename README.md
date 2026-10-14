# Budget Tracker

Application de gestion de budget mensuel (MAD), 100 % locale : aucune donnée ne quitte le navigateur.

## Règles de budget

- **Charges fixes** (Spotify, sport, transport + charges perso) déduites du revenu.
- Le reste est réparti en enveloppes variables selon deux profils : **standard** et **réduit**
  (revenu < 2 200 MAD, priorité aux essentiels).
- **Revenus externes** (inDrive, trading, freelance…) : 50 % vont à l'épargne, 50 % sont redistribués
  dans les enveloppes.

## Ce qui la distingue

- **Enveloppe du jour** : combien tu peux dépenser *aujourd'hui* pour finir le mois dans le budget.
- **Prévisions** : au rythme actuel, quelle enveloppe sera vide et à quelle date (à partir du 5 du mois).
  Un repère sur chaque barre montre où tu devrais en être.
- **« Puis-je me le permettre ? »** : simule un achat avant de le faire — verdict, enveloppes à
  rogner (Imprévus en premier), impact sur le budget quotidien.
- **Saisie rapide** : tape `45 café avec Sara`, le montant, la note et la catégorie sont déduits.
  L'app apprend de tes saisies passées (localement).
- **Objectifs d'épargne** priorisés, avec une date d'atteinte estimée sur ton rythme récent.
- **Charges récurrentes** : un nouveau mois reprend le revenu et les charges du mois précédent.
- **Sauvegarde** : export / restauration JSON (onglet Bilan).

## Développement

```bash
npm install
npm run dev     # serveur local
npm test        # tests de la logique (src/lib)
npm run lint
npm run deploy  # build + GitHub Pages
```

Logique pure dans `src/lib/` (testée), composants dans `src/components/`.
