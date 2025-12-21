# Decimal Day Clock

A digital clock implementing a proposed metric/decimal time system that divides the day cleanly while keeping the second unchanged and eliminating single-point ambiguity at transitions.

## Time System Specification

### Core Divisions
- The day is exactly **86,400 seconds** (unchanged from standard time).
- The day is divided into **96 hours**.
- Each hour = exactly **900 seconds** = 15 standard minutes.
- Clocks display hours from **1 to 96**, then reset to 1 at the start of the next day.

### Minutes
- Each hour is divided into **10 normal minutes**.
- Each minute = exactly **90 seconds**.
- Minutes are numbered **1 to 10**.

### Crossover Minute (Overlap Mechanism)
- After the 10th minute of an hour, there is one additional **crossover minute** labeled **11**.
- The crossover minute (11) is physically identical to the 1st minute of the next hour.
- Duration: 90 seconds (same as regular minutes).
- Purpose: Eliminates sharp ambiguity at hour boundaries by spreading potential confusion over a 90-second window.

### Hour Transition Example
Around the change from hour 47 to 48:

| Display       | Seconds into hour 47 | Equivalent |
|---------------|----------------------|------------|
| 47:09         | 720–809              |            |
| 47:10         | 810–899              | End of normal hour 47 |
| 47:11         | 900–989              | = 48:01 (first minute of hour 48) |
| 48:01         | 900–989              | = 47:11 (crossover) |
| 48:02         | 990–1079             |            |

The clock advances from 47:11 directly to 48:01 (same physical time period, different labels).

### Daily Reset
- After 96:10 (end of normal hour 96), the clock shows 96:11 (crossover minute).
- The next period is displayed as **1:01** (start of the new day).
- The same 90-second crossover window exists at the day boundary.

### Smaller Units (Optional)
- Seconds: unchanged (0–89 per minute).
- Decimal subdivisions can be added if desired:
  - Deciminute = 9 seconds (10 per minute).
  - But plain seconds are recommended for simplicity.

### Display Format
Recommended digital format: `HH:MM:SS` where:
- `HH` = 01–96 (leading zero optional)
- `MM` = 01–11 (11 only during crossover)
- `SS` = 00–89

Analogue clocks could use a 96-mark face with a minute hand that completes one revolution every 10 normal minutes (900 seconds).

## Features to Implement

- Real-time clock displaying current time in the new system.
- Accurate conversion from standard Unix/UTC time to 96-hour format.
- Smooth handling of crossover minutes (display both possible readings optionally during overlap?).
- Configurable display options:
  - Show seconds
  - 24-hour vs 12-hour style not needed (always 1–96)
  - Highlight crossover minute differently
- Support for multiple time zones (offset applied before conversion).

## Why This System?
- Perfect integer division of the day: 86400 ÷ 96 ÷ 10 ÷ 90 = exact.
- Mostly decimal structure (10 minutes per hour).
- No fractional seconds.
- Overlap mechanism removes ambiguous reset points at both hour and day levels.
- Cleaner and more rational than the traditional 24×60×60 system.

## License
MIT (or choose your preferred license)

---

Happy building! This clock will be a great demonstration of a practical decimal time reform.
