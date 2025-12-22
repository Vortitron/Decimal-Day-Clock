import {
	formatDecimalLabel,
	formatSignedTimeDeltaSeconds,
	getDecimalLabelsFromUtcSecondsOfDay,
	parseLongitudeDegrees,
	parseUnixValueToUnixMs,
	shortestSignedDeltaSeconds,
	solarNoonUtcSecondsOfDayFromLongitude,
	unixMsToUtcSecondsOfDay,
	wallTimeWithUtcOffsetToUnixMs,
} from './time.js'

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

	return { showSeconds, showOverlap, preferCrossover }
}

function applySettingsToUi(settings) {
	$('opt-show-seconds').checked = Boolean(settings.showSeconds)
	$('opt-show-overlap').checked = Boolean(settings.showOverlap)
	$('opt-prefer-crossover').checked = Boolean(settings.preferCrossover)

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
	const metaEl = $('clock-meta')

	const utcSecondsOfDay = unixMsToUtcSecondsOfDay(nowUnixMs)
	const { primary, alternate, isOverlapWindow } = getDecimalLabelsFromUtcSecondsOfDay(utcSecondsOfDay)

	const showSeconds = settings.showSeconds
	const showOverlap = settings.showOverlap
	const preferCrossover = settings.preferCrossover

	const mainLabel = (preferCrossover && alternate) ? alternate : primary
	const altLabel = (preferCrossover && alternate) ? primary : alternate

	setText(clockTimeEl, formatDecimalLabel(mainLabel, showSeconds))

	const shouldShowAlt = Boolean(showOverlap && isOverlapWindow && altLabel)
	setHidden(clockAltEl, !shouldShowAlt)
	if (shouldShowAlt) {
		setText(clockAltEl, `overlap: ${formatDecimalLabel(altLabel, showSeconds)}`)
	}

	const iso = new Date(nowUnixMs).toISOString()
	const unixSeconds = Math.floor(nowUnixMs / 1000)
	const overlapNote = isOverlapWindow ? 'Overlap window: minute 11 available for previous hour.' : 'No overlap window.'
	setText(metaEl, `UTC: ${iso} • Unix: ${unixSeconds} • ${overlapNote}`)
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

		const main = formatDecimalLabel(primary, true)
		const alt = alternate ? formatDecimalLabel(alternate, true) : null
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

	const primaryStr = formatDecimalLabel(primary, true)
	const altStr = alternate ? formatDecimalLabel(alternate, true) : null
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
	}

	$('opt-show-seconds').addEventListener('change', save)
	$('opt-show-overlap').addEventListener('change', save)
	$('opt-prefer-crossover').addEventListener('change', save)
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


