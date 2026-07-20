# Intégration du paiement (abonnement premium) — Spec

Date : 2026-07-20
Statut : validé par l'utilisateur, prêt pour plan d'implémentation

## 1. Contexte

L'application AACA (mobile Expo/React Native, iOS + Android publiés, backend FastAPI + MongoDB) a un
champ `User.is_premium: bool = False` (`backend/app/models/schemas.py:80`) déjà présent dans le schéma
mais **totalement dormant** : aucune logique de quota, aucune restriction de fonctionnalité, aucune
librairie de paiement installée côté frontend. Cette spec définit comment le rendre fonctionnel.

## 2. Modèle économique

- **Freemium** : 10 notes capturées par mois gratuites, illimité en premium
- Un seul palier premium, un seul tarif **mensuel** (pas d'offre annuelle pour l'instant)
- Le quota se limite au **nombre de notes créées** (capture photo ou création depuis texte) ; l'OCR et
  les fonctionnalités IA restent disponibles pour les notes autorisées, gratuites comme premium
- Le compteur se réinitialise chaque mois calendaire (pas de report du solde non utilisé)

## 3. Plateformes & contrainte stores

Mobile uniquement (iOS + Android). Apple et Google imposent leur propre système d'achat intégré pour
débloquer des fonctionnalités dans une app native — passer par Stripe directement serait une violation
des règles des deux stores. Comptes développeur Apple et Google Play déjà actifs, app déjà publiée sur
les deux stores.

## 4. Approche technique : RevenueCat (service managé)

RevenueCat plutôt qu'une validation de reçus faite maison (`expo-iap` / `react-native-iap` bruts), pour
une équipe solo/petite : RevenueCat gère la validation des reçus Apple (App Store Server API) et Google
(Play Developer API), le cycle de vie de l'abonnement (renouvellement, annulation, remboursement, litige
de facturation), et la synchronisation multi-appareil. Gratuit jusqu'à 2 500$/mois de revenu tracké, ~1%
au-delà. Le backend ne parle jamais directement à Apple/Google : RevenueCat est la source de vérité et
notifie notre backend par webhook.

**Prérequis externes (aucun n'existe encore, à faire par l'utilisateur avant tout test réel)** :
1. Créer un compte RevenueCat (gratuit)
2. Créer le produit d'abonnement mensuel dans App Store Connect (ex: `aaca_premium_monthly`)
3. Créer le produit équivalent dans Google Play Console (Play Billing)
4. Relier les deux produits à un même "Entitlement" `premium` dans le dashboard RevenueCat
5. Récupérer les clés API publiques SDK (iOS + Android) et le secret de webhook RevenueCat
6. Configurer un compte testeur Sandbox Apple (App Store Connect → Users and Access → Sandbox Testers)
   et un testeur de licence Google Play (Play Console → Setup → License testing) pour les tests réels

Le code sera écrit et testé (logique métier) indépendamment de ces étapes ; seul le test d'achat sandbox
réel en dépend.

## 5. Architecture

```
App mobile (RevenueCat SDK)
   │ achat natif (StoreKit / Play Billing)
   ▼
Apple / Google ──── reçu ────▶ RevenueCat (validation + état abonnement)
                                     │ webhook (Authorization: secret partagé)
                                     ▼
                      Backend FastAPI: POST /api/v1/payments/webhook/revenuecat
                                     │
                                     ▼
                         mongodb_service: user.is_premium = True/False
```

## 6. Composants backend

### `backend/app/core/config.py`
Ajout :
- `REVENUECAT_WEBHOOK_SECRET: str | None = None`
- `FREE_NOTES_MONTHLY_QUOTA: int = 10`

### `backend/app/services/payments_service.py` (nouveau)
- `handle_revenuecat_event(payload: dict) -> None` : dispatch selon `event.type`
  (`INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION` → `is_premium=True` ;
  `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE` → `is_premium=False`)
  — utilise `event.app_user_id` (= notre `user_id` interne, le SDK RevenueCat est initialisé avec
  `appUserID = user.id`, donc pas de table de mapping à maintenir)
- Idempotent par construction : rejouer le même événement plusieurs fois (retries RevenueCat) aboutit au
  même état, aucun effet de bord cumulatif

### `backend/app/services/mongodb_service.py`
Ajout de `get_monthly_note_count(user_id: str) -> int` (variante de `count_user_notes` existant ligne 525,
filtrée sur `created_at >= début du mois calendaire courant`)

### `backend/app/api/routers/payments.py` (nouveau)
- `POST /api/v1/payments/webhook/revenuecat` : pas d'auth JWT (appelé par RevenueCat), vérifie le header
  `Authorization` contre `settings.REVENUECAT_WEBHOOK_SECRET`. Retourne toujours `200` si le secret est
  valide (même si `app_user_id` inconnu, pour éviter les tempêtes de retry RevenueCat) ; `401` si secret
  invalide. Log un warning si `app_user_id` inconnu.
- `GET /api/v1/payments/status` (auth JWT) : retourne
  `{is_premium: bool, notes_used_this_month: int, notes_quota: int}`

### Enforcement du quota
Dans `backend/app/api/routers/notes.py`, en tout début de `capture_and_process` (ligne 152) et
`create_note_from_text` (ligne 267), **avant** tout appel OCR/LLM coûteux :
```
if not user.is_premium and monthly_count >= settings.FREE_NOTES_MONTHLY_QUOTA:
    raise HTTPException(402, detail={"code": "quota_exceeded", ...})
```
Le blocage avant l'appel API évite de gaspiller des crédits OCR/LLM sur une requête refusée.

## 7. Composants frontend

- Installer `react-native-purchases` (SDK RevenueCat)
- Initialiser le SDK au login dans `AuthContext`, avec `appUserID = user.id`, clés API RevenueCat par
  plateforme lues depuis la config Expo (`app.json` extra / variables d'environnement EAS)
- Nouvel écran `frontend/app/paywall.tsx` : présentation de l'offre premium, design **soigné et créatif**
  (cohérent avec `theme.ts`, gradients existants — utiliser le skill frontend-design lors de
  l'implémentation pour éviter un rendu générique), bouton "S'abonner", bouton "Restaurer mes achats"
  (obligatoire pour la validation Apple)
- `AuthContext` étendu avec `isPremium`, `notesUsedThisMonth`, `notesQuota` — rafraîchis après login et
  après un achat réussi (relecture de `GET /payments/status`)
- Badge de quota visible (ex: "7/10 notes ce mois") sur Home ou Profil
- Redirection automatique vers `/paywall` quand le backend renvoie `402 quota_exceeded` lors d'une
  capture

## 8. Gestion d'erreurs

| Cas | Comportement |
|---|---|
| Signature webhook invalide | `401`, log warning, aucune modification |
| `app_user_id` inconnu dans le webhook | `200` (ack, évite retry storm RevenueCat), log warning |
| Événement webhook dupliqué (retry RevenueCat) | Idempotent — même état final, pas d'effet cumulé |
| Achat annulé/échoué côté client | Toast d'erreur, aucun appel backend |
| Réinstallation de l'app par un utilisateur déjà premium | "Restaurer mes achats" recharge l'état RevenueCat, qui refait foi côté backend au prochain webhook/sync |
| Race condition sur le compteur mensuel (deux captures simultanées) | Acceptable en best-effort — ce n'est pas une frontière de sécurité stricte, au pire un utilisateur obtient 11 notes au lieu de 10 |

## 9. Tests

**Automatisés (backend, exécutés et validés comme faisant partie de l'implémentation)** :
- `handle_revenuecat_event` pour chaque type d'événement → vérifie la bascule correcte de `is_premium`
- Idempotence : rejouer deux fois le même événement → état final identique
- Endpoint quota : utilisateur gratuit à 10 notes → `402` ; utilisateur premium → jamais bloqué
- Webhook : secret invalide → `401` ; `app_user_id` inconnu → `200` + pas de crash

**Manuels (hors de portée de l'agent, à faire par l'utilisateur)** :
- Achat sandbox réel Apple (compte testeur Sandbox) et Android (testeur de licence)
- Vérification qu'un vrai renouvellement/annulation déclenche le webhook attendu

## 10. Hors scope (explicitement exclu de cette itération)

- Offre annuelle / paliers multiples de tarifs
- Essai gratuit (free trial)
- Paiement web (Stripe) — mobile uniquement pour cette itération
- Quota sur autre chose que le nombre de notes (ex: nombre d'appels IA séparés)
