process.env.NTBA_FIX_350 = 1;
const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
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
bot.deleteWebHook({ drop_pending_updates: true }).catch(() => { });

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
    bot.answerCallbackQuery(query.id).catch(() => { });

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
    } else if (data === "gen_tive_completo") {
        bot.editMessageText(`📄 *Extrayendo datos para TIVE COMPLETO...*`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
        try {
            const datos = extraerTiveCompletoConLibreria(buffer);
            await iniciarCapturaFaltantesTiveCompleto(chatId, datos, buffer);
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
        userState.set(chatId, "awaiting_antigua_placa");

        // Iniciar IA en segundo plano
        extraerConIA_Antigua(buffer).then(datos => {
            const current = userAntiguaData.get(chatId);
            if (current) current.datosIA = datos;
        }).catch(e => console.error("Error IA fondo:", e.message));

        bot.editMessageText(
            `📜 *Generación de Tarjeta Antigua*\n\n` +
            `Introduce la **PLACA** con su guion (ej: \`5053-QS\`):`,
            { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
        );
    }
});

// --- PERSISTENCIA EN MEMORIA ---
const userPdfs = new Map();
const userState = new Map();
const userAntiguaData = new Map();
const userTiveCompletoData = new Map();

// --- HANDLERS DE EVENTOS ---

// Configuración de persistencia para certificados por HASH
let DOMAIN = process.env.DOMAIN_URL || 'http://localhost:4000';
if (DOMAIN.endsWith('/')) DOMAIN = DOMAIN.slice(0, -1);

// Configuración QR en PDF (Cargado desde .env)
const QR_X = parseFloat(process.env.QR_X) || 12.2;
const QR_Y = parseFloat(process.env.QR_Y) || 10.2;
const QR_SIZE = parseFloat(process.env.QR_SIZE) || 72;
const COMPLETE_TEMPLATE_NAME = 'BASE ELECTRONICA TIVE PDF SIN RELLENO PDF.pdf';
const TIVE_COMPLETO_BODY_CODE = { x: 81, y: 323, width: 80, height: 18 };
const TIVE_COMPLETO_TECH_CODE = { x: 60, y: 13, width: 260, height: 40 };

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
    let normalized = p.trim().toUpperCase();

    // Si el usuario ya puso un guion y tiene 6 caracteres alfanuméricos, respetarlo
    if (normalized.includes("-")) {
        let parts = normalized.split("-");
        let alnumOnly = normalized.replace(/[^A-Z0-9]/g, "");
        if (alnumOnly.length === 6 && parts.length === 2) {
            return normalized;
        }
    }

    let clean = normalized.replace(/[^A-Z0-9]/gi, "");
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

const TIVE_COMPLETO_FIELDS = [
    { key: 'codigo_de_verificacion', dataKey: 'codVerif', x: 231, y: 602, dx: -3, dy: -7, size: 8, bold: false },
    { key: 'fecha', dataKey: 'fechaFinal', x: 180.8, y: 577.5, dx: -8, dy: -7, size: 8, bold: false },
    { key: 'zona_registral', dataKey: 'zonaLimpia', x: 144.0, y: 482.0, dx: -14, dy: 8, size: 9, bold: true },
    { key: 'sede_registral', dataKey: 'sedeLimpia', x: 141.0, y: 467.0, dx: -18, dy: 12, size: 9, bold: true },
    { key: 'parda_registral', dataKey: 'partida', x: 120.9, y: 452.9, dx: -3, dy: -7, size: 8, bold: false },
    { key: 'duadam', dataKey: 'dua', x: 103.1, y: 438, dx: -5.5, dy: -7, size: 8, bold: false },
    { key: 'titulo', dataKey: 'titulo', x: 89.3, y: 422.3, dx: -8, dy: -7, size: 8, bold: false },
    { key: 'fecha_del_titulo', dataKey: 'fechaTitulo', x: 126.3, y: 406.6, dx: -7.5, dy: -7, size: 8, bold: false },
    { key: 'categoria', dataKey: 'categoria', x: 105.1, y: 274.4, dx: -11, dy: -6.5, size: 8, bold: false },
    { key: 'marca', dataKey: 'marca', x: 89.9, y: 261.1, dx: -6, dy: -7, size: 8, bold: false },
    { key: 'modelo', dataKey: 'modelo', x: 96.8, y: 246.8, dx: -7, dy: -7, size: 8, bold: false },
    { key: 'color', dataKey: 'color', x: 88.4, y: 233.2, dx: -5, dy: -6, size: 8, bold: false },
    { key: 'numero_de_vin', dataKey: 'vin', x: 120.5, y: 220.2, dx: -5, dy: -7, size: 8, bold: false },
    { key: 'numero_de_serie', dataKey: 'serie', x: 128.3, y: 206.2, dx: -9, dy: -7, size: 8, bold: false },
    { key: 'numero_motor', dataKey: 'motor', x: 118, y: 191.9, dx: -5, dy: -7, size: 8, bold: false },
    { key: 'carroceria', dataKey: 'carroceria', x: 104.5, y: 178.6, dx: -4, dy: -7, size: 8, bold: false },
    { key: 'potencia', dataKey: 'potencia', x: 99.6, y: 164, dx: -4, dy: -7, size: 8, bold: false },
    { key: 'form_rod', dataKey: 'formRod', x: 107.6, y: 150.7, dx: -6, dy: -6, size: 8, bold: false },
    { key: 'combusble', dataKey: 'combustible', x: 108.6, y: 138.4, dx: -3, dy: -8, size: 8, bold: false },
    { key: 'asientos', dataKey: 'asientos', x: 104.1, y: 108.5, dx: -6, dy: -4, size: 8, bold: false },
    { key: 'pasajeros', dataKey: 'pasajeros', x: 103.1, y: 96.4, dx: -5, dy: -6, size: 8, bold: false },
    { key: 'ruedas', dataKey: 'ruedas', x: 103.9, y: 67, dx: -4, dy: -5.5, size: 8, bold: false },
    { key: 'ejes', dataKey: 'ejes', x: 103.5, y: 81.8, dx: -5, dy: -5, size: 8, bold: false },
    { key: 'placa', dataKey: 'placa', x: 317.9, y: 406.9, dx: -6, dy: -6, size: 25, bold: true },
    { key: 'año_fabricacion', dataKey: 'añoFabricacion', x: 392.6, y: 272.6, dx: -8, dy: -7, size: 8, bold: false },
    { key: 'cilindros', dataKey: 'cilindros', x: 208.6, y: 114.2, dx: 9, dy: -9, size: 8, bold: false },
    { key: 'longitud', dataKey: 'longitud', x: 213.9, y: 100.2, dx: 4, dy: -8, size: 8, bold: false },
    { key: 'altura', dataKey: 'altura', x: 213.9, y: 86.2, dx: 4, dy: -8.5, size: 8, bold: false },
    { key: 'ancho', dataKey: 'ancho', x: 212.6, y: 71.6, dx: 5, dy: -8, size: 8, bold: false },
    { key: 'cilindro', dataKey: 'cilindrada', x: 333.9, y: 109.6, dx: 24, dy: -5, size: 8, bold: false },
    { key: 'p_bruto', dataKey: 'pBruto', x: 326.6, y: 97.6, dx: 33, dy: -6, size: 8, bold: false },
    { key: 'campo_30', dataKey: 'pNeto', x: 329.9, y: 82.9, dx: 30, dy: -4, size: 8, bold: false },
    { key: 'campo_31', dataKey: 'cargaUtil', x: 322.6, y: 71.6, dx: 38, dy: -6, size: 8, bold: false },
    { key: 'version', dataKey: 'version', x: 273.9, y: 155.9, dx: -8, dy: -8, size: 8, bold: false },
    { key: 'año_modelo', dataKey: 'añoModelo', x: 396.6, y: 262.9, dx: -6, dy: -8, size: 8, bold: false },
    { key: 'titulo_numero', dataKey: 'tituloNo', x: 190.6, y: 590.2, dx: -6.5, dy: -8, size: 8, bold: false },
];

function limpiarEtiquetaRegistral(valor = '') {
    let limpio = safe(valor);
    const labelsToRemove = [
        "ZONA REGISTRAL N°", "ZONA REGISTRAL Nº", "ZONA REGISTRAL N", "ZONA REGISTRAL",
        "SEDE REGISTRAL -", "SEDE REGISTRAL-", "SEDE REGISTRAL", "SEDE"
    ];
    labelsToRemove.forEach(label => {
        const regex = new RegExp(`^${label}\\s*[:\\-]*\\s*`, 'i');
        limpio = limpio.replace(regex, '');
    });
    return limpio.trim();
}

function buscarArchivoFirma(sede) {
    if (!sede) return null;
    let cleanSede = safe(sede).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

    const firmasDir = path.join(__dirname, 'tarjeta', 'firmas');
    if (!fs.existsSync(firmasDir)) {
        console.error(`[FIRMA] ❌ Carpeta no existe: ${firmasDir}`);
        return null;
    }

    const files = fs.readdirSync(firmasDir);

    // Mapeo manual para typos conocidos en la carpeta de firmas
    if (cleanSede === 'tarapoto') cleanSede = 'taraporo';
    if (cleanSede === 'pucallpa') cleanSede = 'pucullpa';
    if (cleanSede === 'huanuco') cleanSede = 'huanuco'; // 'frima de huanuco.jpg'

    // 1. Intentar coincidencia exacta o cercana con el nombre limpio de la sede
    let bestMatch = files.find(f => {
        const cleanFile = f.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
        // Buscar que coincida de forma prioritaria con la firma simple (sin números adicionales como 2, 3, etc.)
        return cleanFile.includes(cleanSede) && !cleanFile.includes(cleanSede + '2') && !cleanFile.includes(cleanSede + '3') && !cleanFile.includes(cleanSede + '4') && !cleanFile.includes(cleanSede + '6') && !cleanFile.includes(cleanSede + '7');
    });

    // 2. Si no hay coincidencia simple, buscar cualquier coincidencia con la sede
    if (!bestMatch) {
        bestMatch = files.find(f => {
            const cleanFile = f.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '');
            return cleanFile.includes(cleanSede);
        });
    }

    if (bestMatch) {
        const matchedPath = path.join(firmasDir, bestMatch);
        console.log(`[FIRMA] ✅ Sede '${sede}' mapeada a firma: '${bestMatch}'`);
        return matchedPath;
    }

    console.log(`[FIRMA] ⚠️ No se encontró firma para la sede: '${sede}'`);
    return null;
}

function valorCompleto(datos, dataKey) {
    const value = datos[dataKey];
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function valorPdf417(datos, dataKey) {
    return valorCompleto(datos, dataKey)
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function formatearPdf417TiveCompleto(datos) {
    const zona = valorPdf417(datos, 'zonaLimpia') || valorPdf417(datos, 'zona');
    const sede = valorPdf417(datos, 'sedeLimpia') || valorPdf417(datos, 'sede');
    const placa = valorPdf417(datos, 'placa');
    const partida = valorPdf417(datos, 'partida');
    const dua = valorPdf417(datos, 'dua');
    const titulo = valorPdf417(datos, 'titulo');
    const fechaTitulo = valorPdf417(datos, 'fechaTitulo');
    const estado = valorPdf417(datos, 'estado') || 'NUEVO';
    const codVerif = valorPdf417(datos, 'codVerif');
    const marca = valorPdf417(datos, 'marca');
    const motor = valorPdf417(datos, 'motor');
    const vin = valorPdf417(datos, 'vin');
    const serie = valorPdf417(datos, 'serie');

    return [
        `!ZONA REGISTRAL N ${zona}!SEDE REGISTRAL`,
        `- ${sede.padEnd(22)}!${placa} !`,
        `${partida}!${dua}!`,
        `${titulo}!${fechaTitulo}!`,
        `${estado.padEnd(22)}!    !${codVerif}!`,
        `${marca.padEnd(22)}!`,
        `${motor.padEnd(22)}!`,
        `${vin.padEnd(22)}!`,
        serie,
    ].join('\n');
}

function placaRequiereConfirmacion(valor = '') {
    const original = safe(valor);
    if (!original) return true;
    return !original.includes('-');
}

function extraerTextoPdfTive(pdfBuffer) {
    const pdfBytes = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    const chunks = [];
    const objectRegex = /(\d+)\s+0\s+obj\s*<<(.*?)>>\s*stream\r?\n/gs;
    let match;

    while ((match = objectRegex.exec(pdfBytes.toString('latin1'))) !== null) {
        const dictionary = match[2];
        const start = match.index + match[0].length;
        const end = pdfBytes.indexOf(Buffer.from('endstream'), start);
        if (end < 0) continue;

        const rawStream = pdfBytes.subarray(start, end);
        const trimmedStream = rawStream.toString('latin1').replace(/[\r\n]+$/g, '');
        let dataBuffer = Buffer.from(trimmedStream, 'latin1');

        if (dictionary.includes('/FlateDecode')) {
            try {
                dataBuffer = zlib.inflateSync(dataBuffer);
            } catch (_) {
                continue;
            }
        }

        const streamText = dataBuffer.toString('latin1');
        const textRegex = /\((.*?)\)\s*Tj/gs;
        let textMatch;
        while ((textMatch = textRegex.exec(streamText)) !== null) {
            const text = textMatch[1]
                .replace(/\\\(/g, '(')
                .replace(/\\\)/g, ')')
                .replace(/\\\\/g, '\\');
            chunks.push(text);
        }
    }

    return chunks.join('\n');
}

function normalizarTextoBusqueda(texto = '') {
    return safe(texto)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function buscarValorTive(texto, etiqueta) {
    const escaped = etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}\\s+([^\\n]+)`, 'i');
    const match = regex.exec(texto);
    if (match) return safe(match[1]);

    const labelNormalizado = normalizarTextoBusqueda(etiqueta)
        .toLowerCase()
        .replace(/\s*:\s*$/, '');
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNormalizada = normalizarTextoBusqueda(line).toLowerCase();
        const lineSinDosPuntos = lineNormalizada.replace(/\s*:\s*$/, '');

        if (lineSinDosPuntos === labelNormalizado) {
            return safe(lines[i + 1] || '');
        }

        if (lineNormalizada.startsWith(`${labelNormalizado} `) || lineNormalizada.startsWith(`${labelNormalizado}:`)) {
            const value = line.slice(Math.min(line.length, etiqueta.length)).replace(/^[:\s]+/, '');
            if (safe(value)) return safe(value);
            return safe(lines[i + 1] || '');
        }
    }

    return '';
}

function normalizarValorNumerico(valor = '') {
    const limpio = safe(valor).replace(',', '.');
    const match = limpio.match(/\d+(?:\.\d+)?/);
    return match ? match[0] : limpio;
}

function buscarTituloNumeroTive(texto) {
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
        if (normalizarTextoBusqueda(lines[i]).toLowerCase() === 'titulo nro' && i > 0) {
            return safe(lines[i - 1]);
        }
    }
    return '';
}

function buscarTituloValorTive(texto) {
    const lines = texto.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (const line of lines) {
        const normalized = normalizarTextoBusqueda(line).toLowerCase();
        if (normalized.startsWith('titulo ') && normalized !== 'titulo nro') {
            return safe(line.split(/\s+/, 2)[1]);
        }
    }
    return '';
}

function normalizarTituloDesdeTituloNo(tituloNo = '') {
    const limpio = safe(tituloNo).replace(/\s+/g, '');
    if (!limpio) return '';

    // Check if it's in YYYY-NNNNNN format and convert to NNNNNN-YYYY
    const dateNumberMatch = limpio.match(/^(\d{4})-(\d+)$/);
    if (dateNumberMatch) {
        // Convert from "YYYY-NNNNNN" to "NNNNNN-YYYY"
        return `${dateNumberMatch[2]}-${dateNumberMatch[1]}`;
    }

    // Otherwise, return as-is for other formats like "NNNNN-YYYY" or "NNNN-NNNN"
    const match = limpio.match(/^(\d+)-(\d+)$/);
    if (!match) return limpio;
    return `${match[1]}-${match[2]}`;
}

function extraerTiveCompletoConLibreria(pdfBuffer) {
    console.log(`[TIVE COMPLETO] 📄 Extrayendo con libreria (Buffer size: ${pdfBuffer.length} bytes)...`);
    const text = extraerTextoPdfTive(pdfBuffer);
    if (!safe(text)) {
        throw new Error('No se pudo leer texto del PDF. Asegúrate de que sea un TIVE electrónico con texto embebido.');
    }

    const fechaTitulo = buscarValorTive(text, 'Fecha');
    const tituloNo = normalizarTituloDesdeTituloNo(buscarTituloNumeroTive(text));
    const tituloNormalizado = tituloNo || normalizarTituloDesdeTituloNo(buscarTituloNumeroTive(text));
    const datos = {
        codVerif: '',
        fechaFinal: fechaTitulo,
        zona: '',
        sede: '',
        partida: buscarValorTive(text, 'Partida'),
        dua: '',
        titulo: tituloNormalizado || buscarTituloValorTive(text),
        fechaTitulo: fechaTitulo ? fechaTitulo.split(/\s+/)[0] : '',
        categoria: buscarValorTive(text, 'Categoria'),
        marca: buscarValorTive(text, 'Marca'),
        modelo: buscarValorTive(text, 'Modelo'),
        color: buscarValorTive(text, 'Color'),
        vin: buscarValorTive(text, 'Nro. VIN'),
        serie: buscarValorTive(text, 'Nro. Serie'),
        motor: buscarValorTive(text, 'Nro. Motor'),
        carroceria: buscarValorTive(text, 'Tipo Carroceria') || buscarValorTive(text, 'Tipo Carrocería'),
        potencia: buscarValorTive(text, 'Potencia Motor'),
        formRod: buscarValorTive(text, 'Formula Rodante') || buscarValorTive(text, 'Fórmula Rodante'),
        combustible: buscarValorTive(text, 'Tipo Combustible'),
        asientos: buscarValorTive(text, 'Nro. Asientos'),
        pasajeros: buscarValorTive(text, 'Nro. Pasajeros'),
        ruedas: buscarValorTive(text, 'Nro. Ruedas'),
        ejes: buscarValorTive(text, 'Nro. Ejes'),
        placa: buscarValorTive(text, 'Placa :'),
        placaOriginal: buscarValorTive(text, 'Placa :'),
        añoFabricacion: buscarValorTive(text, 'Año Fabricación') || buscarValorTive(text, 'Ano Fabricacion'),
        cilindros: buscarValorTive(text, 'Nro. Cilindros'),
        longitud: normalizarValorNumerico(buscarValorTive(text, 'Longitud')),
        altura: normalizarValorNumerico(buscarValorTive(text, 'Altura')),
        ancho: normalizarValorNumerico(buscarValorTive(text, 'Ancho')),
        cilindrada: normalizarValorNumerico(buscarValorTive(text, 'Cilindrada')),
        pBruto: normalizarValorNumerico(buscarValorTive(text, 'Peso Bruto')),
        pNeto: normalizarValorNumerico(buscarValorTive(text, 'Peso Neto')),
        cargaUtil: normalizarValorNumerico(buscarValorTive(text, 'Carga Util')),
        version: buscarValorTive(text, 'Nro. Version') || buscarValorTive(text, 'Nro. Versión'),
        añoModelo: buscarValorTive(text, 'Año Modelo') || buscarValorTive(text, 'Ano Modelo'),
        tituloNo,
    };

    console.log(`[TIVE COMPLETO] ✅ Extracción por librería lista. Placa encontrada: ${datos.placa || '(vacía)'}`);
    return datos;
}

const TIVE_COMPLETO_REQUIRED_FIELDS = [
    { key: 'zona', label: 'ZONA REGISTRAL' },
    { key: 'sede', label: 'SEDE REGISTRAL' },
    { key: 'partida', label: 'PARTIDA REGISTRAL' },
    { key: 'dua', label: 'DUA/DAM' },
    { key: 'titulo', label: 'TÍTULO' },
    { key: 'fechaTitulo', label: 'FECHA DEL TÍTULO' },
    { key: 'placa', label: 'PLACA' },
    { key: 'categoria', label: 'CATEGORÍA' },
    { key: 'marca', label: 'MARCA' },
    { key: 'modelo', label: 'MODELO' },
    { key: 'color', label: 'COLOR' },
    { key: 'vin', label: 'VIN' },
    { key: 'serie', label: 'NÚMERO DE SERIE' },
    { key: 'motor', label: 'NÚMERO DE MOTOR' },
];

function generarCodigoVerificacion() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function generarFechaHoraTive(date = new Date()) {
    const parts = new Intl.DateTimeFormat('es-PE', {
        timeZone: process.env.TIVE_TIMEZONE || 'America/Lima',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${byType.day}/${byType.month}/${byType.year} ${byType.hour}:${byType.minute}:${byType.second}`;
}

function generarHashVerificacion(sourceBuffer, datos) {
    const hash = crypto.createHash('sha256');
    if (sourceBuffer) {
        hash.update(sourceBuffer);
    } else {
        hash.update(JSON.stringify(datos));
    }
    return hash.digest('hex').toUpperCase();
}

function prepararDatosTiveCompleto(datos) {
    const prepared = { ...datos };
    prepared.placaOriginal = safe(prepared.placaOriginal || prepared.placa);
    prepared.placa = fmtPlaca(prepared.placa || '');
    prepared.codVerif = safe(prepared.codVerif) || generarCodigoVerificacion();
    prepared.fechaFinal = generarFechaHoraTive();
    prepared.añoFabricacion = safe(prepared.añoFabricacion) || safe(prepared.añoModelo);
    return prepared;
}

function obtenerCamposFaltantesTiveCompleto(datos) {
    return TIVE_COMPLETO_REQUIRED_FIELDS.filter(field => {
        if (field.key === 'placa') return placaRequiereConfirmacion(datos.placaOriginal);
        return !safe(datos[field.key]);
    });
}

async function iniciarCapturaFaltantesTiveCompleto(chatId, datos, sourceBuffer = null) {
    const prepared = prepararDatosTiveCompleto(datos);
    const sourceHash = generarHashVerificacion(sourceBuffer, prepared);
    const missingFields = obtenerCamposFaltantesTiveCompleto(prepared);

    if (missingFields.length === 0) {
        userTiveCompletoData.delete(chatId);
        userState.delete(chatId);
        await generarTiveCompleto(chatId, prepared, null, sourceHash);
        return;
    }

    userTiveCompletoData.set(chatId, { datos: prepared, missingFields, index: 0, sourceHash });
    userState.set(chatId, 'awaiting_tive_completo_field');
    const current = missingFields[0];
    await bot.sendMessage(chatId, `✍️ Falta el dato *${current.label}*.\nEnvíalo ahora para continuar con *TIVE COMPLETO*.`, {
        parse_mode: 'Markdown'
    });
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
        // Truco de sobreimpresión para extra negrita
        page.drawText(txt, { x, y: height - y, size, font: customFont, color });
        page.drawText(txt, { x: x + 0.2, y: height - y, size, font: customFont, color });
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
    draw(datos.zona, 269, 139, 9);
    draw(datos.sede, 225, 147.6, 8);
    draw(datos.reparticion, 169, 164, 8);
    draw(datos.placaSede, 90, 176, 8.5); // Placa Sede
    draw(datos.placa, 80, 195, 18.5);
    // draw(datos.titulo, 202, 178, 9);
    drawSeg(datos.partida, 233, 195, 11, 10, 8);
    draw(datos.apPaterno, 105, 235, 8);
    draw(datos.apPaterno2, 189, 235, 8);
    draw(datos.apMaterno, 105, 245, 8);
    draw(datos.apMaterno2, 189, 245, 8);
    draw(datos.nombres, 105, 257, 8);
    draw(datos.nombres2, 185, 258, 8);
    draw(datos.domicilio, 68, 283, 7.2);
    draw(datos.sedeDomicilio, 105, 269, 7.5);
    drawSeg(datos.fechaPropiedad, 126, 296, 10, 11, 9.5);
    drawSeg(datos.fechaInferior, 210, 365, 15, 14, 10.5, gris);

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
    draw(datos.marca, 425, 149, 11);
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
    draw(datos.zona, 436, 357.5, 4.3, gris, fontArialBold);
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

    const barText = formatearPdf417TiveCompleto({
        ...datos,
        zonaLimpia,
        sedeLimpia,
    });
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

async function generarTiveCompleto(chatId, datos, qrCustomLink = null, verificationHash = null) {
    console.log(`[TIVE COMPLETO] 🎨 Generando PDF completo para: ${safe(datos.placa)}`);

    const templatePath = getTemplatePath(COMPLETE_TEMPLATE_NAME);
    const pdfDoc = await PDFDocument.load(fs.readFileSync(templatePath));
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const negro = rgb(0, 0, 0);
    const gris = rgb(0.6, 0.6, 0.6);

    const baseDatos = prepararDatosTiveCompleto(datos);
    const datosCompletos = {
        ...baseDatos,
        zonaLimpia: limpiarEtiquetaRegistral(baseDatos.zona),
        sedeLimpia: limpiarEtiquetaRegistral(baseDatos.sede),
    };
    const pdfDisplayName = `TIVE_${safe(datosCompletos.placa) || 'DOC'}`;
    pdfDoc.setTitle(pdfDisplayName);
    pdfDoc.setSubject('Tarjeta de Identificacion Vehicular Electronica');
    pdfDoc.setAuthor('SUNARP');
    pdfDoc.setCreator('TIVE');
    pdfDoc.setProducer('TIVE');

    for (const field of TIVE_COMPLETO_FIELDS) {
        const value = valorCompleto(datosCompletos, field.dataKey);
        if (!value) continue;
        page.drawText(value, {
            x: field.x + field.dx,
            y: field.y + field.dy,
            size: field.size,
            font: field.bold ? fontBold : fontRegular,
            color: ['zona_registral', 'sede_registral'].includes(field.key.trim()) ? gris : negro,
        });
    }

    const qrHeaderText = safe(datosCompletos.placa) || 'SIN-PLACA';
    const hash = verificationHash || generarHashVerificacion(null, datosCompletos);
    const finalQRLink = qrCustomLink || `${DOMAIN}/servicio/verCertificado/Tive/${hash}`;
    const qrHeaderImg = await pdfDoc.embedPng(await QRCode.toDataURL(finalQRLink, {
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
    }));
    const headerW = QR_SIZE;
    const headerH = headerW;
    const headerX = (QR_X / 100) * width;
    const headerY = height - ((QR_Y / 100) * height) - headerW;
    page.drawImage(qrHeaderImg, { x: headerX, y: headerY, width: headerW, height: headerH });

    const plateBarcodeImg = await pdfDoc.embedPng(await bwipjs.toBuffer({
        bcid: 'code128',
        text: qrHeaderText,
        scale: 4,
        height: 12,
        includetext: false,
        backgroundcolor: 'FFFFFF',
    }));
    page.drawImage(plateBarcodeImg, TIVE_COMPLETO_BODY_CODE);

    const pdf417Text = formatearPdf417TiveCompleto(datosCompletos);
    const pdf417Img = await pdfDoc.embedPng(await bwipjs.toBuffer({
        bcid: 'pdf417',
        text: pdf417Text,
        scale: 1,
        height: 16,
        includetext: false,
        backgroundcolor: 'FFFFFF',
        paddingwidth: 0,
        paddingheight: 0,
    }));
    page.drawImage(pdf417Img, TIVE_COMPLETO_TECH_CODE);

    // --- INSERCIÓN DE FIRMA REGISTRAL SEGÚN LA SEDE ---
    try {
        const sedeInput = datosCompletos.sedeLimpia || datosCompletos.sede;
        const firmaPath = buscarArchivoFirma(sedeInput);
        if (firmaPath && fs.existsSync(firmaPath)) {
            const signatureImgBytes = fs.readFileSync(firmaPath);
            let embeddedImg;
            if (firmaPath.toLowerCase().endsWith('.png')) {
                embeddedImg = await pdfDoc.embedPng(signatureImgBytes);
            } else {
                embeddedImg = await pdfDoc.embedJpg(signatureImgBytes);
            }

            // Posición: abajo lado derecho, donde está el espacio de la firma / QR
            page.drawImage(embeddedImg, {
                x: 350,
                y: 13,
                width: 100,
                height: 50
            });
            console.log(`[TIVE COMPLETO] ✍️ Firma de la sede '${sedeInput}' incrustada exitosamente en el PDF.`);
        }
    } catch (err) {
        console.error(`[TIVE COMPLETO] ❌ Error incrustando firma de la sede:`, err.message);
    }

    const outBytes = await pdfDoc.save();
    const finalPath = path.join(uploadDir, `${hash}.pdf`);
    fs.writeFileSync(finalPath, Buffer.from(outBytes));
    console.log(`[TIVE COMPLETO] ✅ PDF verificable guardado en: ${finalPath}`);

    const fileName = `${pdfDisplayName}.pdf`;
    await bot.sendDocument(chatId, Buffer.from(outBytes), {
        caption:
            `✅ TIVE COMPLETO generado para ${qrHeaderText}\n\n` +
            `🔐 Hash: \`${hash}\`\n` +
            `🌐 Link: \`${finalQRLink}\``,
        parse_mode: 'Markdown'
    }, { filename: fileName });
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
                    [{ text: "🚀 Generar Fotos TIVE PVC", callback_data: "ask_qr" }],
                    [{ text: "🧾 TIVE COMPLETO", callback_data: "gen_tive_completo" }],
                    [{ text: "📜 Generar Tarjeta Antigua", callback_data: "gen_antigua" }],
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

    if (state === "awaiting_tive_completo_field" && msg.text && !msg.text.startsWith('/')) {
        const pending = userTiveCompletoData.get(chatId);
        if (!pending) {
            userState.delete(chatId);
            return bot.sendMessage(chatId, "⚠️ Se perdió el estado de captura. Vuelve a elegir *TIVE COMPLETO*.", { parse_mode: 'Markdown' });
        }
        const current = pending.missingFields[pending.index];
        const rawValue = msg.text.trim();
        pending.datos[current.key] = current.key === 'placa' ? fmtPlaca(rawValue) : rawValue;
        if (current.key === 'placa') {
            pending.datos.placaOriginal = rawValue;
        }
        pending.index += 1;

        if (pending.index >= pending.missingFields.length) {
            userTiveCompletoData.delete(chatId);
            userState.delete(chatId);
            await bot.sendMessage(chatId, "✅ Datos faltantes completados. Generando *TIVE COMPLETO*...", { parse_mode: 'Markdown' });
            try {
                await generarTiveCompleto(chatId, pending.datos, null, pending.sourceHash);
            } catch (e) {
                console.error(`[BOT] ❌ Error generando TIVE COMPLETO:`, e);
                bot.sendMessage(chatId, "❌ Error: " + e.message);
            }
        } else {
            userTiveCompletoData.set(chatId, pending);
            const next = pending.missingFields[pending.index];
            await bot.sendMessage(chatId, `✍️ Falta el dato *${next.label}*.\nEnvíalo para continuar.`, { parse_mode: 'Markdown' });
        }
    } else if (state === "awaiting_qr" && msg.text && !msg.text.startsWith('/')) {
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
    } else if (state === "awaiting_antigua_placa" && msg.text) {
        userAntiguaData.get(chatId).placa = msg.text.trim().toUpperCase();
        userState.set(chatId, "awaiting_antigua_clase");
        bot.sendMessage(chatId, "🛵 Introduce la **CLASE** (ej: MOTOCICLETA):", { parse_mode: 'Markdown' });
    } else if (state === "awaiting_antigua_clase" && msg.text) {
        userAntiguaData.get(chatId).clase = msg.text.trim().toUpperCase();
        userState.set(chatId, "awaiting_antigua_placa_sede");
        bot.sendMessage(chatId, "📍 Introduce la **PLACA SEDE** (ej: TARAPOTO):", { parse_mode: 'Markdown' });
    } else if (state === "awaiting_antigua_placa_sede" && msg.text) {
        userAntiguaData.get(chatId).placaSede = msg.text.trim().toUpperCase();
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
        userState.set(chatId, "awaiting_antigua_sede_domicilio");
        bot.sendMessage(chatId, "📍 Introduce la **SEDE DOMICILIO** (ej: YURIMAGUAS):", { parse_mode: 'Markdown' });
    } else if (state === "awaiting_antigua_sede_domicilio" && msg.text) {
        userAntiguaData.get(chatId).sedeDomicilio = msg.text.trim().toUpperCase();
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
                bot.deleteMessage(chatId, status.message_id).catch(() => { });
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
            if (data.placa) datos.placa = fmtPlaca(data.placa);
            if (data.clase) datos.clase = data.clase;
            if (data.placaSede) datos.placaSede = data.placaSede;
            if (data.sedeDomicilio) datos.sedeDomicilio = data.sedeDomicilio;
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

    if (messageId) bot.deleteMessage(chatId, messageId).catch(() => { });
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
