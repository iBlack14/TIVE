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


// Ruta para visualizar un certificado específico
app.get('/ver/:hash', (req, res) => {
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
    res.contentType("application/pdf");
    res.sendFile(filePath);
  }
});


// Servir archivos PDF directamente si es necesario
app.use('/servicio/verCertificado', express.static(uploadDir));

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📁 Archivos guardándose en: ${uploadDir}`);
});

