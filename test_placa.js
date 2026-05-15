const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// Usar la primera llave disponible en tu .env
const GEMINI_KEY = (process.env.GEMINI_KEYS || "").split(",")[0].trim();
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

async function procesarPlaca() {
    console.log("📂 Cargando archivos...");
    const pdfDatosBuffer = fs.readFileSync('placacondatos.pdf');
    const plantillaBuffer = fs.readFileSync('placaplantilla.pdf');
    const FONT_PATH = path.join(__dirname, 'tarjeta', 'font_bold.ttf');

    if (!fs.existsSync(FONT_PATH)) {
        throw new Error("No se encontró la fuente en tarjeta/font_bold.ttf");
    }
    const fontBytes = fs.readFileSync(FONT_PATH);

    // 1. DATOS DE PRUEBA (Completos según Imagen 1)
    console.log("🧪 Cargando datos de prueba completos...");
    const datos = {
        // Tarjeta Izquierda (Anverso)
        "controlAnverso": "030184",
        "zona": "III",
        "sede": "TARAPOTO",
        "reparticion": "TARAPOTO",
        "placa": "MX-62817",
        "exp": "30184",
        "ins": "15 11 2006",
        "apPaterno": "LEON ",
        "apPaterno2": "PARADES",
        "apMaterno": "CABANILLAS",
        "apMaterno2": "DE LEON",
        "nombres": "PABLO GODOFREDO",
        "nombres2": "ELDA",
        "domicilio": "ASOC. SANTA MARIA MZ. C LT.14 LIMA",
        "fechaPropiedad": "12  01 2007",
        "fechaInferior": "12   01  2007",

        // Tarjeta Derecha (Reverso)
        "controlReverso": "071542",
        "clase": "L5-VEH.AUT.MEN",
        "marca": "RONCO",
        "añoFab": "2006",
        "modelo": "CK150ZK-I",
        "combustible": "GASOLINA",
        "carroceria": "SEDAN",
        "ejes": "2",
        "color": "ROJO",
        "cilindros": "1",
        "motor": "ZS162MJ386400288",
        "ruedas": "3",
        "serie": "LKXKDKZ0160T00056",
        "pasajeros": "2",
        "asientos": "3",
        "pesoSeco": "0.360",
        "pesoBruto": "0.710",
        "longitud": "2.60",
        "altura": "1.72",
        "ancho": "1.25",
        "cargaUtil": "0.350"
    };

    // 2. RELLENAR PLANTILLA
    console.log("✍️ Escribiendo datos...");
    const pdfDoc = await PDFDocument.load(plantillaBuffer);
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fontBytes);
    const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontFina = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];
    const { height } = page.getSize();

    const draw = (text, x, y, size = 7, color = rgb(0.2, 0.2, 0.2), customFont = fontSerif) => {
        if (!text) return;
        page.drawText(String(text).toUpperCase(), { x, y: height - y, size, font: customFont, color });
    };

    // =========================================================
    // POSICIONAMIENTO - MODIFICA LOS NÚMEROS AQUÍ ABAJO
    // =========================================================

    // --- TARJETA IZQUIERDA ---
    draw(datos.controlAnverso, 220, 120, 19, rgb(0.8, 0.1, 0.1), fontFina); // Número Rojo con letra fina
    draw(datos.zona, 269, 139, 8);
    draw(datos.sede, 225, 147.6, 7);
    draw(datos.reparticion, 169, 164, 7);
    draw(datos.placa, 80, 195, 18);
    draw(datos.exp, 215, 175, 7);
    draw(datos.ins, 233, 195, 8);
    draw(datos.apPaterno, 105, 235, 7);
    draw(datos.apPaterno2, 189, 235, 7); // Segundo titular a la derecha

    draw(datos.apMaterno, 105, 245, 7);
    draw(datos.apMaterno2, 189, 245, 7); // Segundo titular a la derecha

    draw(datos.nombres, 105, 257, 7);
    draw(datos.nombres2, 185, 258, 7);   // Segundo titular a la derecha
    draw(datos.domicilio, 68, 283, 6);
    draw(datos.fechaPropiedad, 121, 296, 7);
    draw(datos.fechaInferior, 218, 364, 9, rgb(0.2, 0.2, 0.2), fontSerif);

    // --- TARJETA DERECHA ---
    draw(datos.controlReverso, 480, 118, 19, rgb(0.8, 0.1, 0.1), fontFina); // Número Rojo con letra fina
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
    draw(datos.pesoSeco, 447, 292, 11);
    draw(datos.pesoBruto, 500, 292, 11);
    draw(datos.longitud, 335, 319, 11);
    draw(datos.altura, 385, 319, 11);
    draw(datos.ancho, 447, 319, 11);
    draw(datos.cargaUtil, 500, 319, 11);

    // 3. GUARDAR RESULTADO
    const finalPdfBytes = await pdfDoc.save();
    fs.writeFileSync('RESULTADO_PLACA_ANTIGUA.pdf', finalPdfBytes);
    console.log("🚀 ¡PDF Generado! Revisa RESULTADO_PLACA_ANTIGUA.pdf");
}

procesarPlaca().catch(err => {
    console.error("❌ ERROR CRÍTICO:", err.message);
});
