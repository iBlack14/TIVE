# 🌐 Deployment a Coolify

## 📋 Requisitos Previos

1. Cuenta en Coolify
2. Proyecto en GitHub o GitLab
3. Dominio configurado (ej: `midominio.com`)

## 📤 Paso 1: Preparar el Repositorio

Antes de subir el proyecto, asegúrate de que el `.env` tenga valores dummy:

```env
TELEGRAM_BOT_TOKEN=8651888269:AAH8Yh8vpvX_NmjHqeVReCjlA-Tq_B1CcNc
DOMAIN_URL=http://localhost:3000
PORT=3000
```

Verifica que `.gitignore` contiene:
```
node_modules/
.env
*.pdf
servicio/verCertificado/*.pdf
```

Luego push a tu repositorio:
```bash
git add .
git commit -m "Initial commit: Certificados bot"
git push origin main
```

## 🚀 Paso 2: Crear Servicio en Coolify

1. Abre tu dashboard de Coolify
2. Click en **"New Service"**
3. Selecciona **"Docker Compose"** o **"Node.js"**
4. Conecta tu repositorio GitHub/GitLab
5. Selecciona la rama (main/master)

## ⚙️ Paso 3: Configurar Variables de Entorno

En Coolify, ve a **"Environment Variables"** y agrega:

```
TELEGRAM_BOT_TOKEN=8651888269:AAH8Yh8vpvX_NmjHqeVReCjlA-Tq_B1CcNc
DOMAIN_URL=https://tu-dominio.com
PORT=3000
NODE_ENV=production
```

⚠️ Cambia `tu-dominio.com` por tu dominio real

## 🔧 Paso 4: Configurar Comando de Inicio

En **"Build Command"** o **"Startup Command"**, usa:

```bash
npm install && npm run all
```

O si prefieres solo el servidor sin bot:

```bash
npm install && npm start
```

## 📁 Paso 5: Configurar Volúmenes (Persistencia)

Para que los PDFs se guarden permanentemente, agrega un volumen:

- **Ruta origen:** `/app/servicio/verCertificado`
- **Ruta destino:** `/data/certificados`

O en `docker-compose.yml`:

```yaml
volumes:
  - /data/certificados:/app/servicio/verCertificado
```

## 🌍 Paso 6: Configurar Dominio

1. En Coolify, ve a **"Domains"**
2. Agrega tu dominio: `tu-dominio.com`
3. Configura DNS en tu proveedor apuntando a Coolify
4. Coolify generará certificado SSL automáticamente

## ✅ Paso 7: Deploy

1. Click en **"Deploy"** o **"Redeploy"**
2. Espera a que compile (2-5 minutos)
3. Verifica en **"Logs"** que todo está bien

## 🧪 Paso 8: Test

### Test Web
```
https://tu-dominio.com
```

### Test Bot
1. Telegram → @tive_odiseabot
2. Envía `/start`
3. Envía un PDF
4. Recibirás un QR con: `https://tu-dominio.com/servicio/verCertificado/[HASH].pdf`

## 📊 Monitoreo

En Coolify puedes ver:
- **Logs en tiempo real**
- **Uso de CPU/RAM**
- **Estado del servicio**

## 🔄 Actualizar Código

Simplemente haz push a tu repositorio. Coolify detectará el cambio y redeployará automáticamente (si lo configuraste así).

## 🆘 Troubleshooting

### El bot no responde
- Verifica que `npm run all` está ejecutándose
- Revisa logs en Coolify
- Confirma que el token es correcto

### Errores de DOMAIN_URL
- Revisa que la variable está bien configurada
- Reinicia el servicio
- Verifica que el dominio es accesible

### No se guardan archivos
- Verifica que el volumen está bien configurado
- Revisa permisos de la carpeta
- Ve a logs del servidor

### QR apunta a localhost
- Cambia `DOMAIN_URL` a tu dominio real
- Redeploy el servicio

## 📞 Soporte

Si hay problemas:
1. Revisa los logs en Coolify
2. Verifica variables de entorno
3. Prueba localmente primero
4. Contacta a soporte de Coolify

---

**Notas importantes:**
- El bot funciona 24/7 con polling
- Los PDFs se guardan por SHA-256 del contenido
- Cada PDF único genera un QR único
- El almacenamiento es persistente si configuras volúmenes
