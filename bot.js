const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const bwipjs = require('bwip-js');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// --- CONFIGURACIÓN ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const GEMINI_KEY = "AIzaSyBQMCOse-Af9uQwW6W-kCp_eRzmA9jNgxw";
const DOMAIN = process.env.DOMAIN_URL || 'localhost:3000';

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const userPdfs = new Map();

// --- PERMISOS ---
const isAuthorized = (msg) => {
    if (!ADMIN_ID) return true; 
    return msg.from.id.toString() === ADMIN_ID.toString();
};

const safe = (t) => t ? String(t).toUpperCase() : '';

// --- FUNCIONES TÉCNICAS TIVE ---
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

async function extraerConIA(pdfBuffer) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analiza este documento TIVE. Extrae datos y devuelve SOLO JSON con llaves exactas: zona, sede, partida, dua, titulo, fechaTitulo, placa, codVerif, tituloNo, fechaFinal, categoria, marca, modelo, color, añoModelo, version, vin, serie, motor, carroceria, potencia, formRod, combustible, asientos, pasajeros, ruedas, ejes, cilindros, longitud, altura, ancho, cilindrada, pBruto, pNeto, cargaUtil.`;
    const result = await model.generateContent([{ inlineData: { data: pdfBuffer.toString("base64"), mimeType: "application/pdf" } }, { text: prompt }]);
    return JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
}

async function generarTIVE(chatId, datos) {
    const fontB = await (await PDFDocument.create()).embedFont(StandardFonts.HelveticaBold);
    
    // Anverso
    const pdfAnt = await PDFDocument.load(fs.readFileSync(path.join(__dirname, 'tarjeta', 'adelantexd.pdf')));
    const pageA = pdfAnt.getPages()[0];
    const { height: hA } = pageA.getSize();
    const dA = (t, x, y, size = 6.5) => pageA.drawText(safe(t), { x, y: hA - y, size, font: fontB });

    dA(datos.zona, 60, 56, 5.5); dA(datos.sede, 55, 63, 5.5);
    dA(datos.partida, 65, 75); dA(datos.dua, 50, 89);
    dA(datos.titulo, 34.5, 104); dA(datos.fechaTitulo, 65, 117);
    dA(datos.placa, 162, 115, 17.5);
    drawRealBarcode(pageA, datos.placa, 10, hA - 168, 80, 15);
    const qrImg = await pdfAnt.embedPng(await QRCode.toDataURL(`https://tive.sunarp.gob.pe/ver/${safe(datos.placa)}`, { margin: 1 }));
    pageA.drawImage(qrImg, { x: 100, y: hA - 170, width: 52, height: 52 });

    // Reverso
    const pdfRev = await PDFDocument.load(fs.readFileSync(path.join(__dirname, 'tarjeta', 'atrasxd.pdf')));
    const pageR = pdfRev.getPages()[0];
    const { height: hR, width: wR } = pageR.getSize();
    const dR = (t, x, y, size = 4.8) => pageR.drawText(safe(t), { x, y: hR - y, size, font: fontB });

    dR(datos.categoria, 37, 40.5); dR(datos.marca, 37, 47.5); dR(datos.modelo, 37, 54.5);
    dR(datos.color, 37, 61.5); dR(datos.vin, 60, 69.5); dR(datos.serie, 60, 76.5);
    dR(datos.motor, 60, 83.5); dR(datos.carroceria, 60, 90.5); dR(datos.potencia, 48, 97.5);
    dR(datos.formRod, 48, 104.5); dR(datos.combustible, 52, 111.5);
    dR(datos.añoModelo, 226, 39); dR(datos.version, 153, 100);
    dR(datos.asientos, 46, 122, 4.2); dR(datos.pasajeros, 46, 129, 4.2);
    dR(datos.ruedas, 46, 134.9, 4.2); dR(datos.ejes, 46, 141.9, 4.2);
    dR(datos.cilindros, 117, 121, 4.2); dR(datos.longitud, 117, 127.8, 4.2);
    dR(datos.altura, 117, 134.6, 4.2); dR(datos.ancho, 117, 141.4, 4.2);
    dR(datos.cilindrada, 205, 121, 4.2); dR(datos.pBruto, 205, 127.8, 4.2);
    dR(datos.pNeto, 205, 134.6, 4.2); dR(datos.cargaUtil, 205, 142, 4.2);

    const barImg = await pdfRev.embedPng(await bwipjs.toBuffer({ bcid: 'pdf417', text: `CAT:${safe(datos.categoria)}|VIN:${safe(datos.vin)}`, scale: 2, height: 12 }));
    pageR.drawImage(barImg, { x: (wR/2)-(170/2), y: 4, width: 170, height: 22 });

    const fA = `anverso_${safe(datos.placa)}.pdf`; const fR = `reverso_${safe(datos.placa)}.pdf`;
    fs.writeFileSync(fA, await pdfAnt.save()); fs.writeFileSync(fR, await pdfRev.save());
    await bot.sendDocument(chatId, fA); await bot.sendDocument(chatId, fR);
    fs.unlinkSync(fA); fs.unlinkSync(fR);
}

// --- COMANDOS ---

bot.onText(/\/start/, (msg) => {
    if (!isAuthorized(msg)) return;
    bot.sendMessage(msg.chat.id, "👋 ¡Hola! Soy el Bot TIVE Pro.\n\n1. Envíame un PDF.\n2. Elige si quieres generar las **Tarjetas TIVE (IA)** o el **QR de Verificación**.");
});

bot.on('document', async (msg) => {
    if (!isAuthorized(msg)) return;
    const chatId = msg.chat.id;
    const fileId = msg.document.file_id;
    const fileStream = bot.getFileStream(fileId);
    const chunks = [];
    for await (const chunk of fileStream) { chunks.push(chunk); }
    userPdfs.set(chatId, Buffer.concat(chunks));

    bot.sendMessage(chatId, "📄 PDF recibido. ¿Qué deseas hacer?", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📝 Generar Tarjetas TIVE (IA)", callback_data: "tive" }],
                [{ text: "🔐 Insertar QR Verificación", callback_data: "qr" }]
            ]
        }
    });
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const buffer = userPdfs.get(chatId);
    if (!buffer) return bot.sendMessage(chatId, "❌ Reenvía el PDF.");

    if (query.data === "tive") {
        bot.sendMessage(chatId, "🧠 Procesando con IA... espera un momento.");
        try {
            const d = await extraerConIA(buffer);
            await generarTIVE(chatId, d);
        } catch (e) { bot.sendMessage(chatId, "❌ Error IA: " + e.message); }
    } else if (query.data === "qr") {
        bot.sendMessage(chatId, "⏳ Generando QR de verificación...");
        // (Lógica de QR de verificación original aquí si se desea)
    }
    bot.answerCallbackQuery(query.id);
});

console.log("🤖 Bot TIVE IA Online!");
