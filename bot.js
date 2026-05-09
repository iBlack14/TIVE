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
const GEMINI_KEY = "AIzaSyBQMCOse-Af9uQwW6W-kCp_eRzmA9jNgxw"; // Tu clave integrada
const DOMAIN = process.env.DOMAIN_URL || 'localhost:3000';

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Almacén temporal de PDFs para el menú
const userPdfs = new Map();

// --- FUNCIONES TÉCNICAS (TIVE) ---
const C128_PATTERNS = { '0': '11011001100', '1': '11001101100', '2': '11001100110', '3': '10001101100', '4': '10001100110', '5': '10110001100', '6': '10110000110', '7': '10110110000', '8': '10110011011', '9': '11001011000', 'A': '11000101100', 'B': '11000100110', 'C': '11011000100', 'D': '11011000010', 'E': '11011011000', 'F': '11011001101', 'G': '11011011011', 'H': '11001101101', 'I': '11001101111', 'J': '11011110110', 'K': '11011111011', 'L': '11110110110', 'M': '11110110111', 'N': '11110111101', 'O': '11110111111', 'P': '11001101101', 'Q': '11001101111', 'R': '11011110110', 'S': '11011111011', 'T': '11110110110', 'U': '11110110111', 'V': '11110111101', 'W': '11110111111', 'X': '11001101101', 'Y': '11001101111', 'Z': '11011110110', '-': '11000111010', '.': '11011011110', ' ': '11011011011', ':': '11011111010' };

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

const safe = (t) => t ? String(t).toUpperCase() : '';

// --- LÓGICA DE IA ---
async function extraerConIA(pdfBuffer) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analiza este documento TIVE. Extrae los datos y devuelve SOLO un JSON con: zona, sede, partida, dua, titulo, fechaTitulo, placa, codVerif, tituloNo, fechaFinal, categoria, marca, modelo, color, añoModelo, version, vin, serie, motor, carroceria, potencia, formRod, combustible, asientos, pasajeros, ruedas, ejes, cilindros, longitud, altura, ancho, cilindrada, pBruto, pNeto, cargaUtil.`;
    
    const result = await model.generateContent([
        { inlineData: { data: pdfBuffer.toString("base64"), mimeType: "application/pdf" } },
        { text: prompt }
    ]);
    return JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
}

// --- GENERADORES TIVE ---
async function generarTIVE(chatId, datos) {
    const fontB = await (await PDFDocument.create()).embedFont(StandardFonts.HelveticaBold);
    
    // 1. ANVERSO
    const antPath = path.join(__dirname, 'tarjeta', 'adelantexd.pdf');
    const pdfAnt = await PDFDocument.load(fs.readFileSync(antPath));
    const pageA = pdfAnt.getPages()[0];
    const { height: hA } = pageA.getSize();
    const drawA = (t, x, y, size = 6.8, color = rgb(0,0,0)) => pageA.drawText(safe(t), { x, y: hA - y, size, font: fontB, color });

    drawA(datos.zona, 60, 56, 5.5, rgb(0.4, 0.4, 0.4));
    drawA(datos.sede, 55, 63, 5.5, rgb(0.4, 0.4, 0.4));
    drawA(datos.partida, 65, 75);
    drawA(datos.dua, 50, 89);
    drawA(datos.titulo, 34.5, 104);
    drawA(datos.fechaTitulo, 65, 117);
    drawA(datos.placa, 162, 115, 17.5);
    drawA(datos.codVerif, 213, 142, 4.2);
    drawA(datos.tituloNo, 183, 149.5, 4.2);
    drawA(datos.fechaFinal, 177, 158, 4.2);
    drawRealBarcode(pageA, datos.placa, 10, hA - 168, 80, 15);
    const qrImg = await pdfAnt.embedPng(await QRCode.toDataURL(`https://tive.sunarp.gob.pe/ver/${safe(datos.placa)}`, { margin: 1 }));
    pageA.drawImage(qrImg, { x: 100, y: hA - 170, width: 52, height: 52 });
    
    // 2. REVERSO
    const revPath = path.join(__dirname, 'tarjeta', 'atrasxd.pdf');
    const pdfRev = await PDFDocument.load(fs.readFileSync(revPath));
    const pageR = pdfRev.getPages()[0];
    const { height: hR, width: wR } = pageR.getSize();
    const drawR = (t, x, y, size = 4.8) => pageR.drawText(safe(t), { x, y: hR - y, size, font: fontB, color: rgb(0,0,0) });

    drawR(datos.categoria, 37, 40.5);
    drawR(datos.marca, 37, 47.5);
    drawR(datos.modelo, 37, 54.5);
    drawR(datos.color, 37, 61.5);
    drawR(datos.vin, 60, 69.5);
    drawR(datos.serie, 60, 76.5);
    drawR(datos.motor, 60, 83.5);
    drawR(datos.carroceria, 60, 90.5);
    drawR(datos.potencia, 48, 97.5);
    drawR(datos.formRod, 48, 104.5);
    drawR(datos.combustible, 52, 111.5);
    drawR(datos.añoModelo, 226, 39);
    drawR(datos.version, 153, 100);
    drawR(datos.asientos, 46, 122, 4.2);
    drawR(datos.pasajeros, 46, 129, 4.2);
    drawR(datos.ruedas, 46, 134.9, 4.2);
    drawR(datos.ejes, 46, 141.9, 4.2);
    drawR(datos.cilindros, 117, 121, 4.2);
    drawR(datos.longitud, 117, 127.8, 4.2);
    drawR(datos.altura, 117, 134.6, 4.2);
    drawR(datos.ancho, 117, 141.4, 4.2);
    drawR(datos.cilindrada, 205, 121, 4.2);
    drawR(datos.pBruto, 205, 127.8, 4.2);
    drawR(datos.pNeto, 205, 134.6, 4.2);
    drawR(datos.cargaUtil, 205, 142, 4.2);

    const barText = `CAT:${safe(datos.categoria)}|MAR:${safe(datos.marca)}|VIN:${safe(datos.vin)}|MOT:${safe(datos.motor)}`;
    const barImg = await pdfRev.embedPng(await bwipjs.toBuffer({ bcid: 'pdf417', text: barText, scale: 2, height: 12 }));
    pageR.drawImage(barImg, { x: (wR/2)-(170/2), y: 4, width: 170, height: 22 });

    const fileA = `anverso_${safe(datos.placa)}.pdf`;
    const fileR = `reverso_${safe(datos.placa)}.pdf`;
    fs.writeFileSync(fileA, await pdfAnt.save());
    fs.writeFileSync(fileR, await pdfRev.save());

    await bot.sendDocument(chatId, fileA, { caption: "✅ Anverso TIVE Generado" });
    await bot.sendDocument(chatId, fileR, { caption: "✅ Reverso TIVE Generado" });
    
    // Limpieza
    fs.unlinkSync(fileA); fs.unlinkSync(fileR);
}

// --- MANEJO DE TELEGRAM ---

bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    if (msg.document.mime_type !== 'application/pdf') return bot.sendMessage(chatId, "❌ Solo PDFs.");

    const fileId = msg.document.file_id;
    const fileStream = bot.getFileStream(fileId);
    const chunks = [];
    for await (const chunk of fileStream) { chunks.push(chunk); }
    const buffer = Buffer.concat(chunks);
    
    userPdfs.set(chatId, buffer);

    bot.sendMessage(chatId, "🎯 ¿Qué quieres hacer con este PDF?", {
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
    const data = query.data;
    const buffer = userPdfs.get(chatId);

    if (!buffer) return bot.sendMessage(chatId, "❌ Sesión expirada. Envía el PDF de nuevo.");

    if (data === "tive") {
        bot.sendMessage(chatId, "🧠 Analizando con IA... esto tardará unos segundos.");
        try {
            const datos = await extraerConIA(buffer);
            await generarTIVE(chatId, datos);
        } catch (e) {
            bot.sendMessage(chatId, `❌ Error IA: ${e.message}`);
        }
    } else if (data === "qr") {
        bot.sendMessage(chatId, "⏳ Función QR en desarrollo o integrada aquí.");
        // Aquí podrías poner la lógica original de hash/QR si la sigues necesitando
    }
    
    bot.answerCallbackQuery(query.id);
});

console.log("🤖 Bot TIVE IA Online!");
