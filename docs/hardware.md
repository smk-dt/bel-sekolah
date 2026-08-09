# SMART BELL IoT - Hardware Documentation

## 1. Daftar Komponen

| No | Komponen | Jumlah | Keterangan |
|----|----------|--------|------------|
| 1 | ESP32 DevKit V1 / ESP32-WROOM-32 | 1 | Board utama |
| 2 | DS3231 RTC Module | 1 | Sumber waktu (backup) + baterai CR2032 |
| 3 | DFPlayer Mini | 1 | Pemutar MP3 bel dari MicroSD |
| 4 | MicroSD Card | 1 | Media penyimpanan file MP3 bel |
| 5 | Relay 2 Channel | 1 | Kontrol power mixer (2 line) |
| 6 | Mixer Amplifier TOA | 1 | Penguat audio ke speaker |
| 7 | Speaker TOA | ≥1 | Output audio sekolah |
| 8 | Power Supply 5V | 1 | Untuk ESP32, DFPlayer & PCM5102A (sesuai kebutuhan) |
| 9 | Baterai CR2032 | 1 | Untuk DS3231 |
| 10 | **PCM5102A (I2S DAC)** | 1 | Konverter audio digital → analog untuk Voice Note & PTT |

## 2. Spesifikasi Komponen Utama

### 2.1 ESP32 DevKit V1 (ESP32-WROOM-32)

- Mikrokontroler: ESP32-WROOM-32
- Dual-core Xtensa LX6, 240 MHz
- RAM: 520 KB
- Flash: 4 MB
- WiFi: 802.11 b/g/n (2.4 GHz)
- Bluetooth: BLE 4.2
- GPIO: ±34 pin dapat digunakan
- Tegangan: 5V (USB) / 3.3V (logic)
- UART: 3 channel (UART0, UART1, UART2)

### 2.2 DS3231 RTC Module

- IC: DS3231 precision RTC
- Komunikasi: I2C
- Alamat I2C: 0x68
- Baterai: CR2032 (backup waktu saat listrik padam)
- Presisi: ±2 ppm (sangat akurat)
- Temperatur sensor built-in
- Pin: VCC, GND, SDA, SCL

### 2.3 DFPlayer Mini

- IC: YX-5300 / combo MP3 decoder
- Media: MicroSD / SD card
- Format audio: MP3, WAV
- Output: Speaker (3W) + DAC/AUX
- Komunikasi: UART Serial
- Baudrate: **9600** (default)
- Tegangan operasi: 3.2V - 5V
- Pin: VCC, GND, TX, RX, BUSY

### 2.4 Relay 2-Channel

- Tipe: Relay module 2-channel (biasanya SRD-05 / SRA-05)
- Kontrol: GPIO aktif LOW atau HIGH (sesuai modul)
- Tegangan koil: 5V
- Kontak: NO (Normally Open) & NC (Normally Closed)
- Capacity: sesuai relay modul (misal 10A 250VAC)
- Optocoupler: umumnya ada pemisah optocoupler

### 2.5 PCM5102A (I2S DAC)

- Type: PCM5102A (I2S DAC module)
- Fungsi: Konversi audio digital (I2S dari ESP32) → analog (AUX/Line-In mixer)
- Komunikasi: **I2S**
- Pin utama modul: VIN, GND, BCK, LCK, DIN, SCK (SCK/MCLK tergantung library & konfigurasi)
- Tegangan: 3.3V (umumnya; **cek spesifikasi modul Anda sebelum wiring final**)

> [!NOTE]
> PCM5102A adalah **DAC** — bukan penyimpanan, bukan MP3 decoder.
> Digunakan untuk **Voice Note** dan **PTT** (jalur PCM5102A → AUX 1 → Mixer).
> Bel otomatis tetap menggunakan **DFPlayer Mini** (jalur DFPlayer → AUX 2 → Mixer).

### 2.6 Power Supply

> [!WARNING]
> Jangan memberikan daya dari listrik PLN (220V) langsung ke ESP32 atau DFPlayer.
> Relay adalah pemisah antara sisi kontrol (ESP32) dan sisi beban (mixer).

## 4. Koneksi Audio

Sistem memiliki **dua jalur audio independen** menuju mixer:

```
JALUR 1 — Voice Note & PTT (audio streaming):
ESP32 (I2S)
   → PCM5102A (I2S DAC)
   → AUX INPUT 1 (Mixer TOA)
   → Amplifier → Speaker

JALUR 2 — Bel Otomatis (DFPlayer):
DFPlayer Mini (MicroSD)
   → AUX INPUT 2 (Mixer TOA)
   → Amplifier → Speaker
```

```
DFPlayer Mini
     │
     ├── SPK_1 / SPK_2 : Speaker kecil (tidak digunakan di sistem TOA)
     │
     └── DAC_R / DAC_L → AUX INPUT 2 → Mixer Amplifier
```

> **Sumber berbeda, jalur berbeda.**
> JANGAN menggabungkan/menjumper output L/R dua perangkat audio secara langsung.
> Gunakan input mixer (AUX 1 & AUX 2) sebagai tempat penggabungan sumber audio.
> Baca spesifikasi DFPlayer untuk memilih output DAC yang benar.

## 5. Jumlah MicroSD

MicroSD berisi file MP3 sesuai daftar:

| File di SD | Fungsi |
|------------|--------|
| 0001.mp3 | Bel / file 1 |
| 0002.mp3 | File 2 |
| 0003.mp3 | File 3 |
| 0004.mp3 | File 4 |
| 0005.mp3 | File 5 |
| 0006.mp3 | File 6 |
| 0007.mp3 | File 7 |
| 0008.mp3 | **TEST AUDIO** |

> Nama file DFPlayer harus 4 digit (0001, 0002, dst — correct to max 0016).
> No 9-14 juga tersedia di project (0009.mp3 - 00015.mp3) dan 0016.mp3.
> DFPlayer navigasi file secara berurutan; saat ini library luar mungkin memakai `playFolderTrack()`.

## 6. Catatan Pendawaian & Susunan

> [!IMPORTANT] Keamanan
> - Koneksi ke listrik PLN (220-240V AC) hanya boleh dilakukan oleh teknisi berkompeten.
> - Gunakan relay dengan rating arus/tegangan yang sesuai load.
> - Gunakan sekring/fuse sesuai kebutuhan.
> - Pastikan seluruh sistem terlindungi dengan proteksi yang memadai.
> - Jangan membangun wiring PLN berdasarkan asumsi; ikuti peraturan instalasi listrik yang berlaku.

## 7. Kebutuhan Power Summary

| Komponen | Tegangan | Arus (perkiraan) |
|----------|----------|------------------|
| ESP32 | 5V (USB) / 3.3V | 200-500 mA |
| DS3231 | 3.3V - 5V | < 1mA |
| DFPlayer | 5V | 30-500 mA |
| PCM5102A | 3.3V / 5V | ≤ 30 mA |
| Relay 2ch | 5V | 50-150 mA (sesuai modul) |
| Total (perkiraan) | 5V | ~1A |

> Estimasi total di atas bukan spesifikasi final — verifikasi sesuai modul yang digunakan.

## 8. Lingkungan Operasi

- Board dan relay pastikan di dalam enclosure / box yang memenuhi kondisi.
- Jauhkan dari air, debu, dan cara langsung.
- Ventilasi cukup jika berada di lingkungan panas.

## 9. Referensi

- [Pinout Documentation](./pinout.md)
- [Architecture](./architecture.md)
- [Firmware Architecture](./firmware-architecture.md)
- [System Architecture](./architecture.md)