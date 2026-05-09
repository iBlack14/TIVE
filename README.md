# 📄 Servicio de Certificados con Bot de Telegram

Sistema completo Node.js para subir certificados PDF, renombrarlos con SHA-256 y generar QR automáticamente mediante Telegram.

## ¿Cómo funciona?

### Flujo:
1. **Subes PDF a Telegram** → @tive_odiseabot
2. **Sistema procesa** → Genera hash SHA-256
3. **Archivo se guarda** → `D6912C854AF13DEAA10A3A6E910B6382.pdf`
4. **Genera QR** → Link descargable
5. **Bot devuelve QR** → En Telegram

### URL Generada:
```
https://midominio.com/servicio/verCertificado/D6912C854AF13DEAA10A3A6E910B6382.pdf
```

## 📋 Requisitos

- Node.js v14+ instalado
- npm
- Bot de Telegram (@tive_odiseabot)
- Token del Bot (ya incluido)

## 🚀 Instalación

### Opción 1: Instalación Local Rápida

```powershell
cd c:\Users\via\Desktop\web
npm install
npm run all
```

Esto inicia:
- ✅ Servidor web (puerto 3000)
- ✅ Bot de Telegram (polling)

### Opción 2: Por Pasos

```powershell
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor web
npm start

# En otra terminal:
# 3. Iniciar bot de Telegram
npm run bot
```

### Opción 3: Doble Clic (Windows)
Haz doble clic en `instalar-y-iniciar.bat`

## 🌐 Configurar para Coolify

Cuando subas a Coolify, cambia el dominio:

### Opción 1: Archivo .env directo
Edita `.env` y reemplaza:
```
DOMAIN_URL=https://midominio.com
```

### Opción 2: Script automático
```powershell
.\configurar-dominio.ps1
```

O:
```cmd
configurar-dominio.bat
```

Luego:
```powershell
npm run all
```

## 📱 Usando el Bot de Telegram

### Comandos:
- `/start` - Mostrar información
- `/help` - Ayuda completa
- Envía un PDF - Procesa automáticamente

### Ejemplo:
1. Abre Telegram
2. Busca: **@tive_odiseabot**
3. Envía `/start`
4. Envía un archivo PDF
5. ¡Recibirás el QR!

## 📁 Estructura del Proyecto

```
web/
├── server.js                (Servidor Express)
├── bot.js                   (Bot de Telegram)
├── package.json             (Dependencias)
├── .env                     (Variables de entorno)
├── .env.example             (Template)
├── .gitignore               (Archivos ignorados)
├── README.md                (Este archivo)
├── configurar-dominio.ps1   (Script PowerShell)
├── configurar-dominio.bat   (Script Batch)
├── instalar-y-iniciar.bat   (Instalador Windows)
├── public/
│   └── index.html           (Interfaz web)
└── servicio/
    └── verCertificado/      (PDFs guardados)
```

## 🔒 Características

✅ Renombre automático con SHA-256  
✅ Generación de QR automática  
✅ Bot de Telegram integrado  
✅ Validación de PDFs  
✅ Interfaz web moderna  
✅ Drag & drop  
✅ Variables de entorno  
✅ Listo para Coolify  

## 🛠️ Variables de Entorno

Edita `.env`:

```env
# Token del bot (ya configurado)
TELEGRAM_BOT_TOKEN=8651888269:AAH8Yh8vpvX_NmjHqeVReCjlA-Tq_B1CcNc

# Cambia esto según tu dominio
DOMAIN_URL=http://localhost:3000

# Puerto
PORT=3000
```

## 🚀 Deploy a Coolify

1. Sube el proyecto a GitHub/GitLab
2. Crea nuevo servicio en Coolify
3. Selecciona tu repositorio
4. En variables de entorno, configura:
   ```
   TELEGRAM_BOT_TOKEN=8651888269:AAH8Yh8vpvX_NmjHqeVReCjlA-Tq_B1CcNc
   DOMAIN_URL=https://tu-dominio.com
   PORT=3000
   ```
5. Comando de inicio:
   ```
   npm install && npm run all
   ```

## 🔗 Endpoints

### Web
- `GET /` - Interfaz de upload
- `POST /upload` - Subir PDF
- `GET /archivos` - Listar PDFs
- `GET /servicio/verCertificado/:filename` - Descargar PDF

### Bot de Telegram
- `/start` - Iniciar
- `/help` - Ayuda
- Enviar documento PDF - Procesar

## 📊 Respuesta del Bot

```
✅ Certificado procesado

📄 Archivo: D6912C854AF13DEAA10A3A6E910B6382.pdf
🔗 Link: https://midominio.com/servicio/verCertificado/D6912C854AF13DEAA10A3A6E910B6382.pdf
🔐 Hash: D6912C854AF13DEAA10A3A6E910B6382

📱 Escanea el QR para descargar
```

## 🛑 Detener Servicios

Presiona **Ctrl + C** en la terminal

## 📝 Logs

Revisa la consola para ver:
- Archivos subidos
- Hashes generados
- QR creados
- Errores

## 💡 Tips

- Cada PDF con el MISMO contenido generará el MISMO hash
- Si necesitas nombres únicos siempre, usa UUID en lugar de SHA-256
- Los QR apuntan directamente a la URL descargable
- El bot funciona 24/7 (polling)

## 🆘 Troubleshooting

**Bot no responde:**
- Verifica que `bot.js` está ejecutándose
- Revisa que el token es correcto

**Error "DOMAIN_URL no definido":**
- Revisa que `.env` existe
- Ejecuta `npm install` nuevamente

**No se generan QR:**
- Verifica que `qrcode` está instalado
- Revisa permisos de carpeta

---

**Bot:** @tive_odiseabot  
**Soporte:** Contacta a tu desarrollador

