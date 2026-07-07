// simulator.js
// Generates synthetic, evolving crowd-density data for stadium zones.
// This stands in for real sensor/turnstile/CCTV feeds so the repo stays
// lightweight and self-contained (no external datasets required).

const ZONES = [
  { id: "gate-1", name: "Gate 1 (North)", capacity: 4000 },
  { id: "gate-2", name: "Gate 2 (East)", capacity: 3500 },
  { id: "gate-3", name: "Gate 3 (South)", capacity: 4200 },
  { id: "gate-4", name: "Gate 4 (West)", capacity: 3000 },
  { id: "concourse-a", name: "Concourse A", capacity: 6000 },
  { id: "concourse-b", name: "Concourse B", capacity: 6000 },
  { id: "section-lower", name: "Lower Bowl Access", capacity: 8000 },
  { id: "section-upper", name: "Upper Bowl Access", capacity: 5000 },
];

class CrowdSimulator {
  constructor() {
    this.state = {};
    const now = Date.now();
    ZONES.forEach((z) => {
      this.state[z.id] = {
        ...z,
        current: Math.round(z.capacity * (0.1 + Math.random() * 0.2)),
        trend: 0, // people/min, positive = filling, negative = draining
        lastUpdated: now,
      };
    });
    this.history = []; // rolling log of snapshots for context
  }

  // Advance the simulation by one tick (called on an interval).
  tick() {
    const now = Date.now();
    ZONES.forEach((z) => {
      const zone = this.state[z.id];
      // Random walk with occasional surges to mimic real match-day behavior
      const surge = Math.random() < 0.05 ? (Math.random() * 400 - 100) : 0;
      const drift = (Math.random() - 0.45) * 120; // slight upward bias pre-match
      zone.trend = Math.round(drift + surge);
      zone.current = Math.max(
        0,
        Math.min(zone.capacity * 1.15, zone.current + zone.trend)
      );
      zone.lastUpdated = now;
    });

    this.history.push({
      timestamp: now,
      snapshot: Object.fromEntries(
        Object.values(this.state).map((z) => [z.id, Math.round(z.current)])
      ),
    });
    if (this.history.length > 60) this.history.shift(); // keep ~last 60 ticks
  }

  getSnapshot() {
    return Object.values(this.state).map((z) => ({
      id: z.id,
      name: z.name,
      capacity: z.capacity,
      current: Math.round(z.current),
      occupancyPct: Math.round((z.current / z.capacity) * 100),
      trend: z.trend,
      lastUpdated: z.lastUpdated,
    }));
  }

  getRecentHistoryFor(zoneId, count = 10) {
    return this.history
      .slice(-count)
      .map((h) => ({ t: h.timestamp, value: h.snapshot[zoneId] }));
  }
}

module.exports = { CrowdSimulator, ZONES };
