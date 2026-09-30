// ============================================================
// SHARED SCHEDULE HELPERS — SMART SCHOOL BELL IoT
// Dipakai oleh HomePage (App.jsx) dan halaman Jadwal (SchedulePage).
// Kolom `day` di public.schedules berupa smallint (0=Setiap Hari, 1=Senin..7=Minggu).
// ============================================================

export const DAY_MAP_KEY_TO_NUM = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
  every: 0,
}

export const DAY_MAP_NUM_TO_KEY = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  7: 'sunday',
  0: 'every',
}

export const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

export const DAY_NAMES_ID = {
  monday: 'Senin',
  tuesday: 'Selasa',
  wednesday: 'Rabu',
  thursday: 'Kamis',
  friday: 'Jumat',
  saturday: 'Sabtu',
  sunday: 'Minggu',
  every: 'Setiap Hari',
}

export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

// "2026-08-16T09:45:00+07:00" -> "16 Agustus 2026, 09:45"
export function formatLastSeen(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTH_NAMES_ID[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`
}

// "07:00:00" -> "07:00"
export function formatTime(timeStr) {
  if (!timeStr) return '--:--'
  const parts = String(timeStr).split(':')
  return `${parts[0]}:${parts[1]}`
}

// Validasi jam 24 jam "HH:mm" (input type="time" + validasi manual
// sebelum INSERT/UPDATE).
export function isValidTime(timeStr) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)
}

// Jadwal aktif terdekat dari waktu sekarang.
// - hanya schedules.enabled === true yang dihitung
// - schedule.day: smallint (0=Setiap Hari, 1=Senin..7=Minggu)
export function getNextSchedule(schedules) {
  const now = new Date()
  const dow = now.getDay() // 0=Sunday..6=Saturday
  const currentIsoDay = dow === 0 ? 7 : dow // 1=Mon..7=Sun
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  let best = null
  for (const schedule of schedules) {
    if (!schedule.enabled) continue

    const dayVal = typeof schedule.day === 'number' ? schedule.day : DAY_MAP_KEY_TO_NUM[schedule.day] ?? -1
    if (dayVal < 0 || dayVal > 7) continue

    const [hour, minute] = String(schedule.time).split(':').map(Number)
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue
    const timeMinutes = hour * 60 + minute

    let diffDays = 0
    if (dayVal === 0) {
      // Setiap Hari
      diffDays = timeMinutes > nowMinutes ? 0 : 1
    } else {
      diffDays = (dayVal - currentIsoDay + 7) % 7
      if (diffDays === 0 && timeMinutes <= nowMinutes) {
        diffDays = 7
      }
    }

    const key = diffDays * 1440 + timeMinutes
    if (!best || key < best.key) {
      best = { schedule, key, diffDays }
    }
  }
  return best
}

export function audioLabelForTrack(audios = [], trackNum) {
  const audio = audios.find((a) => a.file_number === trackNum)
  if (!audio) return `Track ${trackNum}`
  return `${audio.file_name} — ${audio.label}`
}

