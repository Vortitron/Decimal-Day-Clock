import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	formatDecimalLabelWithStyle,
	formatTenDayWeekDate,
	getDecimalLabelsFromUtcSecondsOfDay,
	getTenDayWeekDateFromUnixMs,
	solarNoonUtcSecondsOfDayFromLongitude,
	unixMsToUtcSecondsOfDay,
	wallTimeWithUtcOffsetToUnixMs,
} from '../src/time.js'

test('unixMsToUtcSecondsOfDay wraps correctly', () => {
	assert.equal(unixMsToUtcSecondsOfDay(0), 0)
	assert.equal(unixMsToUtcSecondsOfDay(86_400_000), 0)
	assert.equal(unixMsToUtcSecondsOfDay(86_400_000 + 1000), 1)
})

test('decimal labels at start of day', () => {
	const result = getDecimalLabelsFromUtcSecondsOfDay(0)
	assert.equal(result.primary.hour, 0)
	assert.equal(result.primary.minute, 0)
	assert.equal(result.primary.second, 0)
	assert.equal(result.isOverlapWindow, true, 'First 100s of day should be overlap window')
	assert.notEqual(result.alternate, null, 'Should have alternate label during overlap')
	assert.equal(result.alternate.hour, 95, 'Alternate should be last hour of previous day')
	assert.equal(result.alternate.minute, 9, 'Alternate should be minute 9 (crossover)')
})

test('overlap window occurs in first 100 seconds of each 900-second hour', () => {
	// Hour 0, minute 0: overlap window
	const atStart = getDecimalLabelsFromUtcSecondsOfDay(0)
	assert.equal(atStart.isOverlapWindow, true)
	assert.equal(atStart.primary.hour, 0)
	assert.equal(atStart.primary.minute, 0)
	assert.equal(atStart.alternate.hour, 95)
	assert.equal(atStart.alternate.minute, 9)

	// Just before 100s mark: still in overlap
	const almostEnd = getDecimalLabelsFromUtcSecondsOfDay(99)
	assert.equal(almostEnd.isOverlapWindow, true)
	assert.equal(almostEnd.primary.hour, 0)
	assert.equal(almostEnd.primary.minute, 0)
	assert.equal(almostEnd.primary.second, 99)

	// At 100s: no longer in overlap window
	const afterOverlap = getDecimalLabelsFromUtcSecondsOfDay(100)
	assert.equal(afterOverlap.isOverlapWindow, false)
	assert.equal(afterOverlap.primary.hour, 0)
	assert.equal(afterOverlap.primary.minute, 1)
	assert.equal(afterOverlap.alternate, null)

	// Hour 47, minute 0 (47*900 = 42300s): overlap window
	const hour47Start = getDecimalLabelsFromUtcSecondsOfDay(47 * 900)
	assert.equal(hour47Start.isOverlapWindow, true)
	assert.equal(hour47Start.primary.hour, 47)
	assert.equal(hour47Start.primary.minute, 0)
	assert.equal(hour47Start.alternate.hour, 46)
	assert.equal(hour47Start.alternate.minute, 9)
})

test('solar noon at Greenwich is 12:00 UTC, which maps to decimal hour 48 minute 0', () => {
	const noonSeconds = 12 * 3600 // 43200 seconds
	const solarNoon = solarNoonUtcSecondsOfDayFromLongitude(0)
	assert.equal(solarNoon, noonSeconds)

	const labels = getDecimalLabelsFromUtcSecondsOfDay(noonSeconds)
	assert.equal(labels.primary.hour, 48)
	assert.equal(labels.primary.minute, 0)
})

test('wall time + UTC offset converts to correct UTC instant', () => {
	// 2025-01-15 10:00:00 at UTC+02:00 => UTC 08:00:00
	const unixMs = wallTimeWithUtcOffsetToUnixMs({
		date: '2025-01-15',
		time: '10:00:00',
		offsetMinutes: 120,
	})
	const expected = Date.UTC(2025, 0, 15, 8, 0, 0)
	assert.equal(unixMs, expected)
})

test('bracket format supports HH(M)SS with single-digit minutes', () => {
	const label = { hour: 46, minute: 6, second: 8 }

	// Full: HH(M)SS - minute is single digit 0-9
	const full = formatDecimalLabelWithStyle(label, 'brackets', { showHour: true, showMinute: true, showSeconds: true })
	assert.equal(full, '46(6)08')

	// Hour only: HH()
	const hourOnly = formatDecimalLabelWithStyle(label, 'brackets', { showHour: true, showMinute: false, showSeconds: false })
	assert.equal(hourOnly, '46()')

	// Minute + seconds: (M)SS
	const minuteAndSeconds = formatDecimalLabelWithStyle(label, 'brackets', { showHour: false, showMinute: true, showSeconds: true })
	assert.equal(minuteAndSeconds, '(6)08')

	// Test minute 0
	const label0 = { hour: 12, minute: 0, second: 45 }
	const withZero = formatDecimalLabelWithStyle(label0, 'brackets', { showHour: true, showMinute: true, showSeconds: true })
	assert.equal(withZero, '12(0)45')

	// Test minute 9
	const label9 = { hour: 95, minute: 9, second: 99 }
	const withNine = formatDecimalLabelWithStyle(label9, 'brackets', { showHour: true, showMinute: true, showSeconds: true })
	assert.equal(withNine, '95(9)99')
})

test('10-day week date mapping with zero-indexed weeks and days', () => {
	// 2025-01-01 => year 2025, week 0, day 0
	const date1 = getTenDayWeekDateFromUnixMs(Date.UTC(2025, 0, 1))
	assert.equal(date1.year, 2025)
	assert.equal(date1.week, 0)
	assert.equal(date1.day, 0)

	// 2025-01-10 => year 2025, week 0, day 9
	const date10 = getTenDayWeekDateFromUnixMs(Date.UTC(2025, 0, 10))
	assert.equal(date10.year, 2025)
	assert.equal(date10.week, 0)
	assert.equal(date10.day, 9)

	// 2025-01-11 => year 2025, week 1, day 0
	const date11 = getTenDayWeekDateFromUnixMs(Date.UTC(2025, 0, 11))
	assert.equal(date11.year, 2025)
	assert.equal(date11.week, 1)
	assert.equal(date11.day, 0)
})

test('date formatter produces YYYY(WW.D) format', () => {
	// Week 0, day 0 => 2025(00.0)
	const formatted1 = formatTenDayWeekDate({ year: 2025, week: 0, day: 0 })
	assert.equal(formatted1, '2025(00.0)')

	// Week 35, day 6 => 2025(35.6)
	const formatted2 = formatTenDayWeekDate({ year: 2025, week: 35, day: 6 })
	assert.equal(formatted2, '2025(35.6)')

	// Week 9, day 9 => 2025(09.9)
	const formatted3 = formatTenDayWeekDate({ year: 2025, week: 9, day: 9 })
	assert.equal(formatted3, '2025(09.9)')
})
