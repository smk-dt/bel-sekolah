# SMART BELL IoT - Pinout Documentation

## 1. Ringkasan Pinout Final

| GPIO ESP32 | Fungsi | Koneksi | Arah |
|------------|--------|---------|------|
| GPIO21 | I2C SDA | DS3231 RTC → SDA | Dua arah |
| GPIO22 | I2C SCL | DS3231 RTC → SCL | Dua arah |
| GPIO17 | UART2 TX | DFPlayer Mini → RX | ESP32 → DFPlayer |
| GPIO16 | UART2 RX | DFPlayer Mini ← TX | DFPlayer → ESP32 |
| GPIO27 | Input BUSY | DFPlayer Mini → BUSY | DFPlayer → ESP32 |
| GPIO25 | Relay 1 | Relay 1 Control | ESP32 → Relay |
| GPIO26 | Relay 2 | Relay 2 Control | ESP32 → Relay |
| GPIO32 | I2S BCK | PCM5102A → BCK (Bit Clock) | ESP32 → PCM5102A |
| GPIO33 | I2S LCK | PCM5102A → LCK (Word Select) | ESP32 → PCM5102A |
| GPIO23 | I2S DIN | PCM5102A → DIN (Data In) | ESP32 → PCM5102A |
| GPIO2 | Built-in LED | Onboard LED | Output |

> [!NOTE] Pin I2S dipilih berdasarkan silikon ESP32:
> - GPIO32, GPIO33, GPIO25, GPIO26 dapat dipakai sebagai I2S (VSPI/I2S0 virtual).
> - GPIO23 juga mendukung I2S output dan aman dipakai.
> - SCK/MCLK (GPIO0) **TIDAK digunakan** — library ESP32 Arduino I2S dapat berjalan tanpa MCLK eksternal untuk PCM5102A.
> - Konfigurasi final I2S akan disesuaikan dengan library dan pengujian audio (Phase 9-10).

## 2. Fungsi Pin

### 2.1 RTC DS3231 (I2C)

| ESP32 Pin | DS3231 Pin |
|-----------|------------|
| GPIO21 (SDA) | SDA |
| GPIO22 (SCL) | SCL |
| 3.3V | VCC |
| GND | GND |

> RTC DS3231 menggunakan I2C dengan alamat 0x68.
> Gunakan pull-up I2C (biasanya sudah tersedia di modul).

### 2.2 DFPlayer Mini (UART2)

| ESP32 Pin | DFPlayer Pin | Keterangan |
|-----------|--------------|------------|
| GPIO17 (TX2) | RX | Perintah play/volume dikirim ke DFPlayer |
| GPIO16 (RX2) | TX | Feedback/reply dari DFPlayer |
| GPIO27 | BUSY | 0 = audio sedang diputar, 1 = idle/selesai |
| VCC (5V) | VCC | Daya DFPlayer |
| GND | GND | Ground |

> Baudrate DFPlayer: **9600**.
> BUSY DFPlayer: aktif rendah (LOW saat lagu sedang diputar).

### 2.3 PCM5102A (I2S DAC)

| ESP32 Pin | PCM5102A Pin | Keterangan |
|-----------|--------------|------------|
| GPIO32 | BCK (BCLK) | Bit Clock I2S |
| GPIO33 | LCK (LRCLK/WS) | Word Select / Left-Right Clock |
| GPIO23 | DIN (DATA) | Data audio I2S |
| 3.3V / 5V | VIN | Daya modul (cek spesifikasi modul Anda) |
| GND | GND | Ground |
| - | SCK (MCLK) | **TIDAK dipakai** (library ESP32 I2S tanpa MCLK) |

> **PENTING:** VIN PCM5102A — jangan berasumsi. Banyak modul PCM5102A menerima 3.3V–5V dan memiliki regulator onboard, tetapi **periksa spesifikasi modul Anda sebelum wiring final**.
> Jika modul membutuhkan MCLK/SCK, alternatifnya gunakan GPIO0 sebagai MCLK dan sesuaikan library — keputusan ditentukan saat pengujian audio (Phase 9).

### 2.4 Relay (2-Channel)

| ESP32 Pin | Relay Module | Keterangan |
|-----------|--------------|------------|
| GPIO25 | IN1 (Relay 1) | Kontrol listrik mixer (sesuai fungsi) |
| GPIO26 | IN2 (Relay 2) | Kontrol mixer (sesuai fungsi) |
| GND | GND | Ground |
| 5V | VCC | Daya relay |

> Opsional konfigurasi: tergantung modul relay Anda, aktif LOW atau HIGH.
> Gunakan pull-up/pull-down secara tepat agar relay aman saat boot ESP32.

### 2.5 LED Built-in

| GPIO | Fungsi |
|------|--------|
| GPIO2 | LED indikator pada board |

## 3. Tabel Lengkap GPIO ESP32

| GPIO | Pin Sign | Fungsi | Tidak boleh dipakai |
|------|----------|--------|---------------------|
| 0 | GPIO0 | Boot mode / MCLK (opsional) | Wajib HIGH saat boot |
| 1 | TX0 | Serial debug | - |
| 2 | GPIO2 | Onboard LED | - |
| 3 | RX0 | Serial debug | - |
| 4 | GPIO4 | Tersedia | - |
| 5 | GPIO5 | Tersedia | - |
| 12 | GPIO12 | Tersedia | AD converter |
| 13 | GPIO13 | Tersedia | - |
| 14 | GPIO14 | Tersedia | - |
| 15 | GPIO15 | Tersedia | - |
| 16 | GPIO16 / RX2 | UART2 RX (DFPlayer) | Dipakai |
| 17 | GPIO17 / TX2 | UART2 TX (DFPlayer) | Dipakai |
| 18 | GPIO18 | Tersedia | - |
| 19 | GPIO19 | Tersedia | - |
| 21 | GPIO21 | SDA (DS3231) | Dipakai |
| 22 | GPIO22 | SCL (DS3231) | Dipakai |
| 23 | GPIO23 | I2S DIN (PCM5102A) | Dipakai |
| 25 | GPIO25 | Relay 1 | Dipakai |
| 26 | GPIO26 | Relay 2 | Dipakai |
| 27 | GPIO27 | DFPlayer BUSY | Dipakai |
| 32 | GPIO32 | I2S BCK (PCM5102A) | Dipakai |
| 33 | GPIO33 | I2S LCK (PCM5102A) | Dipakai |
| 34 | GPIO34 | Tersedia (input only) | - |
| 35 | GPIO35 | Tersedia (input only) | - |

## 4. Pertimbangan Pembatasan GPIO

- GPIO 0, 2, 12, 15 memiliki perilaku khusus saat boot — hati-hati. GPIO2 dipakai LED.
- GPIO34-39 adalah input-only (tidak dapat digunakan sebagai output).
- GPIO16/17 dipakai sebagai serial UART2 untuk DFPlayer.
- GPIO21/22 dipakai I2C untuk DS3231 — jangan diganti kecuali ada alasan kuat.
- GPIO32/33/23 dipakai I2S untuk PCM5102A (Voice Note & PTT) — jangan diganti kecuali ada alasan kuat.
- GPIO25/26 dipakai relay — jangan diganti tanpa alasan kuat.

## 5. Wiring Power & Ground

```
[5V Power Supply]
    │
    ├──+ 5V ──► ESP32 VIN
    ├──+ 5V ──► DFPlayer VCC
    ├──+ 5V ──► Relay VCC
    │
    ├── GND ──► ESP32 GND
    ├── GND ──► DFPlayer GND
    ├── GND ──► Relay GND
    ├── GND ──► DS3231 GND
    └── GND ──► PCM5102A GND
```

> VIN PCM5102A: cek spesifikasi modul (3.3V atau 5V).

## 6. Diagram Audio (Dua Jalur Menuju Mixer)

```
JALUR 1 — Voice Note & PTT:
ESP32
  GPIO32 ──► BCK  ─┐
  GPIO33 ──► LCK  ─┼─► PCM5102A (I2S DAC) ──► AUX INPUT 1 ──► Mixer TOA ──► Speaker
  GPIO23 ──► DIN  ─┘

JALUR 2 — Bel Otomatis:
DFPlayer Mini (MicroSD)
  DAC_R / DAC_L ──► AUX INPUT 2 ──► Mixer TOA ──► Speaker
```

> JANGAN menggabungkan output L/R dua perangkat audio secara langsung.
> Gunakan input mixer (AUX 1 & AUX 2) sebagai tempat penggabungan sumber audio.

## 7. Troubleshooting

| Masalah | Penyebab Kemungkinan | Solusi |
|---------|-----------------------|--------|
| RTC tidak terdeteksi | SDA/SCL tertukar | Pastikan GPIO21 (SDA) ke pin SDA. GPIO22 (SCL) ke pin SCL |
| DFPlayer tidak merespon | TX/RX tertukar | GPIO17 → RX DFPlayer, GPIO16 ← TX DFPlayer |
| Audio bel tidak mau diputar | BUSY tidak dibaca | Pastikan GPIO27 dipasang ke pin BUSY DFPlayer |
| Relay tidak aktif | Aktif LOW/HIGH modul salah | Cek modul relay, sesuaikan polaritas |
| Tidak ada suara PCM5102A | Pin I2S salah / SCK tidak sesuai | Cek GPIO32 (BCK), GPIO33 (LCK), GPIO23 (DIN); verifikasi dengan test tone (TES 1) |
| Suara PCM5102A berisik | Ground tidak sama / VIN salah | Pastikan semua GND satu ground; cek tegangan VIN modul |
| LED menyala terus | GPIO2 dibiarkan LOW saat boot? | Cek logika inisialisasi onboard LED |

## 8. Referensi

- [Hardware Documentation](./hardware.md)
- [Firmware Architecture](./firmware-architecture.md)
- [System Architecture](./architecture.md)

---

> Catatan: Pinout ini adalah keputusan fase 1. Jika hardware Anda berbeda (misal pin tidak cocok), koreksi sebelum masuk ke firmware.