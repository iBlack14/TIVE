const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const QRCode = require('qrcode');
const bwipjs = require('bwip-js');
const fs = require('fs');
const path = require('path');
const pdf2img = require('pdf-img-convert');

const FONT_PATH = path.join(__dirname, 'tarjeta', 'font_bold.ttf');
const ADELANTE_PATH = path.join(__dirname, 'tarjeta', 'adelantexd.pdf');
const ATRAS_PATH = path.join(__dirname, 'tarjeta', 'atrasxd.pdf');

const safe = (t) => t ? String(t).toUpperCase() : '';

// DATOS DE PRUEBA (MOCK)
const datosTest = {
    zona: "ZONA REGISTRAL N° IX",
    sede: "SEDE REGISTRAL - LIMA",
    partida: "12345678",
    dua: "118-2025-10-123456",
    titulo: "2026-123456",
    fechaTitulo: "10/05/2026",
    placa: "ABC-123",
    codVerif: "987654321",
    tituloNo: "2026-000123",
    fechaFinal: "10/05/2026",
    categoria: "M1",
    marca: "TOYOTA",
    modelo: "COROLLA",
    color: "BLANCO",
    añoModelo: "2025",
    version: "XLI",
    vin: "9ABC1234567890XYZ",
    serie: "SERIE123456",
    motor: "MOTOR-XYZ-789",
    carroceria: "SEDAN",
    potencia: "110 HP",
    formRod: "4X2",
    combustible: "GSL/GLP",
    asientos: "5",
    pasajeros: "5",
    ruedas: "4",
    ejes: "2",
    cilindros: "4",
    longitud: "4.63",
    altura: "1.45",
    ancho: "1.78",
    cilindrada: "1598",
    pBruto: "1750",
    pNeto: "1250",
    cargaUtil: "500"
};

async function testDiseno() {
    console.log("🎨 Iniciando Test de Diseño (Sin IA)...");
    const negro = rgb(0, 0, 0);
    const gris = rgb(0.6, 0.6, 0.6);

    // --- ANVERSO ---
    const pdfAnt = await PDFDocument.load(fs.readFileSync(ADELANTE_PATH));
    pdfAnt.registerFontkit(fontkit);
    const fontB = await pdfAnt.embedFont(fs.readFileSync(FONT_PATH));
    const pageA = pdfAnt.getPages()[0];
    const { height: hA } = pageA.getSize();

    // Dibujar textos
    pageA.drawText(safe(datosTest.zona), { x: 60, y: hA - 56, size: 5.5, font: fontB, color: gris });
    pageA.drawText(safe(datosTest.sede), { x: 55, y: hA - 63, size: 5.5, font: fontB, color: gris });
    pageA.drawText(safe(datosTest.placa), { x: 162, y: hA - 115, size: 17.9, font: fontB, color: negro });

    // Código de barras profesional corregido
    const barImgAnv = await bwipjs.toBuffer({
        bcid: 'code128',
        text: datosTest.placa,
        scale: 4,
        height: 15,
        includetext: false, // Sin texto abajo
    });
    const pngBarAnv = await pdfAnt.embedPng(barImgAnv);
    pageA.drawImage(pngBarAnv, { x: 10, y: hA - 168, width: 82, height: 18 });

    // QR
    const qrImg = await pdfAnt.embedPng(await QRCode.toDataURL("https://test.com", { margin: 1 }));
    pageA.drawImage(qrImg, { x: 100, y: hA - 170, width: 52, height: 52 });

    const anversoBytes = await pdfAnt.save();
    fs.writeFileSync('TEST_ANVERSO.pdf', anversoBytes);
    console.log("✅ Generado: TEST_ANVERSO.pdf");

    // Convertir a Imagen (como hace el bot)
    const anversoImgs = await pdf2img.convert(anversoBytes, { width: 2000 });
    fs.writeFileSync('TEST_ANVERSO.png', anversoImgs[0]);
    console.log("🖼️  Imagen creada: TEST_ANVERSO.png");

    // --- REVERSO ---
    const pdfRev = await PDFDocument.load(fs.readFileSync(ATRAS_PATH));
    pdfRev.registerFontkit(fontkit);
    const fontBRev = await pdfRev.embedFont(fs.readFileSync(FONT_PATH));
    const pageR = pdfRev.getPages()[0];
    const { height: hR, width: wR } = pageR.getSize();
    const dR = (t, x, y, size = 4.5) => pageR.drawText(safe(t), { x, y: hR - y, size, font: fontBRev, color: negro });

    dR(datosTest.marca, 37, 47.5);
    dR(datosTest.vin, 59, 69.5);
    
    const barText = `🚗 PLACA: ${datosTest.placa}\n🛠️ MOTOR: ${datosTest.motor}`;
    const barImg = await pdfRev.embedPng(await bwipjs.toBuffer({ bcid: 'pdf417', text: barText, scale: 2, height: 12 }));
    pageR.drawImage(barImg, { x: (wR / 2) - (170 / 2), y: 5, width: 170, height: 22 });

    const reversoBytes = await pdfRev.save();
    fs.writeFileSync('TEST_REVERSO.pdf', reversoBytes);
    console.log("✅ Generado: TEST_REVERSO.pdf");

    // Convertir a Imagen (como hace el bot)
    const reversoImgs = await pdf2img.convert(reversoBytes, { width: 2000 });
    fs.writeFileSync('TEST_REVERSO.png', reversoImgs[0]);
    console.log("🖼️  Imagen creada: TEST_REVERSO.png");
    
    console.log("\n🚀 ¡Prueba completada! Revisa los archivos .png generados.");
}

testDiseno().catch(console.error);
