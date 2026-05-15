const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function procesarPlaca() {
    console.log("📂 Cargando archivos...");
    const plantillaBuffer = fs.readFileSync(path.join(__dirname, 'tarjeta', 'placaplantilla.pdf'));
    const FONT_PATH = path.join(__dirname, 'tarjeta', 'font_bold.ttf');
    const fontBytes = fs.readFileSync(FONT_PATH);

    // 1. DATOS DE PRUEBA
    const datos = {
        "controlAnverso": "030184",
        "zona": "III",
        "sede": "TARAPOTO",
        "reparticion": "TARAPOTO",
        "placa": "5053QS", // Se formateará a 5053-QS
        "exp": "30184",
        "ins": "15/11/2006",
        "apPaterno": "REATEGUI",
        "apPaterno2": "",
        "apMaterno": "REATEGUI",
        "apMaterno2": "",
        "nombres": "LUIS ENRIQUE",
        "nombres2": "",
        "domicilio": "YURIMAGUAS",
        "fechaPropiedad": "12/04/2024",
        "fechaInferior": "09/05/2024",
        "controlReverso": "071542",
        "clase": "MOTOCICLETA",
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
    const page = pdfDoc.getPages()[0];
    const { height } = page.getSize();
    const gris = rgb(0.2, 0.2, 0.2);

    // Helpers de Dibujo
    const draw = (text, x, y, size = 7, color = gris, customFont = fontSerif) => {
        if (!text) return;
        page.drawText(String(text).toUpperCase(), { x, y: height - y, size, font: customFont, color });
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

    const drawSeg = (txt, x, y, s1 = 12, s2 = 12, size = 7, color = gris, font = fontSerifNorm) => {
        if (!txt) return;
        const p = String(txt).split(/[\/\-]/);
        if (p.length !== 3) return draw(txt, x, y, size, color, font);
        draw(p[0], x, y, size, color, font);
        draw(p[1], x + s1, y, size, color, font);
        draw(p[2], x + s1 + s2, y, size, color, font);
    };

    // --- RENDERIZADO ANVERSO ---
    draw(datos.controlAnverso, 220, 120, 19, rgb(0.8, 0.1, 0.1), fontFina);
    draw(datos.zona, 269, 139, 8);
    draw(datos.sede, 225, 147.6, 7);
    draw(datos.reparticion, 169, 164, 7);
    draw(fmtPlaca(datos.placa), 80, 195, 18);
    draw(datos.exp, 202, 178, 9);
    
    // Ajuste de espacios para INS (11px y 10px)
    drawSeg(datos.ins, 233, 195, 11, 10, 8); 

    draw(datos.apPaterno, 105, 235, 7);
    draw(datos.apPaterno2, 189, 235, 7);
    draw(datos.apMaterno, 105, 245, 7);
    draw(datos.apMaterno2, 189, 245, 7);
    draw(datos.nombres, 105, 257, 7);
    draw(datos.nombres2, 185, 258, 7);
    draw(datos.domicilio, 68, 283, 6);
    
    // Ajuste de espacios para Propiedad (10px y 11px)
    drawSeg(datos.fechaPropiedad, 121, 296, 10, 11, 7);
    
    // Ajuste de espacios para Emisión (15px y 14px)
    drawSeg(datos.fechaInferior, 218, 364, 15, 14, 9, gris, fontSerifNorm);

    // --- RENDERIZADO REVERSO ---
    draw(datos.controlReverso, 480, 118, 19, rgb(0.8, 0.1, 0.1), fontFina);
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

    // 3. GUARDAR
    const finalPdfBytes = await pdfDoc.save();
    fs.writeFileSync('RESULTADO_TEST_ANTIGUA.pdf', finalPdfBytes);
    console.log("🚀 ¡PDF de Prueba Generado! Revisa RESULTADO_TEST_ANTIGUA.pdf");
}

procesarPlaca().catch(err => console.error("❌ ERROR:", err.message));
