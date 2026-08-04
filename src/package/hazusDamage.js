// hazusDamage.js — headless HAZUS flood-damage aggregation.
//
// Given the per-building damage records (from a HAZUS JSON or GPKG export), sum the structure /
// content dollar losses, the affected population by time-of-day & age bracket, and — for GPKG —
// the per-damage-category breakdown. Pure compute: no DOM, no google.maps, no marker rendering.
//
// Extracted from layers/damage.js (a UI controller) so this valuable headless aggregation STAYS in
// the engine when the controller relocates out with the ui/ tier. The controller keeps only the
// marker rendering + info-window HTML; it calls this for the totals it displays.
//
// Two record shapes, selected by `isGpkg`:
//   GPKG  → { lat, lng, structure, content, pop_amu65, pop_amo65, pop_pmu65, pop_pmo65, damage_cat }
//   JSON  → { lat, lng, sd, cd }   (sd/cd = structure/content dollar damage)

export function estimateHazusDamage(buildings, { isGpkg = false } = {}) {
  const list = Array.isArray(buildings) ? buildings : [];

  let totalStructures = 0;
  let totalContent = 0;
  const totalPop = { amu65: 0, amo65: 0, pmu65: 0, pmo65: 0 };
  const catStats = {};

  for (const b of list) {
    if (!b || b.lat == null || b.lng == null) continue;

    if (isGpkg) {
      totalStructures += b.structure || 0;
      totalContent += b.content || 0;
      totalPop.amu65 += b.pop_amu65 || 0;
      totalPop.amo65 += b.pop_amo65 || 0;
      totalPop.pmu65 += b.pop_pmu65 || 0;
      totalPop.pmo65 += b.pop_pmo65 || 0;
      const cat = b.damage_cat || "OTHER";
      if (!catStats[cat]) catStats[cat] = { count: 0, structure: 0, content: 0 };
      catStats[cat].count++;
      catStats[cat].structure += b.structure || 0;
      catStats[cat].content += b.content || 0;
    } else {
      totalStructures += b.sd;
      totalContent += b.cd;
    }
  }

  const totalPopCount = totalPop.amu65 + totalPop.amo65 + totalPop.pmu65 + totalPop.pmo65;
  // buildingCount mirrors the controller: the full record count, not just the plotted (valid) ones.
  return { count: list.length, totalStructures, totalContent, totalPop, totalPopCount, catStats };
}
