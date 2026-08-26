// USED BY FIMAPP. Not part of the public API for now.
//
// hazusDamage.js — headless HAZUS flood-damage aggregation.
//
// Sums per-building damage records from a HAZUS JSON or GPKG export: structure and content dollar
// losses, affected population by time of day and age bracket, and for GPKG a per-category
// breakdown. Pure compute, with no DOM and no google.maps.
//
// Lives here rather than in layers/damage.js so the aggregation stays in the engine when that UI
// controller moves out into ui/. The controller draws the markers and calls this for the
// totals it displays.
//
// Two record layouts, selected by `isGpkg`:
//   GPKG  → { lat, lng, structure, content, pop_amu65, pop_amo65, pop_pmu65, pop_pmo65, damage_cat }
//   JSON  → { lat, lng, sd, cd }   (sd/cd = structure/content dollar damage)

/**
 * @typedef {Object} HazusPopulation
 * @property {number} amu65 - daytime population under 65
 * @property {number} amo65 - daytime population 65 and over
 * @property {number} pmu65 - nighttime population under 65
 * @property {number} pmo65 - nighttime population 65 and over
 */

/**
 * @typedef {Object} HazusCategoryTotals
 * @property {number} count - buildings in this damage category
 * @property {number} structure - structure dollar loss
 * @property {number} content - content dollar loss
 */

/**
 * Sums per-building HAZUS damage records into totals.
 *
 * A record missing `lat` or `lng` contributes nothing but still counts toward `count`, matching what
 * layers/damage.js reports. Population and `catStats` come from GPKG records only; a JSON record
 * carries just the two dollar figures, so both stay at their zero and empty defaults.
 *
 * @param {Array<Object>} buildings - damage records. A non-array is read as empty.
 * @param {Object} [opts]
 * @param {boolean} [opts.isGpkg] - true reads the GPKG layout, false the JSON layout (see the
 *   header for both). Defaults to false.
 * @returns {{count: number, totalStructures: number, totalContent: number,
 *   totalPop: HazusPopulation, totalPopCount: number,
 *   catStats: Object<string, HazusCategoryTotals>}} `count` is every record, plotted or not.
 *   `totalPopCount` is the four `totalPop` brackets added together. `catStats` is keyed by
 *   `damage_cat`, with records that declare none collected under "OTHER".
 */
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
  // `count` matches the controller: every record, not only the valid ones that get plotted.
  return { count: list.length, totalStructures, totalContent, totalPop, totalPopCount, catStats };
}
