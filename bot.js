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
const ADMIN_ID = process.env.ADMIN_ID;

if (!BOT_TOKEN) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN no está definido en .env');
  process.exit(1);
}

// Función para verificar si el usuario es el administrador
const isAuthorized = (msg) => {
  if (!ADMIN_ID) return true; // Si no hay ADMIN_ID, permitir todo (por defecto)
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
console.log(`📱 Token: ${BOT_TOKEN.substring(0, 10)}...`);
console.log(`👤 Admin Autorizado: ${ADMIN_ID || 'Todos'}`);
console.log(`🌐 Dominio: ${DOMAIN}`);

// Comando /start
bot.onText(/\/start/, (msg) => {
  if (!isAuthorized(msg)) {
    return bot.sendMessage(msg.chat.id, '🚫 Acceso denegado. Este bot es privado.');
  }
  
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    '👋 ¡Hola! Soy tu bot privado de certificados.\n\n' +
    '📄 Envíame un PDF y te generaré:\n' +
    '✅ Hash SHA-256\n' +
    '✅ QR de verificación\n\n' +
    '💡 Solo tú puedes usar este bot.'
  );
});

// Comando /help
bot.onText(/\/help/, (msg) => {
  if (!isAuthorized(msg)) return;
  
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    '📖 *Ayuda Privada:*\n\n' +
    '1️⃣ Envía un PDF\n' +
    '2️⃣ El bot lo renombra con SHA-256\n' +
    '3️⃣ Recibirás un QR con el link oficial de tu web\n\n' +
    '🔒 *Nota:* Nadie más tiene acceso a subir archivos aquí.',
    { parse_mode: 'Markdown' }
  );
});

// Procesar archivos PDF
bot.on('document', async (msg) => {
  if (!isAuthorized(msg)) {
    return bot.sendMessage(msg.chat.id, '🚫 No tienes permiso para subir archivos aquí.');
  }

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
    const fileStream = bot.getFileStream(fileId);

    // Guardar archivo temporalmente con nombre único
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const tempFile = path.join(__dirname, `temp_${uniqueId}.pdf`);
    const writeStream = fs.createWriteStream(tempFile);

    fileStream.pipe(writeStream);

    writeStream.on('finish', async () => {
      // Leer archivo y generar hash
      const fileContent = fs.readFileSync(tempFile);
      const hash = crypto.createHash('sha256').update(fileContent).digest('hex').toUpperCase();
      
      // Nombre final
      const finalFileName = `${hash}.pdf`;
      const finalPath = path.join(uploadDir, finalFileName);

      // Mover archivo (sobrescribir si ya existe el mismo contenido)
      fs.renameSync(tempFile, finalPath);

      // Generar URL de visualización (nueva ruta)
      const displayUrl = `${DOMAIN}/ver/${hash}`;

      // Generar QR
      const qrPath = path.join(__dirname, `qr_${uniqueId}.png`);
      await QRCode.toFile(qrPath, displayUrl, {
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        },
        width: 400,
        margin: 2
      });

      // Enviar QR
      await bot.sendPhoto(chatId, qrPath, {
        caption: 
          '✅ *Certificado procesado*\n\n' +
          `🔐 Hash: \`${hash}\`\n\n` +
          `🔗 Link de Verificación:\n${displayUrl}\n\n` +
          '📱 Escanea el QR para visualizar el documento oficial.',
        parse_mode: 'Markdown'
      });

      // Limpiar temporal
      if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);

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
