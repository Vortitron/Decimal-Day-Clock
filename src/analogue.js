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

		const isMajor = (i % 8) === 0
		const isMid = (i % 4) === 0

		const len = isMajor ? 16 : (isMid ? 11 : 7)
		const rInner = rOuter - len

		const x1 = cx + (Math.cos(a) * rInner)
		const y1 = cy + (Math.sin(a) * rInner)
		const x2 = cx + (Math.cos(a) * rOuter)
		const y2 = cy + (Math.sin(a) * rOuter)

		ctx.beginPath()
		ctx.moveTo(x1, y1)
		ctx.lineTo(x2, y2)
		ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.18)'
		ctx.lineWidth = isMajor ? 3 : 2
		ctx.stroke()
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

export function renderAnalogueClock({ canvas, utcSecondsOfDay, showSeconds }) {
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

	drawRing(ctx, cx, cy, r)
	drawTicks(ctx, cx, cy, r)

	const seconds = ((utcSecondsOfDay % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY
	const hourFraction = seconds / SECONDS_PER_DAY
	const hourAngle = angleFromTop(hourFraction)

	const parts = getDecimalPartsFromUtcSecondsOfDay(seconds)
	const secondsIntoHour = seconds - (parts.hourIndex * SECONDS_PER_HOUR)
	const minuteFraction = secondsIntoHour / SECONDS_PER_HOUR
	const minuteAngle = angleFromTop(minuteFraction)

	const secondInMinute = secondsIntoHour - (Math.floor(secondsIntoHour / SECONDS_PER_MINUTE) * SECONDS_PER_MINUTE)
	const secondFraction = secondInMinute / SECONDS_PER_MINUTE
	const secondAngle = angleFromTop(secondFraction)

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


