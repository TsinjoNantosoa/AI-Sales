# AI Sales Assistant — Frontend

A complete, production-ready **SaaS sales automation platform** built with React, TypeScript, and shadcn/ui. Designed to be presented in a professional portfolio and connected to a FastAPI backend.

---

## Overview

**AI Sales Assistant** automates the full sales lifecycle:

1. **Lead Capture** — Public form and AI chatbot collect and qualify prospects
2. **AI Qualification** — Automatic lead scoring (budget, urgency, service fit, authority)
3. **CRM Pipeline** — Kanban board with drag-and-drop status management
4. **Calendar Booking** — Calendly-like booking page with Google Calendar simulation
5. **Automated Follow-ups** — n8n workflow automation with execution tracking
6. **Sales Analytics** — Rich dashboards with Recharts

---

## Features

| Module | Description |
|---|---|
| Landing Page | Hero, features, how-it-works, integrations, CTA |
| Lead Capture Form | 3-step form with Zod validation |
| AI Chatbot | Floating widget with qualification flow |
| Public Booking | Calendly-style meeting scheduler |
| Dashboard | 8 KPI cards + 5 charts |
| Leads CRM | Table with filters, sort, pagination, bulk actions |
| Pipeline Kanban | Drag-and-drop with @dnd-kit |
| Lead Detail | Full profile with 9 tabs |
| Conversations | Inbox-style messaging with AI/human support |
| Appointments | Calendar + list + availability views |
| Tasks | Full task management with priorities |
| Automations | n8n workflow monitoring |
| Analytics | Advanced sales analytics |
| Notifications | Categorized notification center |
| Team Management | User table with admin actions |
| Audit Logs | Admin-only security trail |
| Integrations | n8n, Google Calendar, Gmail + coming soon |
| Settings | 8-tab configuration panel |
| User Profile | Profile, password, notifications, calendar |
| Auth | Login with demo accounts, forgot password |
| i18n | English + French with centralized translations |
| Dark Mode | Full dark/light theme support |

---

## Tech Stack

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript (strict) | Type safety |
| Vite | Build tool |
| Tailwind CSS | Styling |
| shadcn/ui | Component library |
| TanStack Query | Server state |
| React Router v6 | Routing |
| React Hook Form | Forms |
| Zod | Validation |
| Zustand | Global state |
| Recharts | Charts |
| @dnd-kit | Kanban drag-and-drop |
| date-fns | Date utilities |
| Sonner | Toast notifications |
| next-themes | Dark/light mode |

---

## Installation

```bash
# 1. Clone the project
git clone <repo-url>
cd ai-sales-assistant

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env

# 4. Start development server
npm run dev
```

---

## Environment Variables

```env
VITE_API_URL=http://localhost:8000/api/v1   # Backend URL
VITE_USE_MOCKS=true                          # true = mock data, false = real API
VITE_APP_NAME=AI Sales Assistant
VITE_DEFAULT_LANGUAGE=en
```

> **Important**: Never store API keys, OAuth secrets, or SMTP passwords in the frontend. All secrets must stay in the FastAPI backend.

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@aisales.demo | Demo123! |
| Sales Manager | manager@aisales.demo | Demo123! |
| Sales Representative | sales@aisales.demo | Demo123! |

**Role differences:**
- **Admin** — Full access including audit logs, team management, all settings
- **Sales Manager** — All leads, all team members, analytics
- **Sales Representative** — Own assigned leads and conversations

---

## NPM Scripts

```bash
npm run dev        # Start development server (http://localhost:5173)
npm run build      # TypeScript check + production build
npm run preview    # Preview production build locally
npm run lint       # ESLint code quality check
npm run typecheck  # TypeScript type check only
```

---

## Project Architecture

```
src/
├── components/
│   ├── chatbot/       # ChatbotWidget (floating AI assistant)
│   ├── common/        # Avatar, StatusBadge, EmptyState, ConfirmDialog...
│   ├── dashboard/     # KpiCard
│   ├── leads/         # LeadFormModal
│   └── ui/            # shadcn/ui base components
├── hooks/
│   └── useNotifications.ts
├── layouts/
│   ├── AppLayout.tsx   # Authenticated layout with sidebar
│   ├── AuthLayout.tsx  # Login/forgot password layout
│   ├── PublicLayout.tsx # Public pages + chatbot
│   └── Sidebar.tsx
├── lib/
│   ├── i18n.ts        # English + French translations
│   └── utils.ts       # formatCurrency, cn, getStatusColor...
├── mocks/
│   └── data.ts        # 25+ leads, 6 users, 20 tasks, 8 appointments...
├── pages/
│   ├── auth/          # LoginPage, ForgotPasswordPage
│   ├── app/           # All CRM pages (15 pages)
│   └── public/        # LandingPage, RequestDemoPage, BookMeetingPage
├── services/          # All API service layers (mock + real)
│   ├── api.ts
│   ├── authService.ts
│   ├── leadService.ts
│   ├── conversationService.ts
│   ├── appointmentService.ts
│   ├── taskService.ts
│   ├── notificationService.ts
│   ├── analyticsService.ts
│   └── automationService.ts
├── stores/
│   ├── authStore.ts   # Zustand auth store (persisted)
│   └── appStore.ts    # Zustand app store (language, sidebar)
└── types/
    └── index.ts       # All TypeScript interfaces
```

---

## Mock Data

Located in `src/mocks/data.ts`:

- **26 leads** from 15+ countries (US, France, UK, Germany, Canada, Madagascar, South Africa, Australia...)
- **6 users** with different roles and performance metrics
- **20 tasks** with priorities, assignments, due dates
- **8 appointments** in various statuses (Confirmed, Proposed, Completed, Cancelled)
- **4 conversations** with full message threads
- **10 notifications** across all categories
- **6 n8n workflows** with execution history
- **12 audit log entries**
- **30-day lead time series** for charts

---

## Mock vs. Real API

The `VITE_USE_MOCKS` environment variable controls the data source:

```typescript
// src/services/api.ts
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

// src/services/leadService.ts
async getLeads(): Promise<Lead[]> {
  if (USE_MOCKS) {
    await delay();
    return [...leads]; // Returns mock data
  }
  return apiRequest("/leads"); // Calls FastAPI
}
```

To connect to the real backend:
1. Set `VITE_USE_MOCKS=false` in `.env`
2. Set `VITE_API_URL=https://your-api.com/api/v1`
3. Implement JWT token handling in `src/services/api.ts`

---

## Connecting to FastAPI

Expected endpoints (already prepared in services):

```
POST /auth/login          → authService.login()
GET  /auth/me             → authService.getMe()
GET  /leads               → leadService.getLeads()
POST /leads               → leadService.createLead()
GET  /leads/:id           → leadService.getLead()
PATCH /leads/:id          → leadService.updateLead()
DELETE /leads/:id         → leadService.deleteLead()
GET  /conversations       → conversationService.getConversations()
POST /conversations/:id/messages → conversationService.sendMessage()
GET  /appointments        → appointmentService.getAppointments()
GET  /tasks               → taskService.getTasks()
GET  /dashboard/overview  → analyticsService.getOverview()
GET  /automations         → automationService.getWorkflows()
```

---

## Deployment on Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production
vercel --prod
```

**vercel.json** (create at root if needed for SPA routing):
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## MVP Limitations

- No real OAuth (Google Calendar connection is simulated)
- No real AI (chatbot uses scripted responses; real AI requires FastAPI + OpenAI)
- No real email sending (Gmail integration is UI-only)
- No WebSocket (live conversation updates require backend)
- No file uploads (CSV import is UI-only)
- Authentication uses localStorage (no token refresh in mock mode)

---

## Screenshots

Place screenshots in `/public/screenshots/`:
- `dashboard.png` — KPI cards + charts
- `pipeline.png` — Kanban board
- `lead-detail.png` — Full lead profile
- `chatbot.png` — AI chatbot widget
- `analytics.png` — Sales analytics

---

Built with precision for portfolio presentation. Ready to connect to a FastAPI backend.
