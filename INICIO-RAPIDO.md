## 🚀 INICIO RÁPIDO

### Opción 1: Comando Simple (Windows)

```powershell
cd c:\Users\via\Desktop\web
npm install
npm run all
```

Luego:
- 🌐 Web: http://localhost:3000
- 🤖 Bot: Abre Telegram → @tive_odiseabot → Envía `/start`

---

### Opción 2: Doble Clic (Windows)

Haz doble clic en **`instalar-y-iniciar.bat`** y sigue las instrucciones.

---

### Opción 3: PowerShell

```powershell
.\install.ps1
```

Luego:
```powershell
npm run all
```

---

## 📱 Test del Bot

1. Abre Telegram
2. Busca: `@tive_odiseabot`
3. Envía `/start`
4. Envía un PDF
5. ¡Recibirás el QR!

---

## 🌐 Cambiar Dominio (Para Coolify)

```powershell
.\configurar-dominio.ps1
```

O edita `.env`:
```
DOMAIN_URL=https://tu-dominio.com
```

---

## 📊 Ver Logs

Cuando ejecutes `npm run all`, verás:
```
✅ Bot iniciado
📱 Token: 8651888269...
🌐 Dominio: http://localhost:3000
[servidor express en puerto 3000]
```

---

## ✅ Listo!

- **Servidor web**: http://localhost:3000
- **Bot Telegram**: @tive_odiseabot
- **Archivos**: `servicio/verCertificado/`
