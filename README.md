# Decimal Day Clock

A fullscreen web clock implementing a proposed metric/decimal time system that divides the day cleanly while keeping the second unchanged and reducing single-point ambiguity at transitions.

This repository is a **static site** (no build step) designed to be hosted on **GitHub Pages**.

## What you get

- **Fullscreen decimal clock**: `HH:MM(:SS)` where `HH` = 01–96, `MM` = 01–11, `SS` = 00–89.
- **Overlap/crossover support**: optionally show the alternate reading during the overlap window.
- **Midsun (solar noon) helper**: optional geolocation (or manual longitude) to show the *midsun point* in decimal time and the time delta to/from it.
- **Converters**:
  - Unix time (seconds or milliseconds) → decimal
  - Conventional wall time + **UTC offset** → decimal (useful for “different timezones” without relying on IANA/DST rules)
- **Unit tests** for the core conversion maths (`node --test`).

## Time system specification (implemented)

### Core divisions
- The day is exactly **86,400 seconds** (unchanged from standard time).
- The day is divided into **96 hours**.
- Each hour is exactly **900 seconds** (= 15 standard minutes).
- Hours display **1 to 96**, then wrap to 1 at the next day boundary.

### Minutes + seconds
- Each hour has **10 normal minutes**.
- Each minute is exactly **90 seconds**.
- Minutes are numbered **1 to 10**.
- Seconds are unchanged within the minute: **00–89**.

### Crossover / overlap minute (11)
- During the first **90 seconds of each hour**, the physical time interval can be labelled in two ways:
  - **Current hour, minute 01**, or
  - **Previous hour, minute 11** (the “crossover minute”)
- This spreads the boundary over a window instead of a single instant.

Example around the change from hour 47 to 48:

| Physical time interval | Primary label | Alternate label |
|---|---:|---:|
| last 90s of hour 47 | 47:10 | — |
| first 90s of hour 48 | 48:01 | 47:11 |
| next 90s of hour 48 | 48:02 | — |

## Timezones and solar reference

The main clock is **global** and based on **UTC** (everyone sees the same decimal time at the same instant).

The converters include a **UTC offset** option so you can interpret an input wall time as “UTC+02:00”, “UTC−05:00”, etc. (This does not apply DST rules; it is a fixed offset.)

### Midsun (solar noon)

The “midsun” helper is an **approximation based on longitude only**:
- Greenwich (0°) midsun is **12:00 UTC**
- Shifts by **4 standard minutes per 1° longitude**
  - east (+): earlier
  - west (−): later

Notes:
- This intentionally does **not** include the equation of time, latitude, or atmospheric refraction.

## Run it locally

- Open `index.html` directly in your browser, or
- Serve the folder with any static server (recommended for module loading), for example:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy to GitHub Pages

This repo is already laid out for **Pages from the repository root**:

- GitHub → **Settings** → **Pages**
- **Source**: “Deploy from a branch”
- **Branch**: `main` / `/ (root)`

After it deploys, your site is served over HTTPS (important: browsers typically require **HTTPS** for geolocation).

## Tests

```bash
npm test
```

## Privacy

- Clicking **“Use my location”** uses browser geolocation to read your coordinates.
- The app stores only your **longitude** and display options in **localStorage** (in your browser).
- No data is sent to any server by this project.

## License

MIT (see `LICENSE`).
