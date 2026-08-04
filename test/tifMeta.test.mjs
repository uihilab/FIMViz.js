// geo/tifMeta.js — raster metadata as data.
//
// describeTif is newly pure (it used to be welded to `window.layerPanel` and the app's floating
// #tif-metadata-panel), which is exactly what makes it testable here at all: no jsdom, no google
// .maps, no panel. showTifMetadata now emits and the host renders.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createEmitter, setHostSink } from "../src/package/events.js";
import { describeTif, showTifMetadata, hideTifMetadata } from "../src/geo/tifMeta.js";

// Minimal stand-in for a geotiff.js image — only the surface tifMeta actually reads.
function fakeImage({
  width = 256, height = 128,
  bbox = [-91.6, 41.6, -91.4, 41.8],
  fileDirectory = {},
} = {}) {
  return {
    getWidth: () => width,
    getHeight: () => height,
    getBoundingBox: () => bbox,
    fileDirectory,
  };
}

const rowMap = (rows) => Object.fromEntries(rows);

describe("describeTif (pure)", () => {
  test("reports dimensions, CRS and bounds", () => {
    const m = rowMap(describeTif(fakeImage()));
    assert.equal(m["Dimensions"], "256 × 128 px");
    assert.equal(m["CRS"], "EPSG:4326 (WGS84)");
    assert.equal(m["West / East"], "-91.6000° / -91.4000°");
    assert.equal(m["South / North"], "41.6000° / 41.8000°");
  });

  test("decodes sample format + bit depth into a data type", () => {
    const float32 = rowMap(describeTif(fakeImage({
      fileDirectory: { BitsPerSample: [32], SampleFormat: [3] },
    })));
    assert.equal(float32["Data type"], "Float32");

    const uint8 = rowMap(describeTif(fakeImage({
      fileDirectory: { BitsPerSample: 8, SampleFormat: 1 },   // scalar, not array
    })));
    assert.equal(uint8["Data type"], "UInt8");
  });

  test("missing bit depth degrades to an em dash rather than throwing", () => {
    const m = rowMap(describeTif(fakeImage()));
    assert.equal(m["Data type"], "—");
    assert.equal(m["No-data"], "—");
  });

  test("GDAL_NODATA is normalized through parseFloat", () => {
    const m = rowMap(describeTif(fakeImage({ fileDirectory: { GDAL_NODATA: "-9999.0" } })));
    assert.equal(m["No-data"], "-9999");
  });

  test("unit is included only when supplied; extraRows append", () => {
    const without = rowMap(describeTif(fakeImage()));
    assert.equal("Unit" in without, false);

    const with_ = rowMap(describeTif(fakeImage(), {
      unit: "m",
      extraRows: [["Max speed", "1.250 m/s"]],
    }));
    assert.equal(with_["Unit"], "m");
    assert.equal(with_["Max speed"], "1.250 m/s");
  });
});

describe("showTifMetadata → host event", () => {
  let seen;
  beforeEach(() => {
    seen = [];
    const em = createEmitter();
    em.on("raster:metadata", (p) => seen.push(["raster:metadata", p]));
    em.on("raster:metadata-hidden", (p) => seen.push(["raster:metadata-hidden", p]));
    setHostSink(em);
  });
  afterEach(() => setHostSink(null));

  test("emits both row shapes so a host renders either without recomputing", () => {
    showTifMetadata("Brazos_RP100_depth.tif", fakeImage(), { unit: "m" });
    assert.equal(seen.length, 1);
    const [, p] = seen[0];

    assert.equal(p.title, "Brazos_RP100_depth.tif");
    assert.equal(p.name, "Brazos_RP100_depth", "extension is stripped for display");
    assert.ok(Array.isArray(p.rows[0]), "rows is the flat [label, value] form");
    assert.deepEqual(p.specRows[0], { k: "File", v: "Brazos_RP100_depth" });
    assert.deepEqual(p.specRows[1], { k: "Type", v: "GeoTIFF" });
    assert.equal(p.specRows[2].num, true, "numeric fields are marked for metric rendering");
    assert.equal(p.rows.length + 2, p.specRows.length);
  });

  test("showSupp defaults false and passes through", () => {
    showTifMetadata("a.tif", fakeImage());
    assert.equal(seen[0][1].showSupp, false);
    showTifMetadata("b.tif", fakeImage(), { showSupp: true });
    assert.equal(seen[1][1].showSupp, true);
  });

  test("hideTifMetadata signals the host", () => {
    hideTifMetadata();
    assert.equal(seen[0][0], "raster:metadata-hidden");
  });

  test("with no host attached, both are silent no-ops", () => {
    setHostSink(null);
    assert.doesNotThrow(() => {
      showTifMetadata("a.tif", fakeImage());
      hideTifMetadata();
    });
  });
});
