Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  🔧 Configurar Dominio para Coolify" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$domain = Read-Host "Ingresa tu dominio (ej: midominio.com)"

if ([string]::IsNullOrEmpty($domain)) {
    Write-Host "❌ El dominio no puede estar vacío" -ForegroundColor Red
    exit
}

$envContent = @"
# Bot de Telegram
TELEGRAM_BOT_TOKEN=8651888269:AAH8Yh8vpvX_NmjHqeVReCjlA-Tq_B1CcNc

# Dominio configurado para Coolify
DOMAIN_URL=$domain

# Puerto del servidor
PORT=3000
"@

$envContent | Out-String | Set-Content -Path ".env" -Encoding UTF8

Write-Host ""
Write-Host "✅ Configuración actualizada!" -ForegroundColor Green
Write-Host "🌐 Dominio: $domain" -ForegroundColor Green
Write-Host ""
Write-Host "Ejecuta: npm install && npm run all" -ForegroundColor Yellow
