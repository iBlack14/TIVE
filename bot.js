process.env.NTBA_FIX_350 = 1;
const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const bwipjs = require('bwip-js');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdf2img = require('pdf-img-convert');
const sharp = require('sharp');
require('dotenv').config();

// Cargar la fuente TTF real una sola vez al iniciar
const FONT_PATH = path.join(__dirname, 'tarjeta', 'font_bold.ttf');
const FONT_BYTES = fs.readFileSync(FONT_PATH);

// --- CONFIGURACIÓN ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const API_KEYS = (process.env.GEMINI_KEYS || "").split(",").map(k => k.trim()).filter(k => k);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const userPdfs = new Map();
const userState = new Map();

// Desactivado temporalmente para permitir trabajar en local sin restricciones de ID
const isAuthorized = (msg) => true; // !ADMIN_ID || msg.from.id.toString() === ADMIN_ID.toString();

const escapeMarkdown = (text) => {
    return text.replace(/[_*`\[]/g, '\\$&');
};

const safe = (t) => t ? String(t).trim() : '';

// --- FUNCIONES TÉCNICAS ---
const C128_PATTERNS = { '0': '11011001100', '1': '11001101100', '2': '11001100110', '3': '10001101100', '4': '10001100110', '5': '10110000110', '6': '10110000110', '7': '10110110000', '8': '10110011011', '9': '11001011000', 'A': '11000101100', 'B': '11000100110', 'C': '11011000100', 'D': '11011000010', 'E': '11011011000', 'F': '11011001101', 'G': '11011011011', 'H': '11001101101', 'I': '11001101111', 'J': '11011110110', 'K': '11011111011', 'L': '11110110110', 'M': '11110110111', 'N': '11110111101', 'O': '11110111111', 'P': '11001101101', 'Q': '11001101111', 'R': '11011110110', 'S': '11011111011', 'T': '11110110110', 'U': '11110110111', 'V': '11110111101', 'W': '11110111111', 'X': '11001101101', 'Y': '11001101111', 'Z': '11011110110', '-': '11000111010', '.': '11011011110', ' ': '11011011011', ':': '11011111010' };

function drawRealBarcode(page, text, x, y, width, height) {
    const startCode = '11010010000'; const stopCode = '1100011101011';
    let pattern = startCode;
    for (let char of (text || '').toUpperCase()) { pattern += C128_PATTERNS[char] || '11011011011'; }
    pattern += stopCode;
    const moduleWidth = width / pattern.length;
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === '1') { page.drawRectangle({ x: x + (i * moduleWidth), y, width: moduleWidth, height, color: rgb(0, 0, 0) }); }
    }
}

function getTemplatePath(name) {
    const p = [path.join(__dirname, 'tarjeta', name), path.join(__dirname, name), path.join(process.cwd(), 'tarjeta', name), path.join(process.cwd(), name)];
    for (const pathFound of p) { if (fs.existsSync(pathFound)) return pathFound; }
    throw new Error(`No se encontró la plantilla ${name}.`);
}

async function extraerConIA(pdfBuffer) {
    console.log(`[IA] 🧠 Iniciando extracción con Gemini (Buffer size: ${pdfBuffer.length} bytes)...`);
    if (API_KEYS.length === 0) throw new Error("Llaves API no configuradas.");
    let lastError = null;
    for (const key of API_KEYS) {
        try {
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const prompt = `Analiza este documento TIVE (Tarjeta de Identificación Vehicular Electrónica) de SUNARP. 
            Extrae TODOS los datos técnicos y registrales. Es CRÍTICO que encuentres la PLACA.
            Devuelve SOLO un objeto JSON con estas llaves exactas:
            zona, sede, partida, dua, titulo, fechaTitulo, placa, codVerif, tituloNo, fechaFinal, categoria, marca, modelo, color, añoModelo, version, vin, serie, motor, carroceria, potencia, formRod, combustible, asientos, pasajeros, ruedas, ejes, cilindros, longitud, altura, ancho, cilindrada, pBruto, pNeto, cargaUtil.
            Si no encuentras un valor, pon cadena vacía.`;

            const result = await model.generateContent([{ inlineData: { data: pdfBuffer.toString("base64"), mimeType: "application/pdf" } }, { text: prompt }]);
            const rawText = result.response.text();
            const parsedData = JSON.parse(rawText.replace(/```json|```/g, "").trim());
            console.log(`[IA] ✅ Extracción exitosa. Placa encontrada: ${parsedData.placa}`);
            console.log(`[IA] 📊 Datos obtenidos:\n`, JSON.stringify(parsedData, null, 2));
            return parsedData;
        } catch (e) {
            console.error(`[IA] ⚠️ Error con una API key:`, e.message);
            lastError = e;
        }
    }
    console.error(`[IA] ❌ Todas las API keys fallaron.`);
    throw lastError;
}

async function generarTIVE(chatId, datos, qrCustomLink = null, originalBuffer = null) {
    console.log(`[TIVE] 🎨 Iniciando generación de tarjetas TIVE para la placa: ${datos.placa || 'N/A'}`);
    const gris = rgb(0.6, 0.6, 0.6);
    const negro = rgb(0, 0, 0);

    // ANVERSO
    const pdfAnt = await PDFDocument.load(fs.readFileSync(getTemplatePath('adelantexd.pdf')));
    pdfAnt.registerFontkit(fontkit);
    const fontBAnt = await pdfAnt.embedFont(FONT_BYTES);
    const pageA = pdfAnt.getPages()[0];
    const { height: hA } = pageA.getSize();
    pageA.drawText(safe(datos.zona), { x: 60, y: hA - 56, size: 5.5, font: fontBAnt, color: gris });
    pageA.drawText(safe(datos.sede), { x: 55, y: hA - 63, size: 5.5, font: fontBAnt, color: gris });
    pageA.drawText(safe(datos.partida), { x: 65, y: hA - 75, size: 6.8, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.dua), { x: 50, y: hA - 89, size: 6.8, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.titulo), { x: 34.5, y: hA - 104, size: 6.8, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.fechaTitulo), { x: 65, y: hA - 117, size: 6.8, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.placa), { x: 162, y: hA - 115, size: 17.9, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.codVerif), { x: 213, y: hA - 142, size: 4.5, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.tituloNo), { x: 183, y: hA - 149.5, size: 4.5, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.fechaFinal), { x: 177, y: hA - 158, size: 4.5, font: fontBAnt, color: negro });
    drawRealBarcode(pageA, datos.placa, 10, hA - 172, 110, 28);
    const finalQR = qrCustomLink || `https://tive.sunarp.gob.pe/ver/${safe(datos.placa)}`;
    const qrImg = await pdfAnt.embedPng(await QRCode.toDataURL(finalQR, { margin: 1 }));
    pageA.drawImage(qrImg, { x: 100, y: hA - 170, width: 52, height: 52 });

    // REVERSO
    const pdfRev = await PDFDocument.load(fs.readFileSync(getTemplatePath('atrasxd.pdf')));
    pdfRev.registerFontkit(fontkit);
    const fontBRev = await pdfRev.embedFont(FONT_BYTES);
    const pageR = pdfRev.getPages()[0];
    const { height: hR, width: wR } = pageR.getSize();
    const dR = (t, x, y, size = 4.5) => pageR.drawText(safe(t), { x, y: hR - y, size, font: fontBRev, color: negro });
    dR(datos.categoria, 37, 40.5); dR(datos.marca, 37, 47.5); dR(datos.modelo, 37, 54.5);
    dR(datos.color, 37, 61.5); dR(datos.vin, 59, 69.5); dR(datos.serie, 59, 76.5);
    dR(datos.motor, 59, 83.5); dR(datos.carroceria, 59, 90.5); dR(datos.potencia, 45, 97.5);
    dR(datos.formRod, 45, 104.5); dR(datos.combustible, 50, 111.5);
    dR(datos.añoModelo, 225, 39); dR(datos.version, 151, 100);
    dR(datos.asientos, 45, 122); dR(datos.pasajeros, 45, 129);
    dR(datos.ruedas, 45, 134.9); dR(datos.ejes, 45, 141.9);
    dR(datos.cilindros, 115, 121); dR(datos.longitud, 115, 127.8);
    dR(datos.altura, 115, 134.6); dR(datos.ancho, 115, 141.4);
    dR(datos.cilindrada, 203, 121); dR(datos.pBruto, 203, 127.8);
    dR(datos.pNeto, 203, 134.6); dR(datos.cargaUtil, 203, 142);
    const barText = 
        `📋 FICHA TÉCNICA TIVE\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `🚗 PLACA: ${safe(datos.placa)}\n` +
        `🏢 ZONA: ${safe(datos.zona)}\n` +
        `📍 SEDE: ${safe(datos.sede)}\n` +
        `📑 PARTIDA: ${safe(datos.partida)}\n` +
        `🔢 COD. VERIF: ${safe(datos.codVerif)}\n` +
        `📝 TÍTULO: ${safe(datos.titulo)}\n` +
        `📅 FECHA: ${safe(datos.fechaTitulo)}\n` +
        `🛠️ MOTOR: ${safe(datos.motor)}\n` +
        `🆔 VIN/SERIE: ${safe(datos.vin)}\n` +
        `🚛 CARROCERÍA: ${safe(datos.carroceria)}`;
    const barImg = await pdfRev.embedPng(await bwipjs.toBuffer({ bcid: 'pdf417', text: barText, scale: 2, height: 12 }));
    pageR.drawImage(barImg, { x: (wR / 2) - (246 / 2), y: 5, width: 170, height: 22 });

    // --- RECORTE DE FIRMA ---
    if (originalBuffer) {
        try {
            const images = await pdf2img.convert(originalBuffer, { width: 2000 });
            if (images && images.length > 0) {
                const imgBuffer = Buffer.from(images[0]);
                const metadata = await sharp(imgBuffer).metadata();
                const scale = 2000 / 612; // Basado en el ancho estándar de SUNARP PDF

                let left = Math.round(403.05 * scale);
                let top = Math.round(790 * scale);
                let width = Math.round(140 * scale);
                let height = Math.round(60 * scale);

                left = Math.max(0, Math.min(left, metadata.width - 1));
                top = Math.max(0, Math.min(top, metadata.height - 1));
                width = Math.min(width, metadata.width - left);
                height = Math.min(height, metadata.height - top);

                if (width > 0 && height > 0) {
                    const sigCrop = await sharp(imgBuffer)
                        .extract({ left, top, width, height })
                        .png()
                        .toBuffer();

                    const sigImg = await pdfRev.embedPng(sigCrop);
                    // AJUSTA AQUÍ LA POSICIÓN DE LA FIRMA:
                    // x: más alto = más a la derecha | más bajo = más a la izquierda
                    // y: posición desde abajo hacia arriba
                    pageR.drawImage(sigImg, { x: 184, y: 4, width: 55, height: 24 });
                }
            }
        } catch (e) { console.error("Error recortando firma:", e.message); }
    }

    const bufA = await pdfAnt.save();
    const bufR = await pdfRev.save();

    try {
        const imgA = await pdf2img.convert(bufA, { width: 1200 });
        const imgR = await pdf2img.convert(bufR, { width: 1200 });

        console.log(`[TIVE] 📤 Enviando imágenes PNG al chat ${chatId}...`);
        // Usamos fileOptions para evitar errores de parseo y 414 de Nginx
        await bot.sendPhoto(chatId, Buffer.from(imgA[0]), { caption: `✅ Anverso` }, { filename: 'anverso.png', contentType: 'image/png' });
        await bot.sendPhoto(chatId, Buffer.from(imgR[0]), { caption: `✅ Reverso` }, { filename: 'reverso.png', contentType: 'image/png' });
        console.log(`[TIVE] ✅ Imágenes enviadas exitosamente.`);
    } catch (e) {
        console.error(`[TIVE] ❌ Error enviando fotos:`, e.message);
        console.log(`[TIVE] 📤 Enviando respaldo en PDF...`);
        await bot.sendDocument(chatId, Buffer.from(bufA), { caption: "Anverso (PDF)" }, { filename: `anv_${safe(datos.placa)}.pdf` });
        await bot.sendDocument(chatId, Buffer.from(bufR), { caption: "Reverso (PDF)" }, { filename: `rev_${safe(datos.placa)}.pdf` });
    }
}

bot.onText(/\/start/, (msg) => {
    console.log(`[BOT] 📥 Comando /start recibido de ${msg.from.username || msg.from.id}`);
    if (!isAuthorized(msg)) return;
    const welcome =
        `✨ *TIVE AI PRO* ✨\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `Bienvenido al sistema avanzado de generación de tarjetas TIVE.\n\n` +
        `🚀 *Capacidades:*\n` +
        `• Extracción inteligente de datos (Gemini AI)\n` +
        `• Generación de anverso/reverso en alta definición\n` +
        `• QR y Código de barras dinámicos\n` +
        `• Recorte automático de firma original\n\n` +
        `📥 *Para comenzar:* Envía el documento PDF original de SUNARP.`;
    bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'Markdown' }).catch(err => console.error("[BOT] ❌ Error enviando /start:", err.message));
});

bot.on('document', async (msg) => {
    console.log(`[BOT] 📄 Documento recibido: ${msg.document.file_name} (${msg.document.file_size} bytes)`);
    if (!isAuthorized(msg)) return;
    const chatId = msg.chat.id;

    const statusMsg = await bot.sendMessage(chatId, "⏳ *Descargando documento...*", { parse_mode: 'Markdown' });

    try {
        const chunks = [];
        for await (const chunk of bot.getFileStream(msg.document.file_id)) { chunks.push(chunk); }
        userPdfs.set(chatId, Buffer.concat(chunks));
        console.log(`[BOT] ✅ Documento descargado en memoria.`);

        const menuOptions = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📸 Generar TIVE Completa (IA)", callback_data: "ask_qr" }],
                    [{ text: "🖼️ Solo Imágenes Anverso/Reverso", callback_data: "qr" }]
                ]
            }
        };

        bot.editMessageText(
            `📄 *Documento Cargado*\n` +
            `━━━━━━━━━━━━━━━━━\n` +
            `• Archivo: \`${msg.document.file_name}\`\n` +
            `• Estado: Ready ✨\n\n` +
            `¿Qué acción deseas realizar con este documento?`,
            { chat_id: chatId, message_id: statusMsg.message_id, ...menuOptions }
        );
    } catch (e) {
        bot.editMessageText(`❌ *Error al procesar el archivo:* ${e.message}`, { chat_id: chatId, message_id: statusMsg.message_id });
    }
});

bot.on('callback_query', async (query) => {
    console.log(`[BOT] 🖱️ Botón presionado: ${query.data}`);
    bot.answerCallbackQuery(query.id).catch(err => console.error("[BOT] ❌ Error en answerCallbackQuery:", err.message));

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const buffer = userPdfs.get(chatId);

    if (!buffer) return bot.sendMessage(chatId, "⚠️ *Error:* El documento ya no está en memoria. Por favor, envíalo de nuevo.");

    if (query.data === "ask_qr" || query.data === "qr") {
        userState.set(chatId, "awaiting_qr");
        bot.editMessageText(
            `🔗 *Configuración del Código QR*\n` +
            `━━━━━━━━━━━━━━━━━\n` +
            `El código QR puede apuntar al link oficial de SUNARP o a un enlace personalizado.\n\n` +
            `⌨️ *Escribe ahora el link personalizado* o elige la opción oficial debajo:`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "🏢 Usar Link Oficial SUNARP", callback_data: "use_official" }]]
                }
            }
        );
    } else if (query.data === "use_official") {
        console.log(`[BOT] 🏢 Eligió usar link oficial.`);
        userState.delete(chatId);

        bot.editMessageText(`🧠 *Procesando con Inteligencia Artificial...*\n_Extrayendo datos técnicos y registrales..._`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        });

        try {
            const datos = await extraerConIA(buffer);
            if (!datos.placa) bot.sendMessage(chatId, "⚠️ *Aviso:* No se pudo detectar una placa clara.");
            await generarTIVE(chatId, datos, null, buffer);
            bot.deleteMessage(chatId, messageId).catch(() => { });
        } catch (e) {
            console.error(`[BOT] ❌ Error en flujo principal:`, e);
            bot.sendMessage(chatId, `❌ *Error en el proceso:* ${e.message}`, { parse_mode: 'Markdown' });
        }
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (userState.get(chatId) === "awaiting_qr" && msg.text && !msg.text.startsWith('/')) {
        const customLink = msg.text;
        console.log(`[BOT] 🔗 Link personalizado recibido: ${customLink}`);
        const buffer = userPdfs.get(chatId);
        userState.delete(chatId);
        bot.sendMessage(chatId, `🧠 Procesando con IA...`);
        try {
            const datos = await extraerConIA(buffer);
            if (!datos.placa) bot.sendMessage(chatId, "⚠️ Advertencia: No se detectó placa.");
            await generarTIVE(chatId, datos, customLink, buffer);
        } catch (e) {
            console.error(`[BOT] ❌ Error en flujo custom:`, e);
            bot.sendMessage(chatId, "❌ Error: " + e.message);
        }
    }
});

console.log("🤖 Bot TIVE IA Online!");

// Manejo de apagado seguro para evitar Error 409 en Telegram durante los re-deploys
const gracefulShutdown = () => {
    console.log("🛑 Apagando el bot de forma segura...");
    bot.stopPolling()
        .then(() => {
            console.log("✅ Polling detenido. Saliendo...");
            process.exit(0);
        })
        .catch((err) => {
            console.error("❌ Error deteniendo el bot:", err);
            process.exit(1);
        });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

bot.on('polling_error', (err) => console.error("❌ Error de polling:", err.message));
