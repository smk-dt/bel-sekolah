// ============================================================
// SMART SCHOOL BELL IoT — PHASE 6
// Halaman JADWAL BEL (/jadwal)
// CRUD jadwal per hari + TES audio (placeholder integrasi firmware)
// Data: public.schedules, public.audios, public.devices (Supabase)
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Clock,
  Loader,
  Music,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DAY_MAP_KEY_TO_NUM, DAY_NAMES_ID, formatTime, isValidTime, audioLabelForTrack } from '../lib/schedule'

// Urutan tab hari dimulai Senin (urutan tampil), terpisah dari
// DAY_KEYS (lib/schedule) yang dimulai Minggu untuk getNextSchedule.
const TAB_DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const SCHEDULE_SELECT =
  'id, device_id, name, day, time, enabled, track'

// ------------------------------------------------------------
// Halaman utama
// ------------------------------------------------------------
function SchedulePage() {
  const [schedules, setSchedules] = useState([])
  const [audios, setAudios] = useState([])
  const [deviceId, setDeviceId] = useState(null)
  const [activeDay, setActiveDay] = useState('monday')
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState({})
  const [reloadKey, setReloadKey] = useState(0)

  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [testing, setTesting] = useState(null)
  const [testDone, setTestDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      const nextErrors = {}
      try {
        const [schedResult, audiosResult, devicesResult] = await Promise.all([
          supabase.from('schedules').select(SCHEDULE_SELECT).order('time'),
          supabase
            .from('audios')
            .select('id, file_number, file_name, label')
            .order('file_number'),
          supabase.from('devices').select('id').limit(1),
        ])

        if (schedResult.error) nextErrors.schedules = true
        if (audiosResult.error) nextErrors.audios = true
        if (devicesResult.error) nextErrors.devices = true

        if (isMounted) {
          setSchedules(schedResult.error ? [] : schedResult.data || [])
          setAudios(audiosResult.error ? [] : audiosResult.data || [])
          setDeviceId(devicesResult.data?.[0]?.id ?? null)
          setErrors(nextErrors)
        }
      } catch {
        if (isMounted) {
          setSchedules([])
          setAudios([])
          setErrors({ schedules: true, audios: true, devices: true })
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [reloadKey])

  const activeDayNum = DAY_MAP_KEY_TO_NUM[activeDay] ?? 1

  const daySchedules = useMemo(() => {
    return schedules
      .filter((s) => s.day === activeDayNum)
      .sort((a, b) => String(a.time).localeCompare(String(b.time)))
  }, [schedules, activeDayNum])



  // Cek duplikat: satu hari + satu waktu = satu jadwal.
  function findDuplicate(time, excludeId) {
    return schedules.find(
      (s) => s.day === activeDayNum && formatTime(s.time) === time && s.id !== excludeId
    )
  }

  // Kolom `name` (NOT NULL) diisi dari label audio terpilih.
  function scheduleName(trackNum) {
    const audio = audios.find((a) => a.file_number === trackNum)
    return audio ? audio.label || audio.file_name : 'Bel'
  }

  // CREATE
  async function submitAdd({ time, track, enabled }) {
    if (findDuplicate(time, null)) {
      setFormError('Jadwal pada waktu tersebut sudah ada.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const { data, error } = await supabase
        .from('schedules')
        .insert({
          device_id: deviceId,
          name: scheduleName(track),
          day: activeDayNum,
          time,
          track,
          enabled,
        })
        .select(SCHEDULE_SELECT)
        .single()
      if (error) throw error
      setSchedules((prev) => [...prev, data])
      setShowAdd(false)
      sendRefreshCommand()
    } catch {
      setFormError('Gagal menyimpan jadwal. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  // UPDATE (edit) — jadwal yang diedit dikecualikan dari cek duplikat
  async function submitEdit({ time, track, enabled }) {
    if (findDuplicate(time, editing.id)) {
      setFormError('Jadwal pada waktu tersebut sudah ada.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const { data, error } = await supabase
        .from('schedules')
        .update({ time, track, name: scheduleName(track), enabled })
        .eq('id', editing.id)
        .select(SCHEDULE_SELECT)
        .single()
      if (error) throw error
      setSchedules((prev) => prev.map((s) => (s.id === editing.id ? data : s)))
      setEditing(null)
      sendRefreshCommand()
    } catch {
      setFormError('Gagal menyimpan perubahan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  // DELETE
  async function confirmDelete() {
    if (!deleting) return
    setSaving(true)
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', deleting.id)
      if (error) throw error
      setSchedules((prev) => prev.filter((s) => s.id !== deleting.id))
      setDeleting(null)
      sendRefreshCommand()
    } catch {
      setActionError('Gagal menghapus jadwal. Coba lagi.')
      setDeleting(null)
    } finally {
      setSaving(false)
    }
  }

  // Toggle Aktif/Nonaktif (optimistic update + rollback saat gagal)
  async function toggleEnabled(schedule) {
    const nextEnabled = !schedule.enabled
    setSchedules((prev) =>
      prev.map((s) => (s.id === schedule.id ? { ...s, enabled: nextEnabled } : s))
    )
    const { error } = await supabase
      .from('schedules')
      .update({ enabled: nextEnabled })
      .eq('id', schedule.id)
    if (error) {
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === schedule.id ? { ...s, enabled: schedule.enabled } : s
        )
      )
      setActionError('Gagal mengubah status jadwal. Coba lagi.')
    }
  }

  // TES audio — placeholder: command dikirim ke ESP32 pada phase
  async function sendRefreshCommand() {
    if (!deviceId) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('device_commands').insert({
        device_id: deviceId,
        command_type: 'refresh_schedule',
        created_by: user?.id ?? null,
      })
    } catch (err) {
      console.error('[CMD] Refresh command failed:', err)
    }
  }

  // TES audio — kirim command bell_test dengan track dari schedule terpilih
  async function confirmTest() {
    const targetDeviceId = testing?.device_id
    console.log('[TEST] clicked')
    console.log(`[TEST] schedule id=${testing?.id ?? ''}`)
    console.log(`[TEST] track=${testing?.track ?? ''}`)
    console.log(`[TEST] device_id=${targetDeviceId ?? ''}`)

    if (!testing?.track || !targetDeviceId) {
      console.error('[TEST] missing track or device_id')
      setTesting(null)
      return
    }

    const trackNum = Number(testing.track)
    const scheduleId = testing.id
    setTesting(null)

    if (trackNum < 1 || trackNum > 255) {
      setActionError('Track audio tidak valid.')
      return
    }

    console.log(`[TEST AUDIO] scheduleId=${scheduleId}`)
    console.log(`[TEST AUDIO] track=${trackNum}`)
    console.log('[TEST AUDIO] sending bell_test...')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const insertData = {
        device_id: targetDeviceId,
        command_type: 'bell_test',
        payload: { track: trackNum },
      }
      if (user?.id) {
        insertData.created_by = user.id
      }

      console.log('[TEST] inserting device_commands', insertData)
      const { error } = await supabase
        .from('device_commands')
        .insert(insertData)

      if (error) {
        console.error("[TEST ERROR]");
        console.error("code    :", error.code);
        console.error("message :", error.message);
        console.error("details :", error.details);
        console.error("hint    :", error.hint);
        console.error("full    :", error);
        setActionError('Gagal mengirim perintah tes audio ke bel.');
      } else {
        console.log('[TEST] insert success')
        setTestDone(true)
      }
    } catch (err) {
      console.error('[CMD] bell_test error:', err)
      setActionError('Gagal mengirim perintah tes audio.')
    }
  }

  function openAdd() {
    setFormError('')
    setShowAdd(true)
  }

  function openEdit(schedule) {
    setFormError('')
    setEditing(schedule)
  }

  const deviceAvailable = Boolean(deviceId)
  const dayName = DAY_NAMES_ID[activeDay]

return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10">
      <header className="flex items-center gap-3 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">JADWAL BEL</h1>
          <p className="text-xs text-slate-500">Atur jadwal bel per hari</p>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <DayTabs active={activeDay} onChange={setActiveDay} />

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-600">{dayName}</p>
          <button
            type="button"
            onClick={openAdd}
            disabled={!deviceAvailable}
            title={!deviceAvailable ? 'Device tidak tersedia' : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            TAMBAH JADWAL
          </button>
        </div>

        {actionError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}

        {loading ? (
          <LoadingState />
        ) : errors.schedules || errors.audios || errors.devices ? (
          <ErrorState errors={errors} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : daySchedules.length === 0 ? (
          <EmptyState dayName={dayName} onAdd={openAdd} deviceAvailable={deviceAvailable} />
        ) : (
          <ScheduleTable
            rows={daySchedules}
            audios={audios}
            onEdit={openEdit}
            onDelete={setDeleting}
            onToggle={toggleEnabled}
            onTest={setTesting}
          />
        )}
      </div>

      {showAdd && (
        <ScheduleModal
          mode="add"
          dayName={dayName}
          audios={audios}
          deviceAvailable={deviceAvailable}
          saving={saving}
          error={formError}
          onSave={submitAdd}
          onClose={() => setShowAdd(false)}
          onClearError={() => setFormError('')}
        />
      )}

      {editing && (
        <ScheduleModal
          mode="edit"
          schedule={editing}
          dayName={dayName}
          audios={audios}
          deviceAvailable={deviceAvailable}
          saving={saving}
          error={formError}
          onSave={submitEdit}
          onClose={() => setEditing(null)}
          onClearError={() => setFormError('')}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Hapus Jadwal"
          message={`Apakah Anda yakin ingin menghapus jadwal ${formatTime(deleting.time)}?`}
          confirmLabel="HAPUS"
          danger
          saving={saving}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}

      {testing && (
        <ConfirmDialog
          title="Tes Audio"
          message={`Putar audio sekarang? (${audioLabelForTrack(audios, testing.track)} — ${formatTime(testing.time)})`}
          confirmLabel="PUTAR"
          onConfirm={confirmTest}
          onClose={() => setTesting(null)}
        />
      )}

      {testDone && <TestInfoModal onClose={() => setTestDone(false)} />}
    </div>
  )
}

// ------------------------------------------------------------
// Tab hari (horizontal scroll di HP)
// ------------------------------------------------------------
function DayTabs({ active, onChange }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1">
      <div className="flex gap-2">
        {TAB_DAY_KEYS.map((day) => {
          const isActive = day === active
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(day)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {DAY_NAMES_ID[day]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Tabel jadwal (horizontal scroll di HP)
// ------------------------------------------------------------
function ScheduleTable({ rows, onEdit, onDelete, onToggle, onTest, audios }) {
  return (
    <div className="-mx-4 mt-4 overflow-x-auto px-4">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2.5 pr-3 font-semibold">No</th>
            <th className="py-2.5 pr-3 font-semibold">Waktu</th>
            <th className="py-2.5 pr-3 font-semibold">Audio</th>
            <th className="py-2.5 pr-3 font-semibold">Status</th>
            <th className="py-2.5 pr-3 font-semibold">Aksi</th>
            <th className="py-2.5 font-semibold">Preview</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, index) => (
            <tr key={s.id} className="border-b border-slate-100 last:border-0">
              <td className="py-3 pr-3 text-slate-500">{index + 1}</td>
              <td className="py-3 pr-3">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {formatTime(s.time)}
                </span>
              </td>
              <td className="py-3 pr-3">
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <Music className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {audioLabelForTrack(audios, s.track)}
                </span>
              </td>
              <td className="py-3 pr-3">
                <button
                  type="button"
                  onClick={() => onToggle(s)}
                  title={s.enabled ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    s.enabled
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <Power className="h-3 w-3" />
                  {s.enabled ? 'Aktif' : 'Nonaktif'}
                </button>
              </td>
              <td className="py-3 pr-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(s)}
                    title="Edit jadwal"
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    title="Hapus jadwal"
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
              <td className="py-3">
                <button
                  type="button"
                  onClick={() => onTest(s)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  <Play className="h-3.5 w-3.5" />
                  TES
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------------------------------------
// Empty / Loading / Error state
// ------------------------------------------------------------
function EmptyState({ dayName, onAdd, deviceAvailable }) {
  return (
    <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
      <Bell className="h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm text-slate-600">
        Belum ada jadwal untuk hari {dayName}.
      </p>
      <button
        type="button"
        onClick={onAdd}
        disabled={!deviceAvailable}
        title={!deviceAvailable ? 'Device tidak tersedia' : undefined}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        TAMBAH JADWAL
      </button>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-10">
      <Loader className="h-5 w-5 animate-spin text-blue-600" />
      <p className="text-sm text-slate-600">Memuat jadwal...</p>
    </div>
  )
}

function ErrorState({ errors, onRetry }) {
  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
      {errors.schedules && (
        <p className="mt-3 text-sm font-semibold text-red-700">Gagal memuat jadwal.</p>
      )}
      {errors.audios && (
        <p className="mt-2 text-sm font-semibold text-red-700">
          Gagal memuat daftar audio.
        </p>
      )}
      {errors.devices && (
        <p className="mt-2 text-sm font-semibold text-red-700">
          Gagal memuat data devais.
        </p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
      >
        <RefreshCw className="h-4 w-4" />
        Coba Lagi
      </button>
    </div>
  )
}

// ------------------------------------------------------------
// Modal Tambah / Edit jadwal (dipakai untuk dua mode)
// ------------------------------------------------------------
function ScheduleModal({
  mode,
  schedule,
  dayName,
  audios,
  deviceAvailable,
  saving,
  error,
  onSave,
  onClose,
  onClearError,
}) {
  const isEdit = mode === 'edit'
  const [time, setTime] = useState(isEdit ? formatTime(schedule.time) : '')
  const [track, setTrack] = useState(
    isEdit ? schedule.track : audios[0]?.file_number || 1
  )
  const [enabled, setEnabled] = useState(isEdit ? schedule.enabled : true)
  const [timeError, setTimeError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!isValidTime(time)) {
      setTimeError('Format waktu harus HH:mm (contoh: 07:00).')
      return
    }
    setTimeError('')
    onSave({ time, track, enabled })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {isEdit ? 'Edit Jadwal' : 'Tambah Jadwal'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Hari
            </label>
            <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
              {dayName}
            </p>
          </div>

          <div>
            <label
              htmlFor="jadwal-waktu"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Waktu
            </label>
            <input
              id="jadwal-waktu"
              type="time"
              required
              value={time}
              onChange={(e) => {
                setTime(e.target.value)
                onClearError()
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            />
            {timeError && (
              <p className="mt-1 text-xs text-red-600">{timeError}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="jadwal-audio"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Audio
            </label>
            <select
              id="jadwal-audio"
              value={track}
              onChange={(e) => {
                setTrack(Number(e.target.value))
                onClearError()
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {audios.length === 0 && <option value={0}>Belum ada audio</option>}
              {audios.map((a) => (
                <option key={a.id} value={a.file_number}>
                  {a.file_name} — {a.label}
                </option>
              ))}
            </select>
          </div>

<div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </label>
            <div className="mt-1 inline-flex rounded-lg border border-slate-200 p-1">
              <button
                type="button"
                onClick={() => {
                  setEnabled(true)
                  onClearError()
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  enabled
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Aktif
              </button>
              <button
                type="button"
                onClick={() => {
                  setEnabled(false)
                  onClearError()
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  !enabled
                    ? 'bg-slate-200 text-slate-600'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Nonaktif
              </button>
            </div>
          </div>

          {!deviceAvailable && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Belum ada perangkat (ESP32) terdaftar. Jadwal belum bisa disimpan.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              BATAL
            </button>
            <button
              type="submit"
              disabled={saving || !deviceAvailable || audios.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader className="h-4 w-4 animate-spin" />}
              {isEdit ? 'SIMPAN PERUBAHAN' : 'SIMPAN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Dialog konfirmasi (Hapus / Tes)
// ------------------------------------------------------------
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  saving,
  onConfirm,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            BATAL
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving && <Loader className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Info setelah TES — placeholder integrasi firmware
// ------------------------------------------------------------
function TestInfoModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Play className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Tes Audio</h3>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Command TES akan dikirim ke ESP32 pada phase integrasi firmware.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

export default SchedulePage
