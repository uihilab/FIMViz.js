## 3.5 Read-models: one contract for every interface

A library that ships widgets can only be adopted by hosts willing to accept those widgets. The
engine ships read-models: `ColorScale`, `Legend`, `Stats`, and `Filter` are framework-neutral objects
carrying the values an interface would display, with no opinion about how to display them. A React
host, a Vue host, a plain-DOM host, and a headless script bind to the same objects and read the same
numbers.

Three properties keep those readers in agreement. `ColorScale.set` is the only writer, and
`onChange` notifies every reader, so a panel and a rendered surface cannot drift apart. A `Legend` is
derived from the scale that colored the data rather than authored beside it, which removes the
failure where a legend describes a classification the map no longer uses. A `Filter` scopes a
statistic and an agreement metric through the same call, so a region-restricted number means the same
thing in both.

The contract is what makes the incremental adoption of Section 1.1 possible, and what makes headless
operation equivalent rather than approximate. A script that never mounts a map calls `getStats()` and
receives the object a statistics panel would render, so there is no second code path to keep in step.
Section 6 reports where the contract is still incomplete.

## 3.6 Persistence, provenance, and reproducibility

Client-side storage is treated as disposable, and what is stored reflects that. A Dataset persists to
IndexedDB as a recipe — a source reference plus the ordered operations applied to it — rather than as
a decoded buffer. The recipe rehydrates to the same view on another machine, moves as ordinary JSON,
and doubles as a provenance record, since the operations that produced a displayed result are what
was written down. After evaluation, a Dataset exports to a standard format for use in desktop
geographic information systems.

The recipe encodes the chain, so an operation carrying executable content cannot be serialized. A
reclassification driven by a callback is the case that arises: `toRecord` throws, names the Dataset,
and states the range-rule form that does persist. Failing loudly is the right behavior, and it leaves
composition and persistence pulling against each other wherever a host reaches for the callback form.
Section 5.4 reports the recipe size against the decoded size, and the rehydration time.

## 3.7 Multi-dimensional and temporal datasets

Gridded meteorological and hydrological products are conventionally subset by a server-side service
before a browser sees them. NetCDF3, NetCDF4, GRIB2, Zarr, and Cloud-Optimized GeoTIFF instead enter
through the same call as a single image, and a file declaring a time or scenario dimension arrives
carrying a selection axis. A timestep can be selected, a range taken, the axis animated, or the whole
stack collapsed with a reduction, and each is a lazy operation like any other.

Which of those verbs are legal belongs to the axis rather than to the verb. Two independent flags
carry that (Fig. 3.6): `ordered` gates range selection and nearest matching, and `commensurable`
gates reduction, so an ensemble member axis reduces while a spectral band axis refuses.

The engine's policy on non-conforming files is an explicit default with an explicit override beside
it. Where a file does not declare something the engine needs — a spatial extent, a variable, a time
unit — the thrown error names both the missing item and the argument that supplies it (`grid.bbox`,
`series.coords`, `dims.order`), so an unusual file is a configuration problem rather than an
unsupported format. Section 5.2 exercises this policy and records which files required an override.

## 3.8 The optional interface kit

Hosts that want default markup opt into a separate interface module supplying a layer panel, an axis
slider, a drop zone, a tools panel, and region-drawing and operations panels, each built from
ordinary DOM and styled by the host's own stylesheet. The kit is a separate entry point with its own
bundle, so importing the engine does not import it.

Interaction runs through one delegated listener set rather than per-widget wiring. `bindActions`
attaches click, change, and input handlers to the mounting element, and a control declares its
behavior with a `data-action` attribute, so a host adding a control writes markup instead of
listeners. Lookups are scoped to that element, so two widgets on one page do not address each other's
controls. The engine emits and the kit subscribes, never the reverse.

The division of labor is the one that governs the engine's extension points: the engine owns the
mechanism and the host owns the specifics. A host that wants a different panel writes it against the
read-models of Section 3.5.
