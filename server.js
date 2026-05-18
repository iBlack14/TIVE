const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Ruta donde se guardarán los PDFs (desde el bot)
// ✅ Después
const uploadDir = path.join(__dirname, 'servicio', 'verCertificado', 'Tive');

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


// Ruta para visualizar un certificado específico (Soporta múltiples formatos de URL)
app.get(['/verCertificado/:hash', '/servicio/verCertificado/Tive/:hash'], (req, res) => {
  const hash = req.params.hash.toUpperCase();
  const fileName = `${hash}.pdf`;
  const filePath = path.join(uploadDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Certificado no encontrado');
  }

  // Detectar si es un dispositivo móvil
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (isMobile) {
    // EN CELULAR: Forzar la descarga automática
    res.download(filePath, fileName);
  } else {
    // EN PC: Mostrar el PDF directamente en el navegador (como en tu captura)
    res.setHeader('Content-Disposition', `inline; filename="TIVE_${hash}.pdf"`);
    res.contentType("application/pdf");
    res.sendFile(filePath);
  }
});


// Servir archivos PDF directamente si es necesario
app.use('/servicio/verCertificado', express.static(uploadDir));

// Iniciar servidor escuchando en todas las interfaces (necesario para Docker/Easypanel)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en el puerto: ${PORT}`);
  console.log(`📁 Archivos guardándose en: ${uploadDir}`);
});

