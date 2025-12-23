import { getDecimalPartsFromUtcSecondsOfDay } from './time.js'

const TAU = Math.PI * 2
const HOURS_PER_DAY = 96
const SECONDS_PER_DAY = 86_400
const SECONDS_PER_HOUR = 900
const SECONDS_PER_MINUTE = 100
const MINUTES_PER_HOUR = 10 // 0-9 (minute 9 is the crossover)

function assertCanvas(canvas) {
	if (!(canvas instanceof HTMLCanvasElement)) {
		throw new Error('Expected a canvas element')
	}
}

function angleFromTop(fraction) {
	return (fraction * TAU) - (Math.PI / 2)
}

function setCanvasSizeForCssPixels(canvas, cssPx) {
	const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
	const size = Math.max(100, Math.floor(cssPx))
	const target = Math.floor(size * dpr)

	if (canvas.width !== target || canvas.height !== target) {
		canvas.width = target
		canvas.height = target
	}

	return { dpr, sizeCss: size, sizePx: target }
}

function clear(ctx, sizePx) {
	ctx.clearRect(0, 0, sizePx, sizePx)
}

function drawOuterRing(ctx, cx, cy, r) {
	ctx.save()
	ctx.beginPath()
	ctx.arc(cx, cy, r, 0, TAU)
	ctx.strokeStyle = 'rgba(255,255,255,0.10)'
	ctx.lineWidth = 2
	ctx.stroke()
	ctx.restore()
}

function drawHourTicks(ctx, cx, cy, rOuter) {
	ctx.save()
	for (let i = 0; i < HOURS_PER_DAY; i += 1) {
		const hour = i // 0-95
		const fraction = i / HOURS_PER_DAY
		const a = angleFromTop(fraction)

		const isMajor = (hour % 8) === 0
		const isMid = (hour % 4) === 0

		let tickLen = 4
		let tickWidth = 1.5
		let tickAlpha = 0.12

		if (isMajor) {
			tickLen = 10
			tickWidth = 2.5
			tickAlpha = 0.28
		} else if (isMid) {
			tickLen = 7
			tickWidth = 2
			tickAlpha = 0.18
		}

		const rInner = rOuter - tickLen
		const x1 = cx + (Math.cos(a) * rInner)
		const y1 = cy + (Math.sin(a) * rInner)
		const x2 = cx + (Math.cos(a) * rOuter)
		const y2 = cy + (Math.sin(a) * rOuter)

		ctx.beginPath()
		ctx.moveTo(x1, y1)
		ctx.lineTo(x2, y2)
		ctx.strokeStyle = `rgba(255,255,255,${tickAlpha})`
		ctx.lineWidth = tickWidth
		ctx.stroke()
	}
	ctx.restore()
}

function drawHourLabels(ctx, cx, cy, rOuter) {
	ctx.save()
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'

	const fontPx = Math.max(11, Math.floor(rOuter * 0.058))
	ctx.font = `600 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

	// Label every 4 hours: just the hour number, outside the ring
	// Hours are 0-95, so label 0, 4, 8, 12, ..., 92
	for (let hour = 0; hour < HOURS_PER_DAY; hour += 4) {
		const fraction = hour / HOURS_PER_DAY
		const a = angleFromTop(fraction)

		const rHour = rOuter + 18
		const xHour = cx + (Math.cos(a) * rHour)
		const yHour = cy + (Math.sin(a) * rHour)

		const alpha = (hour % 8) === 0 ? 0.70 : 0.45
		ctx.fillStyle = `rgba(255,255,255,${alpha})`
		ctx.fillText(String(hour), xHour, yHour)
	}

	ctx.restore()
}

function drawMinuteTicks(ctx, cx, cy, rOuter) {
	// Draw a minute dial INSIDE the hour ring.
	// Minutes are 0–9 and the minute hand makes one full revolution per hour,
	// so the minute scale is a 10-division ring around the full circle.
	ctx.save()

	const rDial = rOuter - 14
	const tickLenMajor = 10
	const tickLenMinor = 6

	for (let minute = 0; minute < MINUTES_PER_HOUR; minute += 1) {
		const isMajor = minute === 0
		const a = angleFromTop(minute / MINUTES_PER_HOUR)

		const len = isMajor ? tickLenMajor : tickLenMinor
		const rInner = rDial - len

		const x1 = cx + (Math.cos(a) * rInner)
		const y1 = cy + (Math.sin(a) * rInner)
		const x2 = cx + (Math.cos(a) * rDial)
		const y2 = cy + (Math.sin(a) * rDial)

		ctx.beginPath()
		ctx.moveTo(x1, y1)
		ctx.lineTo(x2, y2)
		ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)'
		ctx.lineWidth = isMajor ? 2 : 1.5
		ctx.stroke()
	}

	ctx.restore()
}

function drawMinuteLabels(ctx, cx, cy, rOuter) {
	// Draw minute numbers (0–9) around the full-circle minute dial.
	ctx.save()
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'

	const rLabel = rOuter - 30
	const fontPx = Math.max(10, Math.floor(rOuter * 0.050))
	ctx.font = `600 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

	for (let minute = 0; minute < MINUTES_PER_HOUR; minute += 1) {
		const a = angleFromTop(minute / MINUTES_PER_HOUR)
		const x = cx + (Math.cos(a) * rLabel)
		const y = cy + (Math.sin(a) * rLabel)

		const alpha = minute === 0 ? 0.45 : 0.28
		ctx.fillStyle = `rgba(255,255,255,${alpha})`
		ctx.fillText(String(minute), x, y)
	}

	ctx.restore()
}

function drawDayProgressArc(ctx, cx, cy, rOuter, dayFraction) {
	ctx.save()
	ctx.beginPath()
	ctx.arc(cx, cy, rOuter + 42, angleFromTop(0), angleFromTop(dayFraction), false)
	ctx.strokeStyle = 'rgba(110,231,255,0.55)'
	ctx.lineWidth = 5
	ctx.lineCap = 'round'
	ctx.stroke()
	ctx.restore()
}

function drawOverlapInnerArc(ctx, cx, cy, r, showOverlap, isInOverlap, hourIndex) {
	if (!showOverlap) {
		return
	}

	// Small inner arc at the top (0° position) showing the overlap window.
	// This represents minute 9 (the crossover minute).
	// It spans the first 100 seconds (0-99) of the current hour, which is also minute 9 of the previous hour.
	const rInner = r * 0.75
	const overlapSpan = SECONDS_PER_MINUTE / SECONDS_PER_HOUR // 100/900 ≈ 0.111

	const a1 = angleFromTop(0)
	const a2 = angleFromTop(overlapSpan)

	ctx.save()
	ctx.beginPath()
	ctx.arc(cx, cy, rInner, a1, a2, false)
	ctx.strokeStyle = isInOverlap ? 'rgba(255,110,138,0.75)' : 'rgba(255,255,255,0.15)'
	ctx.lineWidth = isInOverlap ? 3.5 : 2.5
	ctx.lineCap = 'round'
	ctx.stroke()
	ctx.restore()

	// Label: show previous hour with (9)
	const prevHour = (hourIndex - 1 + HOURS_PER_DAY) % HOURS_PER_DAY
	const labelA = angleFromTop(overlapSpan * 0.5)
	const labelR = rInner - 12
	const labelX = cx + Math.cos(labelA) * labelR
	const labelY = cy + Math.sin(labelA) * labelR

	ctx.save()
	ctx.fillStyle = isInOverlap ? 'rgba(255,110,138,0.90)' : 'rgba(255,255,255,0.35)'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	const fontPx = Math.max(9, Math.floor(r * 0.042))
	ctx.font = `600 ${fontPx}px ui-monospace, monospace`

	const hh = String(prevHour).padStart(2, '0')
	ctx.fillText(`${hh}(9)`, labelX, labelY)
	ctx.restore()
}

function drawHand(ctx, cx, cy, angle, length, width, colour, tailLength = 0) {
	ctx.save()
	ctx.beginPath()

	if (tailLength > 0) {
		const tailX = cx - Math.cos(angle) * tailLength
		const tailY = cy - Math.sin(angle) * tailLength
		ctx.moveTo(tailX, tailY)
	} else {
		ctx.moveTo(cx, cy)
	}

	const tipX = cx + Math.cos(angle) * length
	const tipY = cy + Math.sin(angle) * length
	ctx.lineTo(tipX, tipY)

	ctx.strokeStyle = colour
	ctx.lineWidth = width
	ctx.lineCap = 'round'
	ctx.stroke()
	ctx.restore()
}

function drawCentreDot(ctx, cx, cy, radius) {
	ctx.save()
	ctx.beginPath()
	ctx.arc(cx, cy, radius, 0, TAU)
	ctx.fillStyle = 'rgba(255,255,255,0.90)'
	ctx.fill()
	ctx.restore()
}

export function renderAnalogueClock({ canvas, utcSecondsOfDay, showSeconds, showOverlap, showMinute }) {
	assertCanvas(canvas)

	const rect = canvas.getBoundingClientRect()
	const minCss = Math.min(rect.width, rect.height)
	const { sizePx } = setCanvasSizeForCssPixels(canvas, minCss)

	const ctx = canvas.getContext('2d')
	if (!ctx) {
		throw new Error('Canvas 2D context not available')
	}

	clear(ctx, sizePx)

	const cx = sizePx / 2
	const cy = sizePx / 2
	const r = (sizePx / 2) - 54

	const seconds = ((utcSecondsOfDay % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY
	const dayFraction = seconds / SECONDS_PER_DAY

	const parts = getDecimalPartsFromUtcSecondsOfDay(seconds)
	const minuteFraction = parts.secondsIntoHour / SECONDS_PER_HOUR
	const secondFraction = parts.secondInMinute / SECONDS_PER_MINUTE

	// Draw static face elements
	drawDayProgressArc(ctx, cx, cy, r, dayFraction)
	drawOuterRing(ctx, cx, cy, r)
	drawHourTicks(ctx, cx, cy, r)
	drawMinuteTicks(ctx, cx, cy, r)
	drawHourLabels(ctx, cx, cy, r)
	if (showMinute) {
		drawMinuteLabels(ctx, cx, cy, r)
	}
	drawOverlapInnerArc(ctx, cx, cy, r, showOverlap, parts.isOverlapWindow, parts.hourIndex)

	// Draw hands (back to front for proper layering)
	const hourAngle = angleFromTop(dayFraction)
	const minuteAngle = angleFromTop(minuteFraction)
	const secondAngle = angleFromTop(secondFraction)

	// Hour hand (one revolution per day = 96 hours)
	drawHand(ctx, cx, cy, hourAngle, r * 0.48, 6, 'rgba(110,231,255,0.95)', r * 0.10)

	// Minute hand (one revolution per hour = 9 minutes + crossover)
	drawHand(ctx, cx, cy, minuteAngle, r * 0.72, 4, 'rgba(255,255,255,0.85)', r * 0.12)

	// Second hand (one revolution per minute = 100 seconds)
	if (showSeconds) {
		drawHand(ctx, cx, cy, secondAngle, r * 0.82, 2, 'rgba(255,110,138,0.90)', 0)
	}

	drawCentreDot(ctx, cx, cy, 6)
}
