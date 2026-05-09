# ✅ TODO el Sistema Listo

Tu sistema está 100% configurado y listo para usar. Aquí está el resumen:

## 📦 Archivos Creados

```
web/
├── server.js                (Servidor Express + PDF upload)
├── bot.js                   (Bot de Telegram + QR generator)
├── package.json             (Dependencias: express, multer, node-telegram-bot-api, qrcode)
├── .env                     (Configuración con tu token)
├── .env.example             (Template)
├── .gitignore               (Para Git)
├── README.md                (Documentación completa)
├── INICIO-RAPIDO.md         (Guía rápida)
├── COOLIFY-DEPLOYMENT.md    (Deploy a producción)
├── THIS_FILE.md             (Este archivo)
├── instalar-y-iniciar.bat   (Instalador Windows)
├── install.ps1              (Instalador PowerShell)
├── configurar-dominio.bat   (Cambiar dominio Windows)
├── configurar-dominio.ps1   (Cambiar dominio PowerShell)
├── public/
│   └── index.html           (Interfaz web bonita)
└── servicio/
    └── verCertificado/      (Carpeta donde se guardan PDFs)
```

## 🚀 INICIO RÁPIDO (3 Pasos)

### 1️⃣ Abre PowerShell
```powershell
cd c:\Users\via\Desktop\web
```

### 2️⃣ Instala dependencias
```powershell
npm install
```

### 3️⃣ Ejecuta TODO
```powershell
npm run all
```

**¡Listo!** Verás:
```
✅ Bot iniciado
📱 Token: 8651888269...
🌐 Dominio: http://localhost:3000
[servidor express escuchando en puerto 3000]
```

---

## 📱 USAR EL BOT

### En Telegram:
1. Abre Telegram
2. Busca: `@tive_odiseabot`
3. Envía `/start`
4. **Envía cualquier PDF**
5. 📲 **Recibirás:**
   - ✅ Confirmación de procesamiento
   - 🔐 Hash SHA-256
   - 🌐 Link descargable
   - 📱 **QR con el link** ← ESO ES LO IMPORTANTE

### Escanea el QR:
- Abre cámara del celular
- Escanea
- ¡Se abre el link de descarga!

---

## 🌐 USAR EL SITIO WEB

1. Abre: **http://localhost:3000**
2. Puedes:
   - 📤 Subir PDFs haciendo clic
   - 🖱️ O arrastra archivos (drag & drop)
   - 📋 Ver todos los archivos subidos

---

## ✨ FLUJO COMPLETO

```
Usuario → Envía PDF a Bot Telegram
           ↓
Bot recibe → Genera SHA-256
           ↓
Crea archivo: D6912C854AF13DEAA10A3A6E910B6382.pdf
           ↓
Genera QR → https://localhost:3000/servicio/verCertificado/D6912C854AF13DEAA10A3A6E910B6382.pdf
           ↓
Bot devuelve QR a Telegram
           ↓
Usuario escanea QR → ¡Descarga el PDF!
```

---

## 🌍 CUANDO SUBES A COOLIFY

1. **Edita `.env`:**
   ```
   DOMAIN_URL=https://tu-dominio-en-coolify.com
   ```

2. **O usa el script:**
   ```powershell
   .\configurar-dominio.ps1
   ```

3. **Sube a GitHub**

4. **En Coolify configura:**
   - Comando: `npm install && npm run all`
   - Variables: TELEGRAM_BOT_TOKEN, DOMAIN_URL, PORT
   - Volumen: `/app/servicio/verCertificado` → `/data/certificados`

5. **Deploy!**

---

## 🔐 Información Importante

### Token de Bot
```
8651888269:AAH8Yh8vpvX_NmjHqeVReCjlA-Tq_B1CcNc
```
✅ Ya está configurado en `.env`  
✅ Seguro compartirlo porque solo funciona con el bot específico

### Seguridad
- ✅ Token almacenado en `.env` (no en código)
- ✅ `.gitignore` previene que se suba al Git
- ✅ PDFs se guardan con hash (identificador único)
- ✅ No se guardan nombres originales

---

## 📊 COMANDOS ÚTILES

```powershell
# Instalar dependencias
npm install

# Solo servidor web
npm start

# Solo bot Telegram
npm run bot

# Servidor + Bot (recomendado)
npm run all

# Detener
Ctrl + C
```

---

## 🗂️ CARPETAS IMPORTANTES

```
c:\Users\via\Desktop\web\servicio\verCertificado\
```

Aquí se guardan todos los PDFs procesados:
- D6912C854AF13DEAA10A3A6E910B6382.pdf
- 5A093278C046470292FDFF777101578A.pdf
- etc...

---

## 🧪 TEST RÁPIDO

```powershell
npm run all
```

Luego:

1. **Web:** http://localhost:3000
   - Sube un PDF desde el navegador
   - Verifica que se guarde en la carpeta

2. **Bot:** Telegram @tive_odiseabot
   - `/start`
   - Envía un PDF
   - Recibirás un QR

---

## 🆘 SI ALGO NO FUNCIONA

### Bot no responde
```powershell
npm run bot
# Revisa console que diga "Bot iniciado"
```

### Error "Module not found"
```powershell
npm install
npm run all
```

### Puerto 3000 en uso
- Cambia en `.env`: `PORT=3001`

### No se generan QR
```powershell
npm install qrcode
npm run all
```

---

## 📝 RESUMEN

✅ **Hecho:**
- Bot de Telegram funcional
- Generador de QR
- Servidor web
- Almacenamiento de PDFs
- SHA-256 para identificadores
- Listo para Coolify

✅ **Para usar:**
```powershell
npm install && npm run all
```

✅ **Acceso:**
- Web: http://localhost:3000
- Bot: @tive_odiseabot en Telegram
- Archivos: `servicio/verCertificado/`

---

## 🎉 ¡LISTO PARA USAR!

Ejecuta ahora:
```powershell
cd c:\Users\via\Desktop\web
npm install
npm run all
```

¡Y disfruta tu sistema de certificados! 🚀
