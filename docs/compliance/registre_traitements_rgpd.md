# Registre des traitements RGPD — PicLearn / AACA

**Responsable du traitement :** Équipe PicLearn  
**Version :** 2026-05-v1  
**Dernière mise à jour :** 15 mai 2026  
**Cadre légal :** Règlement (UE) 2016/679 (RGPD) — Article 30

---

## Tableau des traitements

| # | Traitement | Données concernées | Finalité | Base légale | Durée de conservation | Destinataires / Sous-traitants | Mesures de sécurité | Droits utilisateur |
|---|---|---|---|---|---|---|---|---|
| 1 | **Gestion de compte** | Email, nom complet, institution (opt.), mot de passe haché, date de création, `privacy_consent_at`, `privacy_policy_version` | Identification et authentification de l'utilisateur, gestion du profil | Contrat (Art. 6.1.b) | 365 jours après la dernière activité ou à la demande de suppression | MongoDB (stockage local ou hébergé) | Hachage bcrypt, accès restreint par rôle, HTTPS | Accès, rectification, suppression, portabilité |
| 2 | **Authentification (JWT)** | Email, user_id, token JWT (access + refresh) | Vérification de l'identité à chaque requête API | Contrat (Art. 6.1.b) | Access token : 30 min ; Refresh token : 7 jours | Aucun (traitement côté serveur uniquement) | Signature HMAC-SHA256, secret ≥ 32 chars, HTTPS | Déconnexion immédiate possible |
| 3 | **Traitement OCR des images** | Images de cours (JPEG/PNG/WebP), texte brut extrait | Extraction automatique du texte pédagogique pour générer des notes | Contrat (Art. 6.1.b) | Images GridFS : 90 jours ; texte extrait : 365 jours | PaddleOCR (local), OpenAI Vision API (si confiance OCR < 0,8) | Transfert chiffré (HTTPS), images associées à l'utilisateur propriétaire via `user_id` | Suppression de l'image et des données dérivées via suppression du compte |
| 4 | **Génération IA de notes** | Texte OCR corrigé, matière détectée, niveau cognitif | Structuration automatique du contenu en notes pédagogiques (titres, sections, définitions, concepts-clés) | Contrat (Art. 6.1.b) | 365 jours après la dernière activité | LLM : OpenAI GPT-4, Anthropic claude-sonnet-4-6, Google Gemini (selon config) | Transmission chiffrée, clés API stockées en variables d'environnement, pas de mémorisation côté LLM | Suppression de la note et de son contenu dérivé |
| 5 | **Génération IA de quiz** | Texte des notes, matière, niveau cognitif | Création de questions à choix multiples et réponses ouvertes pour évaluer l'apprentissage | Contrat (Art. 6.1.b) | 365 jours (liées aux notes) | Idem traitement n°4 | Idem traitement n°4 | Suppression via suppression de la note parente |
| 6 | **Génération IA de flashcards** | Texte des notes | Création de cartes recto-verso pour la révision espacée (algorithme SM-2) | Contrat (Art. 6.1.b) | 365 jours (liées aux notes) | Idem traitement n°4 | Idem traitement n°4 | Suppression via suppression de la note parente ou du compte |
| 7 | **Suivi de progression pédagogique** | Scores de quiz, taux de maîtrise des flashcards, streak d'étude, distribution par matière, dates d'activité | Personnalisation de l'apprentissage et recommandations adaptatives | Intérêt légitime / Contrat (Art. 6.1.b / 6.1.f) | 365 jours après la dernière activité | MongoDB (local ou hébergé) | Accès restreint au user_id authentifié, HTTPS | Accès via export, suppression via suppression du compte |
| 8 | **Stockage des captures et sessions** | Images de cours, texte OCR brut et corrigé, ordre de capture, session associée | Organisation multi-pages d'un cours en une session cohérente avant finalisation en note | Contrat (Art. 6.1.b) | Images : 90 jours ; métadonnées de session : 365 jours | MongoDB + GridFS (images), stockage local (`/uploads`) en fallback | Propriété vérifiée par `user_id` à chaque accès, HTTPS | Suppression de la session et de ses captures (y compris images GridFS) |
| 9 | **Indexation RAG / Vecteurs** | Texte des notes (chunks), embeddings vectoriels, métadonnées (matière, titre) | Recherche sémantique dans les notes de l'utilisateur via RAG (Retrieval-Augmented Generation) | Contrat (Art. 6.1.b) | Synchronisé avec la durée de conservation des notes (365 jours) | ChromaDB (stockage local dans `vector_store/`) | Index isolé par user_id, stockage local uniquement | Suppression des vecteurs lors de la suppression du compte (`rag_service.delete_user_notes`) |
| 10 | **Export RGPD (Art. 20)** | Toutes les données listées ci-dessus, sauf `password_hash` | Permettre à l'utilisateur d'exercer son droit à la portabilité des données | Obligation légale (Art. 6.1.c) | Données générées à la demande, non conservées en tant qu'export | Aucun (fichier généré côté serveur, transmis uniquement au client authentifié) | JWT requis, `password_hash` explicitement exclu de l'export, HTTPS | Droit à la portabilité (Art. 20 RGPD) |
| 11 | **Suppression de compte (Art. 17)** | Toutes les données de l'utilisateur (user, notes, quiz, flashcards, reviews, sessions, captures, images, vecteurs, progression) | Exercice du droit à l'effacement — suppression complète et irréversible | Obligation légale (Art. 6.1.c) | Suppression immédiate et permanente | Aucun | Filtrage strict par `user_id` (jamais d'autres utilisateurs), confirmation explicite côté frontend, HTTPS | Droit à l'effacement (Art. 17 RGPD) |

---

## Politique de conservation des données

| Type de données | Durée par défaut | Variable d'environnement |
|---|---|---|
| Données de compte, notes, quiz, flashcards, progression | 365 jours | `DATA_RETENTION_DAYS` |
| Images (GridFS + stockage local) | 90 jours | `IMAGE_RETENTION_DAYS` |
| Tokens JWT access | 30 minutes | `ACCESS_TOKEN_EXPIRE_MINUTES` |
| Tokens JWT refresh | 7 jours | `REFRESH_TOKEN_EXPIRE_DAYS` |

Les valeurs par défaut peuvent être modifiées via les variables d'environnement dans le fichier `.env`.  
L'utilisateur peut supprimer son compte et toutes ses données à tout moment depuis **Profil → Supprimer mon compte**.

---

## Preuve de consentement

Lors de l'inscription, les champs suivants sont enregistrés dans la collection `users` :

| Champ | Valeur exemple | Description |
|---|---|---|
| `privacy_consent` | `true` | Consentement explicitement accordé |
| `privacy_consent_at` | `2026-05-15T14:32:00Z` | Horodatage serveur UTC du consentement |
| `privacy_policy_version` | `"2026-05-v1"` | Version de la politique acceptée |

L'inscription est techniquement impossible si `privacy_consent` est `false` (refus HTTP 422 côté backend + case à cocher obligatoire côté frontend).

---

## Droits des personnes concernées

| Droit | Mécanisme d'exercice | Délai |
|---|---|---|
| Accès (Art. 15) | `GET /api/v1/privacy/export` — JSON complet sans `password_hash` | Immédiat |
| Portabilité (Art. 20) | Idem export | Immédiat |
| Rectification (Art. 16) | `PATCH /api/v1/user/me` | Immédiat |
| Effacement (Art. 17) | `DELETE /api/v1/privacy/account` | Immédiat et irréversible |
| Opposition (Art. 21) | Contact : support@piclearn-app.com | Sous 30 jours |

---

## Transferts hors UE

| Sous-traitant | Pays | Garanties |
|---|---|---|
| OpenAI (GPT-4) | États-Unis | Clauses contractuelles types (CCT) — [openai.com/policies/privacy](https://openai.com/policies/privacy) |
| Anthropic (Claude) | États-Unis | CCT — [anthropic.com/privacy](https://www.anthropic.com/privacy) |
| Google (Gemini) | États-Unis | CCT — [policies.google.com/privacy](https://policies.google.com/privacy) |
| MongoDB Atlas (si hébergé) | Variable | Selon région choisie — DPA disponible |

Si le backend est déployé intégralement on-premise avec OCR local (PaddleOCR), aucun transfert hors UE n'a lieu.

---

## Contact DPO / Responsable

Pour toute question relative à ce registre ou à l'exercice des droits :  
**Email :** support@piclearn-app.com  
**Délai de réponse :** 30 jours ouvrables maximum (Art. 12.3 RGPD)
