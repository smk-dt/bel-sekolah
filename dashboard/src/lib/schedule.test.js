// ============================================================
// Self-check cepat untuk helper jadwal (lib/schedule.js).
// Jalankan: node src/lib/schedule.test.js
// ============================================================
import {
  DAY_NAMES_ID,
  formatLastSeen,
  formatTime,
  getNextSchedule,
  isValidTime,
} from './schedule.js'

// formatTime
if (formatTime('07:30:00') !== '07:30') throw new Error('formatTime: 07:30:00')
if (formatTime('09:05:59') !== '09:05') throw new Error('formatTime: 09:05:59')
if (formatTime(null) !== '--:--') throw new Error('formatTime: null')

// isValidTime
if (!isValidTime('00:00')) throw new Error('isValidTime: 00:00 harus valid')
if (!isValidTime('23:59')) throw new Error('isValidTime: 23:59 harus valid')
if (isValidTime('24:00')) throw new Error('isValidTime: 24:00 harus invalid')
if (isValidTime('07:60')) throw new Error('isValidTime: 07:60 harus invalid')
if (isValidTime('7:30')) throw new Error('isValidTime: 7:30 harus invalid')

// formatLastSeen — round-trip lewat Date lokal agar bebas zona waktu
const d = new Date(2026, 7, 16, 9, 45)
if (formatLastSeen(d.toISOString()) !== '16 Agustus 2026, 09:45') {
  throw new Error(`formatLastSeen: ${formatLastSeen(d.toISOString())}`)
}
if (formatLastSeen(null) !== '-') throw new Error('formatLastSeen: null')
if (formatLastSeen('garbage') !== '-') throw new Error('formatLastSeen: invalid date')

// getNextSchedule
// 1) schedule nonaktif dan day tak dikenal harus diabaikan (hasil null)
if (
  getNextSchedule([{ day: 'monday', time: '07:00:00', enabled: false }]) !== null
) {
  throw new Error('getNextSchedule: nonaktif harus menghasilkan null')
}
if (
  getNextSchedule([{ day: 'xoxo', time: '07:00:00', enabled: true }]) !== null
) {
  throw new Error('getNextSchedule: day tak dikenal harus menghasilkan null')
}

// 2) satu-satunya kandidat -> terpilih, diffDays sesuai hari ini
const todayIdx = new Date().getDay()
const expectedDiff = (5 - todayIdx + 7) % 7 || 7 // jumat; waktu 09:00 yang sudah lewat berarti pekan depan
const fridayOnly = getNextSchedule([
  { day: 'friday', time: '09:00:00', enabled: true },
])
if (!fridayOnly || fridayOnly.schedule.day !== 'friday') {
  throw new Error('getNextSchedule: harus memilih jumat')
}
if (fridayOnly.diffDays !== expectedDiff) {
  throw new Error(`diffDays: expected ${expectedDiff}, got ${fridayOnly.diffDays}`)
}

if (!DAY_NAMES_ID.monday || !DAY_NAMES_ID.sunday) {
  throw new Error('DAY_NAMES_ID tidak lengkap')
}

console.log('schedule.js self-check OK')