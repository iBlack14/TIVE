const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { PDFDocument } = require('pdf-lib');
require('dotenv').config();

// Validar variables de entorno
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DOMAIN = process.env.DOMAIN_URL || 'localhost:3000';
const ADMIN_ID = process.env.ADMIN_ID;

// Configuración QR en PDF
const QR_X = parseInt(process.env.QR_X) || 450;
const QR_Y = parseInt(process.env.QR_Y) || 50;
const QR_SIZE = parseInt(process.env.QR_SIZE) || 100;

if (!BOT_TOKEN) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN no está definido en .env');
  process.exit(1);
}

// Función para verificar si el usuario es el administrador
const isAuthorized = (msg) => {
  if (!ADMIN_ID) return true; 
  const userId = msg.from.id.toString();
  return userId === ADMIN_ID.toString();
};

// Crear bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const uploadDir = path.join(__dirname, 'servicio', 'verCertificado');

// Crear carpeta si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

console.log(`✅ Bot iniciado`);
console.log(`👤 Admin Autorizado: ${ADMIN_ID || 'Todos'}`);
console.log(`📍 QR Posición: X:${QR_X}, Y:${QR_Y}, Size:${QR_SIZE}`);

// Comando /start
bot.onText(/\/start/, (msg) => {
  if (!isAuthorized(msg)) {
    return bot.sendMessage(msg.chat.id, '🚫 Acceso denegado.');
  }
  bot.sendMessage(msg.chat.id, '👋 Envíame un PDF y le insertaré su propio QR de verificación.');
});

// Procesar archivos PDF
bot.on('document', async (msg) => {
  if (!isAuthorized(msg)) return;

  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;

  if (!fileName.toLowerCase().endsWith('.pdf')) {
    return bot.sendMessage(chatId, '❌ Por favor, envía un archivo PDF.');
  }

  try {
    bot.sendMessage(chatId, '⏳ Generando certificado auto-verificable...');

    // Descargar archivo a buffer en lugar de archivo temporal directo
    const fileStream = bot.getFileStream(fileId);
    const chunks = [];
    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    // Calcular Hash SHA-256
    const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex').toUpperCase();
    const displayUrl = `${DOMAIN}/ver/${hash}`;

    // Generar imagen QR en Buffer (Negro puro)
    const qrImageBuffer = await QRCode.toBuffer(displayUrl, {
      margin: 0,
      width: 400,
      color: { dark: '#000000', light: '#ffffff' }
    });

    // --- MAGIA: Editar PDF con pdf-lib ---
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Embeber la imagen del QR en el PDF
    const qrImage = await pdfDoc.embedPng(qrImageBuffer);
    
    // Dibujar el QR en la posición configurada
    firstPage.drawImage(qrImage, {
      x: QR_X,
      y: QR_Y,
      width: QR_SIZE,
      height: QR_SIZE,
    });

    // Guardar el PDF modificado
    const modifiedPdfBytes = await pdfDoc.save();
    const finalFileName = `${hash}.pdf`;
    const finalPath = path.join(uploadDir, finalFileName);

    fs.writeFileSync(finalPath, modifiedPdfBytes);

    // Enviar el PDF modificado de vuelta al usuario
    await bot.sendDocument(chatId, finalPath, {
      caption: 
        '✅ *Certificado Listo*\n\n' +
        `🔐 Hash: \`${hash}\`\n` +
        `🔗 Link: ${displayUrl}\n\n` +
        'El QR ha sido insertado en el documento.',
      parse_mode: 'Markdown'
    });

    console.log(`✅ PDF Editado y Guardado: ${finalFileName}`);

  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    console.error('Error:', error);
  }
});


// Manejo de errores
bot.on('polling_error', (error) => {
  console.error('❌ Error de polling:', error.code);
});

console.log('🤖 Bot de Telegram corriendo...');
console.log(`📞 Bot: @tive_odiseabot`);
