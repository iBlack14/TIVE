@echo off
setlocal enabledelayedexpansion

chcp 65001 > nul
echo.
echo ============================================
echo   🔧 Configurar Dominio para Coolify
echo ============================================
echo.

set /p DOMAIN="Ingresa tu dominio (ej: midominio.com): "

if "%DOMAIN%"=="" (
    echo ❌ El dominio no puede estar vacío
    pause
    exit /b 1
)

REM Actualizar .env
(
    echo # Bot de Telegram
    echo TELEGRAM_BOT_TOKEN=8651888269:AAH8Yh8vpvX_NmjHqeVReCjlA-Tq_B1CcNc
    echo.
    echo # Dominio configurado para Coolify
    echo DOMAIN_URL=%DOMAIN%
    echo.
    echo # Puerto del servidor
    echo PORT=3000
) > .env

echo.
echo ✅ Configuración actualizada!
echo 🌐 Dominio: %DOMAIN%
echo.
echo Ejecuta: npm install && npm all
echo.
pause
