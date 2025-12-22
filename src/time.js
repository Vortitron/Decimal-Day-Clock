const SECONDS_PER_DAY = 86_400
const SECONDS_PER_HOUR = 900
const SECONDS_PER_MINUTE = 90
const HOURS_PER_DAY = 96
const CROSSOVER_MINUTE = 11
const SECONDS_PER_LONGITUDE_DEGREE = 240 // 4 standard minutes
const SOLAR_NOON_UTC_SECONDS_AT_GREENWICH = 43_200 // 12:00:00 UTC

function assertFiniteNumber(value, name) {
	if (!Number.isFinite(value)) {
		throw new Error(`${name} must be a finite number`)
	}
}

function assertSafeInteger(value, name) {
	if (!Number.isSafeInteger(value)) {
		throw new Error(`${name} must be a safe integer`)
	}
}

function mod(n, m) {
	return ((n % m) + m) % m
}

function pad2(n) {
	return String(n).padStart(2, '0')
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max)
}

export function getDecimalPartsFromUtcSecondsOfDay(utcSecondsOfDay) {
	assertFiniteNumber(utcSecondsOfDay, 'utcSecondsOfDay')

	const seconds = mod(utcSecondsOfDay, SECONDS_PER_DAY)
	const hourIndex = Math.floor(seconds / SECONDS_PER_HOUR) // 0..95
	const secondsIntoHour = seconds - (hourIndex * SECONDS_PER_HOUR) // 0..899.999

	const secondWhole = Math.floor(secondsIntoHour) // 0..899
	const minuteIndex = Math.floor(secondWhole / SECONDS_PER_MINUTE) // 0..9
	const secondInMinute = secondWhole - (minuteIndex * SECONDS_PER_MINUTE) // 0..89

	const isOverlapWindow = secondWhole < SECONDS_PER_MINUTE

	return {
		secondsOfDay: seconds,
		hourIndex,
		minuteIndex,
		secondInMinute,
		isOverlapWindow,
	}
}

export function getDecimalLabelsFromUtcSecondsOfDay(utcSecondsOfDay) {
	const parts = getDecimalPartsFromUtcSecondsOfDay(utcSecondsOfDay)

	const hour = parts.hourIndex + 1
	const minute = parts.minuteIndex + 1
	const second = parts.secondInMinute

	const primary = { hour, minute, second }

	if (!parts.isOverlapWindow) {
		return { primary, alternate: null, isOverlapWindow: false }
	}

	const altHourIndex = mod(parts.hourIndex - 1, HOURS_PER_DAY)
	const alternate = { hour: altHourIndex + 1, minute: CROSSOVER_MINUTE, second }

	return { primary, alternate, isOverlapWindow: true }
}

export function formatDecimalLabel(label, showSeconds) {
	const hh = pad2(label.hour)
	const mm = pad2(label.minute)
	const ss = pad2(label.second)
	return showSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`
}

export function unixMsToUtcSecondsOfDay(unixMs) {
	assertFiniteNumber(unixMs, 'unixMs')
	const seconds = Math.floor(unixMs / 1000)
	return mod(seconds, SECONDS_PER_DAY)
}

export function parseLongitudeDegrees(raw) {
	if (typeof raw !== 'string') {
		throw new Error('Longitude must be a string')
	}

	const trimmed = raw.trim()
	if (!trimmed) {
		return null
	}

	const value = Number(trimmed)
	if (!Number.isFinite(value)) {
		throw new Error('Longitude must be a number')
	}

	return clamp(value, -180, 180)
}

export function solarNoonUtcSecondsOfDayFromLongitude(longitudeDegrees) {
	assertFiniteNumber(longitudeDegrees, 'longitudeDegrees')

	// East (+) means solar noon is earlier than Greenwich; West (-) later.
	const shiftSeconds = longitudeDegrees * SECONDS_PER_LONGITUDE_DEGREE
	const utcSeconds = SOLAR_NOON_UTC_SECONDS_AT_GREENWICH - shiftSeconds
	return mod(utcSeconds, SECONDS_PER_DAY)
}

export function formatSignedTimeDeltaSeconds(deltaSeconds) {
	assertFiniteNumber(deltaSeconds, 'deltaSeconds')

	const sign = deltaSeconds < 0 ? '-' : '+'
	const abs = Math.abs(Math.trunc(deltaSeconds))

	const h = Math.floor(abs / 3600)
	const m = Math.floor((abs % 3600) / 60)
	const s = abs % 60

	return `${sign}${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

export function shortestSignedDeltaSeconds(targetSecondsOfDay, nowSecondsOfDay) {
	assertFiniteNumber(targetSecondsOfDay, 'targetSecondsOfDay')
	assertFiniteNumber(nowSecondsOfDay, 'nowSecondsOfDay')

	const diff = mod(targetSecondsOfDay - nowSecondsOfDay, SECONDS_PER_DAY)
	if (diff > SECONDS_PER_DAY / 2) {
		return diff - SECONDS_PER_DAY
	}
	return diff
}

function parseIsoDate(raw) {
	if (typeof raw !== 'string') {
		throw new Error('Date must be a string')
	}

	const trimmed = raw.trim()
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
	if (!match) {
		throw new Error('Date must be in YYYY-MM-DD format')
	}

	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])

	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
		throw new Error('Date contains invalid numbers')
	}

	return { year, month, day }
}

function parseHms(raw) {
	if (typeof raw !== 'string') {
		throw new Error('Time must be a string')
	}

	const trimmed = raw.trim()
	const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed)
	if (!match) {
		throw new Error('Time must be HH:MM or HH:MM:SS')
	}

	const hour = Number(match[1])
	const minute = Number(match[2])
	const second = match[3] === undefined ? 0 : Number(match[3])

	if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
		throw new Error('Hour must be 0–23')
	}
	if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
		throw new Error('Minute must be 0–59')
	}
	if (!Number.isInteger(second) || second < 0 || second > 59) {
		throw new Error('Second must be 0–59')
	}

	return { hour, minute, second }
}

export function wallTimeWithUtcOffsetToUnixMs({ date, time, offsetMinutes }) {
	if (!date || !time) {
		throw new Error('Date and time are required')
	}
	assertSafeInteger(offsetMinutes, 'offsetMinutes')

	const { year, month, day } = parseIsoDate(date)
	const { hour, minute, second } = parseHms(time)

	// Interpret given wall time as if it occurred at the provided UTC offset.
	// Example: 10:00 at UTC+02:00 => UTC 08:00, so subtract offset minutes.
	const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - (offsetMinutes * 60_000)
	return utcMs
}

export function parseUnixValueToUnixMs(raw, unit) {
	if (typeof raw !== 'string') {
		throw new Error('Unix value must be a string')
	}
	const trimmed = raw.trim()
	if (!trimmed) {
		throw new Error('Unix value is required')
	}
	if (!/^-?\d+$/.test(trimmed)) {
		throw new Error('Unix value must be an integer')
	}

	const value = Number(trimmed)
	assertSafeInteger(value, 'Unix value')

	if (unit === 'ms') {
		return value
	}
	if (unit === 's') {
		return value * 1000
	}

	throw new Error('Unknown Unix unit')
}


