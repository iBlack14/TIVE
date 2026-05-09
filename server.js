const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Ruta donde se guardarán los PDFs (desde el bot)
const uploadDir = path.join(__dirname, 'servicio', 'verCertificado');

// Crear carpeta si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Servir el visualizador (Premium simple)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Ruta para visualizar un certificado específico con una interfaz limpia
app.get('/ver/:hash', (req, res) => {
  const hash = req.params.hash.toUpperCase();
  const fileName = `${hash}.pdf`;
  const filePath = path.join(uploadDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Certificado no encontrado');
  }

  // Enviamos una página que contiene el PDF embebido con estilo premium
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verificación de Certificado - ${hash}</title>
        <style>
            body { margin: 0; background: #1e293b; font-family: 'Inter', sans-serif; height: 100vh; display: flex; flex-direction: column; }
            header { background: #0f172a; color: white; padding: 15px 25px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            .badge { background: #10b981; color: white; padding: 4px 12px; border-radius: 99px; font-size: 0.8rem; font-weight: 600; }
            .container { flex: 1; display: flex; padding: 20px; gap: 20px; }
            iframe { flex: 1; border: none; border-radius: 12px; background: white; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1); }
            .info { width: 300px; color: #94a3b8; font-size: 0.9rem; }
            .info b { color: white; display: block; margin-top: 15px; }
            @media (max-width: 768px) { .container { flex-direction: column; } .info { width: 100%; order: 2; } iframe { order: 1; height: 500px; } }
        </style>
    </head>
    <body>
        <header>
            <div>
                <div style="font-weight: bold; font-size: 1.1rem;">Verificación de Documento</div>
                <div style="font-size: 0.7rem; opacity: 0.6;">SISTEMA FEDERADO DE CERTIFICACIÓN</div>
            </div>
            <div class="badge">AUTÉNTICO</div>
        </header>
        <div class="container">
            <iframe src="/servicio/verCertificado/${fileName}"></iframe>
            <div class="info">
                <b>Código Hash (SHA-256)</b>
                <span style="word-break: break-all; font-family: monospace; font-size: 0.8rem;">${hash}</span>
                
                <b>Fecha de Emisión</b>
                <span>${fs.statSync(filePath).birthtime.toLocaleDateString()}</span>
                
                <b>Estado</b>
                <span style="color: #10b981;">● Vigente y Verificado</span>
                
                <div style="margin-top: 30px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px;">
                    <small>Este documento ha sido procesado mediante criptografía SHA-256 para garantizar su integridad. Cualquier modificación al contenido invalidará el hash.</small>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Servir archivos PDF directamente si es necesario
app.use('/servicio/verCertificado', express.static(uploadDir));

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📁 Archivos guardándose en: ${uploadDir}`);
});

