const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const bwipjs = require('bwip-js');
const QRCode = require('qrcode');
const pdfParse = require('pdf-parse');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// --- TABLA CODE 128 (Para el Anverso) ---
const C128_PATTERNS = {
    '0': '11011001100', '1': '11001101100', '2': '11001100110', '3': '10001101100',
    '4': '10001100110', '5': '10110001100', '6': '10110000110', '7': '10110110000',
    '8': '10110011011', '9': '11001011000', 'A': '11000101100', 'B': '11000100110',
    'C': '11011000100', 'D': '11011000010', 'E': '11011011000', 'F': '11011001101',
    'G': '11011011011', 'H': '11001101101', 'I': '11001101111', 'J': '11011110110',
    'K': '11011111011', 'L': '11110110110', 'M': '11110110111', 'N': '11110111101',
    'O': '11110111111', 'P': '11001101101', 'Q': '11001101111', 'R': '11011110110',
    'S': '11011111011', 'T': '11110110110', 'U': '11110110111', 'V': '11110111101',
    'W': '11110111111', 'X': '11001101101', 'Y': '11001101111', 'Z': '11011110110',
    '-': '11000111010', '.': '11011011110', ' ': '11011011011', ':': '11011111010'
};

function drawRealBarcode(page, text, x, y, width, height) {
    const startCode = '11010010000'; 
    const stopCode = '1100011101011';
    let pattern = startCode;
    const cleanText = (text || '').toUpperCase();
    for (let char of cleanText) {
        pattern += C128_PATTERNS[char] || '11011011011';
    }
    pattern += stopCode;
    const moduleWidth = width / pattern.length;
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === '1') {
            page.drawRectangle({
                x: x + (i * moduleWidth),
                y: y,
                width: moduleWidth,
                height: height,
                color: rgb(0, 0, 0),
            });
        }
    }
}

/**
 * Extrae datos del PDF (Anverso y Reverso)
 */
async function extraerDatosDePDF(pdfPath) {
    const buffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(buffer);
    const txt = data.text;
    const buscar = (etiqueta) => {
        const regex = new RegExp(`${etiqueta}\\s*[:|-]\\s*([^\\r\\n]+)`, 'i');
        const m = txt.match(regex);
        return m ? m[1].trim() : '';
    };

    return {
        // Campos Anverso
        zona: buscar('ZONA REGISTRAL') || buscar('ZONA'),
        sede: buscar('SEDE REGISTRAL') || buscar('SEDE'),
        partida: buscar('PARTIDA REGISTRAL') || buscar('PARTIDA'),
        dua: buscar('DUA/DAM') || buscar('DUA'),
        titulo: buscar('TITULO') || buscar('TÍTULO'),
        fechaTitulo: buscar('FECHA DEL TITULO') || buscar('FECHA TITULO'),
        placa: buscar('PLACA N') || buscar('PLACA'),
        codVerif: buscar('CODIGO DE VERIFICACION') || buscar('COD. VERIF'),
        tituloNo: buscar('TITULO N') || buscar('TITULO NUMERO'),
        fechaFinal: buscar('FECHA'),

        // Campos Reverso
        categoria: buscar('CATEGORIA'),
        marca: buscar('MARCA'),
        modelo: buscar('MODELO'),
        color: buscar('COLOR'),
        añoModelo: buscar('AÑO MODELO') || buscar('ANO_MODELO'),
        version: buscar('VERSIÓN') || buscar('VERSION'),
        vin: buscar('VIN'),
        serie: buscar('SERIE'),
        motor: buscar('NÚMERO MOTOR') || buscar('NUMERO_MOTOR'),
        carroceria: buscar('CARROCERÍA') || buscar('CARROCERIA'),
        potencia: buscar('POTENCIA'),
        formRod: buscar('FORMA DE RODAJE') || buscar('FORMA_DE_RODAJE'),
        combustible: buscar('COMBUSTIBLE'),
        asientos: buscar('ASIENTOS'),
        pasajeros: buscar('PASAJEROS'),
        ruedas: buscar('RUEDAS'),
        ejes: buscar('EJES'),
        cilindros: buscar('CILINDROS'),
        longitud: buscar('LONGITUD'),
        altura: buscar('ALTURA'),
        ancho: buscar('ANCHO'),
        cilindrada: buscar('CILINDRADA'),
        pBruto: buscar('PESO BRUTO') || buscar('PESO_BRUTO'),
        pNeto: buscar('PESO NETO') || buscar('PESO_NETO'),
        cargaUtil: buscar('CARGA ÚTIL') || buscar('CARGA_UTIL')
    };
}

/**
 * Genera el Reverso (Atrás) con posiciones exactas
 */
async function generarReverso(datos) {
    const templatePath = path.join(__dirname, 'tarjeta', 'atrasxd.pdf');
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const firstPage = pdfDoc.getPages()[0];
    const { height, width } = firstPage.getSize();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const style = { size: 4.5, font: fontBold, color: rgb(0, 0, 0) };

    const safe = (t) => t ? String(t) : '';

    // Posiciones REVERSO
    const pos = {
        cat: { x: 37, y: height - 40.5 },
        mar: { x: 37, y: height - 47.5 },
        mod: { x: 37, y: height - 54.5 },
        col: { x: 37, y: height - 61.5 },
        vin: { x: 59, y: height - 69.5 },
        ser: { x: 59, y: height - 76.5 },
        mot: { x: 59, y: height - 83.5 },
        car: { x: 59, y: height - 90.5 },
        pot: { x: 45, y: height - 97.5 },
        rod: { x: 45, y: height - 104.5 },
        com: { x: 50, y: height - 111.5 },
        año: { x: 225, y: height - 39 },
        ver: { x: 151, y: height - 100 },
        asi: { x: 45, y: height - 122 },
        pas: { x: 45, y: height - 129 },
        rue: { x: 45, y: height - 134.9 },
        eje: { x: 45, y: height - 141.9 },
        cil: { x: 115, y: height - 121 },
        lon: { x: 115, y: height - 127.8 },
        alt: { x: 115, y: height - 134.6 },
        anc: { x: 115, y: height - 141.4 },
        cda: { x: 203, y: height - 121 },
        pbr: { x: 203, y: height - 127.8 },
        pne: { x: 203, y: height - 134.6 },
        util: { x: 203, y: height - 142 }
    };

    firstPage.drawText(safe(datos.categoria), { ...pos.cat, ...style });
    firstPage.drawText(safe(datos.marca), { ...pos.mar, ...style });
    firstPage.drawText(safe(datos.modelo), { ...pos.mod, ...style });
    firstPage.drawText(safe(datos.color), { ...pos.col, ...style });
    firstPage.drawText(safe(datos.vin), { ...pos.vin, ...style });
    firstPage.drawText(safe(datos.serie), { ...pos.ser, ...style });
    firstPage.drawText(safe(datos.motor), { ...pos.mot, ...style });
    firstPage.drawText(safe(datos.carroceria), { ...pos.car, ...style });
    firstPage.drawText(safe(datos.potencia), { ...pos.pot, ...style });
    firstPage.drawText(safe(datos.formRod), { ...pos.rod, ...style });
    firstPage.drawText(safe(datos.combustible), { ...pos.com, ...style });
    firstPage.drawText(safe(datos.añoModelo), { ...pos.año, ...style });
    firstPage.drawText(safe(datos.version), { ...pos.ver, ...style });
    firstPage.drawText(safe(datos.asientos), { ...pos.asi, ...style });
    firstPage.drawText(safe(datos.pasajeros), { ...pos.pas, ...style });
    firstPage.drawText(safe(datos.ruedas), { ...pos.rue, ...style });
    firstPage.drawText(safe(datos.ejes), { ...pos.eje, ...style });
    firstPage.drawText(safe(datos.cilindros), { ...pos.cil, ...style });
    firstPage.drawText(safe(datos.longitud), { ...pos.lon, ...style });
    firstPage.drawText(safe(datos.altura), { ...pos.alt, ...style });
    firstPage.drawText(safe(datos.ancho), { ...pos.anc, ...style });
    firstPage.drawText(safe(datos.cilindrada), { ...pos.cda, ...style });
    firstPage.drawText(safe(datos.pBruto), { ...pos.pbr, ...style });
    firstPage.drawText(safe(datos.pNeto), { ...pos.pne, ...style });
    firstPage.drawText(safe(datos.cargaUtil), { ...pos.util, ...style });

    const barcodeText = `CATEGORIA:${safe(datos.categoria)}|MARCA:${safe(datos.marca)}|MODELO:${safe(datos.modelo)}|ANO_MODELO:${safe(datos.añoModelo)}|VERSION:${safe(datos.version)}|COLOR:${safe(datos.color)}|VIN:${safe(datos.vin)}|SERIE:${safe(datos.serie)}|NUMERO_MOTOR:${safe(datos.motor)}|CARROCERIA:${safe(datos.carroceria)}|POTENCIA:${safe(datos.potencia)}|FORMA_DE_RODAJE:${safe(datos.formRod)}|COMBUSTIBLE:${safe(datos.combustible)}|ASIENTOS:${safe(datos.asientos)}|PASAJEROS:${safe(datos.pasajeros)}|RUEDAS:${safe(datos.ruedas)}|EJES:${safe(datos.ejes)}|CILINDROS:${safe(datos.cilindros)}|LONGITUD:${safe(datos.longitud)}|ALTURA:${safe(datos.altura)}|ANCHO:${safe(datos.ancho)}|CILINDRADA:${safe(datos.cilindrada)}|PESO_BRUTO:${safe(datos.pBruto)}|PESO_NETO:${safe(datos.pNeto)}|CARGA_UTIL:${safe(datos.cargaUtil)}`;
    const barcodeImageBuffer = await bwipjs.toBuffer({ bcid: 'pdf417', text: barcodeText, scale: 2, height: 12, includetext: false });
    const barcodeImage = await pdfDoc.embedPng(barcodeImageBuffer);
    
    firstPage.drawImage(barcodeImage, { x: (width / 2) - (246 / 2), y: 4, width: 170, height: 22 });

    const pdfBytes = await pdfDoc.save();
    const fileName = `reverso_final_${datos.placa || 'vehiculo'}.pdf`;
    fs.writeFileSync(fileName, pdfBytes);
    console.log(`✅ REVERSO GENERADO: ${fileName}`);
}

/**
 * Genera el Anverso (Adelante) con lógica de generar_tarjeta.js
 */
async function generarAnverso(datos) {
    const templatePath = path.join(__dirname, 'tarjeta', 'adelantexd.pdf');
    if (!fs.existsSync(templatePath)) return;
    
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];
    const { height } = page.getSize();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const colorGris = rgb(0.6, 0.6, 0.6);
    const safe = (t) => t ? String(t) : '';

    // --- POSICIONES ANVERSO (Desde generar_tarjeta.js) ---
    page.drawText(safe(datos.zona), { x: 60, y: height - 56, size: 5.5, font: fontBold, color: colorGris });
    page.drawText(safe(datos.sede), { x: 55, y: height - 63, size: 5.5, font: fontBold, color: colorGris });
    page.drawText(safe(datos.partida), { x: 65, y: height - 75, size: 6.8, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText(safe(datos.dua), { x: 50, y: height - 89, size: 6.8, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText(safe(datos.titulo), { x: 34.5, y: height - 104, size: 6.8, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText(safe(datos.fechaTitulo), { x: 65, y: height - 117, size: 6.8, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText(safe(datos.placa), { x: 162, y: height - 115, size: 17.9, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText(safe(datos.codVerif), { x: 213, y: height - 142, size: 4.5, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText(safe(datos.tituloNo), { x: 183, y: height - 149.5, size: 4.5, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText(safe(datos.fechaFinal), { x: 177, y: height - 158, size: 4.5, font: fontBold, color: rgb(0, 0, 0) });

    // Código de barras Placa (Code 128)
    drawRealBarcode(page, datos.placa, 10, height - 168, 80, 15);

    // QR Placa
    const qrData = `https://tive.sunarp.gob.pe/ver/${safe(datos.placa)}`;
    const qrImageData = await QRCode.toDataURL(qrData, { margin: 1 });
    const qrImage = await pdfDoc.embedPng(qrImageData);
    page.drawImage(qrImage, { x: 100, y: height - 170, width: 52, height: 52 });

    const pdfBytes = await pdfDoc.save();
    const fileName = `anverso_final_${datos.placa || 'vehiculo'}.pdf`;
    fs.writeFileSync(fileName, pdfBytes);
    console.log(`✅ ANVERSO GENERADO: ${fileName}`);
}

async function main() {
    const sourcePdf = process.argv[2];
    let datos;

    if (sourcePdf && fs.existsSync(sourcePdf)) {
        console.log(`📄 Analizando PDF: ${sourcePdf}`);
        datos = await extraerDatosDePDF(sourcePdf);
    } else {
        console.log('\n--- ENTRADA MANUAL DE DATOS ---');
        datos = {
            zona: await question('Zona Registral N°: '),
            sede: await question('Sede Registral: '),
            partida: await question('Partida Registral: '),
            dua: await question('DUA/DAM: '),
            titulo: await question('Título: '),
            fechaTitulo: await question('Fecha del Título: '),
            placa: await question('Placa N°: '),
            codVerif: await question('Código de Verificación: '),
            tituloNo: await question('Título N°: '),
            fechaFinal: await question('Fecha Completa: '),
            categoria: await question('Categoría: '),
            marca: await question('Marca: '),
            modelo: await question('Modelo: '),
            color: await question('Color: '),
            añoModelo: await question('Año Modelo: '),
            version: await question('Versión: '),
            vin: await question('Número de VIN: '),
            serie: await question('Número de Serie: '),
            motor: await question('Número Motor: '),
            carroceria: await question('Carrocería: '),
            potencia: await question('Potencia: '),
            formRod: await question('Form. Rod.: '),
            combustible: await question('Combustible: '),
            asientos: await question('Asientos: '),
            pasajeros: await question('Pasajeros: '),
            ruedas: await question('Ruedas: '),
            ejes: await question('Ejes: '),
            cilindros: await question('Cilindros: '),
            longitud: await question('Longitud: '),
            altura: await question('Altura: '),
            ancho: await question('Ancho: '),
            cilindrada: await question('Cilindrada: '),
            pBruto: await question('P. Bruto: '),
            pNeto: await question('P. Neto: '),
            cargaUtil: await question('Carga Útil: ')
        };
    }
    rl.close();

    await generarAnverso(datos);
    await generarReverso(datos);
    console.log('\n✨ ¡Proceso terminado! Ambos lados generados con éxito.');
}

main().catch(err => { console.error('❌ Error:', err); rl.close(); });
