// app.js
// Polls the backend for live zone status + AI alerts, renders the dashboard,
// and handles the control-room assistant chat interaction.

const zoneGrid = document.getElementById("zone-grid");
const alertsList = document.getElementById("alerts-list");
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

function statusClassFor(pct) {
  if (pct >= 95) return "status-critical";
  if (pct >= 80) return "status-warn";
  return "status-safe";
}

function renderZones(zones) {
  zoneGrid.innerHTML = zones
    .map((z) => {
      const cls = statusClassFor(z.occupancyPct);
      const trendLabel = z.trend > 0 ? `+${z.trend}/min` : `${z.trend}/min`;
      return `
        <div class="zone-tile ${cls}">
          <div class="name">${z.name}</div>
          <div class="pct">${z.occupancyPct}%</div>
          <div class="counts">${z.current.toLocaleString()} / ${z.capacity.toLocaleString()} · ${trendLabel}</div>
          <div class="beam-track">
            <div class="beam-fill" style="width:${Math.min(100, z.occupancyPct)}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderAlerts(alerts) {
  if (!alerts.length) {
    alertsList.innerHTML = `<p class="empty-state">No active advisories. Monitoring…</p>`;
    return;
  }
  alertsList.innerHTML = alerts
    .map(
      (a) => `
        <div class="alert-card ${a.severity}">
          <span class="zone-tag">${a.zoneName} · ${a.severity}</span>
          ${escapeHtml(a.text).replace(/\n/g, "<br/>")}
        </div>
      `
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function refreshStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    renderZones(data.zones);
  } catch (err) {
    console.error("Failed to fetch status:", err);
  }
}

async function refreshAlerts() {
  try {
    const res = await fetch("/api/alerts");
    const data = await res.json();
    renderAlerts(data.alerts || []);
  } catch (err) {
    console.error("Failed to fetch alerts:", err);
  }
}

function appendChatMessage(text, role) {
  const el = document.createElement("div");
  el.className = `chat-msg ${role}`;
  el.textContent = text;
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;

  appendChatMessage(question, "user");
  chatInput.value = "";
  chatInput.disabled = true;

  appendChatMessage("Thinking…", "assistant");
  const thinkingEl = chatLog.lastElementChild;

  try {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    thinkingEl.textContent = data.answer || data.error || "No response received.";
  } catch (err) {
    thinkingEl.textContent = "Something went wrong reaching the assistant.";
    console.error(err);
  } finally {
    chatInput.disabled = false;
    chatInput.focus();
  }
});

// Initial load + polling loop
refreshStatus();
refreshAlerts();
setInterval(refreshStatus, 4000);
setInterval(refreshAlerts, 15000);
