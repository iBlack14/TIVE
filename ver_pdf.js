const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');

// Usar node-pdfreader para extraer imágenes del PDF
const { PDFDocument } = require('pdf-lib');

async function main() {
    const pdfPath = process.argv[2];
    if (!pdfPath || !fs.existsSync(pdfPath)) {
        console.error('❌ Uso: node ver_pdf.js archivo.pdf');
        process.exit(1);
    }

    console.log(`\n📄 Extrayendo datos con OCR del PDF: ${pdfPath}\n`);

    try {
        // Leer el PDF
        const pdfBytes = fs.readFileSync(pdfPath);

        // Intentar extracción simple primero
        console.log('⚙️  Intentando extracción de imágenes del PDF...');
        
        // Procesar con Tesseract directamente usando el PDF como imagen
        const worker = await Tesseract.createWorker('spa');
        console.log('⚙️  Iniciando OCR en el PDF...\n');

        // Tesseract.js puede procesar PDFs si se le pasa como buffer
        const result = await worker.recognize(pdfBytes);
        const fullText = result.data.text;

        await worker.terminate();

        console.log('=== TEXTO EXTRAÍDO CON OCR ===\n');
        console.log(fullText);
        console.log('\n=== FIN TEXTO ===\n');

        // Extraer datos estructurados
        const data = extractDataFromText(fullText);

        console.log('=== DATOS ENCONTRADOS ===\n');
        if (Object.keys(data).length > 0) {
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log('⚠️  No se encontraron patrones de datos comunes.');
            console.log('📋 Texto completo extraído (arriba).');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error('\n📌 Nota: Instalando herramientas adicionales para PDF...');
        process.exit(1);
    }
}

function extractDataFromText(text) {
    const data = {};
    const lines = text.split('\n');

    // Buscar líneas con información estructurada
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Patrones más flexibles
        if (line.includes('Código de Verificación')) {
            data['Código de Verificación'] = extractValue(line);
        }
        if (line.includes('Título') && !line.includes('Fecha')) {
            data['Título'] = extractValue(line);
        }
        if (line.includes('Placa')) {
            data['Placa'] = extractValue(line);
        }
        if (line.includes('Partida Registral')) {
            data['Partida Registral'] = extractValue(line);
        }
        if (line.includes('DUA') && line.includes('DAM')) {
            data['DUA/DAM'] = extractValue(line);
        }
        if (line.includes('Fecha del Título') || (line.includes('Fecha') && line.includes(':'))) {
            data['Fecha'] = extractValue(line);
        }
        if (line.includes('Marca') && !line.includes('Remarque')) {
            data['Marca'] = extractValue(line);
        }
        if (line.includes('Modelo') && !line.includes('Año')) {
            data['Modelo'] = extractValue(line);
        }
        if (line.includes('Año') && line.includes('Modelo')) {
            const match = line.match(/\d{4}/);
            if (match) data['Año'] = match[0];
        }
        if (line.includes('Color') && !line.includes('Remarque')) {
            data['Color'] = extractValue(line);
        }
        if (line.includes('Número de VIN') || line.includes('VIN')) {
            data['VIN'] = extractValue(line);
        }
        if (line.includes('Número de Serie') || line.includes('Serie')) {
            data['Serie'] = extractValue(line);
        }
        if (line.includes('Número de Motor') || line.includes('Motor')) {
            data['Motor'] = extractValue(line);
        }
        if (line.includes('Carrocería')) {
            data['Carrocería'] = extractValue(line);
        }
        if (line.includes('Potencia')) {
            data['Potencia'] = extractValue(line);
        }
        if (line.includes('Combustible')) {
            data['Combustible'] = extractValue(line);
        }
        if (line.includes('Cilindrada')) {
            data['Cilindrada'] = extractValue(line);
        }
        if (line.includes('Pasajeros')) {
            data['Pasajeros'] = extractValue(line);
        }
        if (line.includes('Ruedas')) {
            data['Ruedas'] = extractValue(line);
        }
    }

    return data;
}

function extractValue(line) {
    // Extrae el valor después de ":" o espacios
    const match = line.match(/[:]\s*(.+)/);
    if (match) {
        return match[1].trim();
    }
    return line.replace(/^[^:]*:\s*/, '').trim();
}

main();
