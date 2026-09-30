import { useEffect, useRef, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  Outlet,
  useNavigate,
} from 'react-router-dom'
import {
  Bell,
  Mic,
  Radio,
  Home,
  LogOut,
  ArrowLeft,
  Loader,
  Server,
  Wifi,
  WifiOff,
  CalendarDays,
  Music,
  Power,
  Activity,
  Clock,
  MapPin,
  Cpu,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import { DAY_NAMES_ID, DAY_MAP_NUM_TO_KEY, formatLastSeen, formatTime, getNextSchedule, audioLabelForTrack } from './lib/schedule'
import SchedulePage from './components/SchedulePage'
// ============================================================
// SMART SCHOOL BELL IoT — PHASE 5-6
// Dashboard Home & Status ESP32 + CRUD jadwal bel (/jadwal)
// ============================================================
// Halaman:
//   /login      → LoginPage
//   /           → HomePage (protected — dashboard home)
//   /jadwal     → SchedulePage (CRUD jadwal bel)
//   /ptt        → PttPage (placeholder)
//
// Phase 5: halaman Home membaca data nyata dari Supabase
// (public.devices, public.schedules, public.audios).
// ============================================================
// ------------------------------------------------------------
// App root: kelola session Supabase
// ------------------------------------------------------------
function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let isMounted = true
    // Cek session saat aplikasi pertama dibuka
    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (isMounted) {
          setSession(currentSession)
          setLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setSession(null)
          setLoading(false)
        }
      })
    // Pantau perubahan auth state (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (isMounted) {
        setSession(currentSession)
        setLoading(false)
      }
    })
    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader className="mx-auto h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">
            Checking authentication...
          </p>
        </div>
      </div>
    )
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage session={session} />} />
        <Route
          path="/"
          element={
            <ProtectedRoute session={session}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage session={session} />} />
          <Route path="jadwal" element={<SchedulePage />} />
          <Route path="ptt" element={<PttPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
// ------------------------------------------------------------
// Login Page
// ------------------------------------------------------------
function LoginPage({ session }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  // Jika sudah login, langsung ke dashboard
  useEffect(() => {
    if (session) {
      navigate('/', { replace: true })
    }
  }, [session, navigate])
  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (authError) {
      // Terjemahkan error umum Supabase ke pesan Indonesia
      let message = 'Terjadi kesalahan. Silakan coba lagi.'
      const code = authError.code || ''
      if (
        code === 'invalid_credentials' ||
        authError.message?.includes('Invalid login credentials')
      ) {
        message = 'Email atau password salah.'
      } else if (code === 'email_not_confirmed') {
        message = 'Email belum dikonfirmasi. Periksa email Anda.'
      } else if (
        code === 'UserNotFound' ||
        authError.message?.includes('User not found')
      ) {
        message = 'Akun tidak ditemukan.'
      } else if (authError.message) {
        message = authError.message
      }
      setError(message)
      setLoading(false)
      return
    }
    // Login sukses â€” onAuthStateChange akan mengupdate session
    // dan LoginPage redirect otomatis ke /
    setLoading(false)
  }
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
            <Bell className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            SMART SCHOOL BELL IoT
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sistem Kontrol Bel Sekolah
          </p>
        </header>
        {/* Form Login */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4">
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@sekolah.sch.id"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Memproses login...' : 'MASUK'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">
          Akun dibuat melalui Supabase Dashboard â€” tidak ada tombol register.
        </p>
      </div>
    </div>
  )
}
// ------------------------------------------------------------
// Protected Route
// ------------------------------------------------------------
function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return children
}
// ------------------------------------------------------------
// Dashboard Layout â€” Topbar + Navbar + Outlet
// ------------------------------------------------------------
function DashboardLayout() {
  const [showMenu, setShowMenu] = useState(false)
  const navigate = useNavigate()
  async function handleLogout() {
    await supabase.auth.signOut()
    // onAuthStateChange akan mengupdate session â†’ redirect ke /login
    navigate('/login', { replace: true })
  }
  const navItems = [
    { to: '/', label: 'HOME', icon: Home, end: true },
    { to: '/jadwal', label: 'JADWAL', icon: Bell },
    { to: '/ptt', label: 'PTT', icon: Radio },
  ]
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Topbar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-800 sm:text-base">
              SMART SCHOOL BELL IoT
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">LOGOUT</span>
          </button>
        </div>
      </header>
      {/* Navbar mobile (hamburger) */}
      <div className="border-b border-slate-200 bg-white md:hidden">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700"
        >
          <span>Menu</span>
          <span className="text-slate-400">{showMenu ? 'âœ•' : 'â˜°'}</span>
        </button>
        {showMenu && (
          <MobileNavItems navItems={navItems} onNavigate={() => setShowMenu(false)} />
        )}
      </div>
      {/* Navbar desktop */}
      <nav className="mx-auto hidden max-w-5xl gap-1 px-4 py-2 md:flex">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
// Nav mobile
function MobileNavItems({ navItems, onNavigate }) {
  return (
    <nav className="flex flex-col gap-1 px-4 pb-3">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
// ------------------------------------------------------------
// Home Page - Dashboard Utama (Phase 5)
// ------------------------------------------------------------
// Data diambil langsung dari Supabase:
//   public.devices    -> status ESP32, relay, ip, last_seen
//   public.schedules  -> jadwal bel (enabled = true saja)
//   public.audios     -> metadata audio MP3 di MicroSD
//
// Status ONLINE/OFFLINE dihitung dari kolom last_seen:
//   sekarang - last_seen <  60 detik  -> ONLINE
//   sekarang - last_seen >= 60 detik  -> OFFLINE
// ------------------------------------------------------------
const DEVICE_OFFLINE_THRESHOLD_MS = 60 * 1000
function HomePage({ session }) {
  const [devices, setDevices] = useState([])
  const [schedules, setSchedules] = useState([])
  const [audios, setAudios] = useState([])
  const [counts, setCounts] = useState({
    totalSchedules: 0,
    activeSchedules: 0,
    totalAudios: 0,
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let isMounted = true
    async function loadData() {
      if (reloadKey === 0) setLoading(true)
      const nextErrors = {}
      let nextDevices = []
      let nextSchedules = []
      let nextAudios = []
      try {
        const [devicesResult, schedulesResult, audiosResult, profileResult] =
          await Promise.all([
            supabase
              .from('devices')
              .select('*')
              .order('last_seen', { ascending: false }),
            supabase
              .from('schedules')
              .select('id, name, day, time, enabled, track')
              .order('time'),
            supabase
              .from('audios')
              .select('id, file_number, file_name, label')
              .order('file_number'),
            session?.user
              ? supabase
                  .from('profiles')
                  .select('username')
                  .eq('id', session.user.id)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
          ])
        if (devicesResult.error) {
          nextErrors.devices = true
        } else {
          nextDevices = devicesResult.data ?? []
        }
        if (schedulesResult.error) {
          nextErrors.schedules = true
        } else {
          nextSchedules = schedulesResult.data ?? []
        }
        if (audiosResult.error) {
          nextErrors.audios = true
        } else {
          nextAudios = audiosResult.data ?? []
        }
        if (!profileResult.error && profileResult.data?.username && isMounted) {
          setProfile(profileResult.data)
        }
      } catch {
        nextErrors.all = true
        nextErrors.devices = true
        nextErrors.schedules = true
        nextErrors.audios = true
      }
      if (isMounted) {
        setDevices(nextDevices)
        setSchedules(nextSchedules)
        setAudios(nextAudios)
        setCounts({
          totalSchedules: nextSchedules.length,
          activeSchedules: nextSchedules.filter((s) => s.enabled).length,
          totalAudios: nextAudios.length,
        })
        setErrors(nextErrors)
        setLoading(false)
      }
    }
    loadData()
    // Polling data devais setiap 3 detik untuk memantau status aktual/heartbeat
    const interval = setInterval(() => {
      loadData()
    }, 3000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [session, reloadKey])
  const device = devices[0] ?? null
  const email = session?.user?.email || profile?.username || 'Pengguna'
  const allFailed =
    errors.all || (errors.devices && errors.schedules && errors.audios)
  if (loading) {
    return <HomeLoading />
  }
  if (allFailed) {
    return <HomeErrorPage onRetry={() => setReloadKey((k) => k + 1)} />
  }
  return (
    <div>
      {/* Status sistem + email user yang login */}
      <HomeHeader email={email} onRefresh={() => setReloadKey((k) => k + 1)} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DeviceStatusCard
          device={device}
          hasError={Boolean(errors.devices)}
          className="md:col-span-2"
        />
        <RelayControlCard device={device} />
        <NextScheduleCard
          schedules={schedules}
          audios={audios}
          hasError={Boolean(errors.schedules)}
        />
        <SummarySection
          counts={counts}
          hasError={Boolean(errors.schedules || errors.audios)}
          className="md:col-span-2"
        />
      </div>
    </div>
  )
}
function HomeHeader({ email, onRefresh }) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Status Sistem
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-800">Dashboard</h1>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Terhubung
          </span>
          <p className="max-w-[220px] truncate text-xs text-slate-500">
            {email}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Segarkan Data
      </button>
    </section>
  )
}
function DeviceStatusCard({ device, hasError, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Server className="h-4 w-4 text-blue-500" />
          STATUS ESP32
        </h2>
        {hasError && (
          <span className="text-xs font-medium text-red-500">
            Gagal memuat data devais
          </span>
        )}
      </div>
      {!device ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-slate-50 px-4 py-8 text-center">
          <WifiOff className="h-8 w-8 text-slate-300" />
          <div>
            <p className="text-sm font-bold text-slate-600">
              ESP32 BELUM TERDAFTAR
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Belum ada perangkat pada tabel devices.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800">
                  {device.device_name || device.device_id}
                </p>
                <p className="text-xs text-slate-400">ID: {device.device_id}</p>
              </div>
            </div>
            <OnlineBadge lastSeen={device.last_seen} />
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <InfoRow
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Last Seen"
              value={formatLastSeen(device.last_seen)}
            />
            <InfoRow
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="IP Address"
              value={device.ip_address || '-'}
            />
            <InfoRow
              icon={<Wifi className="h-3.5 w-3.5" />}
              label="WiFi"
              value={
                device.wifi_ssid
                  ? `${device.wifi_ssid} (${device.wifi_rssi ?? '..'} dBm)`
                  : 'Belum tersedia'
              }
            />
            <InfoRow
              icon={<Server className="h-3.5 w-3.5" />}
              label="Firmware"
              value={device.firmware_version || '-'}
            />
          </dl>
          <p className="mt-3 text-[11px] text-slate-400">
            Status dihitung dari last_seen. Ambang offline: 60 detik.
          </p>
        </div>
      )}
    </section>
  )
}
function OnlineBadge({ lastSeen }) {
  const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : null
  const online =
    lastSeenMs !== null &&
    !Number.isNaN(lastSeenMs) &&
    Date.now() - lastSeenMs < DEVICE_OFFLINE_THRESHOLD_MS
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
        <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
        <Wifi className="h-3.5 w-3.5" />
        ONLINE
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
      <span className="h-2 w-2 rounded-full bg-red-500" />
      <WifiOff className="h-3.5 w-3.5" />
      OFFLINE
    </span>
  )
}
function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-sm font-medium text-slate-700">
        {value}
      </span>
    </div>
  )
}
function RelayControlCard({ device }) {
  const [sendingKey, setSendingKey] = useState(null);
  const lastSeenMs = device?.last_seen ? new Date(device.last_seen).getTime() : null;
  const isOffline =
    lastSeenMs === null || Number.isNaN(lastSeenMs) || Date.now() - lastSeenMs >= 60000;
  const relays = [
    { key: "relay_1", label: "Relay 1", state: device?.relay1 ?? null },
    { key: "relay_2", label: "Relay 2", state: device?.relay2 ?? null },
  ];
  async function toggleRelay(key, currentState) {
    if (!device?.id || isOffline) return;
    const command = currentState === true ? `${key}_off` : `${key}_on`;
    setSendingKey(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: commandError } = await supabase.from("device_commands").insert({
        device_id: device.id,
        command_type: command,
        created_by: user?.id ?? null,
      });
      if (commandError) console.error('[RELAY] command insert failed:', commandError.message);
    } finally {
      setTimeout(() => setSendingKey(null), 1000);
    }
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Power className="h-4 w-4 text-blue-500" /> KONTROL RELAY
        </h2>
        {isOffline && <span className="text-[10px] font-bold text-red-500 uppercase">Offline</span>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {relays.map((relay) => {
          const isSending = sendingKey === relay.key;
          const isActive = relay.state === true;
          const noData = relay.state === null;
          return (
            <div key={relay.key} className={`rounded-xl border p-4 transition-colors ${isActive ? "border-green-200 bg-green-50/30" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">{relay.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${noData ? "bg-slate-300" : isActive ? "animate-pulse bg-green-500" : "bg-slate-400"}`} />
                  <span className="text-[11px] font-bold text-slate-500 uppercase">{noData ? "MATI" : isActive ? "MENYALA" : "MATI"}</span>
                </div>
              </div>
              <div className="mt-3">
                <button type="button" disabled={!device?.id || isSending || noData || isOffline} onClick={() => toggleRelay(relay.key, relay.state)} className={`w-full rounded-lg py-2.5 text-xs font-bold transition-all ${!device?.id || isSending || noData || isOffline ? "cursor-not-allowed bg-slate-200 text-slate-400" : isActive ? "bg-red-500 text-white shadow-sm hover:bg-red-600" : "bg-green-600 text-white shadow-sm hover:bg-green-700"}`}>
                  {isSending ? <Loader className="mx-auto h-4 w-4 animate-spin" /> : isActive ? "MATIKAN" : "NYALAKAN"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 space-y-2">
        {isOffline && <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">Perangkat offline. Status relay terakhir.</p>}
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-700">PENTING: Perintah membutuhkan delay beberapa dtk (polling). Status aktual diperbarui setelah ESP32 mengirim heartbeat (~3 detik).</p>
      </div>
    </section>
  );
}
function NextScheduleCard({ schedules, audios, hasError }) {
  const next = getNextSchedule(schedules)
  const dayKey = next?.schedule ? (typeof next.schedule.day === 'number' ? DAY_MAP_NUM_TO_KEY[next.schedule.day] : next.schedule.day) : ''
  const dayName = DAY_NAMES_ID[dayKey] || ''
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <CalendarDays className="h-4 w-4 text-blue-500" />
        JADWAL BERIKUTNYA
      </h2>
      {hasError ? (
        <div className="rounded-xl bg-red-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-red-600">
            Gagal memuat data jadwal.
          </p>
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-xl bg-slate-50 px-4 py-6 text-center">
          <Bell className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-500">
            Belum ada jadwal bel
          </p>
        </div>
      ) : !next ? (
        <div className="rounded-xl bg-slate-50 px-4 py-6 text-center">
          <CalendarDays className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-500">
            Tidak ada jadwal berikutnya
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-5">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-500">
              {relativeDayLabel(next.diffDays)}
            </p>
            <p className="mt-1 text-xl font-bold leading-tight text-slate-800">
              {dayName}
            </p>
            <p className="text-base font-bold text-blue-600">
              {formatTime(next.schedule.time)}
            </p>
          </div>
          <div className="min-w-0 flex-1 border-l border-slate-200 pl-4">
            <p className="truncate text-sm font-semibold text-slate-800">
              {next.schedule.name}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <Music className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {audioLabelForTrack(audios, next.schedule.track)}
              </span>
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
function relativeDayLabel(diffDays) {
  if (diffDays === 0) return 'Hari ini'
  if (diffDays === 1) return 'Besok'
  return 'Akan datang'
}
function SummarySection({ counts, hasError, className = '' }) {
  const stats = [
    { icon: CalendarDays, label: 'TOTAL JADWAL', value: counts.totalSchedules },
    { icon: Activity, label: 'JADWAL AKTIF', value: counts.activeSchedules },
    { icon: Music, label: 'TOTAL AUDIO', value: counts.totalAudios },
  ]
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Activity className="h-4 w-4 text-blue-500" />
          RINGKASAN SISTEM
        </h2>
        {hasError && (
          <span className="text-xs font-medium text-amber-600">
            Sebagian data gagal dimuat
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </p>
              <p className="text-2xl font-bold leading-tight text-slate-800">
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
function HomeLoading() {
  return (
    <div>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-6 w-40 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-2" />
        <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
        <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
        <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-2" />
      </div>
      <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
        <Loader className="h-4 w-4 animate-spin" />
        Memuat data sistem...
      </p>
    </div>
  )
}
function HomeErrorPage({ onRetry }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
      <h2 className="mt-3 text-lg font-bold text-red-700">
        Gagal mengambil data sistem.
      </h2>
      <p className="mt-1 text-sm text-red-600">Silakan coba refresh halaman.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
      >
        <RefreshCw className="h-4 w-4" />
        Coba Lagi
      </button>
    </div>
  )
}
// ------------------------------------------------------------
// Placeholder Pages
// ------------------------------------------------------------
function PlaceholderPage({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold text-slate-800">{title}</h1>
      <div className="mt-4">{children}</div>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Home
      </Link>
    </div>
  )
}
function PttPage() {
  const audioServerUrl = (import.meta.env.VITE_AUDIO_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')
  const [device, setDevice] = useState(null)
  const [pttActive, setPttActive] = useState(false)
  const [microphoneStatus, setMicrophoneStatus] = useState('MIC OFF')
  const [microphoneError, setMicrophoneError] = useState(null)

  const [pttDiag, setPttDiag] = useState({ mic: '-', ctx: '-', inputRate: 0, generated: 0, sent: 0, bytes: 0, micPeak: null, micRms: null, micNonZero: null, minSample: null, maxSample: null, resPeak: null, i16Peak: null, i16Zeros: null, zeroFrames: null, constFrames: null })
  const microphoneStream = useRef(null)
  const audioContextRef = useRef(null)
  const pttWorkerRef = useRef(null) // dedicated WebSocket worker: the ONLY PCM sender
  const pttNodeRef = useRef(null) // AudioWorkletNode: the ONLY PCM producer
  const pttAckRef = useRef({ timer: null, resolve: null, reject: null })
  const pcmState = useRef({ generated: 0, sent: 0, bytes: 0 })
  // [PTT MIC] latest cumulative snapshot posted by the worklet (read-only, no sample is modified)
  const workletStat = useRef(null) // { frames, stat:{...}, win:{...}|null }
  const lastLogFrames = useRef(0)
  // [PTT WORKER] status / send-summary received from the worker
  const workerStatus = useRef({ sent: 0, queue: 0, queuePeak: 0, overflow: 0 })
  const workerSend = useRef({ min: 0, sum: 0, count: 0, max: 0, gap25: 0, gap40: 0, gap100: 0 })
  const [error, setError] = useState(null)
  useEffect(() => {
    let mounted = true
    supabase
      .from('devices')
      .select('*')
      .order('last_seen', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!mounted) return
        setDevice(data)
        setError(queryError ? 'Gagal memuat perangkat.' : null)
      })
    return () => { mounted = false }
  }, [])
  const deviceOnline = device?.last_seen &&
    Date.now() - new Date(device.last_seen).getTime() < DEVICE_OFFLINE_THRESHOLD_MS
  useEffect(() => () => {
    const ac = pttAckRef.current
    if (ac.timer) { clearTimeout(ac.timer); ac.timer = null }
    pttAckRef.current = { timer: null, resolve: null, reject: null }
    const wk = pttWorkerRef.current
    pttWorkerRef.current = null
    if (wk) { try { wk.postMessage({ type: 'stop' }) } catch { /* ignore */ } ; try { wk.terminate() } catch { /* ignore */ } }
    const nd = pttNodeRef.current
    pttNodeRef.current = null
    if (nd) {
      try { nd.disconnect() } catch { /* ignore */ } // port lives in the worker, terminated above
    }
    microphoneStream.current?.getTracks().forEach((track) => track.stop())
    microphoneStream.current = null
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}) }
    audioContextRef.current = null
    pcmState.current = { generated: 0, sent: 0, bytes: 0 }
    workletStat.current = null
    lastLogFrames.current = 0
    workerStatus.current = { sent: 0, queue: 0, queuePeak: 0, overflow: 0 }
    workerSend.current = { min: 0, sum: 0, count: 0, max: 0, gap25: 0, gap40: 0, gap100: 0 }
  }, [audioServerUrl])
  function audioWsUrl() {
    return audioServerUrl.replace(/^http/, 'ws') + '/ptt'
  }

  // [PTT MIC] worklet snapshot relayed by the worker: PCM frames go straight from the worklet
  // port to the WebSocket, never through this thread
  function handleWorkletMessage(msg) {
    const st = pcmState.current
    st.generated = msg.frames
    workletStat.current = msg
    const a = msg.stat
    if (msg.win) {
      const winFrames = msg.frames - lastLogFrames.current
      lastLogFrames.current = msg.frames
      const w = msg.win
      console.log('[PTT MIC] Frames=' + winFrames +
        ' Peak=' + w.winInPeak.toFixed(4) +
        ' RMS=' + Math.sqrt(w.winInSumSq / (w.winInN || 1)).toFixed(4) +
        ' NonZero=' + w.winInNonZero +
        ' ResPeak=' + w.winResPeak.toFixed(4) +
        ' I16Peak=' + w.winI16Peak +
        ' ZeroFrames(total)=' + a.zeroFrames +
        ' ConstFrames(total)=' + a.constFrames)
      console.log('[PTT TIMING] GenInterval(min/avg/max)=' +
        (a.tGenMin ? a.tGenMin.toFixed(1) : 'N/A') + '/' +
        (a.tGenCount ? (a.tGenSum / a.tGenCount).toFixed(1) : 'N/A') + '/' +
        (a.tGenMax ? a.tGenMax.toFixed(1) : 'N/A') + 'ms' +
        ' Gaps\u003e25/40/100=' + (a.gapGen25 || 0) + '/' + (a.gapGen40 || 0) + '/' + (a.gapGen100 || 0) +
        ' WORKER send avg=' + (workerSend.current.count ? (workerSend.current.sum / workerSend.current.count).toFixed(1) : 'N/A') + 'ms')
      setPttDiag((d) => ({
        ...d,
        generated: st.generated,
        sent: workerStatus.current.sent,
        bytes: workerStatus.current.sent * 640,
        micPeak: a.inPeak, micRms: Math.sqrt(a.inSumSq / (a.inN || 1)),
        micNonZero: a.inNonZero, minSample: a.inMin, maxSample: a.inMax,
        resPeak: a.resPeak, i16Peak: a.i16Peak, i16Zeros: a.i16Zeros,
        zeroFrames: a.zeroFrames, constFrames: a.constFrames,
        avgGen: a.tGenCount ? +(a.tGenSum / a.tGenCount).toFixed(1) : null,
        avgSend: workerSend.current.count ? +((workerSend.current.sum / workerSend.current.count).toFixed(1)) : null,
        zeroPct: st.generated ? +((a.zeroFrames / st.generated) * 100).toFixed(2) : null,
        zeroRunMax: a.zeroRunMax,
        gapSend25: workerSend.current.gap25 || 0,
        gapSend40: workerSend.current.gap40 || 0,
        gapSend100: workerSend.current.gap100 || 0,
        sendQueuePeak: workerStatus.current.queuePeak || 0,
        sendQueueOverflow: workerStatus.current.overflow || 0
      }))
    }
  }

  // [PTT WORKER] messages from the worker (mic snapshots / ack / status / stop summary)
  function handleWorkerMessage(msg) {
    if (msg.type === 'mic-snap') {
      handleWorkletMessage(msg) // worklet diagnostics relayed by the worker (no PCM payload)
      return
    }
    if (msg.type === 'acked') {
      const ac = pttAckRef.current
      if (ac.timer) { clearTimeout(ac.timer); ac.timer = null }
      const r = ac.resolve
      pttAckRef.current = { timer: null, resolve: null, reject: null }
      if (r) r(true)
      return
    }
    if (msg.type === 'error') {
      const ac = pttAckRef.current
      if (ac.timer) { clearTimeout(ac.timer); ac.timer = null }
      const rj = ac.reject
      pttAckRef.current = { timer: null, resolve: null, reject: null }
      if (rj) rj(new Error('Audio Server WebSocket failed'))
      return
    }
    if (msg.type === 'status') {
      workerStatus.current = { sent: msg.sent, queue: msg.queue, queuePeak: msg.queuePeak, overflow: msg.overflow }
      return
    }
    if (msg.type === 'summary') {
      workerSend.current = msg.send || workerSend.current
      workerStatus.current = { sent: msg.sent, queue: msg.queueRemaining, queuePeak: msg.queuePeak, overflow: msg.overflow }
      if (msg.mic) workletStat.current = msg.mic // last cumulative worklet snapshot: keeps [PTT MIC] STOP exact
      if (msg.mic) pcmState.current.generated = msg.mic.frames // final worklet frame count (snapshots are 1/s)
    }
  }
  async function startMicrophone() {
    if (microphoneStream.current) return true
    if (!navigator.mediaDevices?.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) {
      setMicrophoneError('Microphone or audio recording unavailable')
      setMicrophoneStatus('MIC OFF')
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setPttDiag((d) => ({ ...d, mic: 'GRANTED' }))
      const AC = window.AudioContext || window.webkitAudioContext
      const ctx = new AC()
      await ctx.resume()
      audioContextRef.current = ctx
      setPttDiag((d) => ({ ...d, ctx: ctx.state.toUpperCase(), inputRate: ctx.sampleRate }))
      // reset per-session accumulator refs (a new worklet + worker owns this session)
      workletStat.current = null
      lastLogFrames.current = 0
      workerStatus.current = { sent: 0, queue: 0, queuePeak: 0, overflow: 0 }
      workerSend.current = { min: 0, sum: 0, count: 0, max: 0, gap25: 0, gap40: 0, gap100: 0 }
      // AudioWorklet: mic Float32 -> 16 kHz S16LE mono -> 640-byte frames, processed on the
      // audio rendering thread (no main-thread ScriptProcessor callback, no main-thread timer)
      await ctx.audioWorklet.addModule(new URL('./ptt-audio-worklet.js', import.meta.url))
      const source = ctx.createMediaStreamSource(stream)
      const node = new AudioWorkletNode(ctx, 'ptt-audio-worklet', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
        outputChannelCount: [1]
      })
      pttNodeRef.current = node
      const mute = ctx.createGain()
      mute.gain.value = 0
      // The worker owns BOTH the PCM WebSocket and the AudioWorklet port, so frames travel
      // AudioWorklet -> worker -> ws.send and React render work cannot delay the audio path
      const wk = new Worker(new URL('./ptt-ws-worker.js', import.meta.url), { type: 'module' })
      pttWorkerRef.current = wk
      const onWorkerMessage = (ev) => handleWorkerMessage(ev.data)
      wk.onmessage = onWorkerMessage
      // handshake: transfer the port, wait for AUDIO_PORT_READY, then (below) connect the mic
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Audio port attach timeout')), 2000)
        wk.onmessage = (ev) => {
          if (ev.data && ev.data.type === 'audio-port-ready') {
            clearTimeout(timer)
            wk.onmessage = onWorkerMessage
            resolve()
          } else {
            onWorkerMessage(ev)
          }
        }
        wk.postMessage({ type: 'attach-audio-port', port: node.port }, [node.port])
      })
      const ac = pttAckRef.current
      if (ac.timer) { clearTimeout(ac.timer); ac.timer = null }
      pttAckRef.current = { timer: null, resolve: null, reject: null }
      await new Promise((resolve, reject) => {
        pttAckRef.current = {
          timer: setTimeout(() => reject(new Error('Audio Server registration timeout')), 5000),
          resolve,
          reject
        }
        wk.postMessage({ type: 'start', url: audioWsUrl() })
      })
      if (pttWorkerRef.current !== wk) return false // released while waiting for registration
      source.connect(node)
      node.connect(mute)
      mute.connect(ctx.destination) // keep the graph alive; mic audio is never audible
      microphoneStream.current = stream
      setMicrophoneError(null)
      setMicrophoneStatus('MIC ON')
      return true
    } catch (captureError) {
      microphoneStream.current?.getTracks().forEach((track) => track.stop())
      microphoneStream.current = null
      if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}) }
      audioContextRef.current = null
      const nd = pttNodeRef.current
      pttNodeRef.current = null
      if (nd) { try { nd.disconnect() } catch { /* ignore */ } }
      const wk = pttWorkerRef.current
      pttWorkerRef.current = null
      if (wk) { try { wk.postMessage({ type: 'stop' }) } catch { /* ignore */ } ; try { wk.terminate() } catch { /* ignore */ } }
      const ac = pttAckRef.current
      if (ac.timer) { clearTimeout(ac.timer); ac.timer = null }
      pttAckRef.current = { timer: null, resolve: null, reject: null }
      setPttDiag((d) => ({ ...d, ctx: 'CLOSED' }))
      setMicrophoneError(captureError.message || 'Microphone unavailable')
      setMicrophoneStatus('MIC OFF')
      return false
    }
  }

  async function stopMicrophone() {
    const st = pcmState.current
    // 1) stop the producer first: the worklet MessagePort now lives in the worker, which closes
    // it while handling the stop message below, so only detach the node here
    const nd = pttNodeRef.current
    pttNodeRef.current = null
    if (nd) {
      try { nd.disconnect() } catch { /* ignore */ }
    }
    const wk = pttWorkerRef.current
    if (wk) {
      wk.postMessage({ type: 'stop' })
      // 2) await the worker stop summary (the worker also closes its own WebSocket)
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 2000)
        const orig = wk.onmessage
        wk.onmessage = (ev) => {
          if (ev.data && ev.data.type === 'summary') {
            clearTimeout(timer)
            handleWorkerMessage(ev.data)
            resolve()
          } else if (orig) orig(ev)
        }
      })
    }
    const a = workletStat.current ? workletStat.current.stat : null
    if (a) {
      console.log('[PTT MIC] STOP Frames=' + st.generated +
        ' MicPeak=' + a.inPeak.toFixed(4) +
        ' MicRMS=' + Math.sqrt(a.inSumSq / (a.inN || 1)).toFixed(4) +
        ' MicNonZero=' + a.inNonZero +
        ' MinSample=' + a.inMin.toFixed(4) +
        ' MaxSample=' + a.inMax.toFixed(4) +
        ' ResPeak=' + a.resPeak.toFixed(4) +
        ' I16Peak=' + a.i16Peak +
        ' I16Zeros=' + a.i16Zeros +
        ' ZeroFrames=' + a.zeroFrames +
        ' ZeroFramePct=' + (st.generated ? ((a.zeroFrames / st.generated) * 100).toFixed(2) : 'N/A') + '%' +
        ' LongestZeroRun=' + (a.zeroRunMax || 0) +
        ' ConstFrames=' + a.constFrames +
        ' ClipPos=' + a.clipPos + ' ClipNeg=' + a.clipNeg + ' ClipTotal=' + (a.clipPos + a.clipNeg) +
        ' ClipPct=' + (a.inN ? (((a.clipPos + a.clipNeg) / a.inN) * 100).toFixed(4) : 'N/A') + '%')
      console.log('[PTT TIMING] STOP GenInterval(min/avg/max)=' +
        (a.tGenMin ? a.tGenMin.toFixed(1) : 'N/A') + '/' +
        (a.tGenCount ? (a.tGenSum / a.tGenCount).toFixed(1) : 'N/A') + '/' +
        (a.tGenMax ? a.tGenMax.toFixed(1) : 'N/A') + 'ms' +
        ' SendInterval(min/avg/max)=' +
        (workerSend.current.min ? workerSend.current.min.toFixed(1) : 'N/A') + '/' +
        (workerSend.current.count ? (workerSend.current.sum / workerSend.current.count).toFixed(1) : 'N/A') + '/' +
        (workerSend.current.max ? workerSend.current.max.toFixed(1) : 'N/A') + 'ms' +
        ' SendGaps\u003e25/40/100=' + (workerSend.current.gap25 || 0) + '/' + (workerSend.current.gap40 || 0) + '/' + (workerSend.current.gap100 || 0))
      console.log('[PTT WORKER] STOP Sent=' + workerStatus.current.sent +
        ' SendQueuePeak=' + (workerStatus.current.queuePeak || 0) +
        ' SendQueueOverflow=' + (workerStatus.current.overflow || 0) +
        ' QueueRemaining=' + workerStatus.current.queue)
    }
    // 3) tear down mic + audio context, then the worker
    microphoneStream.current?.getTracks().forEach((track) => track.stop())
    microphoneStream.current = null
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}) }
    audioContextRef.current = null
    if (wk) { try { wk.terminate() } catch { /* ignore */ } }
    pttWorkerRef.current = null
    setPttDiag((d) => ({
      ...d,
      generated: st.generated,
      sent: workerStatus.current.sent,
      bytes: workerStatus.current.sent * 640,
      ctx: 'CLOSED',
      micPeak: a ? a.inPeak : null,
      micRms: a ? Math.sqrt(a.inSumSq / (a.inN || 1)) : null,
      micNonZero: a ? a.inNonZero : null,
      minSample: a ? a.inMin : null,
      maxSample: a ? a.inMax : null,
      resPeak: a ? a.resPeak : null,
      i16Peak: a ? a.i16Peak : null,
      i16Zeros: a ? a.i16Zeros : null,
      zeroFrames: a ? a.zeroFrames : null,
      constFrames: a ? a.constFrames : null,
      zeroPct: a && st.generated ? +((a.zeroFrames / st.generated) * 100).toFixed(2) : null,
      zeroRunMax: a ? (a.zeroRunMax || 0) : null,
      avgGen: a && a.tGenCount ? +(a.tGenSum / a.tGenCount).toFixed(1) : null,
      avgSend: workerSend.current.count ? +((workerSend.current.sum / workerSend.current.count).toFixed(1)) : null,
      gapSend25: workerSend.current.gap25 || 0,
      gapSend40: workerSend.current.gap40 || 0,
      gapSend100: workerSend.current.gap100 || 0,
      sendQueuePeak: workerStatus.current.queuePeak || 0,
      sendQueueOverflow: workerStatus.current.overflow || 0
    }))
    setMicrophoneStatus('MIC OFF')
    setPttActive(false)
  }

  async function handlePttPress() {
    if (!deviceOnline || pttActive) return
    setMicrophoneError(null)
    if (await startMicrophone()) setPttActive(true)
  }
  return (
    <PlaceholderPage title="PTT">
      <div className="mb-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <InfoRow icon={<Server className="h-3.5 w-3.5" />} label="AUDIO SERVER" value="OFFLINE" />
        <InfoRow icon={<Mic className="h-3.5 w-3.5" />} label="MICROPHONE" value={microphoneStatus} />
        <InfoRow icon={<Radio className="h-3.5 w-3.5" />} label="STREAMING" value={pttActive ? 'TRANSMITTING' : deviceOnline ? 'READY' : 'OFFLINE'} />
      </div>
      {(error || microphoneError) && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error || microphoneError}</p>}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-600">
        <p>Mic permission: <span className="font-semibold text-slate-800">{pttDiag.mic}</span> · AudioContext: <span className="font-semibold text-slate-800">{pttDiag.ctx}</span> · Input sample rate: <span className="font-semibold text-slate-800">{pttDiag.inputRate ? `${pttDiag.inputRate} Hz` : '-'}</span> · Output PCM rate: <span className="font-semibold text-slate-800">16000 Hz</span></p>
        <p>PCM format: <span className="font-semibold text-slate-800">16-bit signed LE · mono · 320 samples / 640 B / 20 ms</span></p>
        <p>Frames generated: <span className="font-semibold text-slate-800">{pttDiag.generated}</span> · sent: <span className="font-semibold text-slate-800">{pttDiag.sent}</span> · bytes: <span className="font-semibold text-slate-800">{pttDiag.bytes}</span> · gen avg <span className="font-semibold text-slate-800">{pttDiag.avgGen ?? '-'}</span> ms · send avg <span className="font-semibold text-slate-800">{pttDiag.avgSend ?? '-'}</span> ms</p>
        <p>Frame quality: zero frames <span className="font-semibold text-slate-800">{pttDiag.zeroFrames ?? '-'}</span> ({pttDiag.zeroPct ?? '-'}%) · longest zero run <span className="font-semibold text-slate-800">{pttDiag.zeroRunMax ?? '-'}</span> · send gaps &gt;25/40/100&nbsp;ms: <span className="font-semibold text-slate-800">{pttDiag.gapSend25 ?? '-'}/{pttDiag.gapSend40 ?? '-'}/{pttDiag.gapSend100 ?? '-'}</span> · queue peak <span className="font-semibold text-slate-800">{pttDiag.sendQueuePeak ?? '-'}</span> · overflow <span className="font-semibold text-slate-800">{pttDiag.sendQueueOverflow ?? '-'}</span></p>
        <p>Mic signal: peak <span className="font-semibold text-slate-800">{pttDiag.micPeak !== null ? pttDiag.micPeak.toFixed(4) : '-'}</span> · RMS <span className="font-semibold text-slate-800">{pttDiag.micRms !== null ? pttDiag.micRms.toFixed(4) : '-'}</span> · min <span className="font-semibold text-slate-800">{pttDiag.minSample !== null ? pttDiag.minSample.toFixed(4) : '-'}</span> · max <span className="font-semibold text-slate-800">{pttDiag.maxSample !== null ? pttDiag.maxSample.toFixed(4) : '-'}</span> · non-zero samples <span className="font-semibold text-slate-800">{pttDiag.micNonZero ?? '-'}</span></p>
        <p>Resampler out peak <span className="font-semibold text-slate-800">{pttDiag.resPeak !== null ? pttDiag.resPeak.toFixed(4) : '-'}</span> · Int16 peak <span className="font-semibold text-slate-800">{pttDiag.i16Peak ?? '-'}</span> · Int16 zero samples <span className="font-semibold text-slate-800">{pttDiag.i16Zeros ?? '-'}</span> · all-zero frames <span className="font-semibold text-slate-800">{pttDiag.zeroFrames ?? '-'}</span> · const frames <span className="font-semibold text-slate-800">{pttDiag.constFrames ?? '-'}</span></p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RelayControlCard device={device} />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">PUSH-TO-TALK</p>
          <button type="button" disabled={!deviceOnline} onPointerDown={handlePttPress} onPointerUp={stopMicrophone} onPointerCancel={stopMicrophone} onPointerLeave={stopMicrophone} className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 ${pttActive ? 'bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            <Mic className="h-4 w-4" />
            {pttActive ? 'TRANSMITTING' : 'TEKAN DAN TAHAN'}
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Audio PTT dikirim ke Audio Server selama tombol ditekan.</p>
    </PlaceholderPage>
  )
}
export default App
