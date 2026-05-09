const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createTestCard() {
    // Cargar la plantilla
    const templatePath = path.join(__dirname, 'tarjeta', 'adelantexd.pdf');
    const templateBytes = fs.readFileSync(templatePath);
    
    // Crear un nuevo documento basado en la plantilla
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // Fuente
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 10;

    // Función para dibujar texto con coordenadas estimadas
    // Nota: Y se mide desde abajo en pdf-lib
    const drawText = (text, x, y) => {
        firstPage.drawText(text, {
            x: x,
            y: height - y, // Convertir de "desde arriba" a "desde abajo"
            size: fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
        });
    };

    // --- DATOS DE PRUEBA (Coordenadas estimadas) ---
    
    // Zona y Sede
    drawText('IX', 180, 155);        // Zona Registral N°
    drawText('LIMA', 180, 185);    // SEDE REGISTRAL -
    
    // Placa (Grande a la derecha)
    firstPage.drawText('ABC-123', {
        x: 700,
        y: height - 280,
        size: 24,
        font: helveticaFont,
        color: rgb(0, 0, 0),
    });

    // Campos de la izquierda
    drawText('11002233', 180, 245);    // Partida Registral
    drawText('2023-001', 180, 310);    // DUA/DAM
    drawText('99887766', 180, 375);    // Título
    drawText('09/05/2026', 180, 435); // Fecha del Título
    // Condición ya dice "NUEVO" en la plantilla, pero podríamos taparlo o escribir al lado

    // Campos de la derecha abajo
    drawText('XYZ789', 750, 500);      // Código de Verificación
    drawText('2023-12345', 750, 535);  // Titulo N°
    drawText('09/05/2026', 750, 570);  // Fecha

    // Guardar resultado
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('prueba_adelante.pdf', pdfBytes);
    console.log('✅ PDF de prueba generado: prueba_adelante.pdf');
}

createTestCard().catch(console.error);
