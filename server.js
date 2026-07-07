// server.js
// Lightweight Express server: serves the dashboard frontend and exposes
// three endpoints the frontend polls / calls:
//   GET  /api/status    -> live zone snapshot
//   GET  /api/alerts     -> GenAI-generated advisories for currently flagged zones
//   POST /api/assistant  -> free-form Q&A grounded in live zone data

require("dotenv").config();
const express = require("express");
const path = require("path");

const { CrowdSimulator } = require("./simulator");
const { detectIssues } = require("./detector");
const { generateAlert, answerQuestion } = require("./genai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

const simulator = new CrowdSimulator();

// Advance the simulation every 4 seconds.
setInterval(() => simulator.tick(), 4000);

// Cache alerts briefly so we don't hit the Claude API on every poll.
let alertCache = { generatedAt: 0, alerts: [] };
const ALERT_CACHE_MS = 15000;

app.get("/api/status", (req, res) => {
  res.json({ zones: simulator.getSnapshot(), serverTime: Date.now() });
});

app.get("/api/alerts", async (req, res) => {
  try {
    const zones = simulator.getSnapshot();
    const issues = detectIssues(zones);

    const now = Date.now();
    if (now - alertCache.generatedAt < ALERT_CACHE_MS && issues.length > 0) {
      return res.json({ alerts: alertCache.alerts });
    }

    if (issues.length === 0) {
      alertCache = { generatedAt: now, alerts: [] };
      return res.json({ alerts: [] });
    }

    const alerts = await Promise.all(
      issues.map(async (issue) => {
        const text = await generateAlert(issue);
        return { zoneId: issue.zoneId, zoneName: issue.zoneName, severity: issue.severity, text };
      })
    );

    alertCache = { generatedAt: now, alerts };
    res.json({ alerts });
  } catch (err) {
    console.error("Error generating alerts:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/assistant", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "A 'question' string is required." });
    }
    const zones = simulator.getSnapshot();
    const answer = await answerQuestion(question, zones);
    res.json({ answer });
  } catch (err) {
    console.error("Error answering question:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Smart Stadium crowd-management server running on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("WARNING: ANTHROPIC_API_KEY not set — GenAI endpoints will fail until it is configured in .env");
  }
});
