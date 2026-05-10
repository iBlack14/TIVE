const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const bwipjs = require('bwip-js');
const { execSync } = require('child_process');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// --- CONFIGURACIÓN ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const API_KEYS = (process.env.GEMINI_KEYS || "").split(",").map(k => k.trim()).filter(k => k);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const userPdfs = new Map();
const userState = new Map();

const isAuthorized = (msg) => !ADMIN_ID || msg.from.id.toString() === ADMIN_ID.toString();
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
            return JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
        } catch (e) { lastError = e; }
    }
    throw lastError;
}

async function generarTIVE(chatId, datos, qrCustomLink = null, originalBuffer = null) {
    const fontB = await (await PDFDocument.create()).embedFont(StandardFonts.HelveticaBold);
    const gris = rgb(0.6, 0.6, 0.6);
    const negro = rgb(0, 0, 0);

    // ANVERSO
    const pdfAnt = await PDFDocument.load(fs.readFileSync(getTemplatePath('adelantexd.pdf')));
    const pageA = pdfAnt.getPages()[0];
    const { height: hA } = pageA.getSize();
    pageA.drawText(safe(datos.zona), { x: 60, y: hA - 56, size: 5.5, font: fontB, color: gris });
    pageA.drawText(safe(datos.sede), { x: 55, y: hA - 63, size: 5.5, font: fontB, color: gris });
    pageA.drawText(safe(datos.partida), { x: 65, y: hA - 75, size: 6.8, font: fontB, color: negro });
    pageA.drawText(safe(datos.dua), { x: 50, y: hA - 89, size: 6.8, font: fontB, color: negro });
    pageA.drawText(safe(datos.titulo), { x: 34.5, y: hA - 104, size: 6.8, font: fontB, color: negro });
    pageA.drawText(safe(datos.fechaTitulo), { x: 65, y: hA - 117, size: 6.8, font: fontB, color: negro });
    pageA.drawText(safe(datos.placa), { x: 162, y: hA - 115, size: 17.9, font: fontB, color: negro });
    pageA.drawText(safe(datos.codVerif), { x: 213, y: hA - 142, size: 4.5, font: fontB, color: negro });
    pageA.drawText(safe(datos.tituloNo), { x: 183, y: hA - 149.5, size: 4.5, font: fontB, color: negro });
    pageA.drawText(safe(datos.fechaFinal), { x: 177, y: hA - 158, size: 4.5, font: fontB, color: negro });
    drawRealBarcode(pageA, datos.placa, 10, hA - 168, 80, 15);
    const finalQR = qrCustomLink || `https://tive.sunarp.gob.pe/ver/${safe(datos.placa)}`;
    const qrImg = await pdfAnt.embedPng(await QRCode.toDataURL(finalQR, { margin: 1 }));
    pageA.drawImage(qrImg, { x: 100, y: hA - 170, width: 52, height: 52 });

    // REVERSO
    const pdfRev = await PDFDocument.load(fs.readFileSync(getTemplatePath('atrasxd.pdf')));
    const pageR = pdfRev.getPages()[0];
    const { height: hR, width: wR } = pageR.getSize();
    const dR = (t, x, y, size = 4.5) => pageR.drawText(safe(t), { x, y: hR - y, size, font: fontB, color: negro });
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
    const barText = `CATEGORIA:${safe(datos.categoria)}|MARCA:${safe(datos.marca)}|MODELO:${safe(datos.modelo)}|VIN:${safe(datos.vin)}|MOTOR:${safe(datos.motor)}`;
    const barImg = await pdfRev.embedPng(await bwipjs.toBuffer({ bcid: 'pdf417', text: barText, scale: 2, height: 12 }));
    pageR.drawImage(barImg, { x: (wR / 2) - (246 / 2), y: 5, width: 170, height: 22 });

    // --- RECORTE DE FIRMA ORIGINAL ---
    if (originalBuffer) {
        try {
            const originalDoc = await PDFDocument.load(originalBuffer);
            const [embeddedPage] = await pdfRev.embedPdf(originalDoc, [0]);
            
            // Área de la firma en el original (Aprox inferior derecha)
            // Escala para ajustar el tamaño del recorte
            const scale = 0.28; 
            pageR.pushGraphicsState();
            // Creamos un área de recorte en el reverso
            pageR.drawRectangle({ x: 235, y: 3, width: 55, height: 26, color: rgb(1, 1, 1) });
            pageR.clip(); 
            // Dibujamos la página original desplazada para que solo se vea la firma
            pageR.drawPage(embeddedPage, {
                x: 235 - (405 * scale), // Desplazamiento X para encontrar la firma
                y: 3 - (10 * scale),   // Desplazamiento Y
                width: 595 * scale,
                height: 842 * scale
            });
            pageR.popGraphicsState();
        } catch (e) { console.error("Error recortando firma:", e.message); }
    }

    const fA_pdf = `anv_${safe(datos.placa)}.pdf`; const fR_pdf = `rev_${safe(datos.placa)}.pdf`;
    fs.writeFileSync(fA_pdf, await pdfAnt.save()); fs.writeFileSync(fR_pdf, await pdfRev.save());

    try {
        execSync(`pdftocairo -png -singlefile -r 300 ${fA_pdf} anv_${safe(datos.placa)}`);
        execSync(`pdftocairo -png -singlefile -r 300 ${fR_pdf} rev_${safe(datos.placa)}`);
        await bot.sendPhoto(chatId, `anv_${safe(datos.placa)}.png`, { caption: `✅ Anverso - QR: ${finalQR}` });
        await bot.sendPhoto(chatId, `rev_${safe(datos.placa)}.png`, { caption: `✅ Reverso` });
        fs.unlinkSync(fA_pdf); fs.unlinkSync(fR_pdf); fs.unlinkSync(`anv_${safe(datos.placa)}.png`); fs.unlinkSync(`rev_${safe(datos.placa)}.png`);
    } catch (e) {
        await bot.sendDocument(chatId, fA_pdf); await bot.sendDocument(chatId, fR_pdf);
    }
}

bot.onText(/\/start/, (msg) => {
    if (!isAuthorized(msg)) return;
    const welcome = `🚀 *TIVE Pro - AI Generation Suite*\n━━━━━━━━━━━━━━━━━━\nBienvenido.\n\n📥 *Instrucciones:*\n1. Envía el *PDF original*.\n2. Selecciona el proceso.\n\n_Esperando documento..._`;
    bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'Markdown' });
});

bot.on('document', async (msg) => {
    if (!isAuthorized(msg)) return;
    const chatId = msg.chat.id;
    const chunks = [];
    for await (const chunk of bot.getFileStream(msg.document.file_id)) { chunks.push(chunk); }
    userPdfs.set(chatId, Buffer.concat(chunks));
    bot.sendMessage(chatId, "📄 PDF recibido. ¿Qué deseas hacer?", { reply_markup: { inline_keyboard: [[{ text: "📸 Generar Tarjetas PNG (IA)", callback_data: "ask_qr" }], [{ text: "🔐 Insertar QR Verificación", callback_data: "qr" }]] } });
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const buffer = userPdfs.get(chatId);
    if (!buffer) return bot.sendMessage(chatId, "❌ Reenvía el PDF.");

    if (query.data === "ask_qr") {
        userState.set(chatId, "awaiting_qr");
        bot.sendMessage(chatId, "🔗 *Configuración de QR*\n\nEnvía el enlace personalizado para el QR o presiona el botón para el oficial.", {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: "🏛️ Usar Link Oficial SUNARP", callback_data: "use_official" }]] }
        });
    } else if (query.data === "use_official") {
        userState.delete(chatId);
        bot.sendMessage(chatId, "🧠 Procesando con IA...");
        try { 
            const datos = await extraerConIA(buffer);
            await generarTIVE(chatId, datos, null, buffer); 
        } catch (e) { bot.sendMessage(chatId, "❌ Error: " + e.message); }
    }
    bot.answerCallbackQuery(query.id);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (userState.get(chatId) === "awaiting_qr" && msg.text && !msg.text.startsWith('/')) {
        const customLink = msg.text;
        const buffer = userPdfs.get(chatId);
        userState.delete(chatId);
        bot.sendMessage(chatId, `🧠 Procesando con IA...`);
        try { 
            const datos = await extraerConIA(buffer);
            await generarTIVE(chatId, datos, customLink, buffer); 
        } catch (e) { bot.sendMessage(chatId, "❌ Error: " + e.message); }
    }
});

console.log("🤖 Bot TIVE IA Online!");
