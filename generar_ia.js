/**
 * ========================================================
 *  GENERADOR TIVE PRO CON IA (GEMINI)
 * ========================================================
 *  Este script usa la IA de Google para leer PDFs escaneados
 *  y generar automáticamente el Anverso y Reverso.
 * ========================================================
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const bwipjs = require('bwip-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURACIÓN ---
const API_KEY = "AIzaSyBQMCOse-Af9uQwW6W-kCp_eRzmA9jNgxw";
const genAI = new GoogleGenerativeAI(API_KEY);

const safe = (t) => t ? String(t).toUpperCase() : '';

// --- TABLA CODE 128 ---
const C128_PATTERNS = { '0': '11011001100', '1': '11001101100', '2': '11001100110', '3': '10001101100', '4': '10001100110', '5': '10110001100', '6': '10110000110', '7': '10110110000', '8': '10110011011', '9': '11001011000', 'A': '11000101100', 'B': '11000100110', 'C': '11011000100', 'D': '11011000010', 'E': '11011011000', 'F': '11011001101', 'G': '11011011011', 'H': '11001101101', 'I': '11001101111', 'J': '11011110110', 'K': '11011111011', 'L': '11110110110', 'M': '11110110111', 'N': '11110111101', 'O': '11110111111', 'P': '11001101101', 'Q': '11001101111', 'R': '11011110110', 'S': '11011111011', 'T': '11110110110', 'U': '11110110111', 'V': '11110111101', 'W': '11110111111', 'X': '11001101101', 'Y': '11001101111', 'Z': '11011110110', '-': '11000111010', '.': '11011011110', ' ': '11011011011', ':': '11011111010' };

function drawRealBarcode(page, text, x, y, width, height) {
    const startCode = '11010010000'; const stopCode = '1100011101011';
    let pattern = startCode;
    for (let char of safe(text).toUpperCase()) { pattern += C128_PATTERNS[char] || '11011011011'; }
    pattern += stopCode;
    const moduleWidth = width / pattern.length;
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === '1') { page.drawRectangle({ x: x + (i * moduleWidth), y, width: moduleWidth, height, color: rgb(0, 0, 0) }); }
    }
}

// ========================================================
//  EXTRACCIÓN CON IA (GEMINI)
// ========================================================
async function extraerConIA(pdfPath) {
    console.log("🧠 La IA está analizando el documento...");
    // Usando 1.5 Flash que tiene más cuota gratuita
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    
    const pdfData = fs.readFileSync(pdfPath).toString("base64");
    const prompt = `Analiza este documento TIVE (Tarjeta de Identificacion Vehicular Electronica). 
    Extrae TODOS los datos tecnicos y registrales.
    Devuelve UNICAMENTE un objeto JSON con estas llaves exactas: 
    zona, sede, partida, dua, titulo, fechaTitulo, placa, codVerif, tituloNo, fechaFinal, 
    categoria, marca, modelo, color, añoModelo, version, vin, serie, motor, carroceria, potencia, formRod, combustible, asientos, pasajeros, ruedas, ejes, cilindros, longitud, altura, ancho, cilindrada, pBruto, pNeto, cargaUtil. 
    Usa solo valores encontrados en el documento. No inventes datos.`;

    const result = await model.generateContent([
        { inlineData: { data: pdfData, mimeType: "application/pdf" } },
        { text: prompt }
    ]);

    const responseText = result.response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(responseText);
}

// ========================================================
//  GENERACIÓN DE PDFS
// ========================================================
async function generarAnverso(datos) {
    const template = path.join(__dirname, 'tarjeta', 'adelantexd.pdf');
    if (!fs.existsSync(template)) return;
    const pdfDoc = await PDFDocument.load(fs.readFileSync(template));
    const page = pdfDoc.getPages()[0];
    const { height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const draw = (t, x, y, size = 6.5, color = rgb(0,0,0)) => 
        page.drawText(safe(t), { x, y: height - y, size, font, color });

    draw(datos.zona, 60, 56, 5.5, rgb(0.4, 0.4, 0.4));
    draw(datos.sede, 55, 63, 5.5, rgb(0.4, 0.4, 0.4));
    draw(datos.partida, 65, 75);
    draw(datos.dua, 50, 89);
    draw(datos.titulo, 34.5, 104);
    draw(datos.fechaTitulo, 65, 117);
    draw(datos.placa, 162, 115, 17.5);
    draw(datos.codVerif, 213, 142, 4.2);
    draw(datos.tituloNo, 183, 149.5, 4.2);
    draw(datos.fechaFinal, 177, 158, 4.2);

    drawRealBarcode(page, datos.placa, 10, height - 168, 80, 15);
    const qrImg = await pdfDoc.embedPng(await QRCode.toDataURL(`https://tive.sunarp.gob.pe/ver/${safe(datos.placa)}`, { margin: 1 }));
    page.drawImage(qrImg, { x: 100, y: height - 170, width: 52, height: 52 });

    fs.writeFileSync(`anverso_${safe(datos.placa) || 'final'}.pdf`, await pdfDoc.save());
}

async function generarReverso(datos) {
    const template = path.join(__dirname, 'tarjeta', 'atrasxd.pdf');
    if (!fs.existsSync(template)) return;
    const pdfDoc = await PDFDocument.load(fs.readFileSync(template));
    const page = pdfDoc.getPages()[0];
    const { height, width } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Ajuste de posiciones REVERSO para que encajen mejor
    const style = { size: 4.8, font, color: rgb(0, 0, 0) };
    const d = (t, x, y) => page.drawText(safe(t), { x, y: height - y, ...style });

    // Bloque Izquierdo
    d(datos.categoria, 37, 40.5);
    d(datos.marca, 37, 47.5);
    d(datos.modelo, 37, 54.5);
    d(datos.color, 37, 61.5);
    d(datos.vin, 60, 69.5);
    d(datos.serie, 60, 76.5);
    d(datos.motor, 60, 83.5);
    d(datos.carroceria, 60, 90.5);
    d(datos.potencia, 48, 97.5);
    d(datos.formRod, 48, 104.5);
    d(datos.combustible, 52, 111.5);

    // Bloque Derecho Superior
    d(datos.añoModelo, 226, 39);
    d(datos.version, 153, 100);

    // Bloque Inferior
    const s2 = { size: 4.2, font, color: rgb(0,0,0) };
    const d2 = (t, x, y) => page.drawText(safe(t), { x, y: height - y, ...s2 });

    d2(datos.asientos, 46, 122);
    d2(datos.pasajeros, 46, 129);
    d2(datos.ruedas, 46, 134.9);
    d2(datos.ejes, 46, 141.9);

    d2(datos.cilindros, 117, 121);
    d2(datos.longitud, 117, 127.8);
    d2(datos.altura, 117, 134.6);
    d2(datos.ancho, 117, 141.4);

    d2(datos.cilindrada, 205, 121);
    d2(datos.pBruto, 205, 127.8);
    d2(datos.pNeto, 205, 134.6);
    d2(datos.cargaUtil, 205, 142);

    // Barcode PDF417
    const technicos = `CAT:${safe(datos.categoria)}|MAR:${safe(datos.marca)}|MOD:${safe(datos.modelo)}|VIN:${safe(datos.vin)}|MOT:${safe(datos.motor)}`;
    const barImg = await pdfDoc.embedPng(await bwipjs.toBuffer({ bcid: 'pdf417', text: technicos, scale: 2, height: 12 }));
    page.drawImage(barImg, { x: (width/2)-(170/2), y: 4, width: 170, height: 22 });

    fs.writeFileSync(`reverso_${safe(datos.placa) || 'final'}.pdf`, await pdfDoc.save());
}

async function main() {
    const pdf = process.argv[2];
    if (!pdf) return console.log("Uso: node generar_ia.js archivo.pdf");
    
    try {
        const datos = await extraerConIA(pdf);
        console.log("✅ Datos extraídos con éxito por la IA.");
        await generarAnverso(datos);
        await generarReverso(datos);
        console.log("\n✨ ¡Tarjetas generadas! Revisa los archivos anverso_... y reverso_...");
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

main();
