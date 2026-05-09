const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Ruta donde se guardarán los PDFs
const uploadDir = path.join(__dirname, 'servicio', 'verCertificado');

// Crear carpeta si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Leer el contenido del archivo
    const fileBuffer = file.buffer;
    // Crear hash SHA-256 del contenido
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex').toUpperCase();
    // Renombrar con hash + extensión original
    const ext = path.extname(file.originalname);
    cb(null, `${hash}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Solo permitir PDFs
    if (path.extname(file.originalname).toLowerCase() === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  }
});

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta para subir archivo
app.post('/upload', upload.single('pdf'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió archivo' });
  }
  
  res.json({
    success: true,
    message: 'Archivo subido exitosamente',
    filename: req.file.filename,
    path: `/servicio/verCertificado/${req.file.filename}`
  });
});

// Ruta para listar archivos subidos
app.get('/archivos', (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Error al leer carpeta' });
    }
    
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    res.json({
      total: pdfFiles.length,
      archivos: pdfFiles
    });
  });
});

// Servir el formulario HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Servir archivos PDF
app.use('/servicio/verCertificado', express.static(uploadDir));

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📁 Archivos guardándose en: ${uploadDir}`);
});
