const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const uploadDir = path.join(__dirname, 'servicio', 'verCertificado');
const DOMAIN = process.env.DOMAIN_URL || 'http://localhost:4000';

async function crearPruebaPersistencia() {
    console.log("🛠️ Iniciando prueba de persistencia...");

    // 1. Crear un contenido de PDF falso pero único
    const contenido = "ESTE ES UN DOCUMENTO DE PRUEBA DE PERSISTENCIA - TIVE BOT";
    const hash = crypto.createHash('sha256').update(contenido).digest('hex').toUpperCase();
    const fileName = `${hash}.pdf`;
    const filePath = path.join(uploadDir, fileName);

    // 2. Crear la carpeta si no existe (por si acaso)
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 3. Guardar el archivo
    fs.writeFileSync(filePath, contenido);

    console.log("\n✅ ARCHIVO DE PRUEBA CREADO CON ÉXITO");
    console.log(`📂 Ruta: ${filePath}`);
    console.log(`🔐 Hash: ${hash}`);
    console.log(`\n🔗 LINK PARA PROBAR:`);
    console.log(`${DOMAIN}/verCertificado/${hash}`);
    console.log("\n---------------------------------------------------------");
    console.log("INSTRUCCIONES:");
    console.log("1. Abre el link de arriba en tu navegador. Debe cargar.");
    console.log("2. Ve a Easypanel y dale a 'REDEPLOY' o reconstruye el bot.");
    console.log("3. Espera a que termine y vuelve a abrir el link.");
    console.log("4. SI EL LINK SIGUE CARGANDO, EL VOLUMEN ESTÁ FUNCIONANDO PERFECTO. 🚀");
    console.log("---------------------------------------------------------");
}

crearPruebaPersistencia().catch(console.error);
