import assert from 'node:assert/strict'
import test from 'node:test'

import {
	getDecimalLabelsFromUtcSecondsOfDay,
	formatDecimalLabelWithStyle,
	solarNoonUtcSecondsOfDayFromLongitude,
	unixMsToUtcSecondsOfDay,
	wallTimeWithUtcOffsetToUnixMs,
} from '../src/time.js'

test('unixMsToUtcSecondsOfDay wraps correctly', () => {
	assert.equal(unixMsToUtcSecondsOfDay(0), 0)
	assert.equal(unixMsToUtcSecondsOfDay(86_400_000), 0)
	assert.equal(unixMsToUtcSecondsOfDay(86_400_000 + 1000), 1)
	assert.equal(unixMsToUtcSecondsOfDay(-1000), 86_399)
})

test('decimal labels at start of day', () => {
	const r = getDecimalLabelsFromUtcSecondsOfDay(0)
	assert.equal(r.primary.hour, 1)
	assert.equal(r.primary.minute, 1)
	assert.equal(r.primary.second, 0)
	assert.equal(r.isOverlapWindow, true)
	assert.ok(r.alternate)
	assert.equal(r.alternate.hour, 96)
	assert.equal(r.alternate.minute, 11)
	assert.equal(r.alternate.second, 0)
})

test('overlap window occurs in first 90 seconds of each 900-second hour', () => {
	const startOfHour2 = 900
	const inside = getDecimalLabelsFromUtcSecondsOfDay(startOfHour2 + 45)
	assert.equal(inside.isOverlapWindow, true)
	assert.equal(inside.primary.hour, 2)
	assert.equal(inside.primary.minute, 1)
	assert.ok(inside.alternate)
	assert.equal(inside.alternate.hour, 1)
	assert.equal(inside.alternate.minute, 11)

	const boundary = getDecimalLabelsFromUtcSecondsOfDay(startOfHour2 + 90)
	assert.equal(boundary.isOverlapWindow, false)
	assert.equal(boundary.primary.hour, 2)
	assert.equal(boundary.primary.minute, 2)
	assert.equal(boundary.primary.second, 0)
	assert.equal(boundary.alternate, null)
})

test('solar noon at Greenwich is 12:00 UTC, which maps to decimal hour 49 minute 1', () => {
	const noonUtcSeconds = solarNoonUtcSecondsOfDayFromLongitude(0)
	assert.equal(noonUtcSeconds, 43_200)

	const r = getDecimalLabelsFromUtcSecondsOfDay(noonUtcSeconds)
	assert.equal(r.primary.hour, 49)
	assert.equal(r.primary.minute, 1)
	assert.equal(r.primary.second, 0)
	assert.equal(r.isOverlapWindow, true)
})

test('wall time + UTC offset converts to correct UTC instant', () => {
	// 2025-01-01 10:00 at UTC+02:00 == 2025-01-01 08:00Z
	const unixMs = wallTimeWithUtcOffsetToUnixMs({
		date: '2025-01-01',
		time: '10:00',
		offsetMinutes: 120,
	})

	assert.equal(new Date(unixMs).toISOString(), '2025-01-01T08:00:00.000Z')
})

test('bracket format supports HH(MM)SS, 46(), and (MM)SS', () => {
	const label = { hour: 46, minute: 6, second: 8 }

	assert.equal(
		formatDecimalLabelWithStyle(label, 'brackets', { showHour: true, showMinute: true, showSeconds: true }),
		'46(06)08'
	)

	assert.equal(
		formatDecimalLabelWithStyle(label, 'brackets', { showHour: true, showMinute: false, showSeconds: false }),
		'46()'
	)

	assert.equal(
		formatDecimalLabelWithStyle(label, 'brackets', { showHour: false, showMinute: true, showSeconds: true }),
		'(06)08'
	)
})




