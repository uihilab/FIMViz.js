import { fromArrayBuffer } from "geotiff";
import { getTifWgs84Bounds } from "../geo/tifBounds.js";
import { showTifMetadata, hideTifMetadata } from "../geo/tifMeta.js";
import { Layer, registerLayerType } from "../package/layer.js";
import { FimMap, fimForMap } from "../package/fimMap.js";

// Engine → UI events go on this instance's bus; ui/velocityTools.js subscribes. velocity names no
// UI (extraction blocker #1). Transitional single-instance reach to the mounted map.
// The FimMap this layer last rendered onto — bound from the provider map renderVelocityLayer
// receives, not from the default app's first map.
// Callers hold either a FimMap or a raw provider map, depending on which tier they sit in.
// `instanceof` and not a duck-type: Leaflet's L.Map has its OWN addLayer/removeLayer, so a shape
// check for those silently accepts a raw Leaflet map as if it were a FimMap — after which
// `fim.app.config.provider` is undefined, the provider defaults to google, and Google's
// GroundOverlay.setMap() is handed an L.Map. The error surfaces deep in the Maps SDK.
const _resolveFim = (v) => (!v ? null : (v instanceof FimMap ? v : fimForMap(v)));
// import { waterAnim } from "../vendor/water-canvas.min.js";

const NODATA = -99999;
// [0] velocityScaleFactor, [1] fadeAlpha (destination-in canvas fade, applied every frame),
// [2] velocityScale (overridden per dataset), [3] maxAge, [4] lineWidth,
// [5] particleDensity, [6] mobileMult, [7] fps,
// [8] deathAgeFadeAlpha (null/'' = no death phase; 0–1 = draw opacity for dying particles),
// [9] maxAgeFadeAlpha (draw opacity for live particles 0→maxAge),
// [10] deathAge (absolute age at which particle recycles; null = recycle at maxAge)
let VELOCITY_CONSTS = [0.000048, 0.960, 4.0, 150, 1.2, 0.006, 0.75, 30, 0, 1, null];
// 4-grade light→dark blue; index 2 (velocityScale) is replaced dynamically per dataset
const VELOCITY_COLOR = ["#7EC8E3", "#4AA3E0", "#1A5FA8", "#2255B8"];

// The velocity render/animation state lives on a VelocityLayer instance.
//
// ONE INSTANCE PER FimMap. The animation state (canvas layer, rAF loop, map listeners) is genuinely
// per-widget: a module-level singleton would let a second widget stop the first's animation and
// repaint into its canvas. The animation timer lives inside createWaterAnim, not on the layer.
class VelocityLayer extends Layer {
  constructor(opts = {}) {
    super({ ...opts, type: "velocity" });
    this.anim = null;          // createWaterAnim handle
    this.canvasLayer = null;   // the CanvasLayer OverlayView
    this.loadSeq = 0;          // monotonic counter — drops stale async toggles
    this.mapListeners = [];    // google.maps listeners for drag/zoom/idle
  }

  /** Stop the animation, detach the canvas overlay, and remove map listeners. */
  stop() {
    if (this.anim) { this.anim.stop(); this.anim = null; }
    if (this.canvasLayer) { this.canvasLayer.setMap(null); this.canvasLayer = null; }
    // eslint-disable-next-line no-undef
    this.mapListeners.forEach((l) => google.maps.event.removeListener(l));
    this.mapListeners = [];
  }
}

const _layers = new Map();   // FimMap -> VelocityLayer

function _layerFor(fim) {
  if (!fim) return null;
  let layer = _layers.get(fim);
  if (!layer) { layer = new VelocityLayer({ map: fim }); _layers.set(fim, layer); }
  return layer;
}

/** This map's velocity layer, created on first use. @param {*} fimOrMap @returns {VelocityLayer|null} */
export function velocityLayerFor(fimOrMap) { return _layerFor(_resolveFim(fimOrMap)); }

// ─── Inline WaterAnim ──────────────────────────────────────────────────────
// CanvasLayer uses google.maps.OverlayView at prototype-assignment time, so
// it cannot live at module scope. We wrap everything in a factory that runs
// only after Maps is ready.

function createCanvasLayer(options) {
  // eslint-disable-next-line no-undef
  class CanvasLayerImpl extends google.maps.OverlayView {
    constructor(opts) {
      super();
      this.isAnimated_ = false;
      this.paneName_ = "overlayLayer";
      this.updateHandler_ = null;
      this.resizeHandler_ = null;
      this.topLeft_ = null;
      this.needsResize_ = true;
      this.rafId_ = null;

      const canvas = document.createElement("canvas");
      canvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;";
      this.canvas = canvas;

      if (opts) this._applyOptions(opts);
    }

    _applyOptions(opts) {
      if (opts.animate != null) this.setAnimate(opts.animate);
      if (opts.updateHandler) this.updateHandler_ = opts.updateHandler;
      if (opts.resizeHandler) this.resizeHandler_ = opts.resizeHandler;
      if (opts.map) this.setMap(opts.map);
    }

    setAnimate(v) {
      this.isAnimated_ = !!v;
      if (this.isAnimated_) this._scheduleUpdate();
    }

    onAdd() {
      this.getPanes().overlayLayer.appendChild(this.canvas);
      // eslint-disable-next-line no-undef
      this._resizeListener = google.maps.event.addListener(this.getMap(), "resize", () => this._resize());
      // eslint-disable-next-line no-undef
      this._centerListener = google.maps.event.addListener(this.getMap(), "center_changed", () => this._reposition());
      this._resize();
      this._reposition();
    }

    onRemove() {
      if (this.canvas.parentElement) this.canvas.parentElement.removeChild(this.canvas);
      // eslint-disable-next-line no-undef
      if (this._resizeListener) google.maps.event.removeListener(this._resizeListener);
      // eslint-disable-next-line no-undef
      if (this._centerListener) google.maps.event.removeListener(this._centerListener);
      if (this.rafId_) cancelAnimationFrame(this.rafId_);
    }

    draw() { this._reposition(); }

    _resize() {
      const div = this.getMap().getDiv();
      const w = div.offsetWidth, h = div.offsetHeight;
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.canvas.style.width = w + "px";
        this.canvas.style.height = h + "px";
        this.needsResize_ = true;
        this._scheduleUpdate();
      }
    }

    _reposition() {
      const bounds = this.getMap().getBounds();
      // eslint-disable-next-line no-undef
      this.topLeft_ = new google.maps.LatLng(bounds.getNorthEast().lat(), bounds.getSouthWest().lng());
      const px = this.getProjection().fromLatLngToDivPixel(this.topLeft_);
      this.canvas.style.transform = `translate(${Math.round(px.x)}px,${Math.round(px.y)}px)`;
      this._scheduleUpdate();
    }

    _scheduleUpdate() {
      if (!this.rafId_) {
        this.rafId_ = requestAnimationFrame(() => {
          this.rafId_ = null;
          if (this.needsResize_ && this.resizeHandler_) {
            this.needsResize_ = false;
            this.resizeHandler_();
          }
          if (this.updateHandler_) this.updateHandler_();
        });
      }
    }
  }

  return new CanvasLayerImpl(options);
}

// Inlined WaterAnim — extracted from water-canvas.min.js, unminified
function createWaterAnim(params) {
  const e = params.constants;
  const colorStops = params.color;
  const lineWidth = e[4];
  const maxAge = e[3];
  const particleDensity = e[5];
  const mobileMult = e[6];
  const fps = e[7];
  const velocityScale = e[2];
  const SENTINEL = [NaN, NaN, null];

  const fadeAlpha = e[1];
  const deathAgeFadeAlpha = (e[8] == null || e[8] === '') ? null : e[8];
  const maxAgeFadeAlpha = e[9] != null ? e[9] : 1;
  const deathAge = e[10] != null ? e[10] : null;
  const velocityScaleFactor = e[0]; // geographic→pixel scale factor (b[0] in original)

  const toRad = t => t / 180 * Math.PI;
  const toDeg = t => t / (Math.PI / 180);
  const mercY = t => Math.log(Math.tan(t / 2 + Math.PI / 4));

  // Equivalent to G() in water-canvas.min.js.
  // Converts (lat_deg, lon_deg) to screen pixel [px, py] via Mercator.
  function latLonToPixel(lat_deg, lon_deg, vp) {
    const ms = mercY(vp.south), mn = mercY(vp.north);
    const pxPerRadLon = vp.width / (vp.east - vp.west);
    const pyPerMercY  = vp.height / (mn - ms);
    return [
      (toRad(lon_deg) - vp.west) * pxPerRadLon,
      (mn - mercY(toRad(lat_deg))) * pyPerMercY,
    ];
  }

  // Equivalent to z() in water-canvas.min.js.
  // Returns the 2×2 Jacobian [∂px/∂lon/cos(lat), ∂py/∂lon/cos(lat), ∂px/∂lat, ∂py/∂lat].
  function jacobian(lon_deg, lat_deg, px, py, vp) {
    const eps  = Math.pow(10, -5.2);
    const dLon = lon_deg >= 0 ? -eps : eps;
    const dLat = lat_deg >= 0 ? -eps : eps;
    const kLon = latLonToPixel(lat_deg, lon_deg + dLon, vp);
    const kLat = latLonToPixel(lat_deg + dLat, lon_deg, vp);
    const cosLat = Math.cos(lat_deg / 360 * 2 * Math.PI);
    return [
      (kLon[0] - px) / dLon / cosLat,
      (kLon[1] - py) / dLon / cosLat,
      (kLat[0] - px) / dLat,
      (kLat[1] - py) / dLat,
    ];
  }

  // Equivalent to y() in water-canvas.min.js.
  // Transforms vec[0]/vec[1] in-place from geographic m/s to screen pixel deltas.
  // vec[2] (raw speed) is left unchanged for color indexing.
  function transformVec(lon_deg, lat_deg, px, py, vec, vp) {
    const su = vec[0] * velocityScaleFactor;
    const sv = vec[1] * velocityScaleFactor;
    const J  = jacobian(lon_deg, lat_deg, px, py, vp);
    vec[0] = J[0] * su + J[2] * sv;
    vec[1] = J[1] * su + J[3] * sv;
    return vec;
  }

  function bilinear(rx, ry, v00, v10, v01, v11) {
    const ox = 1 - rx, oy = 1 - ry;
    return [
      v00[0] * ox * oy + v10[0] * rx * oy + v01[0] * ox * ry + v11[0] * rx * ry,
      v00[1] * ox * oy + v10[1] * rx * oy + v01[1] * ox * ry + v11[1] * rx * ry,
    ];
  }

  function buildGrid(data, imagedata) {
    let uBand = null, vBand = null;
    data.forEach(band => {
      const key = band.header.parameterCategory + "," + band.header.parameterNumber;
      if (key === "2,2") uBand = band;
      if (key === "2,3") vBand = band;
    });

    const useImagedata = imagedata[0].length > 0;
    const uArr = useImagedata ? imagedata[0] : uBand.data;
    const vArr = useImagedata ? imagedata[1] : vBand.data;
    const header = uBand.header;

    return {
      header,
      interpolate: bilinear,
      data: idx => [uArr[idx], vArr[idx]],
    };
  }

  function toMercPixel(lon, lat, viewport) {
    const east = viewport.east - viewport.west;
    const px = (lon - toDeg(viewport.west)) / toDeg(east) * viewport.width;
    const my = mercY(viewport.south);
    const mn = mercY(viewport.north);
    const py = (mn - mercY(toRad(lat))) / (mn - my) * viewport.height;
    return [px, py];
  }

  function fromMercPixel(px, py, viewport) {
    const east = toDeg(viewport.east - viewport.west);
    const lon = toDeg(viewport.west) + px / viewport.width * east;
    const mn = mercY(viewport.north);
    const my = mercY(viewport.south);
    const lat = toDeg(2 * Math.atan(Math.exp(mn - (mn - my) * py / viewport.height)) - Math.PI / 2);
    return [lon, lat];
  }

  function buildField(grid, viewport, canvas, callback) {
    const h = grid.header;
    const lo1 = h.lo1, la1 = h.la1, dx = h.dx, dy = h.dy, nx = h.nx, ny = h.ny;

    // Unpack grid rows (west→east, north→south)
    const rows = [];
    for (let row = 0, idx = 0; row < ny; row++) {
      const r = [];
      for (let col = 0; col < nx; col++, idx++) r[col] = grid.data(idx);
      rows[row] = r;
    }

    const lookup = [];
    function buildColumn(x) {
      const col = [];
      for (let y = canvas.y; y <= canvas.yMax; y += 2) {
        const [lon, lat] = fromMercPixel(x, y, viewport);
        if (!isFinite(lon)) continue;
        const ci = (lon - lo1) / dx;
        const ri = (la1 - lat) / dy;
        const c0 = Math.floor(ci), c1 = c0 + 1;
        const r0 = Math.floor(ri), r1 = r0 + 1;
        if (rows[r0] && rows[r1]) {
          const v00 = rows[r0][c0], v10 = rows[r0][c1];
          const v01 = rows[r1][c0], v11 = rows[r1][c1];
          if (v00 && v10 && v01 && v11) {
            const [u, v] = bilinear(ci - c0, ri - r0, v00, v10, v01, v11);
            const spd = Math.sqrt(u * u + v * v);
            col[y + 1] = col[y] = transformVec(lon, lat, x, y, [u, v, spd], viewport);
          }
        }
      }
      lookup[x + 1] = lookup[x] = col;
    }

    let x = canvas.x;
    (function fill() {
      const t0 = Date.now();
      while (x < canvas.width) {
        buildColumn(x);
        x += 2;
        if (Date.now() - t0 > 1000) { setTimeout(fill, 25); return; }
      }
      function pick(px, py) {
        const col = lookup[Math.round(px)];
        return (col && col[Math.round(py)]) || SENTINEL;
      }
      pick.release = () => { lookup.length = 0; };
      pick.randomize = t => {
        let tries = 0, px, py;
        do {
          px = Math.round(Math.random() * canvas.width + canvas.x);
          py = Math.round(Math.random() * canvas.height + canvas.y);
        } while (pick(px, py)[2] === null && tries++ < 30);
        t.x = px; t.y = py;
        return t;
      };
      callback(canvas, pick);
    })();
  }

  function animate(canvas, field, ctx) {
    const colorIndex = colorStops.map(() => []);
    const dyingEnabled = deathAge != null && deathAgeFadeAlpha != null;
    const dyingIndex = dyingEnabled ? colorStops.map(() => []) : null;
    const effectiveDeathAge = dyingEnabled ? maxAge + deathAge : maxAge;
    colorStops.indexFor = spd => Math.floor(Math.min(spd, velocityScale) / velocityScale * (colorStops.length - 1));
    let count = Math.round(canvas.width * canvas.height * particleDensity);
    if (/android|blackberry|iemobile|ipad|iphone|ipod|opera mini|webos/i.test(navigator.userAgent)) count *= mobileMult;

    const particles = [];
    for (let i = 0; i < count; i++) particles.push(field.randomize({ age: Math.floor(Math.random() * maxAge) }));

    ctx.lineWidth = lineWidth;
    ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;

    let timer;
    (function draw() {
      try {
        timer = setTimeout(() => {
          requestAnimationFrame(draw);
          colorStops.forEach((_, i) => {
            colorIndex[i].length = 0;
            if (dyingIndex) dyingIndex[i].length = 0;
          });
          particles.forEach(p => {
            if (dyingEnabled && p.age === maxAge) { field.randomize(p); }
            if (p.age > effectiveDeathAge) { if (!dyingEnabled) field.randomize(p); p.age = 0; }
            const [u, v, spd] = field(p.x, p.y);
            if (spd === null) { field.randomize(p).age = 0; return; }
            const nx = p.x + u, ny = p.y + v;
            if (field(nx, ny)[2] !== null) {
              p.xt = nx; p.yt = ny;
              (dyingIndex && p.age >= maxAge ? dyingIndex : colorIndex)[colorStops.indexFor(spd)].push(p);
            } else {
              p.x = nx; p.y = ny;
            }
            p.age++;
          });
          ctx.globalCompositeOperation = "destination-in";
          ctx.globalAlpha = 1.0;
          ctx.fillRect(canvas.x, canvas.y, canvas.width, canvas.height);
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = maxAgeFadeAlpha;
          colorStops.forEach((color, i) => {
            const group = colorIndex[i];
            if (!group.length) return;
            ctx.beginPath();
            ctx.strokeStyle = color;
            group.forEach(p => { ctx.moveTo(p.x, p.y); ctx.lineTo(p.xt, p.yt); p.x = p.xt; p.y = p.yt; });
            ctx.stroke();
          });
          if (dyingIndex) {
            ctx.globalAlpha = deathAgeFadeAlpha;
            colorStops.forEach((color, i) => {
              const group = dyingIndex[i];
              if (!group.length) return;
              ctx.beginPath();
              ctx.strokeStyle = color;
              group.forEach(p => { ctx.moveTo(p.x, p.y); ctx.lineTo(p.xt, p.yt); p.x = p.xt; p.y = p.yt; });
              ctx.stroke();
            });
          }
        }, 1000 / fps);
      } catch (err) { console.error(err); }
    })();

    return { stop: () => clearTimeout(timer) };
  }

  let animHandle = null;
  let field = null;

  return {
    start(pixelBounds, mapW, mapH, latLonBounds) {
      if (animHandle) { animHandle.stop(); animHandle = null; }
      if (field) { field.release(); field = null; }

      const viewport = {
        south: toRad(latLonBounds[0][1]),
        north: toRad(latLonBounds[1][1]),
        east:  toRad(latLonBounds[1][0]),
        west:  toRad(latLonBounds[0][0]),
        width: mapW,
        height: mapH,
      };

      const canvas = {
        x: pixelBounds[0][0], y: pixelBounds[0][1],
        xMax: pixelBounds[1][0], yMax: pixelBounds[1][1],
        width: mapW, height: mapH,
      };

      const grid = buildGrid(params.data, params.imagedata);
      const ctx = params.canvas.getContext("2d");

      buildField(grid, viewport, canvas, (cv, f) => {
        field = f;
        animHandle = animate(cv, f, ctx);
      });
    },
    stop() {
      if (animHandle) { animHandle.stop(); animHandle = null; }
      if (field) { field.release(); field = null; }
    },
  };
}

// ─── TIF → WaterAnim JSON ─────────────────────────────────────────────────

function tifToVelocityBand(pixelData, bounds, nx, ny, paramNumber) {
  const { west, north, east, south } = bounds;
  const dx = (east - west) / nx;
  const dy = (north - south) / ny;
  const data = [];
  for (let i = 0; i < pixelData.length; i++) {
    const v = pixelData[i];
    data.push(Math.abs(v - NODATA) < 1 || isNaN(v) ? 0 : Math.round(v * 1e4) / 1e4);
  }
  return {
    header: {
      parameterCategory: 2,
      parameterNumber: paramNumber,
      nx, ny,
      lo1: west,
      la1: north,
      dx, dy,
      refTime: "2000-01-01T00:00:00.000Z",
      forecastTime: 0,
    },
    data,
  };
}

// ─── Layer management ────────────────────────────────────────────────────

/**
 * Stop and remove the velocity animation. Pass the FimMap (or its provider map) to target one
 * widget; with no argument every mounted widget's velocity layer is stopped.
 * @param {*} [fimOrMap]
 */
export function removeVelocityLayer(fimOrMap) {
  const fim = _resolveFim(fimOrMap);
  for (const f of (fim ? [fim] : [..._layers.keys()])) {
    _layers.get(f)?.stop();
    f.emit('velocity:removed');
  }
  hideTifMetadata();
}

export async function renderVelocityLayer({ name, map, vx, vy }) {
  const fim = _resolveFim(map);
  // Shadows the former module singleton, so everything below — including the closures that drive
  // the animation — addresses THIS map's layer.
  const _layer = _layerFor(fim);
  if (!_layer) { console.warn("[velocity] no FimMap owns this map — nothing rendered"); return; }
  const mySeq = ++_layer.loadSeq;
  if (!vx || !vy) return;

  const [tiffX, tiffY] = await Promise.all([
    fromArrayBuffer(vx),
    fromArrayBuffer(vy),
  ]);
  const [imageX, imageY] = await Promise.all([tiffX.getImage(), tiffY.getImage()]);

  const nx = imageX.getWidth();
  const ny = imageX.getHeight();
  const bounds = getTifWgs84Bounds(imageX);

  const [[rastersX], [rastersY]] = await Promise.all([
    imageX.readRasters(),
    imageY.readRasters(),
  ]);

  const velocityJson = [
    tifToVelocityBand(rastersX, bounds, nx, ny, 2),  // U (east-west)
    tifToVelocityBand(rastersY, bounds, nx, ny, 3),  // V (north-south)
  ];

  // Compute max speed from raw raster values for dynamic color scaling
  let maxSpeed = 0;
  for (let i = 0; i < rastersX.length; i++) {
    const u = rastersX[i], v = rastersY[i];
    if (Math.abs(u - NODATA) < 1 || Math.abs(v - NODATA) < 1 || isNaN(u) || isNaN(v)) continue;
    const spd = Math.sqrt(u * u + v * v);
    if (spd > maxSpeed) maxSpeed = spd;
  }
  if (!maxSpeed) maxSpeed = 4.0;

  const dynConsts = [...VELOCITY_CONSTS];
  dynConsts[2] = maxSpeed;

  // Emit the field DATA; ui/velocityTools.js renders the panel (file-spec, legend, metrics).
  fim?.emit('velocity:activated', { name, bounds, nx, ny, maxSpeed, colors: VELOCITY_COLOR });

  showTifMetadata(name, imageX, { extraRows: [["Components", "X (E–W) · Y (N–S)"], ["Max speed", `${maxSpeed.toFixed(3)} m/s`]] });

  // Pan map to data extent
  const centerLat = (bounds.south + bounds.north) / 2;
  const centerLon  = (bounds.west + bounds.east) / 2;
  // eslint-disable-next-line no-undef
  map.setCenter(new google.maps.LatLng(centerLat, centerLon));
  map.setZoom(13);

  function hideCanvas() {
    if (_layer.anim) _layer.anim.stop();
    if (_layer.canvasLayer) _layer.canvasLayer.canvas.style.display = "none";
  }

  function redraw() {
    if (!_layer.anim || !_layer.canvasLayer) return;
    const mapBounds = map.getBounds();
    // The map's OWN container, not `domId("map")` — that hardcodes the reference app's div id, so
    // it is null on any other host (and ambiguous once two widgets are mounted). getDiv() is what
    // the canvas layer above already uses.
    const mapDiv = map.getDiv?.() || map.getContainer?.() || null;
    if (!mapDiv) return;
    const mapW = mapDiv.offsetWidth;
    const mapH = mapDiv.offsetHeight;
    _layer.canvasLayer.canvas.getContext("2d").clearRect(0, 0, _layer.canvasLayer.canvas.width, _layer.canvasLayer.canvas.height);
    _layer.canvasLayer.canvas.style.display = "block";
    _layer.anim.start(
      [[0, 0], [mapW, mapH]],
      mapW, mapH,
      [
        [mapBounds.getSouthWest().lng(), mapBounds.getSouthWest().lat()],
        [mapBounds.getNorthEast().lng(), mapBounds.getNorthEast().lat()],
      ]
    );
  }

  if (mySeq !== _layer.loadSeq) return;
  _layer.canvasLayer = createCanvasLayer({ map, animate: false });

  _layer.anim = createWaterAnim({
    color: VELOCITY_COLOR,
    constants: dynConsts,
    canvas: _layer.canvasLayer.canvas,
    data: velocityJson,
    imagedata: [[], []],
  });

  _layer.mapListeners = [
    // eslint-disable-next-line no-undef
    google.maps.event.addListener(map, "dragstart",    hideCanvas),
    // eslint-disable-next-line no-undef
    google.maps.event.addListener(map, "zoom_changed", hideCanvas),
    // eslint-disable-next-line no-undef
    google.maps.event.addListener(map, "idle",         redraw),
  ];
  redraw();
}

// Register with the Layer type registry — this map's instance, created on first use. Rendering is
// still driven by the DOM entry points (toggleVelocityLayer); addLayer('velocity') makes the layer
// object reachable via fim.layers.
registerLayerType("velocity", (fim) => _layerFor(fim));

