# Project outline: Decimal Day Clock

## Goals

- Provide a **static** (no-build) web app that can be hosted on **GitHub Pages**.
- Show the current time in the **96-hour / 10-minute / 90-second** system.
- Provide both **digital** and **analogue** clock views.
- Support the **overlap/crossover** window so the first minute of each hour can also be labelled as the previous hour’s minute 11.
- Show a simple UTC-based **10-day-week date** (year + week + day).
- Provide a simple **midsun (solar noon)** reference based on longitude (optional geolocation).
- Provide **converters** from:
  - Unix time (s/ms)
  - Conventional wall time + UTC offset

## Structure

- `index.html`
  - Layout: fullscreen clock + a right-hand panel with options, midsun, and converters.
  - Loads the app via `<script type="module" src="./src/main.js">`.
- `assets/styles.css`
  - Fullscreen layout and modern styling.
- `src/main.js`
  - UI wiring, localStorage settings, periodic clock tick, and converter/midsun interactions.
  - Imports conversion logic from `src/time.js` and drawing from `src/analogue.js`.
- `src/analogue.js`
  - Canvas renderer for the analogue dial/hands.
- `src/time.js`
  - Pure conversion utilities (no DOM). This is the primary unit-test surface.
- `test/time.test.js`
  - Node test suite using `node:test` and `node:assert/strict`.

## Key constants (in `src/time.js`)

- `SECONDS_PER_DAY = 86_400`
- `SECONDS_PER_HOUR = 900`
- `SECONDS_PER_MINUTE = 90`
- `HOURS_PER_DAY = 96`
- `CROSSOVER_MINUTE = 11`

## Overlap model

The overlap window is the first 90 seconds of each 900-second hour:

- **Primary label**: current hour, minute `01`
- **Alternate label**: previous hour, minute `11`

Implementation detail:
- `getDecimalLabelsFromUtcSecondsOfDay()` returns `{ primary, alternate, isOverlapWindow }`
- UI can:
  - show both readings, or
  - prefer the crossover label during overlap

## Digital formatting

The app supports two output styles:

- `colon`: `HH:MM(:SS)`
- `brackets`: `HH(MM)SS` (minute always appears in brackets; can be empty)

Implemented by:
- `formatDecimalLabelWithStyle(label, style, opts)`

## Date (10-day weeks)

Implemented by:
- `getTenDayWeekDateFromUnixMs(unixMs)` returning:
  - `year`
  - `week` (10-day weeks, starting at 1)
  - `day` (1–10)
  - `dayOfYear`, `yearLengthDays`

## Midsun model (approximation)

Midsun is approximated from longitude only:

- Greenwich (0°): 12:00 UTC
- Shift: 4 minutes per degree = 240 seconds per degree

Implemented by:
- `solarNoonUtcSecondsOfDayFromLongitude(longitudeDegrees)`

## Converters

- Unix → decimal:
  - `parseUnixValueToUnixMs(raw, unit)`
  - `unixMsToUtcSecondsOfDay(unixMs)`
- Wall time (+ UTC offset) → decimal:
  - `wallTimeWithUtcOffsetToUnixMs({ date, time, offsetMinutes })`

Limitations:
- “Timezone” conversion is done via **fixed UTC offsets**, not IANA zone rules or DST.

## Testing

Run:

```bash
npm test
```

The tests cover:
- day wrapping
- overlap/crossover behaviour
- longitude-to-midsun mapping
- offset wall time → UTC instant conversion



