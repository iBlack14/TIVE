# 📄 Servicio de Certificados TIVE con IA

Sistema avanzado para la generación de tarjetas TIVE de SUNARP, procesamiento con Gemini AI e inserción de códigos QR. Optimizado para despliegue en VPS (Docker/Easypanel).

## 🚀 Guía de Migración y Persistencia (VPS)

Si cambias de servidor o reinstalas el proyecto, sigue estos pasos para no perder tus datos:

### 1. Preparar el Servidor (SSH)
Antes de levantar el bot, crea las carpetas de persistencia física en tu VPS:
```bash
mkdir -p /root/backups_sunarp/certificados /root/backups_sunarp/logs
```

### 2. Configuración de Volúmenes (Docker/Easypanel)
Para que los archivos no se borren al reiniciar el contenedor, debes mapear los volúmenes como **"Bind Mounts"**:

| Tipo | Ruta en el Servidor (Host) | Ruta en el Bot (Container) |
| :--- | :--- | :--- |
| **Bind** | `/root/backups_sunarp/certificados` | `/app/servicio/verCertificado` |
| **Bind** | `/root/backups_sunarp/logs` | `/app/logs` |

### 3. Evitar Conflictos (Error 409)
El bot tiene un **retraso de seguridad de 5-7 segundos** al arrancar. Esto permite que la instancia anterior se apague correctamente antes de que la nueva intente conectarse a Telegram.

---

## 🛠️ Configuración (.env)

| Variable | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Token de tu bot de Telegram | `865188...` |
| `ADMIN_ID` | IDs de administradores autorizados (separados por coma) | `ID1,ID2` |
| `GEMINI_KEYS` | Llaves de Google AI (separadas por coma) | `KEY1,KEY2` |
| `DOMAIN_URL` | URL pública para los códigos QR | `https://tu-dominio.com` |
| `QR_SIZE` | Tamaño del QR en el PDF | `72` |

---

## 📱 Comandos del Bot
- `/start` - Inicia el bot y muestra capacidades.
- `/ping` - Prueba de vida (si responde "PONG", todo está OK).
- **Envío de PDF** - El bot detecta el archivo y ofrece las opciones de IA o Inserción de QR.

## 📁 Estructura Crítica
- `bot.js`: Lógica del bot y procesamiento de imágenes/PDF.
- `server.js`: Servidor web para visualizar los certificados.
- `tarjeta/`: Plantillas base (`adelantexd.pdf`, `atrasxd.pdf`).
- `servicio/verCertificado/`: Carpeta interna donde se guardan los archivos (mapeada al VPS).

---

## 🆘 Solución de Problemas
- **Bot no responde a botones**: El documento en memoria expiró por un reinicio. Vuelve a enviar el PDF.
- **Error 409 Conflict**: Asegúrate de tener solo **1 réplica** en tu panel de control y el **Autoscaling desactivado**.
- **Files no aparecen en VPS**: Verifica que el "Bind Mount" en Easypanel apunte exactamente a `/app/servicio/verCertificado`.

---
**Desarrollado para:** TIVE Pro AI
**Bot:** @tive_odiseabot
**Soporte:** Contacta a tu desarrollador

