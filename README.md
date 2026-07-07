# Smart Stadium — Dynamic Crowd Management Assistant
### FIFA World Cup 2026 · Smart Stadiums & Tournament Operations

## Chosen Vertical
**Dynamic Crowd Management.** This solution helps stadium control-room staff (duty managers, stewards, ops coordinators) monitor real-time crowd density across gates, concourses, and bowl access points, and gives them a GenAI-powered assistant that turns raw density data into clear, actionable guidance.

## Problem
On match day, a control room is flooded with numbers — occupancy percentages, entry/exit rates, sensor feeds — across dozens of zones simultaneously. Recognizing *which* number matters right now, and *what to do about it*, is a judgment call that's easy to make too slowly under pressure. This solution closes that gap: it detects congestion risk automatically and uses GenAI to translate it into a plain-language advisory and a concrete next action, plus a conversational assistant for ad-hoc questions.

## Approach & Logic

The system is deliberately split into two layers with a clear boundary:

1. **Deterministic detection layer** (`detector.js`) — explainable, rule-based thresholds (occupancy %, rate of change) flag zones that need attention. This layer never uses GenAI, so the *risk signal itself* is always auditable and reproducible — a hackathon judge or a real stadium safety officer can verify exactly why a zone was flagged.
2. **GenAI reasoning layer** (`genai.js`) — Claude is used **on top of** the detected signal, not instead of it, for two jobs:
   - Turning a flagged issue into a short, control-room-ready advisory with a concrete recommended action (`generateAlert`).
   - Answering free-form staff questions ("Is Gate 3 safe to keep open?") grounded in the *live* zone data passed as context (`answerQuestion`), so answers are specific to what's actually happening, not generic advice.

This separation matters for real-world usability: you never want a safety-critical detection to depend on an LLM being available or non-hallucinatory. GenAI adds clarity and judgment-support on top of a trustworthy signal, rather than replacing it.

### Data flow
```
CrowdSimulator (synthetic zone data, ticks every 4s)
        │
        ▼
detectIssues() — rule-based thresholds
        │
        ▼
generateAlert() — Claude turns issue → advisory + action   ──┐
                                                              │
answerQuestion() — Claude answers staff Q's using live data ─┤
        │                                                    │
        ▼                                                    ▼
   /api/alerts, /api/assistant  ◄──────────────────  Dashboard (frontend)
```

## How the Solution Works

- **Backend** (`/backend`): Node.js + Express.
  - `simulator.js` generates evolving, synthetic crowd-density data for 8 stadium zones (gates, concourses, bowl access) — a random-walk model with occasional surges, standing in for real turnstile/CCTV/sensor feeds. This keeps the repo small and demo-able without bundling real datasets.
  - `detector.js` applies simple, explainable thresholds to flag zones approaching or exceeding safe capacity, or draining unusually fast (a possible incident signal).
  - `genai.js` calls the Anthropic Messages API to (a) phrase flagged issues as short advisories with a recommended action, and (b) answer free-form control-room questions using the current live snapshot as context.
  - `server.js` exposes `GET /api/status`, `GET /api/alerts`, and `POST /api/assistant`, and serves the frontend as static files.
- **Frontend** (`/frontend`): plain HTML/CSS/JS control-room dashboard — no framework, no build step.
  - Live zone tiles (color-coded by occupancy: safe / warning / critical) polling `/api/status` every 4 seconds.
  - An advisories panel polling `/api/alerts` every 15 seconds (rate-limited/cached server-side to avoid unnecessary API calls).
  - A chat panel where staff can ask the assistant free-form questions about current conditions.

## Running It Locally

```bash
cd backend
cp .env.example .env        # then add your ANTHROPIC_API_KEY
npm install
npm start
```

Open `http://localhost:3000` in a browser. The dashboard will start showing live simulated zone data immediately; the advisories panel and chat assistant require a valid `ANTHROPIC_API_KEY` in `.env`.

## Assumptions Made

- Real stadium sensor/turnstile/CCTV integration is out of scope for this prototype; `simulator.js` generates realistic synthetic data instead, clearly isolated behind one module so it can be swapped for a real data feed without touching the detection or GenAI layers.
- Thresholds in `detector.js` (95% = critical, 80%+with fast rise = warning, rapid outflow = possible-incident info) are illustrative starting points, not validated safety figures — a real deployment would calibrate these with venue safety officers per stadium/event.
- Alerts are cached for 15 seconds server-side to keep API usage efficient during a live demo; this interval would be tuned based on real deployment cost/latency requirements.
- The assistant is advisory only — it recommends actions for a human duty manager to approve and execute, and does not autonomously trigger physical interventions (e.g. gate locks, signage changes). This is an intentional safety-first design choice.

## Tech Stack
- Backend: Node.js, Express, `dotenv`
- GenAI: Anthropic Messages API (Claude)
- Frontend: Vanilla HTML/CSS/JS (no framework, no build step — keeps the repo lightweight and dependency-free)

## Project Structure
```
.
├── backend/
│   ├── server.js       # Express server & API routes
│   ├── simulator.js    # Synthetic crowd-data engine
│   ├── detector.js     # Rule-based congestion detection
│   ├── genai.js         # Claude API integration
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── README.md
```
