const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const https = require('https');
require('dotenv').config();

// Validar variables de entorno
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DOMAIN = process.env.DOMAIN_URL || 'localhost:3000';

if (!BOT_TOKEN) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN no está definido en .env');
  process.exit(1);
}

// Crear bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const uploadDir = path.join(__dirname, 'servicio', 'verCertificado');

// Crear carpeta si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

console.log(`✅ Bot iniciado`);
console.log(`📱 Token: ${BOT_TOKEN.substring(0, 10)}...`);
console.log(`🌐 Dominio: ${DOMAIN}`);

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    '👋 ¡Hola! Soy tu bot de certificados.\n\n' +
    '📄 Envíame un PDF y te generaré:\n' +
    '✅ Hash SHA-256\n' +
    '✅ QR de descarga\n\n' +
    '📝 Comandos:\n' +
    '/start - Mostrar este mensaje\n' +
    '/help - Ayuda\n\n' +
    '💡 Solo envía un archivo PDF'
  );
});

// Comando /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    '📖 *Cómo usar el bot:*\n\n' +
    '1️⃣ Envía un PDF\n' +
    '2️⃣ El bot lo procesará\n' +
    '3️⃣ Recibirás un QR con el link de descarga\n\n' +
    '🔒 *Seguridad:*\n' +
    '- Cada PDF se renombra con SHA-256\n' +
    '- Identificadores únicos por contenido\n' +
    '- Los archivos se guardan en el servidor\n\n' +
    '📞 Soporte: @tive_odiseabot',
    { parse_mode: 'Markdown' }
  );
});

// Procesar archivos PDF
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;

  // Validar que sea PDF
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    bot.sendMessage(chatId, '❌ Solo acepto archivos PDF. Por favor, envía un PDF válido.');
    return;
  }

  try {
    // Mostrar que está procesando
    bot.sendMessage(chatId, '⏳ Procesando tu PDF...');

    // Descargar archivo
    const file = await bot.getFile(fileId);
    const fileStream = bot.getFileStream(fileId);

    // Guardar archivo temporalmente
    const tempFile = path.join(__dirname, 'temp_upload.pdf');
    const writeStream = fs.createWriteStream(tempFile);

    fileStream.pipe(writeStream);

    writeStream.on('finish', async () => {
      // Leer archivo y generar hash
      const fileContent = fs.readFileSync(tempFile);
      const hash = crypto.createHash('sha256').update(fileContent).digest('hex').toUpperCase();
      
      // Nombre final
      const finalFileName = `${hash}.pdf`;
      const finalPath = path.join(uploadDir, finalFileName);

      // Mover archivo
      fs.renameSync(tempFile, finalPath);

      // Generar URL
      const pdfUrl = `${DOMAIN}/servicio/verCertificado/${finalFileName}`;

      // Generar QR
      const qrPath = path.join(__dirname, 'temp_qr.png');
      await QRCode.toFile(qrPath, pdfUrl, {
        color: {
          dark: '#000',
          light: '#fff'
        },
        width: 300,
        margin: 2
      });

      // Enviar QR
      await bot.sendPhoto(chatId, qrPath, {
        caption: 
          '✅ *Certificado procesado*\n\n' +
          `📄 Archivo: \`${finalFileName}\`\n` +
          `🔗 Link: \`${pdfUrl}\`\n` +
          `🔐 Hash: \`${hash}\`\n\n` +
          '📱 Escanea el QR para descargar',
        parse_mode: 'Markdown'
      });

      // Limpiar temporal
      fs.unlinkSync(qrPath);

      console.log(`✅ PDF procesado: ${finalFileName}`);
    });

    writeStream.on('error', (err) => {
      bot.sendMessage(chatId, `❌ Error al procesar: ${err.message}`);
      console.error('Error:', err);
    });

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
