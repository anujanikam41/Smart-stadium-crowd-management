// detector.js
// Lightweight rule engine that flags zones needing attention.
// Kept deterministic and explainable on purpose: GenAI should explain and
// recommend action on TOP of these signals, not invent the risk signal itself.

function detectIssues(zones) {
  const issues = [];

  zones.forEach((z) => {
    if (z.occupancyPct >= 95) {
      issues.push({
        zoneId: z.id,
        zoneName: z.name,
        severity: "critical",
        reason: `Occupancy at ${z.occupancyPct}% of capacity`,
        metric: z,
      });
    } else if (z.occupancyPct >= 80 && z.trend > 50) {
      issues.push({
        zoneId: z.id,
        zoneName: z.name,
        severity: "warning",
        reason: `Occupancy at ${z.occupancyPct}% and rising fast (+${z.trend}/min)`,
        metric: z,
      });
    } else if (z.trend < -150) {
      issues.push({
        zoneId: z.id,
        zoneName: z.name,
        severity: "info",
        reason: `Rapid outflow detected (${z.trend}/min) — possible incident or mass exit`,
        metric: z,
      });
    }
  });

  return issues;
}

module.exports = { detectIssues };
