# NUMPTi

A fullscreen web clock implementing a proposed metric/decimal time system that divides the day cleanly while keeping the second unchanged and reducing single-point ambiguity at transitions.

This repository is a **static site** (no build step) designed to be hosted on **GitHub Pages**.

## What you get

- **Fullscreen decimal clock** with selectable formats:
  - **Colon**: `HH:M(:SS)` where `HH` = 00–95, `M` = 0–9 (single digit), `SS` = 00–99
  - **Brackets**: `HH(M)SS` (minute is always in brackets, single digit 0–9)
  - Examples: `74(8)01`, `46()`, `(6)08`
- **Overlap/crossover support**: optionally show the alternate reading during the overlap window (indicated by ◐ symbol).
- **Analogue mode**: 96-hour dial with hands for day-progress (hour), minute-in-hour, and optional seconds. Minute labels (0-9) appear at key positions (every 24 hours) when enabled via checkbox.
- **Built-in “How it works” panel**: a quick explanation of the system, overlap, and date format inside the app.
- **Midsun (solar noon) helper**: optional geolocation (or manual longitude) to show the *midsun point* in decimal time and the time delta to/from it.
- **Converters**:
  - Unix time (seconds or milliseconds) → decimal
  - Conventional wall time + **UTC offset** → decimal (useful for "different timezones" without relying on IANA/DST rules)
- **Unit tests** for the core conversion maths (`node --test`).

## Time system specification (implemented)

### Core divisions
- The day is exactly **86,400 seconds** (unchanged from standard time).
- The day is divided into **96 hours** (numbered **0 to 95**).
- Each hour is exactly **900 seconds** (= 15 standard minutes).

### Minutes + seconds
- Each hour has **9 normal minutes** (numbered **0 to 8**).
- Each normal minute is exactly **100 seconds**.
- Seconds within the minute: **00–99**.

### Crossover / overlap minute (9)
- During the first **100 seconds of each hour**, the physical time interval can be labelled in two ways:
  - **Current hour, minute 0**, or
  - **Previous hour, minute 9** (the "overlap minute")
- This spreads the boundary over a window instead of a single instant.

Example around the change from hour 47 to 48:

| Physical time interval | Primary label | Alternate label |
|---|---:|---:|
| last 100s of hour 47 | 47:08 | — |
| first 100s of hour 48 | 48:00 | 47:09 |
| next 100s of hour 48 | 48:01 | — |

The clock advances through the overlap showing both `47:09` and `48:00` for the same physical moment.

### Daily reset
- After hour 95, minute 8 (end of normal hour 95), the clock shows 95:09 (crossover minute).
- The next period is displayed as **0:00** (start of the new day).
- The same 100-second crossover window exists at the day boundary.

### Display formats

The app supports two digital formats:

- **Colon**: `HH:M(:SS)` — minutes are single digit 0–9
- **Brackets**: `HH(M)SS` — minute is always inside brackets, single digit 0–9
  - Examples: `74(8)01`, `46(3)99`, `12(0)45`
  - If minute is hidden, brackets are kept empty: `46()`
  - You can also hide the hour to show just minute(+seconds): `(6)08`

### Date (10-day weeks)

The UI shows a simple date line using **10-day weeks** (UTC-based):

- Format: `YYYY(WW.D)` where week and day are both **zero-indexed**
- `WW` is the week number (00–36)
- `D` is the day within the 10-day week (0–9, single digit)
- Examples: `2025(00.0)` (Jan 1), `2025(35.6)` (late December)

No month concept is used at present; the year length remains Gregorian (365/366 days).

## Timezones and solar reference

The main clock is **global** and based on **UTC** (everyone sees the same decimal time at the same instant).

The converters include a **UTC offset** option so you can interpret an input wall time as "UTC+02:00", "UTC−05:00", etc. (This does not apply DST rules; it is a fixed offset.)

### Midsun (solar noon)

The "midsun" helper is an **approximation based on longitude only**:
- Greenwich (0°) midsun is **12:00 UTC** (approximately decimal hour 48)
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
- **Source**: "Deploy from a branch"
- **Branch**: `main` / `/ (root)`

After it deploys, your site is served over HTTPS (important: browsers typically require **HTTPS** for geolocation).

### Custom domain (`numpti.com`)

This repo includes a `CNAME` file for GitHub Pages. In GitHub:

- Go to **Settings** → **Pages**
- Set **Custom domain** to `numpti.com`
- Ensure **Enforce HTTPS** is enabled once the certificate is issued

You’ll also need to point your domain’s DNS to GitHub Pages (exact records depend on your DNS host).

## Tests

```bash
npm test
```

## Privacy

- Clicking **"Use my location"** uses browser geolocation to read your coordinates.
- The app stores only your **longitude** and display options in **localStorage** (in your browser).
- No data is sent to any server by this project.

## License

MIT (see `LICENSE`).
