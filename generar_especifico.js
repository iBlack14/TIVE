const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const bwipjs = require('bwip-js');

const datos = {
    // Anverso
    zona: "ZONA REGISTRAL N° I",
    sede: "PIURA",
    partida: "61026554",
    dua: "118-2025-10-543705-8",
    titulo: "2026-959840",
    fechaTitulo: "25/03/2026",
    placa: "1274-UP",
    codVerif: "49747854",
    tituloNo: "959840-2026",
    fechaFinal: "25/03/2026 12:15:02",
    // Reverso
    categoria: "L3",
    marca: "SUZUKI",
    modelo: "GSX-R150 ABS",
    color: "NEGRO ROJO",
    añoModelo: "2026",
    version: "GSX-R150 ABS",
    vin: "9FSDL23E3TC101115",
    serie: "9FSDL23E3TC101115",
    motor: "CGA2258481",
    carroceria: "MOTOCICLETA",
    potencia: "14,16@10500",
    formRod: "2X1",
    combustible: "GASOLINA",
    asientos: "2",
    pasajeros: "1",
    ruedas: "2",
    ejes: "2",
    cilindros: "1",
    longitud: "2.02",
    altura: "1.075",
    ancho: "0.70",
    cilindrada: "0.147",
    pBruto: "0.280",
    pNeto: "0.130",
    cargaUtil: "0.150"
};

// --- Reutilizamos las funciones de barcode ---
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

async function generar() {
    console.log('🚀 Generando tarjetas para SUZUKI 1274-UP...');

    // 1. ANVERSO
    const antPath = path.join(__dirname, 'tarjeta', 'adelantexd.pdf');
    const pdfAnt = await PDFDocument.load(fs.readFileSync(antPath));
    const pageA = pdfAnt.getPages()[0];
    const { height: hA } = pageA.getSize();
    const fontB = await pdfAnt.embedFont(StandardFonts.HelveticaBold);
    
    pageA.drawText(datos.zona, { x: 60, y: hA - 56, size: 5.5, font: fontB, color: rgb(0.6,0.6,0.6) });
    pageA.drawText(datos.sede, { x: 55, y: hA - 63, size: 5.5, font: fontB, color: rgb(0.6,0.6,0.6) });
    pageA.drawText(datos.partida, { x: 65, y: hA - 75, size: 6.8, font: fontB });
    pageA.drawText(datos.dua, { x: 50, y: hA - 89, size: 6.8, font: fontB });
    pageA.drawText(datos.titulo, { x: 34.5, y: hA - 104, size: 6.8, font: fontB });
    pageA.drawText(datos.fechaTitulo, { x: 65, y: hA - 117, size: 6.8, font: fontB });
    pageA.drawText(datos.placa, { x: 162, y: hA - 115, size: 17.9, font: fontB });
    pageA.drawText(datos.codVerif, { x: 213, y: hA - 142, size: 4.5, font: fontB });
    pageA.drawText(datos.tituloNo, { x: 183, y: hA - 149.5, size: 4.5, font: fontB });
    pageA.drawText(datos.fechaFinal, { x: 177, y: hA - 158, size: 4.5, font: fontB });
    drawRealBarcode(pageA, datos.placa, 10, hA - 168, 80, 15);
    const qrImg = await pdfAnt.embedPng(await QRCode.toDataURL(`https://tive.sunarp.gob.pe/ver/${datos.placa}`, { margin: 1 }));
    pageA.drawImage(qrImg, { x: 100, y: hA - 170, width: 52, height: 52 });
    fs.writeFileSync('anverso_SUZUKI_1274UP.pdf', await pdfAnt.save());

    // 2. REVERSO
    const revPath = path.join(__dirname, 'tarjeta', 'atrasxd.pdf');
    const pdfRev = await PDFDocument.load(fs.readFileSync(revPath));
    const pageR = pdfRev.getPages()[0];
    const { height: hR, width: wR } = pageR.getSize();
    const s = { size: 4.5, font: fontB };

    pageR.drawText(datos.categoria, { x: 37, y: hR - 40.5, ...s });
    pageR.drawText(datos.marca, { x: 37, y: hR - 47.5, ...s });
    pageR.drawText(datos.modelo, { x: 37, y: hR - 54.5, ...s });
    pageR.drawText(datos.color, { x: 37, y: hR - 61.5, ...s });
    pageR.drawText(datos.vin, { x: 59, y: hR - 69.5, ...s });
    pageR.drawText(datos.serie, { x: 59, y: hR - 76.5, ...s });
    pageR.drawText(datos.motor, { x: 59, y: hR - 83.5, ...s });
    pageR.drawText(datos.carroceria, { x: 59, y: hR - 90.5, ...s });
    pageR.drawText(datos.potencia, { x: 45, y: hR - 97.5, ...s });
    pageR.drawText(datos.formRod, { x: 45, y: hR - 104.5, ...s });
    pageR.drawText(datos.combustible, { x: 50, y: hR - 111.5, ...s });
    pageR.drawText(datos.añoModelo, { x: 225, y: hR - 39, ...s });
    pageR.drawText(datos.version, { x: 151, y: hR - 100, ...s });
    pageR.drawText(datos.asientos, { x: 45, y: hR - 122, ...s });
    pageR.drawText(datos.pasajeros, { x: 45, y: hR - 129, ...s });
    pageR.drawText(datos.ruedas, { x: 45, y: hR - 134.9, ...s });
    pageR.drawText(datos.ejes, { x: 45, y: hR - 141.9, ...s });
    pageR.drawText(datos.cilindros, { x: 115, y: hR - 121, ...s });
    pageR.drawText(datos.longitud, { x: 115, y: hR - 127.8, ...s });
    pageR.drawText(datos.altura, { x: 115, y: hR - 134.6, ...s });
    pageR.drawText(datos.ancho, { x: 115, y: hR - 141.4, ...s });
    pageR.drawText(datos.cilindrada, { x: 203, y: hR - 121, ...s });
    pageR.drawText(datos.pBruto, { x: 203, y: hR - 127.8, ...s });
    pageR.drawText(datos.pNeto, { x: 203, y: hR - 134.6, ...s });
    pageR.drawText(datos.cargaUtil, { x: 203, y: hR - 142, ...s });

    const barText = `CATEGORIA:${datos.categoria}|MARCA:${datos.marca}|MODELO:${datos.modelo}|ANO_MODELO:${datos.añoModelo}|VERSION:${datos.version}|VIN:${datos.vin}|MOTOR:${datos.motor}`;
    const barImg = await pdfRev.embedPng(await bwipjs.toBuffer({ bcid: 'pdf417', text: barText, scale: 2, height: 12 }));
    pageR.drawImage(barImg, { x: (wR/2)-(170/2), y: 4, width: 170, height: 22 });
    
    fs.writeFileSync('reverso_SUZUKI_1274UP.pdf', await pdfRev.save());

    console.log('✅ PDFs generados: anverso_SUZUKI_1274UP.pdf y reverso_SUZUKI_1274UP.pdf');
}

generar().catch(e => console.error(e));
