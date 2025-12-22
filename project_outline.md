# Project outline: Decimal Day Clock

## Goals

- Provide a **static** (no-build) web app that can be hosted on **GitHub Pages**.
- Show the current time in the **96-hour / 10-minute / 100-second** system.
- Support the **overlap/crossover** window so the first 100 seconds of each hour can also be labelled as the previous hour's minute 9.
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
- `assets/favicon.svg`
  - Simple clock icon.
- `src/main.js`
  - UI wiring, localStorage settings, periodic clock tick, and converter/midsun interactions.
  - Imports all conversion logic from `src/time.js`.
- `src/time.js`
  - Pure conversion utilities (no DOM). This is the primary unit-test surface.
- `src/analogue.js`
  - Canvas-based analogue clock renderer showing 96-hour dial with overlap indicator.
- `test/time.test.js`
  - Node test suite using `node:test` and `node:assert/strict`.

## Key constants (in `src/time.js`)

- `SECONDS_PER_DAY = 86_400`
- `SECONDS_PER_HOUR = 900`
- `SECONDS_PER_MINUTE = 100`
- `HOURS_PER_DAY = 96`
- `MINUTES_PER_HOUR = 9` (0-8 are normal, 9 is crossover)
- `CROSSOVER_MINUTE = 9`

## Time system details

### Hours
- **96 hours per day** (0-95, zero-indexed)
- Each hour = **900 seconds**

### Minutes
- **10 minutes per hour** (0-9, zero-indexed)
- Each minute = **100 seconds**
- Minutes 0-8 are normal
- **Minute 9 is the crossover minute**

### Seconds
- **100 seconds per minute** (0-99, zero-indexed)

### Overlap model

The overlap window is the first 100 seconds of each 900-second hour:

- **Primary label**: current hour, minute `0`
- **Alternate label**: previous hour, minute `9`

Implementation detail:
- `getDecimalLabelsFromUtcSecondsOfDay()` returns `{ primary, alternate, isOverlapWindow }`
- UI can:
  - show both readings, or
  - prefer the crossover label during overlap

## Display formats

Two digital formats are supported:

- **Colon**: `HH:M(:SS)` where HH=00-95, M=0-9 (single digit), SS=00-99
- **Brackets**: `HH(M)SS` where minute is always in brackets, single digit 0-9
  - Examples: `74(8)01`, `46()`, `(6)08`

## Analogue clock

- 96-hour outer dial with hour numbers (0, 4, 8, ..., 92) and minute ranges `(0-8)`
- Small inner arc at top showing crossover minute (minute 9)
- Three hands:
  - Hour hand: one revolution per day
  - Minute hand: one revolution per hour
  - Second hand: one revolution per minute (100 seconds)
- Day progress arc around the outside
- Overlap indicator highlights when in the crossover window

## Midsun model (approximation)

Midsun is approximated from longitude only:

- Greenwich (0°): 12:00 UTC (≈ decimal hour 48)
- Shift: 4 standard minutes per degree = 240 seconds per degree

Implemented by:
- `solarNoonUtcSecondsOfDayFromLongitude(longitudeDegrees)`

## Date system (10-day weeks)

- Format: `YYYY(WW.D)` where week and day are zero-indexed
- Each week = 10 days
- Week number: 00–36 (zero-indexed)
- Day-in-week: 0–9 (single digit)
- Examples: `2025(00.0)`, `2025(35.6)`
- Gregorian year length (365/366 days) is retained

Implemented by:
- `getTenDayWeekDateFromUnixMs(unixMs)` — returns `{ year, week, day }`
- `formatTenDayWeekDate({ year, week, day })` — formats as `YYYY(WW.D)`

## Converters

- Unix → decimal:
  - `parseUnixValueToUnixMs(raw, unit)`
  - `unixMsToUtcSecondsOfDay(unixMs)`
- Wall time (+ UTC offset) → decimal:
  - `wallTimeWithUtcOffsetToUnixMs({ date, time, offsetMinutes })`

Limitations:
- "Timezone" conversion is done via **fixed UTC offsets**, not IANA zone rules or DST.

## Testing

Run:

```bash
npm test
```

The tests cover:
- day wrapping
- overlap/crossover behaviour (minute 9)
- longitude-to-midsun mapping
- offset wall time → UTC instant conversion
- bracket formatting
- 10-day week date mapping
