import {
	formatSignedTimeDeltaSeconds,
	formatDecimalLabelWithStyle,
	formatTenDayWeekDate,
	getDecimalLabelsFromUtcSecondsOfDay,
	getTenDayWeekDateFromUnixMs,
	parseLongitudeDegrees,
	parseUnixValueToUnixMs,
	shortestSignedDeltaSeconds,
	solarNoonUtcSecondsOfDayFromLongitude,
	unixMsToUtcSecondsOfDay,
	unixMsToUtcSecondsOfDayPrecise,
	wallTimeWithUtcOffsetToUnixMs,
} from './time.js'

import { renderAnalogueClock } from './analogue.js'

const CLOCK_TICK_MS = 100
const STORAGE_KEY = 'decimal-day-clock:v1'

function $(id) {
	const el = document.getElementById(id)
	if (!el) {
		throw new Error(`Missing element: #${id}`)
	}
	return el
}

function logError(context, err) {
	const message = err instanceof Error ? err.message : String(err)
	console.error(`[DecimalDayClock] ${context}: ${message}`, err)
}

function setText(el, text) {
	el.textContent = text
}

function setHidden(el, hidden) {
	el.hidden = Boolean(hidden)
}

function setStatus(el, { text, isError }) {
	setText(el, text ?? '')
	el.classList.toggle('status--error', Boolean(isError))
}

function formatUtcOffsetLabel(totalMinutes) {
	const sign = totalMinutes < 0 ? '-' : '+'
	const abs = Math.abs(totalMinutes)
	const hh = String(Math.floor(abs / 60)).padStart(2, '0')
	const mm = String(abs % 60).padStart(2, '0')
	return `UTC${sign}${hh}:${mm}`
}

function buildUtcOffsetOptions(selectEl) {
	const minMinutes = -12 * 60
	const maxMinutes = 14 * 60
	const stepMinutes = 15

	selectEl.textContent = ''

	for (let minutes = minMinutes; minutes <= maxMinutes; minutes += stepMinutes) {
		const opt = document.createElement('option')
		opt.value = String(minutes)
		opt.textContent = formatUtcOffsetLabel(minutes)
		selectEl.appendChild(opt)
	}

	// Default to UTC.
	selectEl.value = '0'
}

function safeReadSettings() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) {
			return null
		}
		const parsed = JSON.parse(raw)
		if (!parsed || typeof parsed !== 'object') {
			return null
		}
		return parsed
	} catch (err) {
		logError('Failed to read settings', err)
		return null
	}
}

function safeWriteSettings(settings) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
	} catch (err) {
		logError('Failed to persist settings', err)
	}
}

function getClockSettings() {
	const showSeconds = Boolean($('opt-show-seconds').checked)
	const showOverlap = Boolean($('opt-show-overlap').checked)
	const preferCrossover = Boolean($('opt-prefer-crossover').checked)
	const showHour = Boolean($('opt-show-hour').checked)
	const showMinute = Boolean($('opt-show-minute').checked)
	const formatStyle = $('sel-format').value
	const mode = $('sel-mode').value

	// Guardrails:
	// - If seconds are shown, minute should be shown (otherwise the output is confusing).
	// - If both hour and minute are hidden, force hour.
	const effectiveShowMinute = showSeconds ? true : showMinute
	const effectiveShowHour = (!showHour && !effectiveShowMinute) ? true : showHour

	return {
		showSeconds,
		showOverlap,
		preferCrossover,
		showHour: effectiveShowHour,
		showMinute: effectiveShowMinute,
		formatStyle: (formatStyle === 'brackets') ? 'brackets' : 'colon',
		mode: (mode === 'analogue') ? 'analogue' : 'digital',
	}
}

function applySettingsToUi(settings) {
	$('opt-show-seconds').checked = Boolean(settings.showSeconds)
	$('opt-show-overlap').checked = Boolean(settings.showOverlap)
	$('opt-prefer-crossover').checked = Boolean(settings.preferCrossover)
	$('opt-show-hour').checked = (settings.showHour !== false)
	$('opt-show-minute').checked = (settings.showMinute !== false)
	if (settings.formatStyle === 'brackets') {
		$('sel-format').value = 'brackets'
	}
	if (settings.mode === 'analogue') {
		$('sel-mode').value = 'analogue'
	}

	if (typeof settings.longitude === 'number') {
		$('in-longitude').value = String(settings.longitude)
	}
}

function getLongitudeFromUi() {
	const raw = $('in-longitude').value
	return parseLongitudeDegrees(raw)
}

function renderDecimalTime({ nowUnixMs, settings }) {
	const clockTimeEl = $('clock-time')
	const clockAltEl = $('clock-alt')
	const canvasEl = $('clock-canvas')
	const metaEl = $('clock-meta')

	const utcSecondsOfDay = unixMsToUtcSecondsOfDay(nowUnixMs)
	const utcSecondsOfDayPrecise = unixMsToUtcSecondsOfDayPrecise(nowUnixMs)
	const { primary, alternate, isOverlapWindow } = getDecimalLabelsFromUtcSecondsOfDay(utcSecondsOfDay)

	const showSeconds = settings.showSeconds
	const showOverlap = settings.showOverlap
	const preferCrossover = settings.preferCrossover
	const showHour = settings.showHour
	const showMinute = settings.showMinute
	const formatStyle = settings.formatStyle
	const mode = settings.mode

	const mainLabel = (preferCrossover && alternate) ? alternate : primary
	const altLabel = (preferCrossover && alternate) ? primary : alternate

	const formattedMain = formatDecimalLabelWithStyle(mainLabel, formatStyle, { showHour, showMinute, showSeconds })
	setText(clockTimeEl, formattedMain)

	clockTimeEl.classList.toggle('clock__time--small', mode === 'analogue')

	const shouldShowAlt = Boolean(showOverlap && isOverlapWindow && altLabel)
	setHidden(clockAltEl, !shouldShowAlt)
	if (shouldShowAlt) {
		const formattedAlt = formatDecimalLabelWithStyle(altLabel, formatStyle, { showHour, showMinute, showSeconds })
		setText(clockAltEl, `◐ ${formattedAlt}`)
	}

	const now = new Date(nowUnixMs)
	const utcDate = now.toISOString().slice(0, 10)
	const utcTime = now.toISOString().slice(11, 19)
	const unixSeconds = Math.floor(nowUnixMs / 1000)
	const overlapNote = isOverlapWindow ? '◐ minute 9' : ''
	const decDate = getTenDayWeekDateFromUnixMs(nowUnixMs)
	const decDateStr = formatTenDayWeekDate(decDate)
	const line1 = `Date ${decDateStr}`
	const metaParts = [`UTC ${utcDate} ${utcTime}Z`, `Unix ${unixSeconds}`]
	if (overlapNote) {
		metaParts.push(overlapNote)
	}
	setText(metaEl, `${line1}\n${metaParts.join(' • ')}`)

	const isAnalogue = mode === 'analogue'
	setHidden(canvasEl, !isAnalogue)
	setHidden(clockAltEl, !shouldShowAlt)
	setHidden(clockTimeEl, false)

	if (isAnalogue) {
		try {
			renderAnalogueClock({ canvas: canvasEl, utcSecondsOfDay: utcSecondsOfDayPrecise, showSeconds, showOverlap, showMinute })
		} catch (err) {
			logError('Analogue render failed', err)
		}
	}
}

function renderMidsun({ nowUnixMs }) {
	const midsunEl = $('out-midsun')
	const statusEl = $('out-location-status')

	let longitude = null
	try {
		longitude = getLongitudeFromUi()
	} catch (err) {
		setText(midsunEl, '—')
		setStatus(statusEl, { text: err instanceof Error ? err.message : String(err), isError: true })
		return
	}

	if (longitude === null) {
		setText(midsunEl, '—')
		setStatus(statusEl, { text: 'Enter a longitude or use location to calculate midsun.', isError: false })
		return
	}

	try {
		const targetSeconds = solarNoonUtcSecondsOfDayFromLongitude(longitude)
		const nowSeconds = unixMsToUtcSecondsOfDay(nowUnixMs)
		const delta = shortestSignedDeltaSeconds(targetSeconds, nowSeconds)
		const { primary, alternate, isOverlapWindow } = getDecimalLabelsFromUtcSecondsOfDay(targetSeconds)

		const settings = getClockSettings()
		const main = formatDecimalLabelWithStyle(primary, settings.formatStyle, { showHour: true, showMinute: true, showSeconds: true })
		const alt = alternate ? formatDecimalLabelWithStyle(alternate, settings.formatStyle, { showHour: true, showMinute: true, showSeconds: true }) : null
		const overlap = isOverlapWindow && alt ? ` (alt: ${alt})` : ''

		setText(midsunEl, `${main}${overlap} • Δ ${formatSignedTimeDeltaSeconds(delta)}`)
		setStatus(statusEl, { text: `Longitude in use: ${longitude.toFixed(5)}°`, isError: false })
	} catch (err) {
		logError('Failed to render midsun', err)
		setText(midsunEl, '—')
		setStatus(statusEl, { text: err instanceof Error ? err.message : String(err), isError: true })
	}
}

function setLongitudeInUi(value) {
	$('in-longitude').value = String(value)
}

function wireLocationButtons() {
	const statusEl = $('out-location-status')

	$('btn-use-location').addEventListener('click', () => {
		if (!('geolocation' in navigator)) {
			setStatus(statusEl, { text: 'Geolocation is not available in this browser.', isError: true })
			return
		}

		setStatus(statusEl, { text: 'Requesting location…', isError: false })

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const lon = pos.coords.longitude
				setLongitudeInUi(lon)
				setStatus(statusEl, { text: `Location received (accuracy ~${Math.round(pos.coords.accuracy)}m).`, isError: false })
			},
			(err) => {
				const message = err && err.message ? err.message : 'Location request failed.'
				setStatus(statusEl, { text: message, isError: true })
			},
			{
				enableHighAccuracy: true,
				timeout: 12_000,
				maximumAge: 60_000,
			}
		)
	})

	$('btn-clear-location').addEventListener('click', () => {
		$('in-longitude').value = ''
		setStatus(statusEl, { text: 'Cleared longitude.', isError: false })
	})
}

function describeDecimalForUnixMs(unixMs) {
	const utcSecondsOfDay = unixMsToUtcSecondsOfDay(unixMs)
	const { primary, alternate, isOverlapWindow } = getDecimalLabelsFromUtcSecondsOfDay(utcSecondsOfDay)

	const settings = getClockSettings()
	const primaryStr = formatDecimalLabelWithStyle(primary, settings.formatStyle, { showHour: true, showMinute: true, showSeconds: true })
	const altStr = alternate ? formatDecimalLabelWithStyle(alternate, settings.formatStyle, { showHour: true, showMinute: true, showSeconds: true }) : null
	const overlap = isOverlapWindow && altStr ? ` (alt: ${altStr})` : ''

	return {
		primaryStr,
		altStr,
		overlapNote: overlap,
		isoUtc: new Date(unixMs).toISOString(),
		unixSeconds: Math.floor(unixMs / 1000),
	}
}

function wireUnixConverter() {
	const outEl = $('out-unix-result')

	$('btn-now-unix').addEventListener('click', () => {
		$('in-unix').value = String(Math.floor(Date.now() / 1000))
		$('sel-unix-unit').value = 's'
	})

	$('btn-convert-unix').addEventListener('click', () => {
		try {
			const raw = $('in-unix').value
			const unit = $('sel-unix-unit').value
			const unixMs = parseUnixValueToUnixMs(raw, unit)

			const d = describeDecimalForUnixMs(unixMs)
			setText(outEl, [
				`Decimal: ${d.primaryStr}${d.overlapNote}`,
				`UTC: ${d.isoUtc}`,
				`Unix seconds: ${d.unixSeconds}`,
			].join('\n'))
		} catch (err) {
			logError('Unix conversion failed', err)
			setText(outEl, `Error: ${err instanceof Error ? err.message : String(err)}`)
		}
	})
}

function wireNormalConverter() {
	const outEl = $('out-normal-result')
	const outDecimalEl = $('out-normal-decimal')

	function updateDecimalPreview() {
		try {
			const date = $('in-date').value
			const time = $('in-time').value
			const offsetMinutes = Number($('sel-offset').value)

			if (!date || !time || !Number.isFinite(offsetMinutes)) {
				setText(outDecimalEl, '—')
				return
			}

			const unixMs = wallTimeWithUtcOffsetToUnixMs({ date, time, offsetMinutes })
			const d = describeDecimalForUnixMs(unixMs)
			setText(outDecimalEl, d.primaryStr)
		} catch {
			setText(outDecimalEl, '—')
		}
	}

	$('btn-now-normal').addEventListener('click', () => {
		const now = new Date()
		const yyyy = String(now.getFullYear()).padStart(4, '0')
		const mm = String(now.getMonth() + 1).padStart(2, '0')
		const dd = String(now.getDate()).padStart(2, '0')
		const hh = String(now.getHours()).padStart(2, '0')
		const mi = String(now.getMinutes()).padStart(2, '0')
		const ss = String(now.getSeconds()).padStart(2, '0')

		const offsetMinutes = -now.getTimezoneOffset()

		$('in-date').value = `${yyyy}-${mm}-${dd}`
		$('in-time').value = `${hh}:${mi}:${ss}`
		$('sel-offset').value = String(offsetMinutes)
		updateDecimalPreview()
	})

	$('btn-convert-normal').addEventListener('click', () => {
		try {
			const date = $('in-date').value
			const time = $('in-time').value
			const offsetMinutes = Number($('sel-offset').value)

			const unixMs = wallTimeWithUtcOffsetToUnixMs({ date, time, offsetMinutes })
			const d = describeDecimalForUnixMs(unixMs)

			setText(outDecimalEl, d.primaryStr)
			setText(outEl, [
				`Decimal: ${d.primaryStr}${d.overlapNote}`,
				`UTC: ${d.isoUtc}`,
				`Unix seconds: ${d.unixSeconds}`,
				`Interpreted input as: ${date} ${time} (${formatUtcOffsetLabel(offsetMinutes)})`,
			].join('\n'))
		} catch (err) {
			logError('Normal conversion failed', err)
			setText(outDecimalEl, '—')
			setText(outEl, `Error: ${err instanceof Error ? err.message : String(err)}`)
		}
	})

	$('in-date').addEventListener('input', updateDecimalPreview)
	$('in-time').addEventListener('input', updateDecimalPreview)
	$('sel-offset').addEventListener('change', updateDecimalPreview)
}

function wireSettingsPersistence() {
	const save = () => {
		const settings = getClockSettings()
		const longitude = (() => {
			try {
				return getLongitudeFromUi()
			} catch {
				return null
			}
		})()

		const stored = {
			...settings,
			longitude: typeof longitude === 'number' ? longitude : null,
		}
		safeWriteSettings(stored)

		// Trigger immediate re-render when settings change
		const nowUnixMs = Date.now()
		renderDecimalTime({ nowUnixMs, settings })
		renderMidsun({ nowUnixMs })
	}

	$('opt-show-seconds').addEventListener('change', save)
	$('opt-show-overlap').addEventListener('change', save)
	$('opt-prefer-crossover').addEventListener('change', save)
	$('opt-show-hour').addEventListener('change', save)
	$('opt-show-minute').addEventListener('change', save)
	$('sel-format').addEventListener('change', save)
	$('sel-mode').addEventListener('change', save)
	$('in-longitude').addEventListener('input', save)
}

function start() {
	buildUtcOffsetOptions($('sel-offset'))

	const saved = safeReadSettings()
	if (saved) {
		applySettingsToUi(saved)
	}

	wireLocationButtons()
	wireUnixConverter()
	wireNormalConverter()
	wireSettingsPersistence()

	const tick = () => {
		const nowUnixMs = Date.now()
		const settings = getClockSettings()
		renderDecimalTime({ nowUnixMs, settings })
		renderMidsun({ nowUnixMs })
	}

	tick()
	window.setInterval(tick, CLOCK_TICK_MS)
}

try {
	start()
} catch (err) {
	logError('Fatal initialisation error', err)
	document.body.textContent = 'Fatal error initialising the app. Check the console for details.'
}


