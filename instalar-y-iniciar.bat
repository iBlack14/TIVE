@echo off
chcp 65001 > nul
title Servicio de Certificados - Bot Telegram

echo.
echo ============================================
echo   SERVICIO DE CERTIFICADOS CON BOT TELEGRAM
echo ============================================
echo.
echo   Bot: @tive_odiseabot
echo   Web: http://localhost:3000
echo.

REM Verificar si Node.js está instalado
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js no está instalado!
    echo.
    echo Descárgalo desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js detectado
echo.
echo ============================================
echo   📦 Instalando dependencias...
echo ============================================
echo.

call npm install

if %errorlevel% neq 0 (
    echo.
    echo ERROR durante la instalación!
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Dependencias instaladas!
echo.
echo ============================================
echo   🚀 Iniciando servicios...
echo ============================================
echo.
echo   📌 Web: http://localhost:3000
echo   🤖 Bot: @tive_odiseabot
echo   📁 Archivos: servicio\verCertificado\
echo.
echo   Presiona Ctrl+C para detener
echo.
echo ============================================
echo.

call npm run all

pause
