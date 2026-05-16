const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function procesarPlaca() {
    console.log("📂 Cargando archivos...");
    const plantillaBuffer = fs.readFileSync(path.join(__dirname, 'tarjeta', 'placaplantilla.pdf'));
    const FONT_PATH = path.join(__dirname, 'tarjeta', 'font_bold.ttf');
    const fontBytes = fs.readFileSync(FONT_PATH);

    // 1. DATOS DE PRUEBA
    console.log("\n--- ENTRADA DE DATOS ---");
    const placaInput = await question("🔢 Ingrese la PLACA (ej: 5053-QS): ");
    const claseInput = await question("🛵 Ingrese la clase (por defecto MOTOCICLETA): ");
    const placaSedeInput = await question("📍 Ingrese Placa Sede (ej: TARAPOTO): ");
    const sedeDomicilioInput = await question("🏠 Ingrese Sede Domicilio: ");

    const datos = {
        "controlAnverso": "030184",
        "zona": "III",
        "sede": "TARAPOTO",
        "reparticion": "TARAPOTO",
        "placa": placaInput || "5053-QS", 
        "placaSede": placaSedeInput || "",
        "exp": "30184",
        "ins": "15/11/2006",
        "apPaterno": "REATEGUI",
        "apPaterno2": "",
        "apMaterno": "REATEGUI",
        "apMaterno2": "",
        "nombres": "LUIS ENRIQUE",
        "nombres2": "",
        "domicilio": "YURIMAGUAS",
        "sedeDomicilio": sedeDomicilioInput || "",
        "fechaPropiedad": "12/04/2024",
        "fechaInferior": "09/05/2024",
        "controlReverso": "071542",
        "clase": claseInput || "MOTOCICLETA",
        "marca": "ZONGSHEN",
        "añoFab": "2024",
        "modelo": "SPEX150",
        "combustible": "GASOLINA",
        "carroceria": "MOTOCICLETA",
        "ejes": "2",
        "color": "NEGRO",
        "cilindros": "1",
        "motor": "ZS162MJ386400288",
        "ruedas": "2",
        "serie": "LKXKDKZ0160T00056",
        "pasajeros": "1",
        "asientos": "2",
        "pesoSeco": "0.129 TN",
        "pesoBruto": "0.279 TN",
        "longitud": "2.16 MT",
        "altura": "1.22 MT",
        "ancho": "0.82 MT",
        "cargaUtil": "0.150 TN"
    };

    // 2. CONFIGURAR PDF
    const pdfDoc = await PDFDocument.load(plantillaBuffer);
    pdfDoc.registerFontkit(fontkit);
    const fontB = await pdfDoc.embedFont(fontBytes);
    const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontSerifNorm = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontFina = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontArialBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.getPages()[0];
    const { height } = page.getSize();
    const gris = rgb(0.2, 0.2, 0.2);

    // Helpers de Dibujo
    const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

    const draw = (text, x, y, size = 7, color = gris, customFont = fontSerif, forceUpper = true) => {
        if (!text) return;
        const txt = forceUpper ? String(text).toUpperCase() : String(text);
        // Truco de sobreimpresión para extra negrita
        page.drawText(txt, { x, y: height - y, size, font: customFont, color });
        page.drawText(txt, { x: x + 0.2, y: height - y, size, font: customFont, color });
    };

    const fmtPlaca = (p) => {
        if (!p) return "";
        let clean = p.replace(/[^A-Z0-9]/gi, "").toUpperCase();
        if (clean.length === 6) {
            if (/^\d{4}/.test(clean)) return `${clean.substring(0, 4)}-${clean.substring(4)}`;
            return `${clean.substring(0, 3)}-${clean.substring(3)}`;
        }
        return clean;
    };

    const drawTec = (text, x, y, size = 11) => {
        if (!text) return;
        let finalX = x;
        if (String(text).toUpperCase().includes("MT") || String(text).toUpperCase().includes("TN")) {
            finalX -= 7;
        }
        draw(text, finalX, y, size);
    };

    const drawSeg = (txt, x, y, s1 = 12, s2 = 12, size = 7, color = gris, font = fontSerif) => {
        if (!txt) return;
        draw(txt, x, y, size, color, font);
    };

    // --- RENDERIZADO ANVERSO ---
    // draw(datos.controlAnverso, 220, 120, 19, rgb(0.8, 0.1, 0.1), fontFina);
    draw(datos.zona, 269, 139, 9);
    draw(datos.sede, 225, 147.6, 8);
    draw(datos.reparticion, 169, 164, 8);
    draw(datos.placaSede, 90, 176, 8.5); // Placa Sede arriba y a la derecha
    draw(datos.placa, 80, 195, 18.5); // Dibujar placa tal cual se ingresó
    // draw(datos.exp, 202, 178, 9);

    // Ajuste de espacios para INS (11px y 10px)
    drawSeg(datos.ins, 233, 195, 11, 10, 8);

    draw(datos.apPaterno, 105, 235, 8);
    draw(datos.apPaterno2, 189, 235, 8);
    draw(datos.apMaterno, 105, 245, 8);
    draw(datos.apMaterno2, 189, 245, 8);
    draw(datos.nombres, 105, 257, 8);
    draw(datos.nombres2, 185, 258, 8);
    draw(datos.sedeDomicilio, 105, 269, 7.5);
    draw(datos.domicilio, 68, 283, 7.2);

    // Ajuste de espacios para Propiedad (10px y 11px)
    drawSeg(datos.fechaPropiedad, 126, 296, 10, 11, 9.5);

    // Ajuste de espacios para Emisión (15px y 14px)
    drawSeg(datos.fechaInferior, 210, 365, 15, 14, 10.5, gris);

    // --- RENDERIZADO REVERSO ---
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
    draw(datos.zona, 435, 357.5, 4.3, gris, fontArialBold);
    draw(capitalize(datos.sede), 455, 357.5, 4.3, gris, fontArialBold, false);

    // 3. GUARDAR
    const finalPdfBytes = await pdfDoc.save();
    fs.writeFileSync('RESULTADO_TEST_ANTIGUA.pdf', finalPdfBytes);
    console.log("🚀 ¡PDF de Prueba Generado! Revisa RESULTADO_TEST_ANTIGUA.pdf");
    rl.close();
}

procesarPlaca().catch(err => {
    console.error("❌ ERROR:", err.message);
    rl.close();
});

