# Resume Customizer Pro

<div align="center">
  <img src="https://img.shields.io/badge/React-18.3.1-blue?logo=react" alt="React 18.3.1" />
  <img src="https://img.shields.io/badge/TypeScript-5.6.3-blue?logo=typescript" alt="TypeScript 5.6.3" />
  <img src="https://img.shields.io/badge/Node.js-Express-green?logo=nodedotjs" alt="Node.js Express" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-blue?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/UI-TailwindCSS-blue?logo=tailwindcss" alt="Tailwind CSS" />
</div>

## 🚀 What this project is

Resume Customizer Pro is a full‑stack, AI‑assisted resume editor focused on real DOCX compatibility. Users can upload DOCX resumes, extract editable HTML while preserving formatting, use an MS Word‑like rich editor to customize content, and export genuine DOCX files that open in Microsoft Word.

This repository contains:

- A React + TypeScript frontend (client/)
- An Express + TypeScript backend (server/) with a DOCX processing pipeline
- Shared types/schemas (shared/)

### Notable implemented features

- DOCX upload and parsing (server/docx-processor.ts — uses Mammoth + docx)
- HTML-based rich editor with MS Word-like toolbar (client/src/components/advanced-resume-editor.tsx)
- AI-assisted tech-stack and bullet-point grouping
- Export API that generates genuine .docx files (POST /api/resumes/:id/export-docx)
- Multi-resume management and bulk export

For in-depth design and implementation notes see `MS_WORD_INTEGRATION.md`.

## 🏗️ Tech stack

Frontend

- React + TypeScript (Vite)
- Tailwind CSS + Radix UI
- TanStack Query, Sonner (toasts), Lucide icons

Backend

- Node.js + Express + TypeScript
- Drizzle ORM with PostgreSQL
- File uploads with Multer
- DOCX processing: Mammoth (parsing) + docx (generation)

## 🛠️ Quick start (development)

Prerequisites

- Node.js 18+
- PostgreSQL running locally (or a connection string)
- Git

1. Clone and install

```powershell
git clone https://github.com/12shivam219/Resume_Customizer_Pro.git
cd Resume_Customizer_Pro
npm install
```

2. Create a `.env` in the repository root. Minimum variables used by the project:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/resume_customizer

# App
NODE_ENV=development
PORT=5000

# Sessions / Auth
SESSION_SECRET=your-super-secret-key-here

# Optional third-party integrations
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

3. Prepare database (Drizzle)

```powershell
npm run db:generate
npm run db:push
```

4. Start the app

```powershell
# Start both client and server (if configured in package.json)
npm run dev

# Or run separately in two terminals:
# Terminal 1 (server): npm run dev
# Terminal 2 (client): npm run dev:client
```

Open http://localhost:5000 (or the port you configured).

## Running and building for production

```powershell
npm run build
npm run start
```

Notes

- The server exposes REST endpoints under `/api/*`. The DOCX export endpoint is `POST /api/resumes/:id/export-docx` and returns a proper DOCX MIME response.

## Environment variables (summary)

- DATABASE_URL — Postgres connection string used by Drizzle
- NODE_ENV — development | production
- PORT — server port
- SESSION_SECRET — secret for session cookies
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — optional Google Drive integration

## Project layout

```
Resume_Customizer_Pro/
├── client/                 # React frontend (Vite)
├── server/                 # Express backend, routes, and DOCX processor
├── shared/                 # Shared types and Zod schemas
├── migrations/             # Drizzle migrations
├── MS_WORD_INTEGRATION.md  # Design notes and implementation details for DOCX support
├── PROJECT_STRUCTURE_SUGGESTIONS.md
├── package.json
└── readme.md
```

## Tests, types and linting

- Type checking: `npm run check`
- Add unit/integration tests for critical pieces (recommended)

## Contributing

Contributions are welcome. A small recommended workflow:

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Implement and add tests
4. Run `npm run check`
5. Commit and push, then open a Pull Request

Please follow the patterns already used in the project and keep changes focused and well-tested.

## Troubleshooting & notes

- If DOCX parsing fails for a specific document, the server falls back to storing the original file as base64 and marking the resume as "uploaded". See `server/routes.ts` for details.
- For heavy DOCX processing, consider increasing Node's memory limit or processing larger files in a background job.

## License

MIT — see the `LICENSE` file.

## Acknowledgments

- Mammoth.js and docx for DOCX handling
- React, Vite, Tailwind CSS, Radix UI

---

Made with ❤️ by developers, for developers — star the repo if it's helpful!
