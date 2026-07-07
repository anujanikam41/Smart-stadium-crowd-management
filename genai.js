// genai.js
// Thin wrapper around the Anthropic Messages API.
// Two jobs:
//   1. Turn a detected rule-based issue into a clear, actionable alert.
//   2. Answer free-form control-room questions using live zone data as context.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

async function callClaude(systemPrompt, userPrompt, maxTokens = 400) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your .env file (see .env.example)."
    );
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((c) => c.type === "text");
  return textBlock ? textBlock.text : "";
}

// --- 1. Alert generation ---------------------------------------------------

const ALERT_SYSTEM_PROMPT = `You are a crowd-safety advisory assistant embedded in a stadium control-room dashboard during a FIFA World Cup 2026 match.
You will be given a single detected crowd-density issue as structured data.
Respond with a short, control-room-ready advisory in this exact format:

ALERT: <one sentence, plain language, no jargon>
ACTION: <one concrete, specific recommended action a duty manager could execute in the next 2 minutes>
RISK: <low|medium|high>

Keep it under 60 words total. Do not add commentary outside this format.`;

async function generateAlert(issue) {
  const userPrompt = `Zone: ${issue.zoneName}
Severity flag: ${issue.severity}
Reason: ${issue.reason}
Occupancy: ${issue.metric.occupancyPct}% of capacity (${issue.metric.current}/${issue.metric.capacity})
Trend: ${issue.metric.trend > 0 ? "+" : ""}${issue.metric.trend} people/min`;

  return callClaude(ALERT_SYSTEM_PROMPT, userPrompt, 150);
}

// --- 2. Conversational assistant -------------------------------------------

const ASSISTANT_SYSTEM_PROMPT = `You are the on-duty AI assistant for a FIFA World Cup 2026 stadium control room.
You help operators, volunteers, and duty managers make fast, safe decisions about crowd flow.
You will be given the current live status of every zone in the stadium, followed by a question from a staff member.
Answer concisely (max 4 sentences), reference specific zones and numbers when relevant, and prioritize actionable guidance over generic advice.
If the data shows no real concern, say so plainly and reassure rather than inventing risk.`;

async function answerQuestion(question, zones) {
  const context = zones
    .map(
      (z) =>
        `- ${z.name}: ${z.occupancyPct}% full (${z.current}/${z.capacity}), trend ${
          z.trend > 0 ? "+" : ""
        }${z.trend}/min`
    )
    .join("\n");

  const userPrompt = `Current stadium status:\n${context}\n\nStaff question: ${question}`;

  return callClaude(ASSISTANT_SYSTEM_PROMPT, userPrompt, 300);
}

module.exports = { generateAlert, answerQuestion };
