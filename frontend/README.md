# AI Sales Assistant — Frontend

Frontend SaaS React/TypeScript pour **AI Sales Assistant** : capture de leads, qualification IA, CRM, pipeline Kanban, réservations, automatisations et analytics. Le mode mock est fonctionnel et persistant ; le mode API est prêt pour un backend FastAPI.

## Stack

React 18 · TypeScript · Vite · Tailwind · shadcn/ui · TanStack Query · React Router · Zustand · React Hook Form · Zod · Recharts · @dnd-kit · Vitest · Playwright

## Démarrage

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Ouvrir `http://localhost:5173`.

## Comptes démo

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@aisales.demo | Demo123! |
| Sales Manager | manager@aisales.demo | Demo123! |
| Sales Rep | sales@aisales.demo | Demo123! |

Les mots de passe ne sont **jamais** stockés dans `localStorage`.

## Variables d'environnement

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_USE_MOCKS=true
VITE_APP_NAME=AI Sales Assistant
VITE_DEFAULT_LANGUAGE=en
```

- `VITE_USE_MOCKS=true` → repository mock partagé + `localStorage`
- `VITE_USE_MOCKS=false` → `apiClient` vers FastAPI

## Scripts

```bash
npm run typecheck
npm run lint
npm run build
npm run test
npm run test:e2e
npm run preview
```

## Architecture données

```
Page → TanStack Query / hook → service → mockRepository | apiClient
```

Les pages n'importent pas `src/mocks/data` directement.

## Parcours public

1. `/` Landing
2. `/request-demo` crée un lead (`status: NEW`, `source: Website`)
3. `/chat?leadId=…` qualification IA (score / température / conversation)
4. `/book?leadId=…` rendez-vous + statut `MEETING_SCHEDULED`
5. Visible dans CRM, pipeline et dashboard (persistance mock)

## RBAC

- **ADMIN** : accès complet
- **SALES_MANAGER** : opérationnel + team / analytics / integrations (pas settings sensibles / audit)
- **SALES_REPRESENTATIVE** : uniquement ses données (`assignedUserId`)

Guards : `AuthGuard`, `GuestGuard`, `RoleGuard`.

## Déploiement Vercel

`vercel.json` réécrit toutes les routes vers `index.html` pour React Router.

## Backend FastAPI attendu

Endpoints principaux :

- `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me`
- `GET|POST /leads`, `GET|PATCH|DELETE /leads/:id`, notes, import, bulk
- `GET|POST /appointments`, slots calendrier
- `GET /conversations`, messages, handoff, qualify
- `GET /dashboard/overview`, analytics
- `GET|PATCH /settings`, `GET|POST /integrations/:id/*`
- `GET /users`, invite, stats
- `GET /audit-logs`, `GET /notifications`, `GET /tasks`, automations

Toutes les clés secrètes (OpenAI, Google OAuth, SMTP, n8n) restent côté backend.
