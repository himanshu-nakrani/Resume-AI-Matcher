# OptiMatch ✨

> AI-powered resume analysis and job application management platform.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![License](https://img.shields.io/badge/License-MIT-22C55E?logo=opensourceinitiative&logoColor=white)](./LICENSE)

**Live Demo:** [https://himanshu-nakrani.github.io/Resume-AI-Matcher/](https://himanshu-nakrani.github.io/Resume-AI-Matcher/)

OptiMatch helps job seekers analyze their resumes against job descriptions, generate tailored cover letters, track applications, and make data-driven career decisions — all powered by modern AI.

---

## 🚀 What It Does

Paste your resume and a job description (or a job URL) and OptiMatch gives you:

- **AI Fit Score** (0–100) with actionable reasoning
- **ATS Compatibility Score** with matched/missing keywords
- **Strengths, Gaps & Improvements** tailored to the role
- **Cover Letter Generator** with 4 tones and multiple variations
- **LinkedIn Post Generator** for your network
- **Interview Questions**, **Learning Plans**, **Salary Guides**, **Career Paths**, and more

Then track every application through a visual Kanban board, analyze your pipeline with stats, and share analyses with public links.

---

## 🎯 Feature Highlights

| Category | Features |
|----------|----------|
| **Resume Analysis** | AI fit score, ATS score, keyword matching, strengths/gaps, improvement suggestions |
| **AI Generators** | Cover letter, LinkedIn post, follow-up emails, STAR answers, negotiation scripts |
| **Job Import** | Paste a job URL to auto-extract title, company, and description |
| **Application Tracking** | Status pipeline, Kanban board, deadlines, follow-ups, contacts, tags, favorites |
| **Analytics** | Score trends, keyword trends, funnel conversion, time-in-stage, momentum |
| **Sharing** | Public share links with revocable tokens, email sharing |
| **Productivity** | Global command palette (`⌘K`/`Ctrl+K`), dark mode, PDF export, CSV export |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        OptiMatch                             │
├────────────────────────────┬────────────────────────────────┤
│   artifacts/resume-matcher │     artifacts/api-server       │
│   React + Vite Frontend    │     Express 5 API Server       │
│   Port: 5173               │     Port: 3000                 │
├────────────────────────────┴────────────────────────────────┤
│              lib/ — Shared Libraries                         │
│  • api-spec       (OpenAPI contract)                         │
│  • api-zod        (Generated Zod schemas)                    │
│  • api-client-react (Generated React Query hooks)            │
│  • db             (Drizzle ORM + SQLite schema)              │
│  • integrations   (OpenAI / DeepSeek AI clients)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
- [React 19](https://react.dev/) + [Vite 7](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [TanStack Query](https://tanstack.com/query) for server state
- [Wouter](https://github.com/molefrog/wouter) for routing
- [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) for UI
- [Recharts](https://recharts.org/) for charts
- [Framer Motion](https://www.framer.com/motion/) for animations

### Backend
- [Express 5](https://expressjs.com/)
- [SQLite](https://sqlite.org/) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Zod](https://zod.dev/) for validation
- [Pino](https://getpino.io/) for structured logging
- [esbuild](https://esbuild.github.io/) for bundling

### AI
- [OpenAI GPT](https://openai.com/) / [DeepSeek](https://www.deepseek.com/)
- Server-side API key management for security

---

## 📦 Prerequisites

- [Node.js](https://nodejs.org/) 24+
- [pnpm](https://pnpm.io/) 9+
- An [OpenAI](https://platform.openai.com/) or [DeepSeek](https://platform.deepseek.com/) API key
- An [Exa](https://exa.ai/) API key (for job URL import)

---

## ⚡ Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up the database

```bash
pnpm --filter @workspace/db run push
```

This creates/updates `resume-matcher.sqlite` at the repo root.

### 3. Configure environment variables

Create `artifacts/api-server/.env`:

```env
# Required: choose one AI provider
DEEPSEEK_API_KEY=your_deepseek_key_here
# or
OPENAI_API_KEY=your_openai_key_here

# Required for job URL import
EXA_API_KEY=your_exa_key_here

# Optional
PORT=3000
NODE_ENV=development
```

> 🔒 Never commit API keys. Both `.env` files are already gitignored.

### 4. Generate API types and hooks

```bash
pnpm --filter @workspace/api-spec run codegen
```

### 5. Start the servers

In one terminal, run the API server:

```bash
pnpm --filter @workspace/api-server run dev
```

In another terminal, run the frontend:

```bash
cd artifacts/resume-matcher
pnpm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:3000](http://localhost:3000)
- API health check: [http://localhost:3000/api/healthz](http://localhost:3000/api/healthz)

---

## 🧪 Testing

```bash
# Run all tests
pnpm run test

# Watch mode
pnpm run test:watch

# Run a specific workspace's tests
pnpm --filter @workspace/api-server run test
```

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `pnpm run typecheck` | Type-check all packages |
| `pnpm run build` | Type-check + build all packages |
| `pnpm --filter @workspace/api-server run dev` | Run API server in development |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks and Zod schemas |
| `pnpm --filter @workspace/db run push` | Push DB schema changes |

---

## 🗂️ Project Structure

```
.
├── artifacts/
│   ├── resume-matcher/    # React frontend
│   ├── api-server/        # Express API server
│   └── mockup-sandbox/    # UI component sandbox
├── lib/
│   ├── db/                # Database schema & Drizzle config
│   ├── api-spec/          # OpenAPI specification
│   ├── api-zod/           # Generated Zod validation schemas
│   ├── api-client-react/  # Generated React Query hooks
│   └── integrations/      # OpenAI / DeepSeek integrations
├── scripts/               # Build and utility scripts
├── package.json           # Root workspace config
└── pnpm-workspace.yaml    # Workspace definition
```

---

## 🚀 Deployment

### Frontend (GitHub Pages)

The frontend auto-deploys via GitHub Actions:

1. Set **Settings → Pages → Source** to **GitHub Actions**
2. Push to the default branch to trigger the workflow
3. The workflow publishes `artifacts/resume-matcher/dist/public`

Live site: [https://himanshu-nakrani.github.io/Resume-AI-Matcher/](https://himanshu-nakrani.github.io/Resume-AI-Matcher/)

### Backend

The API server can be deployed to any Node.js host. Build with:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See [LICENSE](./LICENSE) for details.

---

<p align="center">
  Built with ❤️ to help job seekers land their next role.
</p>
