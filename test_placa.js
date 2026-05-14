const { PDFDocument, rgb } = require('pdf-lib');
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

    // 1. EXTRAER DATOS CON IA
    console.log("🧠 Analizando PDF con IA (Gemini)...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analiza este documento vehicular antiguo y extrae TODOS los datos.
    Devuelve estrictamente un objeto JSON con estos campos:
    {
      "placa": "...",
      "clase": "...",
      "marca": "...",
      "modelo": "...",
      "color": "...",
      "añoFab": "...",
      "serie": "...",
      "motor": "...",
      "combustible": "...",
      "asientos": "...",
      "pasajeros": "...",
      "pesoSeco": "...",
      "pesoBruto": "...",
      "cargaUtil": "...",
      "longitud": "...",
      "altura": "...",
      "ancho": "...",
      "zona": "...",
      "sede": "...",
      "propietario": "...",
      "fechaPropiedad": "..."
    }`;

    const result = await model.generateContent([
        { inlineData: { data: pdfDatosBuffer.toString("base64"), mimeType: "application/pdf" } },
        { text: prompt }
    ]);

    const rawResponse = result.response.text();
    const datos = JSON.parse(rawResponse.replace(/```json|```/g, "").trim());
    console.log("✅ Datos extraídos exitosamente:", datos);

    // 2. RELLENAR PLANTILLA
    console.log("✍️ Escribiendo datos en la plantilla...");
    const pdfDoc = await PDFDocument.load(plantillaBuffer);
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fontBytes);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    const draw = (text, x, y, size = 7, color = rgb(0, 0, 0)) => {
        if (!text || text === "null" || text === "undefined") return;
        // Invertimos Y porque pdf-lib empieza desde abajo
        page.drawText(String(text).toUpperCase(), {
            x,
            y: height - y,
            size,
            font,
            color
        });
    };

    // --- MAPEO DE COORDENADAS (Basado en placaplantilla.pdf) ---
    
    // IZQUIERDA (Datos Generales)
    draw(datos.zona, 405, 148, 6, rgb(0.3, 0.3, 0.3));
    draw(datos.sede, 405, 156, 6, rgb(0.3, 0.3, 0.3));
    draw(datos.sede, 250, 172, 7); // Repartición
    draw(datos.placa, 75, 212, 18); // Placa grande
    draw(datos.propietario, 120, 290, 8);
    draw(datos.fechaPropiedad, 120, 335, 8);

    // DERECHA (Datos Técnicos)
    draw(datos.clase, 545, 153);
    draw(datos.marca, 710, 153);
    draw(datos.añoFab, 875, 153);
    
    draw(datos.modelo, 545, 186);
    draw(datos.combustible, 810, 186);
    
    draw(datos.serie, 545, 292, 9); // Serie grande
    draw(datos.motor, 545, 258, 9); // Motor grande
    
    draw(datos.color, 545, 222);
    
    draw(datos.pasajeros, 545, 318);
    draw(datos.asientos, 630, 318);
    draw(datos.pesoSeco, 730, 318);
    draw(datos.pesoBruto, 845, 318);
    
    draw(datos.longitud, 545, 348);
    draw(datos.altura, 630, 348);
    draw(datos.ancho, 730, 348);
    draw(datos.cargaUtil, 845, 348);

    // 3. GUARDAR RESULTADO
    const finalPdfBytes = await pdfDoc.save();
    const outputPath = 'RESULTADO_PLACA_ANTIGUA.pdf';
    fs.writeFileSync(outputPath, finalPdfBytes);
    
    console.log(`\n🚀 ¡PROCESO COMPLETADO!`);
    console.log(`📂 Archivo generado: ${outputPath}`);
}

procesarPlaca().catch(err => {
    console.error("❌ ERROR CRÍTICO:", err.message);
});
