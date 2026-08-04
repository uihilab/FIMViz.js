// rasterImage — the pure raster colorize (package/rasterImage.js). The canvas encode (rgbaToDataURL/
// gridToDataURL) is browser-only and verified in examples/dataset-layer.html; colorizeGrid is pure.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { colorizeGrid } from "../src/package/rasterImage.js";
import { RasterGrid } from "../src/package/materialize.js";
import { ColorScale } from "../src/package/colorScale.js";

const grid = (pixels, extra = {}) => new RasterGrid({
  pixels: Float32Array.from(pixels), width: 2, height: 2,
  bounds: { north: 1, south: 0, east: 1, west: 0 }, ...extra,
});
const px = (rgba, i) => [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], rgba[i * 4 + 3]];

describe("colorizeGrid", () => {
  const scale = new ColorScale({ palette: "blues" }).setStops([
    { value: 1, color: "#ff0000" }, { value: 2, color: "#00ff00" },
  ]);

  test("maps each value through the ColorScale, opaque by default", () => {
    const rgba = colorizeGrid(grid([1, 2, 1, 2]), { colorScale: scale });
    assert.deepEqual(px(rgba, 0), [255, 0, 0, 255]);
    assert.deepEqual(px(rgba, 1), [0, 255, 0, 255]);
  });

  test("noData, NaN and unmapped values become transparent", () => {
    const rgba = colorizeGrid(grid([1, NaN, 2, 9], { noData: 9 }), { colorScale: scale });
    assert.deepEqual(px(rgba, 0), [255, 0, 0, 255], "1 → red");
    assert.equal(px(rgba, 1)[3], 0, "NaN → transparent");
    assert.deepEqual(px(rgba, 2), [0, 255, 0, 255], "2 → green");
    assert.equal(px(rgba, 3)[3], 0, "noData(9) → transparent");
  });

  test("skipZero makes 0 transparent; alpha overrides opacity", () => {
    const rgba = colorizeGrid(grid([1, 0, 2, 1]), { colorScale: scale, skipZero: true, alpha: 128 });
    assert.equal(px(rgba, 0)[3], 128, "alpha applied");
    assert.equal(px(rgba, 1)[3], 0, "0 skipped");
  });

  test("with no ColorScale, a default continuous ramp colours valid pixels (noData stays transparent)", () => {
    const rgba = colorizeGrid(grid([0, 5, 10, -99], { noData: -99 }));
    assert.ok(px(rgba, 0)[3] === 255 && px(rgba, 1)[3] === 255, "valid pixels opaque");
    assert.equal(px(rgba, 3)[3], 0, "noData transparent");
    // a low vs high value differ under the ramp
    assert.notDeepEqual(px(rgba, 0).slice(0, 3), px(rgba, 2).slice(0, 3));
  });

  test("output length is width*height*4", () => {
    assert.equal(colorizeGrid(grid([1, 2, 1, 2]), { colorScale: scale }).length, 2 * 2 * 4);
  });
});
