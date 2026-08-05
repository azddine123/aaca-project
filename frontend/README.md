# PicLearn — Mobile App

Expo / React Native client for PicLearn: capture a course, review the AI-generated note, and study with adaptive quizzes and flashcards.

See the [root README](../README.md) for the full project overview, screenshots and architecture diagram.

## Stack

| | |
|---|---|
| Framework | Expo SDK 54 + Expo Router 6 |
| UI | React Native 0.81, React 19, React Native Paper |
| Language | TypeScript |
| Styling | `StyleSheet` + design tokens (`theme.ts`) + `expo-linear-gradient` |
| State | React Context (`AuthContext`, `NotesContext`, `StudyContext`, `SubjectsContext`, `AppearanceContext`) |
| Payments | `react-native-purchases` (RevenueCat) |
| Charts | `react-native-chart-kit` |

## Project structure

```
app/                       # Expo Router — file-based routing
├── (auth)/                  # login, register, forgot-password, verify-email
├── (tabs)/                  # Home, Notes, Study, Profile, Snap (FAB placeholder)
├── capture.tsx              # camera / import capture flow
├── note-detail.tsx          # note tabs: résumé / contenu / étudier
├── session-new.tsx          # multi-capture course session
├── paywall.tsx              # premium subscription screen
└── _layout.tsx
components/                # Shared UI (AppLogo, MathFormula, NoteContentView, UIKit, ...)
contexts/                  # App-wide state via React Context
lib/
├── api.ts                   # centralized API client (apiFetch, ApiError)
└── purchases.ts             # RevenueCat SDK wrapper
config/
└── api.ts                   # API base URL resolution
theme.ts                   # design tokens (colors, spacing, typography)
```

## Setup

```bash
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL to point at the backend
```

The backend must be running first — see [backend/README.md](../backend/README.md).

## Run

```bash
npm run start      # Expo dev server, then choose iOS / Android / Web
npm run android
npm run ios
npm run web
```

## Environment variables

Reference in [.env.example](.env.example):

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend API base URL (defaults to local dev API otherwise) |
| `EXPO_PUBLIC_ENABLE_ANALYTICS` | Feature flag |
| `EXPO_PUBLIC_APP_ENV` | `development` / `production` |

## Lint / type-check

```bash
npm run lint
npx tsc --noEmit
```

Both are run in CI on every push/PR to `main` (see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).
