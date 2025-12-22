import { getDecimalPartsFromUtcSecondsOfDay } from './time.js'

const TAU = Math.PI * 2
const HOURS_PER_DAY = 96
const SECONDS_PER_DAY = 86_400
const SECONDS_PER_HOUR = 900
const SECONDS_PER_MINUTE = 90

function assertCanvas(canvas) {
	if (!(canvas instanceof HTMLCanvasElement)) {
		throw new Error('Expected a canvas element')
	}
}

function angleFromTop(fraction) {
	return (fraction * TAU) - (Math.PI / 2)
}

function pad2(n) {
	return String(n).padStart(2, '0')
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

function drawRing(ctx, cx, cy, r) {
	ctx.save()
	ctx.beginPath()
	ctx.arc(cx, cy, r, 0, TAU)
	ctx.strokeStyle = 'rgba(255,255,255,0.14)'
	ctx.lineWidth = 2
	ctx.stroke()
	ctx.restore()
}

function drawTicks(ctx, cx, cy, rOuter) {
	ctx.save()
	for (let i = 0; i < HOURS_PER_DAY; i += 1) {
		const fraction = i / HOURS_PER_DAY
		const a = angleFromTop(fraction)

		const hour = i + 1
		const isMajor = (hour % 8) === 0 || hour === 1
		const isMid = (hour % 4) === 0

		const insideLen = isMajor ? 18 : (isMid ? 12 : 7)
		const outsideLen = isMajor ? 6 : 0
		const rInner = rOuter - insideLen
		const rOuter2 = rOuter + outsideLen

		const x1 = cx + (Math.cos(a) * rInner)
		const y1 = cy + (Math.sin(a) * rInner)
		const x2 = cx + (Math.cos(a) * rOuter2)
		const y2 = cy + (Math.sin(a) * rOuter2)

		ctx.beginPath()
		ctx.moveTo(x1, y1)
		ctx.lineTo(x2, y2)
		ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.18)'
		ctx.lineWidth = isMajor ? 3 : 2
		ctx.stroke()
	}
	ctx.restore()
}

function drawDayArc(ctx, cx, cy, rOuter, fraction) {
	ctx.save()
	ctx.beginPath()
	ctx.arc(cx, cy, rOuter + 2, angleFromTop(0), angleFromTop(fraction), false)
	ctx.strokeStyle = 'rgba(110,231,255,0.55)'
	ctx.lineWidth = 6
	ctx.lineCap = 'round'
	ctx.stroke()
	ctx.restore()
}

function drawNumbers(ctx, cx, cy, rOuter) {
	ctx.save()
	ctx.fillStyle = 'rgba(255,255,255,0.70)'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'

	const fontPx = Math.max(11, Math.floor(rOuter * 0.06))
	ctx.font = `600 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`

	// Label a sensible density: 1, then every 4 hours (4..96).
	for (let hour = 1; hour <= HOURS_PER_DAY; hour += 1) {
		if (hour !== 1 && (hour % 4) !== 0) {
			continue
		}

		const i = hour - 1
		const fraction = i / HOURS_PER_DAY
		const a = angleFromTop(fraction)

		const rText = rOuter - 30
		const x = cx + (Math.cos(a) * rText)
		const y = cy + (Math.sin(a) * rText)

		const alpha = (hour % 8) === 0 || hour === 1 ? 0.78 : 0.55
		ctx.fillStyle = `rgba(255,255,255,${alpha})`
		ctx.fillText(String(hour), x, y)
	}

	ctx.restore()
}

function drawHand(ctx, cx, cy, angle, length, width, colour) {
	ctx.save()
	ctx.beginPath()
	ctx.moveTo(cx, cy)
	ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length)
	ctx.strokeStyle = colour
	ctx.lineWidth = width
	ctx.lineCap = 'round'
	ctx.stroke()
	ctx.restore()
}

function drawCentre(ctx, cx, cy) {
	ctx.save()
	ctx.beginPath()
	ctx.arc(cx, cy, 6, 0, TAU)
	ctx.fillStyle = 'rgba(255,255,255,0.85)'
	ctx.fill()
	ctx.restore()
}

export function renderAnalogueClock({ canvas, utcSecondsOfDay, showSeconds, showOverlap }) {
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
	const r = (sizePx / 2) - 18

	const seconds = ((utcSecondsOfDay % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY
	const hourFraction = seconds / SECONDS_PER_DAY

	drawDayArc(ctx, cx, cy, r, hourFraction)
	drawRing(ctx, cx, cy, r)
	drawTicks(ctx, cx, cy, r)
	drawNumbers(ctx, cx, cy, r)

	const hourAngle = angleFromTop(hourFraction)

	const parts = getDecimalPartsFromUtcSecondsOfDay(seconds)
	const secondsIntoHour = seconds - (parts.hourIndex * SECONDS_PER_HOUR)
	const minuteFraction = secondsIntoHour / SECONDS_PER_HOUR
	const minuteAngle = angleFromTop(minuteFraction)

	const secondInMinute = secondsIntoHour - (Math.floor(secondsIntoHour / SECONDS_PER_MINUTE) * SECONDS_PER_MINUTE)
	const secondFraction = secondInMinute / SECONDS_PER_MINUTE
	const secondAngle = angleFromTop(secondFraction)

	if (showOverlap) {
		drawMinuteOverlapSpiral(ctx, cx, cy, r, minuteFraction, parts.isOverlapWindow, parts.hourIndex)
	}

	// Hour hand: one revolution per day, points at 96-hour dial.
	drawHand(ctx, cx, cy, hourAngle, r * 0.62, 6, 'rgba(110,231,255,0.9)')

	// Minute-in-hour hand: one revolution per decimal hour (900s).
	drawHand(ctx, cx, cy, minuteAngle, r * 0.82, 4, 'rgba(255,255,255,0.82)')

	if (showSeconds) {
		// Second-in-minute hand: one revolution per decimal minute (90s).
		drawHand(ctx, cx, cy, secondAngle, r * 0.90, 2, 'rgba(255,110,138,0.85)')
	}

	drawCentre(ctx, cx, cy)
}

function drawMinuteOverlapSpiral(ctx, cx, cy, rOuter, minuteFraction, isInOverlapWindow, hourIndex) {
	// Represent the crossover minute (11) as a continuation beyond the hour boundary:
	// - normal minutes (1..10): outer minute ring (full circle)
	// - crossover minute (11): spiral inward at the top, then continue for 10% of a circle on an inner ring

	const overlapFraction = 0.1 // 90s of 900s
	const connectorFraction = 0.035 // short spiral approaching the top

	const rMinuteOuter = rOuter * 0.78
	const rMinuteInner = rMinuteOuter - 14

	// Outer minute ring (normal minutes)
	ctx.save()
	ctx.beginPath()
	ctx.arc(cx, cy, rMinuteOuter, 0, TAU)
	ctx.strokeStyle = 'rgba(255,255,255,0.08)'
	ctx.lineWidth = 2
	ctx.stroke()
	ctx.restore()

	// Inner overlap ring segment (minute 11 continuation)
	const overlapA1 = angleFromTop(0)
	const overlapA2 = angleFromTop(overlapFraction)

	ctx.save()
	ctx.strokeStyle = 'rgba(255,255,255,0.16)'
	ctx.lineWidth = 4
	ctx.lineCap = 'round'
	ctx.beginPath()
	ctx.arc(cx, cy, rMinuteInner, overlapA1, overlapA2, false)
	ctx.stroke()
	ctx.restore()

	// Spiral connector: from outer ring down to inner ring, ending at the top (fraction 1.0 == 0.0)
	const startFraction = 1 - connectorFraction
	const steps = 64

	ctx.save()
	ctx.strokeStyle = 'rgba(255,255,255,0.22)'
	ctx.lineWidth = 4
	ctx.lineCap = 'round'
	ctx.lineJoin = 'round'
	ctx.beginPath()

	for (let i = 0; i <= steps; i += 1) {
		const t = i / steps
		const f = startFraction + (t * connectorFraction)
		const a = angleFromTop(f)
		const r = rMinuteOuter - (t * (rMinuteOuter - rMinuteInner))
		const x = cx + (Math.cos(a) * r)
		const y = cy + (Math.sin(a) * r)
		if (i === 0) {
			ctx.moveTo(x, y)
		} else {
			ctx.lineTo(x, y)
		}
	}
	ctx.stroke()
	ctx.restore()

	// Highlight current overlap progress on the inner segment when within the overlap window.
	if (isInOverlapWindow) {
		const progress = Math.max(0, Math.min(overlapFraction, minuteFraction))
		ctx.save()
		ctx.strokeStyle = 'rgba(255,110,138,0.60)'
		ctx.lineWidth = 5
		ctx.lineCap = 'round'
		ctx.beginPath()
		ctx.arc(cx, cy, rMinuteInner, angleFromTop(0), angleFromTop(progress), false)
		ctx.stroke()
		ctx.restore()
	}

	// Label the inner segment as 11 (subtle).
	ctx.save()
	ctx.fillStyle = isInOverlapWindow ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.50)'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	const fontPx = Math.max(10, Math.floor(rOuter * 0.055))
	ctx.font = `600 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`
	const labelAngle = angleFromTop(overlapFraction * 0.55)
	const lx = cx + (Math.cos(labelAngle) * (rMinuteInner - 16))
	const ly = cy + (Math.sin(labelAngle) * (rMinuteInner - 16))

	// The overlap window is labelled as the previous hour’s minute 11.
	// Example: at the start of hour 1, the overlap reads as 96(11).
	const currentHour = hourIndex + 1
	const prevHour = currentHour === 1 ? HOURS_PER_DAY : (currentHour - 1)
	ctx.fillText(`${pad2(prevHour)}(11)`, lx, ly)
	ctx.restore()
}


