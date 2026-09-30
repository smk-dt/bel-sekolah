import { createClient } from '@supabase/supabase-js'

// ============================================================
// SUPABASE CLIENT CONFIGURATION
// ============================================================
// Membaca konfigurasi dari environment variables (dashboard/.env)
// JANGAN menaruh credential hard-code di file ini.
//
// auth options:
// - persistSession: session tetap tersimpan (localStorage) agar
//   refresh halaman tidak menghapus login.
// - autoRefreshToken: token direfresh otomatis sebelum expired.
// - detectSessionInUrl: mendeteksi session dari URL (berguna
//   untuk OAuth callback di masa depan).
// ============================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Environment variables VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diisi. ' +
      'Salin dashboard/.env.example menjadi dashboard/.env lalu isi nilainya.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
