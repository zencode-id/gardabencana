# ============================================================
#  Script: setup-android-env.ps1
#  Fungsi: Set ANDROID_HOME & PATH untuk React Native / Expo
#  Cara pakai: Klik kanan -> "Run with PowerShell" (as Admin)
#              atau jalankan di terminal: .\scripts\setup-android-env.ps1
# ============================================================

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  SETUP ANDROID ENVIRONMENT VARIABLE" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Path Android SDK default (setelah install Android Studio)
$AndroidSdkPath = "$env:LOCALAPPDATA\Android\Sdk"

# Cek apakah folder Android SDK sudah ada
if (Test-Path $AndroidSdkPath) {
    Write-Host "[OK] Android SDK ditemukan di: $AndroidSdkPath" -ForegroundColor Green
} else {
    Write-Host "[WARN] Android SDK belum ditemukan di: $AndroidSdkPath" -ForegroundColor Yellow
    Write-Host "       Pastikan Android Studio sudah terinstall!" -ForegroundColor Yellow
    Write-Host "       Download: https://developer.android.com/studio" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Tetap mau set environment variable sekarang? (y/n): " -NoNewline -ForegroundColor White
    $answer = Read-Host
    if ($answer -ne 'y' -and $answer -ne 'Y') {
        Write-Host "Dibatalkan. Silakan install Android Studio terlebih dahulu." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Setting ANDROID_HOME..." -ForegroundColor Yellow

# Set ANDROID_HOME sebagai System Environment Variable (permanen)
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $AndroidSdkPath, "User")
Write-Host "[OK] ANDROID_HOME = $AndroidSdkPath" -ForegroundColor Green

# Path yang perlu ditambahkan ke PATH
$pathsToAdd = @(
    "$AndroidSdkPath\platform-tools",
    "$AndroidSdkPath\tools",
    "$AndroidSdkPath\tools\bin",
    "$AndroidSdkPath\emulator"
)

Write-Host ""
Write-Host "Menambahkan ke PATH..." -ForegroundColor Yellow

# Ambil PATH user saat ini
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$pathEntries = $currentPath -split ";" | Where-Object { $_ -ne "" }

$addedCount = 0
foreach ($newPath in $pathsToAdd) {
    if ($pathEntries -notcontains $newPath) {
        $pathEntries += $newPath
        Write-Host "[ADDED] $newPath" -ForegroundColor Green
        $addedCount++
    } else {
        Write-Host "[SKIP]  $newPath (sudah ada)" -ForegroundColor Gray
    }
}

# Simpan PATH baru
$newPath = $pathEntries -join ";"
[System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  SELESAI! $addedCount path baru ditambahkan." -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "PENTING: Tutup & buka ulang terminal/PowerShell agar" -ForegroundColor Yellow
Write-Host "         perubahan environment variable berlaku!" -ForegroundColor Yellow
Write-Host ""

# Verifikasi
Write-Host "Verifikasi (buka terminal baru dan jalankan):" -ForegroundColor Cyan
Write-Host '  echo $env:ANDROID_HOME' -ForegroundColor White
Write-Host '  adb --version' -ForegroundColor White
Write-Host ""

Read-Host "Tekan Enter untuk menutup"
