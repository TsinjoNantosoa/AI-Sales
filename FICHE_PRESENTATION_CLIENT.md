# AI Sales Assistant — Fiche de présentation client

Document prêt pour la démonstration commerciale.  
Objectif : expliquer le **problème**, les **objectifs**, le **score lead**, et convaincre.

---

## 1. En une phrase

**AI Sales Assistant** capture, qualifie et priorise automatiquement vos leads grâce à l’IA et à l’automation (n8n), pour que vos commerciaux interviennent au bon moment sur les bons prospects.

---

## 2. Le problème à résoudre

### Situation actuelle (avant)

| Problème | Conséquence business |
|----------|----------------------|
| Les leads arrivent 24/7, l’équipe ne répond pas toujours le jour même | Leads froids, opportunités perdues |
| Qualification manuelle, subjective, lente | Mauvais priorisation, temps gaspillé |
| Relances oubliées ou irrégulières | Pipeline qui stagne |
| Pas de vision claire Hot / Warm / Cold | Les Hot ne sont pas traités en priorité |
| RDV mal suivis, pas de rappels | No-shows, perte de temps |
| Données dispersées (Excel, mails, WhatsApp) | Pas de traçabilité, reporting faible |

### Phrase d’accroche client

> « Combien de leads remplissent votre formulaire… et ne reçoivent aucune réponse la même journée ? »

### Coût réel

- Temps commercial passé sur des leads non qualifiés
- Leads chauds traités trop tard
- Conversion faible faute de process reproductible
- Dépendance à une ou deux personnes « qui se souviennent de relancer »

---

## 3. Les objectifs du projet

| Objectif | Ce que le produit fait |
|----------|------------------------|
| **Capturer** | Chaque demande (formulaire / chat) crée un lead immédiatement dans le CRM |
| **Qualifier** | L’IA + un score automatique classent le lead (Cold / Warm / Hot) |
| **Prioriser** | Les Hot déclenchent une alerte pour l’équipe commerciale |
| **Relancer** | Les follow-ups partent automatiquement (J+1, J+3, J+7) |
| **Convertir** | Prise de RDV + rappels de meeting |
| **Mesurer** | Dashboard, pipeline, automations, historique complet |

### Phrase clé à retenir

> « L’IA qualifie. L’automation relance. Le commercial intervient au bon moment. »

Ce n’est **pas** un remplacement des commerciaux.  
C’est un **copilote** qui filtre, accélère et industrialise le tunnel de vente.

---

## 4. Comment le score lead est calculé

Le score va de **0 à 100**.  
Il est recalculé à la création du lead, puis mis à jour pendant la conversation IA / qualification.

### Température (Hot / Warm / Cold)

| Score | Température | Action recommandée |
|------:|-------------|--------------------|
| **70 – 100** | **HOT** | Prioriser le contact immédiat (alerte équipe) |
| **40 – 69** | **WARM** | Nurturing / qualification continue |
| **0 – 39** | **COLD** | Nurturing léger, ne pas saturer le commercial |

### Les 6 critères du score (total max 100)

| Critère | Points max | Ce qui influence le score |
|---------|-----------:|---------------------------|
| **Budget Fit** | 25 | Budget déclaré (ex. > 10 000 $ = 25 pts) |
| **Urgency** | 20 | Délai (« Immediately » = 20, « Within 30 days » = 16) |
| **Service Fit** | 18 | Intérêt AI / Automation / RAG = score élevé |
| **Decision Authority** | 15 | Décideur identifié (« yes / decide ») |
| **Company Size** | 12 | Taille d’entreprise (plus grande = plus de points) |
| **Profile Completeness** | 15 | Prénom, email, société, téléphone, description, etc. |

**Formule :**
```text
Score total = min(100,
  Budget Fit
  + Urgency
  + Service Fit
  + Decision Authority
  + Company Size
  + Profile Completeness
)
```

### Exemple concret (persona démo « Marie Dupont / TechCorp »)

| Critère | Situation | Points |
|---------|-----------|-------:|
| Budget Fit | More than $10,000 | 25 |
| Urgency | Within 30 days | 16 |
| Service Fit | AI Automation | 18 |
| Decision Authority | Décideur (via chat) | 15 |
| Company Size | 51–200 employés | 10 |
| Profile Completeness | Formulaire bien rempli | ~13 |
| **TOTAL** | | **~97 → HOT** |

### Ce que le client voit dans le frontend

Sur la fiche lead (`/app/leads/:id`) :
- Score **/100**
- Badge **HOT / WARM / COLD**
- Breakdown (Budget, Urgency, Service Fit, etc.)
- Historique de recalcul du score
- Recommandation : *Prioritize outreach* (Hot) ou *Nurture* (Warm/Cold)

---

## 5. Architecture simple (pour expliquer sans jargon)

```text
Visiteur (site)
    → Formulaire / Chat AI
    → Backend FastAPI (cerveau métier + CRM + scoring)
    → n8n (automatisations : welcome, alertes, follow-up, RDV, rappels)
    → Équipe commerciale (dashboard + Hot leads)
```

| Couche | Rôle |
|--------|------|
| **Frontend** | Expérience prospect + CRM vendeur |
| **Backend (FastAPI + LangGraph)** | Logique métier, score, conversation IA |
| **n8n** | Orchestration des workflows (pas le cerveau métier) |

---

## 6. Les 7 automatisations n8n

| # | Workflow | Déclencheur | Résultat business |
|---|----------|-------------|-------------------|
| 01 | **Lead Capture** | Nouveau lead créé | Welcome + tracking |
| 02 | **AI Qualification** | Score / qualification mis à jour | CRM synchronisé |
| 03 | **Hot Lead Alert** | Lead devient HOT | Alerte prioritaire équipe |
| 04 | **Follow-up** | Relance due | Emails de nurturing |
| 05 | **Appointment Booking** | RDV créé | Sync / tâches / confirmation |
| 06 | **Meeting Reminder** | RDV proche | Rappel anti no-show |
| 07 | **Global Error Handler** | Échec workflow | Traçabilité des erreurs |

---

## 7. Parcours de démonstration (ordre recommandé)

1. **Landing** — montrer la promesse produit  
2. **Request a Demo** — créer un lead (formulaire 3 étapes)  
3. **CRM → Leads** — le lead apparaît immédiatement  
4. **CRM → Automations** — Lead Capture = Success  
5. **Chat AI** — qualification conversationnelle  
6. **Fiche lead** — score qui monte, température Hot/Warm  
7. **Book Meeting** — prise de RDV  
8. **CRM → Appointments + Automations** — RDV + workflow Success  
9. **Dashboard** — vision globale pour le décideur  

Compte démo CRM :
- Email : `admin@aisales.demo`
- Mot de passe : `Demo123!`

URLs locales :
- Frontend : http://localhost:5173
- Backend API : http://localhost:8000/docs
- n8n : http://localhost:5678

---

## 8. Bénéfices / arguments de conviction

### Pour le dirigeant
- Moins de leads perdus
- Process reproductible (pas dépendant d’une personne)
- Visibilité temps réel (pipeline, score, automations)
- ROI mesurable : temps de 1ère réponse, % Hot, RDV bookés

### Pour le commercial
- Focus sur les Hot
- Relances automatiques
- Historique chat + activités au même endroit
- Moins d’admin, plus de closing

### Pour l’IT / ops
- Backend = source de vérité
- n8n = workflows flexibles
- Auth service-à-service, idempotence, error handler
- Déployable Docker, évolutif

---

## 9. Ce que le produit fait / ne fait pas (encore)

| Fait déjà | À brancher en phase suivante |
|-----------|------------------------------|
| Capture lead + CRM | Emails SMTP réels (aujourd’hui mock possible en local) |
| Scoring + température | Google Calendar réel (mock possible en local) |
| Chat IA de qualification | Intégration CRM tiers (HubSpot, etc.) si besoin |
| Workflows n8n bout-en-bout | Branding / tunnel client spécifique |
| Dashboard + automations | Production hardening & monitoring |

Message honnête et rassurant :
> « La logique métier est démontrable aujourd’hui. Les connecteurs email/calendrier se branchent ensuite sans changer l’architecture. »

---

## 10. Proposition de suite (closing)

1. **Pilote 2–4 semaines** sur un canal (formulaire site actuel)
2. **Mesurer** : délai 1ère réponse, % leads Hot, RDV créés, no-shows
3. **Brancher** email + calendrier réels
4. **Étendre** aux autres canaux (ads, landing pages, inbound)

### Phrase de clôture

> « Aujourd’hui vous perdez des leads dans les délais et les relances.  
> Demain, chaque lead est capturé, scoré, relancé et priorisé — automatiquement.  
> On démarre par un pilote sur votre tunnel actuel. »

---

## 11. FAQ objections (réponses courtes)

**« Est-ce que ça remplace mon équipe commerciale ? »**  
Non. Ça filtre et accélère. Les humains ferment les deals Hot.

**« Et si l’IA se trompe sur le score ? »**  
Le score est transparent (critères visibles). L’équipe peut toujours intervenir / override.

**« On a déjà un CRM. »**  
Ce produit industrialise capture + qualification + automation. On peut s’intégrer / exporter selon le besoin.

**« Combien de temps pour démarrer ? »**  
Un pilote peut démarrer en semaines, pas en mois, sur un formulaire existant.

**« Sécurité / données ? »**  
Auth JWT, clés internes service-à-service, workflows tracés, base PostgreSQL, séparation backend / n8n.

---

## 12. Résumé ultra-court (à apprendre par cœur)

1. **Problème** : leads perdus, qualification lente, relances oubliées.  
2. **Objectif** : capturer → scorer → prioriser → relancer → convertir.  
3. **Score** : 0–100 via budget, urgence, fit service, décideur, taille, complétude.  
4. **Hot ≥ 70** : alerte immédiate.  
5. **Valeur** : plus de conversion, moins d’effort commercial, process mesurable.
