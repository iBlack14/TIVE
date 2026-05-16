process.env.NTBA_FIX_350 = 1;
const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const bwipjs = require('bwip-js');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
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
const ADMIN_IDS = (process.env.ADMIN_ID || "").split(",").map(id => id.trim()).filter(id => id);
const API_KEYS = (process.env.GEMINI_KEYS || "").split(",").map(k => k.trim()).filter(k => k);
const DOMAIN_URL = process.env.DOMAIN_URL || 'http://localhost:3000';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Limpieza inicial silenciosa
bot.deleteWebHook({ drop_pending_updates: true }).catch(() => {});

// 1. Comando de prueba
bot.onText(/\/ping/, (msg) => {
    bot.sendMessage(msg.chat.id, "🏓 ¡PONG! El bot está vivo y escuchando.");
});

// 2. Manejo de Botones (Callback Queries)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    console.log(`[BOT] 🖱️ Botón presionado: ${data} en chat ${chatId}`);
    
    // Quitar reloj de carga
    bot.answerCallbackQuery(query.id).catch(() => {});

    const buffer = userPdfs.get(chatId);
    if (!buffer) {
        return bot.sendMessage(chatId, "⚠️ El documento expiró. Por favor, envíalo de nuevo.");
    }

    if (data === "ask_qr" || data === "qr") {
        userState.set(chatId, "awaiting_qr");
        bot.editMessageText(`🔗 *Configuración QR*\nEscribe el link personalizado o elige el oficial:`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: "🏢 Usar Link Oficial SUNARP", callback_data: "use_official" }]]
            }
        });
    } else if (data === "use_official") {
        bot.editMessageText(`🧠 *Procesando con IA...*`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
        try {
            const datos = await extraerConIA(buffer);
            await generarTIVE(chatId, datos, null, buffer);
        } catch (e) {
            bot.sendMessage(chatId, `❌ Error: ${e.message}`);
        }
    } else if (data === "insert_qr_only") {
        const hash = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
        await finalizarInsercionQR(chatId, buffer, "CERTIFICADO", hash, messageId);
    } else if (data === "gen_antigua") {
        // Generar datos aleatorios
        const n1 = Math.floor(100000 + Math.random() * 900000).toString();
        let n2; do { n2 = Math.floor(100000 + Math.random() * 900000).toString(); } while (n1 === n2);
        const exp = Math.floor(10000 + Math.random() * 90000).toString();

        userAntiguaData.set(chatId, { controlAnverso: n1, controlReverso: n2, exp: exp });
        userState.set(chatId, "awaiting_antigua_clase");
        
        // Iniciar IA en segundo plano para tener la fecha lista al final
        extraerConIA_Antigua(buffer).then(datos => {
            const current = userAntiguaData.get(chatId);
            if (current) current.datosIA = datos;
        }).catch(e => console.error("Error IA fondo:", e.message));

        bot.editMessageText(
            `📜 *Generación de Tarjeta Antigua*\n\n` +
            `🔢 Control Anv: \`${n1}\` | Rev: \`${n2}\` | EXP: \`${exp}\` (Aleatorios ✨)\n\n` +
            `Introduce la **CLASE** (ej: MOTOCICLETA):`, 
            { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
        );
    }
});

// --- PERSISTENCIA EN MEMORIA ---
const userPdfs = new Map();
const userState = new Map();
const userAntiguaData = new Map();

// --- HANDLERS DE EVENTOS ---

// Configuración de persistencia para certificados por HASH
let DOMAIN = process.env.DOMAIN_URL || 'http://localhost:4000';
if (DOMAIN.endsWith('/')) DOMAIN = DOMAIN.slice(0, -1);

// Configuración QR en PDF (Cargado desde .env)
const QR_X = parseFloat(process.env.QR_X) || 12.2;
const QR_Y = parseFloat(process.env.QR_Y) || 10.2;
const QR_SIZE = parseFloat(process.env.QR_SIZE) || 72;

// ✅ CAMBIO: Carpeta actualizada a /servicio/verCertificado/Tive/
const uploadDir = path.join(__dirname, 'servicio', 'verCertificado', 'Tive');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Sistema de autorización para múltiples IDs
const isAuthorized = (msg) => {
    if (ADMIN_IDS.length === 0) return true;
    const userId = (msg.from.id || "").toString();
    const authorized = ADMIN_IDS.includes(userId);
    if (!authorized) console.log(`[AUTH] 🚫 Intento de acceso denegado para ID: ${userId}`);
    return authorized;
};

const escapeMarkdown = (text) => {
    return text.replace(/[_*`\[]/g, '\\$&');
};

const safe = (t) => t ? String(t).trim() : '';

const fmtPlaca = (p) => {
    if (!p) return "";
    let clean = p.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (clean.length === 6) {
        if (/^\d{4}/.test(clean)) return `${clean.substring(0, 4)}-${clean.substring(4)}`;
        return `${clean.substring(0, 3)}-${clean.substring(3)}`;
    }
    return clean;
};

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
    const p = [
        path.join(__dirname, 'tarjeta', name),
        path.join(__dirname, name),
        path.join(process.cwd(), 'tarjeta', name),
        path.join(process.cwd(), name)
    ];
    console.log(`[DEBUG] 🔍 Buscando plantilla: ${name}`);
    for (const pathFound of p) {
        console.log(`[DEBUG] 📂 Probando ruta: ${pathFound}`);
        if (fs.existsSync(pathFound)) {
            console.log(`[DEBUG] ✅ Encontrada en: ${pathFound}`);
            return pathFound;
        }
    }
    throw new Error(`No se encontró la plantilla ${name}. Rutas revisadas: ${p.join(', ')}`);
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
    console.error(`[IA] ❌ Todas las API keys fallaron o el documento no es válido.`);
    throw new Error("No se pudo extraer información. Asegúrate de que el PDF sea un documento TIVE original de SUNARP.");
}

async function extraerConIA_Antigua(pdfBuffer) {
    console.log(`[IA-ANTIGUA] 🧠 Iniciando extracción de documento antiguo...`);
    if (API_KEYS.length === 0) throw new Error("Llaves API no configuradas.");
    
    for (const key of API_KEYS) {
        try {
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const prompt = `Analiza este documento de Inscripción de Vehículo de SUNARP y extrae TODOS los datos técnicos y registrales.
            Devuelve estrictamente un objeto JSON con estos campos:
            {
              "controlAnverso": "", "zona": "", "sede": "", "reparticion": "", "placa": "", "titulo": "", "partida": "",
              "apPaterno": "", "apPaterno2": "", "apMaterno": "", "apMaterno2": "", "nombres": "", "nombres2": "",
              "domicilio": "", "fechaPropiedad": "", "fechaInferior": "", "fechaAsiento": "",
              "controlReverso": "", "clase": "", "marca": "", "añoFab": "", "modelo": "", "combustible": "",
              "carroceria": "", "ejes": "", "color": "", "cilindros": "", "motor": "", "ruedas": "", "serie": "",
              "pasajeros": "", "asientos": "", "pesoSeco": "", "pesoBruto": "", "longitud": "", "altura": "", "ancho": "", "cargaUtil": ""
            }
            IMPORTANTE: 
            - El Título Nro se mapea a "titulo". 
            - La Partida se mapea a "partida".
            - Busca específicamente la "Fecha Asiento" (suele estar al final) y ponla en "fechaAsiento".
            - Si hay dos propietarios (Persona Natural), sepáralos. 
            - Extrae Zona y Sede del recibo o encabezado si es posible.
            - No incluyas unidades de medida (tn, mt) en los campos de peso o dimensiones.`;

            const result = await model.generateContent([{ inlineData: { data: pdfBuffer.toString("base64"), mimeType: "application/pdf" } }, { text: prompt }]);
            const rawText = result.response.text();
            const parsedData = JSON.parse(rawText.replace(/```json|```/g, "").trim());
            console.log(`[IA-ANTIGUA] ✅ Extracción exitosa. Placa encontrada: ${parsedData.placa}`);
            console.log(`[IA-ANTIGUA] 📊 Datos obtenidos:\n`, JSON.stringify(parsedData, null, 2));
            return parsedData;
        } catch (e) { console.error(`[IA-ANTIGUA] ⚠️ Error:`, e.message); }
    }
    throw new Error("No se pudo extraer información del documento antiguo.");
}

async function generarTarjetaAntigua(chatId, datos, originalBuffer = null) {
    console.log(`[ANTIGUA] 🎨 Generando tarjeta para: ${datos.placa}`);
    const templatePath = getTemplatePath('placaplantilla.pdf');
    const pdfDoc = await PDFDocument.load(fs.readFileSync(templatePath));
    
    pdfDoc.setTitle(`CERTIFICADO DE IDENTIFICACIÓN VEHICULAR - ${datos.placa}`);
    pdfDoc.setAuthor('SUNARP - Sistema TIVE');
    
    pdfDoc.registerFontkit(fontkit);
    
    const fontB = await pdfDoc.embedFont(FONT_BYTES);
    const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontSerifNorm = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontFina = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontArialBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const page = pdfDoc.getPages()[0];
    const { height } = page.getSize();
    const gris = rgb(0.2, 0.2, 0.2);

    const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

    const draw = (text, x, y, size = 7, color = gris, customFont = fontSerif, forceUpper = true) => {
        if (!text) return;
        const txt = forceUpper ? String(text).toUpperCase() : String(text);
        page.drawText(txt, { x, y: height - y, size, font: customFont, color });
    };

    const fmtEspacios = (txt) => {
        if (!txt) return "";
        return txt.replace(/[\/\-]/g, " ").replace(/\s+/g, "   ").trim();
    };

    const drawSeg = (txt, x, y, s1 = 12, s2 = 12, size = 7, color = gris, font = fontSerif) => {
        if (!txt) return;
        draw(txt, x, y, size, color, font);
    };

    // draw(datos.controlAnverso, 220, 120, 19, rgb(0.8, 0.1, 0.1), fontFina);
    draw(datos.zona, 269, 139, 8);
    draw(datos.sede, 225, 147.6, 7);
    draw(datos.reparticion, 169, 164, 7);
    draw(fmtPlaca(datos.placa), 80, 195, 18);
    // draw(datos.titulo, 202, 178, 9);
    drawSeg(datos.partida, 233, 195, 11, 10, 8); 
    draw(datos.apPaterno, 105, 235, 7);
    draw(datos.apPaterno2, 189, 235, 7);
    draw(datos.apMaterno, 105, 245, 7);
    draw(datos.apMaterno2, 189, 245, 7);
    draw(datos.nombres, 105, 257, 7);
    draw(datos.nombres2, 185, 258, 7);
    draw(datos.domicilio, 68, 283, 6);
    drawSeg(datos.fechaPropiedad, 126, 296, 10, 11, 8.5);
    drawSeg(datos.fechaInferior, 218, 364, 15, 14, 9, gris);

    const drawTec = (text, x, y, size = 11) => {
        if (!text) return;
        let finalX = x;
        if (String(text).toUpperCase().includes("MT") || String(text).toUpperCase().includes("TN")) {
            finalX -= 7;
        }
        draw(text, finalX, y, size);
    };

    // draw(datos.controlReverso, 480, 118, 19, rgb(0.8, 0.1, 0.1), fontFina);
    draw(datos.clase, 325, 149, 10);
    draw(datos.marca, 435, 149, 11);
    draw(datos.añoFab, 510, 145, 11);
    draw(datos.modelo, 337, 173, 11);
    draw(datos.combustible, 485, 176, 11);
    draw(datos.carroceria, 337, 198, 11);
    draw(datos.ejes, 535, 198, 11);
    draw(datos.color, 337, 220, 11);
    draw(datos.cilindros, 533, 245, 11);
    draw(datos.motor, 335, 243, 11);
    draw(datos.ruedas, 531, 268, 11);
    draw(datos.serie, 335, 267, 11);
    draw(datos.pasajeros, 345, 292, 11);
    draw(datos.asientos, 395, 292, 11);
    drawTec(datos.pesoSeco, 447, 292, 11);
    drawTec(datos.pesoBruto, 500, 292, 11);
    drawTec(datos.longitud, 335, 319, 11);
    drawTec(datos.altura, 385, 319, 11);
    drawTec(datos.ancho, 447, 319, 11);
    drawTec(datos.cargaUtil, 500, 319, 11);

    // Bloque de Firma (Reverso)
    draw(datos.zona, 435, 357.5, 4.3, gris, fontArialBold);
    draw(capitalize(datos.sede), 455, 357.5, 4.3, gris, fontArialBold, false);

    const pdfBytes = await pdfDoc.save();

    // ✅ CAMBIO: Nombre del archivo → Tarjeta_Antigua_PLACA.pdf
    const fileName = `Tarjeta_Antigua_${(datos.placa || 'DOC').toUpperCase()}.pdf`;
    await bot.sendDocument(chatId, Buffer.from(pdfBytes), { caption: "✅ Tarjeta Antigua Generada con Éxito" }, { filename: fileName });
}

async function generarTIVE(chatId, datos, qrCustomLink = null, originalBuffer = null) {
    const safe = (val) => (val || '').toString().trim();

    let zonaLimpia = safe(datos.zona);
    let sedeLimpia = safe(datos.sede);

    const labelsToRemove = [
        "ZONA REGISTRAL N°", "ZONA REGISTRAL Nº", "ZONA REGISTRAL N", "ZONA REGISTRAL",
        "SEDE REGISTRAL -", "SEDE REGISTRAL-", "SEDE REGISTRAL", "SEDE"
    ];

    labelsToRemove.forEach(label => {
        const regex = new RegExp(`^${label}\\s*[:\\-]*\\s*`, 'i');
        zonaLimpia = zonaLimpia.replace(regex, '');
        sedeLimpia = sedeLimpia.replace(regex, '');
    });

    console.log(`[TIVE] 🎨 Generando tarjeta para: ${safe(datos.placa)}`);
    const gris = rgb(0.6, 0.6, 0.6);
    const negro = rgb(0, 0, 0);

    // ANVERSO
    const pdfAnt = await PDFDocument.load(fs.readFileSync(getTemplatePath('adelantexd.pdf')));
    pdfAnt.registerFontkit(fontkit);
    const fontBAnt = await pdfAnt.embedFont(FONT_BYTES);
    const pageA = pdfAnt.getPages()[0];
    const { height: hA } = pageA.getSize();
    pageA.drawText(zonaLimpia, { x: 74, y: hA - 56.5, size: 5.2, font: fontBAnt, color: gris });
    pageA.drawText(sedeLimpia, { x: 72, y: hA - 63.5, size: 5.2, font: fontBAnt, color: gris });
    pageA.drawText(safe(datos.partida), { x: 65, y: hA - 75, size: 6.8, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.dua), { x: 50, y: hA - 89, size: 6.8, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.titulo), { x: 34.5, y: hA - 104, size: 6.8, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.fechaTitulo), { x: 65, y: hA - 117, size: 6.8, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.placa), { x: 157, y: hA - 115, size: 17.9, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.codVerif), { x: 213, y: hA - 142, size: 4.5, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.tituloNo), { x: 183, y: hA - 149.5, size: 4.5, font: fontBAnt, color: negro });
    pageA.drawText(safe(datos.fechaFinal), { x: 177, y: hA - 158, size: 4.5, font: fontBAnt, color: negro });

    const barImgAnv = await bwipjs.toBuffer({
        bcid: 'code128',
        text: safe(datos.placa),
        scale: 4,
        height: 15,
        includetext: false,
    });
    const pngBarAnv = await pdfAnt.embedPng(barImgAnv);
    pageA.drawImage(pngBarAnv, { x: 10, y: hA - 168, width: 82, height: 18 });

    const finalQR = qrCustomLink || `${DOMAIN_URL}/servicio/verCertificado/Tive/TIVE-${safe(datos.placa).toUpperCase()}`;
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
                const scale = 2000 / 612;

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

        // ✅ CAMBIO: Eliminado fs.writeFileSync — TIVE ya NO guarda en disco
        const cropPx = 35;
        
        const recortarParaTelegram = async (bufferImg, extraRight = 0, extraLeft = 0) => {
            const buffer = Buffer.from(bufferImg);
            const metadata = await sharp(buffer).metadata();
            
            const left = cropPx + extraLeft;
            const top = cropPx;
            const right = cropPx + extraRight;
            const bottom = cropPx;

            const finalW = metadata.width - left - right;
            const finalH = metadata.height - top - bottom;
            
            if (finalW > 0 && finalH > 0) {
                return await sharp(buffer)
                    .extract({ left, top, width: finalW, height: finalH })
                    .toBuffer();
            }
            return buffer;
        };

        console.log(`[TIVE] ✂️ Aplicando recorte asimétrico para Telegram...`);
        const finalImgA = await recortarParaTelegram(imgA[0], 30, 0);
        const finalImgR = await recortarParaTelegram(imgR[0], 25, 25);

        console.log(`[TIVE] 📤 Enviando imágenes PNG al chat ${chatId}...`);
        
        await bot.sendPhoto(chatId, finalImgA, { caption: `✅ Anverso (Recortado)` }, { filename: 'anverso.png', contentType: 'image/png' });
        await bot.sendPhoto(chatId, finalImgR, { caption: `✅ Reverso (Recortado)` }, { filename: 'reverso.png', contentType: 'image/png' });
        
        console.log(`[TIVE] ✅ Imágenes y mensaje enviados exitosamente.`);
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
                    [{ text: "🚀 Generar Tarjeta TIVE (IA)", callback_data: "ask_qr" }],
                    [{ text: "📜 Generar Tarjeta Antigua (IA)", callback_data: "gen_antigua" }],
                    [{ text: "🔐 Insertar QR en PDF Original", callback_data: "insert_qr_only" }]
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

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const state = userState.get(chatId);
    const buffer = userPdfs.get(chatId);

    if (state === "awaiting_qr" && msg.text && !msg.text.startsWith('/')) {
        const customLink = msg.text;
        userState.delete(chatId);
        bot.sendMessage(chatId, `🧠 Procesando con IA...`);
        try { 
            const datos = await extraerConIA(buffer);
            if (!datos.placa) bot.sendMessage(chatId, "⚠️ Advertencia: No se detectó placa.");
            await generarTIVE(chatId, datos, customLink, buffer);
        } catch (e) { 
            console.error(`[BOT] ❌ Error en flujo custom:`, e);
            bot.sendMessage(chatId, "❌ Error: " + escapeMarkdown(e.message), { parse_mode: 'Markdown' }); 
        }
    } else if (state === "awaiting_plate_for_qr") {
        const plate = msg.text.toUpperCase().trim();
        userState.delete(chatId);
        
        bot.sendMessage(chatId, `⏳ Generando PDF con QR para la placa *${plate}*...`, { parse_mode: 'Markdown' });
        try {
            const hash = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
            await finalizarInsercionQR(chatId, buffer, plate, hash);
        } catch (e) {
            bot.sendMessage(chatId, `❌ Error: ${e.message}`);
        }
    } else if (state === "awaiting_antigua_clase" && msg.text) {
        userAntiguaData.get(chatId).clase = msg.text.trim().toUpperCase();
        userState.set(chatId, "awaiting_antigua_zona");
        bot.sendMessage(chatId, "🌏 Introduce la **ZONA** (ej: III):", { parse_mode: 'Markdown' });
    } else if (state === "awaiting_antigua_zona" && msg.text) {
        userAntiguaData.get(chatId).zona = msg.text.trim().toUpperCase();
        userState.set(chatId, "awaiting_antigua_sede");
        bot.sendMessage(chatId, "📍 Introduce la **SEDE** (ej: YURIMAGUAS):", { parse_mode: 'Markdown' });
    } else if (state === "awaiting_antigua_sede" && msg.text) {
        userAntiguaData.get(chatId).sede = msg.text.trim().toUpperCase();
        userState.set(chatId, "awaiting_antigua_reparticion");
        bot.sendMessage(chatId, "📂 Introduce la **REPARTICIÓN** (ej: YURIMAGUAS):", { parse_mode: 'Markdown' });
    } else if (state === "awaiting_antigua_reparticion" && msg.text) {
        userAntiguaData.get(chatId).reparticion = msg.text.trim().toUpperCase();
        userState.set(chatId, "awaiting_antigua_domicilio");
        bot.sendMessage(chatId, "🏠 Introduce la **DIRECCIÓN (DOMICILIO)** (o /skip):", { parse_mode: 'Markdown' });
    } else if (state === "awaiting_antigua_domicilio" && msg.text) {
        let domicilio = msg.text.trim();
        if (domicilio.startsWith('/skip')) domicilio = "";
        const data = userAntiguaData.get(chatId);
        data.domicilio = domicilio;
        
        const checkIA = async () => {
            if (!data.datosIA) {
                const status = await bot.sendMessage(chatId, "⏳ *Esperando que la IA detecte la fecha...*", { parse_mode: 'Markdown' });
                while (!data.datosIA) { await new Promise(r => setTimeout(r, 1000)); }
                bot.deleteMessage(chatId, status.message_id).catch(() => {});
            }
            const fechaSugerida = data.datosIA.fechaAsiento || data.datosIA.fechaInferior || "";
            userState.set(chatId, "awaiting_antigua_fecha");
            bot.sendMessage(chatId, 
                `✅ **Datos Registrados.**\n\n` +
                `📅 **Fecha Detectada:** \`${fechaSugerida}\`\n\n` +
                `Introduce **LA FECHA** (o escribe /ok para usar la detectada):`, 
                { parse_mode: 'Markdown' }
            );
        };
        checkIA();
    } else if (state === "awaiting_antigua_fecha" && msg.text) {
        let fecha = msg.text.trim();
        const data = userAntiguaData.get(chatId);
        if (fecha.toLowerCase() === "/ok" && data.datosIA) {
            fecha = data.datosIA.fechaAsiento || data.datosIA.fechaInferior || "";
        }
        data.fecha = fecha;
        userState.delete(chatId);
        
        bot.sendMessage(chatId, `✨ *Generando Tarjeta Antigua...*`, { parse_mode: 'Markdown' });
        
        try {
            const datos = data.datosIA || await extraerConIA_Antigua(buffer);
            datos.controlAnverso = data.controlAnverso;
            datos.controlReverso = data.controlReverso;
            datos.titulo = data.exp;
            datos.partida = fecha;
            datos.fechaPropiedad = fecha;
            datos.fechaInferior = fecha;
            datos.zona = data.zona;
            datos.sede = data.sede;
            datos.reparticion = data.reparticion;
            if (data.clase) datos.clase = data.clase;
            if (data.domicilio) datos.domicilio = data.domicilio;
            
            await generarTarjetaAntigua(chatId, datos, buffer);
            userAntiguaData.delete(chatId);
        } catch (e) {
            console.error(`[BOT] ❌ Error final:`, e);
            bot.sendMessage(chatId, "❌ Error: " + e.message);
        }
    }
});

async function finalizarInsercionQR(chatId, buffer, placa, hash, messageId = null) {
    const pdfDoc = await PDFDocument.load(buffer);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();
    console.log(`[BOT] 📐 Dimensiones del PDF original: ${width}x${height}`);
    
    // ✅ CAMBIO: URL sin "CERT-" y sin ".pdf", con ruta /Tive/
    const qrUrl = `${DOMAIN}/servicio/verCertificado/Tive/${hash}`;
    const qrImg = await pdfDoc.embedPng(await QRCode.toDataURL(qrUrl, { 
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
    }));
    
    const qrSize = QR_SIZE;
    const posX = (QR_X / 100) * width;
    const posY = height - ((QR_Y / 100) * height) - qrSize;

    console.log(`[BOT] 📍 Pegando QR en X:${posX.toFixed(2)}, Y:${posY.toFixed(2)} (Size: ${qrSize})`);
    
    page.drawImage(qrImg, { x: posX, y: posY, width: qrSize, height: qrSize });
    
    const pdfBytes = await pdfDoc.save();
    
    // ✅ CAMBIO: Guardado en /servicio/verCertificado/Tive/HASH.pdf
    const finalFileName = `${hash}.pdf`;
    const finalPath = path.join(uploadDir, finalFileName);
    fs.writeFileSync(finalPath, Buffer.from(pdfBytes));
    console.log(`[BOT] ✅ Certificado guardado en: ${finalPath}`);

    const fileName = `Certificado-Tive-${hash.substring(0, 8)}.pdf`;
    
    await bot.sendDocument(chatId, Buffer.from(pdfBytes), { 
        caption: 
            `✨ *¡DOCUMENTO VERIFICADO EXITOSAMENTE!* ✨\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📂 *Archivo:* \`${placa}\`\n` +
            `🔐 *Hash de Seguridad:* \n\`${hash.substring(0, 32)}\`\n\`${hash.substring(32)}\`\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🌐 *Link de verificación:*\n\`${qrUrl}\`\n\n` +
            `📱 _El código QR ha sido insertado en el documento para validación inmediata._`, 
        parse_mode: 'Markdown' 
    }, { filename: fileName });
    
    if (messageId) bot.deleteMessage(chatId, messageId).catch(() => {});
}

console.log("🤖 Bot TIVE IA Online!");

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

bot.on('polling_error', (err) => {
    if (err.message.includes("409 Conflict")) {
        console.error("⚠️ Conflicto detectado (409): Otra instancia del bot está corriendo.");
        console.error("💡 Si estás en Railway/Docker, asegúrate de tener 'Replicas = 1' y desactivar el 'Autoscaling'.");
    } else {
        console.error("❌ Error de polling:", err.message);
    }
});
