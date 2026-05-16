# OptiMatch — AI Resume & Job Matcher

An intelligent AI-powered platform that analyzes resumes against job descriptions to provide fit scores, ATS compatibility, personalized improvement suggestions, and comprehensive job application management.

## Features

### Core Analysis
- **AI Fit Scoring** — Paste your resume and a job description to get an AI-powered fit score (0–100), ATS score, strengths, gaps, and improvement suggestions
- **Keyword Matching** — Identifies matched and missing ATS keywords from your resume
- **Cover Letter Generator** — Generates tailored cover letters with 4 tone options (professional, friendly, enthusiastic, concise) with multiple variations
- **LinkedIn Post Generator** — Creates personalized job-search posts for your network
- **AI Bullet Rewriter** — Paste any resume bullet and get a stronger, impact-driven version
- **Job URL Import** — Paste a job listing URL to automatically extract the job description, title, and company

### Interview Preparation
- **Interview Questions** — AI-generated likely interview questions based on the role and your resume gaps
- **STAR Answer Helper** — Generate or polish STAR-method interview answers for each question
- **Interview Practice Mode** — Timed 2-minute STAR answer practice with local scoring and session history
- **Company Research** — AI-generated company overview, culture notes, red flags, and interview tips
- **Red Flags Detector** — AI scans job descriptions for warning signs before you apply

### Career Development
- **Learning Plan** — Personalized study plans with specific courses, certifications, and projects
- **AI Salary Guide** — AI-estimated salary range (low/mid/high) with market context and negotiation tips
- **Market Insights** — Role demand level, salary trends, top in-demand skills, and hiring outlook
- **Career Path Planner** — Infers your current role and suggests next-step and stretch roles with timelines
- **Negotiation Simulator** — Multi-turn AI salary negotiation chat with offer/counter-offer scripts
- **Negotiation Calculator** — Offer/target/floor salary calculator with gap analysis and script templates
- **Skills Tracker** — Tracks most common matched/missing keywords across all your analyses
- **Follow-up Email Generator** — Generates follow-up emails for after applying, after interviews, or thank-you notes

### Job Application Management
- **Application Status Tracking** — Track each analysis through: Not Applied → Applied → Interview → Offer → Rejected
- **Kanban Job Board** — Visual drag-and-drop board to manage your job pipeline by status
- **Job Tracking** — Per-analysis deadline, follow-up date, contact info, and tags
- **History with Search & Filter** — Search by title/company, filter by status/favorites, save searches
- **Comparison View** — Side-by-side comparison of any two analyses (scores, keywords, strengths, gaps)
- **Duplicate Analysis** — Clone any analysis to quickly apply to similar roles

### Analytics & Insights
- **Advanced Stats** — Fit/ATS score trends, distribution histogram, pipeline funnel, and top keywords
- **Funnel Analytics** — Pipeline widget showing applied → interview → offer conversion rates
- **Brand Dashboard** — Keyword strength bars, skill gap map, personal summary stats, and strengths word-cloud
- **Stats Enhancements** — Keyword trends, time-in-stage metrics, interview/offer conversion cards, score momentum

### Collaboration & Sharing
- **Social Sharing** — Create public share links with revocable tokens
- **Email Sharing** — Quick email sharing button for analyses
- **Favorites & Notes** — Star important analyses and add private auto-saved notes
- **Portfolio Links** — Save up to 3 portfolio URLs (GitHub, portfolio, case study) per analysis

### User Experience
- **Keyboard Command Palette** — `⌘K` / `Ctrl+K` global search and quick navigation
- **Themes** — 3 visual themes (warm, formal, minimal) with dark mode support
- **Export PDF** — Print-optimized layout for sharing analyses
- **Bulk CSV Export** — Export all analyses from History as CSV
- **In-App Notifications** — Deadline and follow-up reminders with real-time badge count
- **Error Boundary** — Graceful error handling with friendly recovery UI

## Tech Stack

### Frontend
- **React** with **Vite** for fast development
- **TypeScript** for type safety
- **TanStack Query** for data fetching and caching
- **Wouter** for lightweight routing
- **shadcn/ui** component library with **Tailwind CSS**
- **Recharts** for data visualization
- **Framer Motion** for animations
- **React Hook Form** + **Zod** for form validation

### Backend
- **Express 5** API server
- **SQLite** (via **better-sqlite3**) with **Drizzle ORM** for local development
- **Zod** for runtime validation
- **Pino** for structured logging
- **esbuild** for fast builds

### AI Integration
- **OpenAI GPT** for all AI-powered features
- Custom AI prompts for resume analysis, interview prep, salary guidance, and career planning

### Architecture
- **pnpm workspace monorepo** with shared libraries
- **OpenAPI spec** with automatic code generation (Orval)
- **Shared Zod schemas** for type-safe API contracts
- **React Query hooks** auto-generated from OpenAPI spec

## Project Structure

```
├── artifacts/
│   ├── resume-matcher/    # React frontend application
│   ├── api-server/        # Express API server
│   └── mockup-sandbox/    # UI component sandbox
├── lib/
│   ├── db/                # Database schema and Drizzle config
│   ├── api-spec/          # OpenAPI specification
│   ├── api-zod/           # Generated Zod validation schemas
│   ├── api-client-react/  # Generated React Query hooks
│   └── integrations/      # OpenAI integration libraries
├── scripts/               # Build and utility scripts
├── package.json           # Root workspace config
└── pnpm-workspace.yaml    # Workspace definition
```

## Getting Started

### Prerequisites
- Node.js 24+
- pnpm package manager
- OpenAI / DeepSeek API key (depending on integration)

### Installation

```bash
# Install dependencies
pnpm install

# Set up database schema (creates/updates ./resume-matcher.sqlite at repo root by default)
pnpm --filter @workspace/db run push

# Generate API types and hooks
pnpm --filter @workspace/api-spec run codegen
```

### Development

```bash
# Run API server
pnpm --filter @workspace/api-server run dev

# Run frontend (in another terminal)
cd artifacts/resume-matcher
pnpm run dev
```

### Build

```bash
# Typecheck all packages
pnpm run typecheck

# Build all packages
pnpm run build
```

## Deploy to GitHub Pages

GitHub Actions now deploys the frontend automatically from this repository.

1. Push to `main` (or `master`) to trigger deployment.
2. In GitHub, set **Settings → Pages → Source** to **GitHub Actions**.
3. The workflow builds `@workspace/resume-matcher` and publishes `artifacts/resume-matcher/dist/public`.

It automatically sets the correct Vite base path for project pages and includes a `404.html` fallback for client-side routes.

## License

MIT
