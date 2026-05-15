const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function checkRealAccess() {
    const keys = process.env.GEMINI_KEYS ? process.env.GEMINI_KEYS.split(',') : [];
    if (keys.length === 0) {
        console.error("❌ No hay llaves en .env");
        return;
    }

    const key = keys[0].trim();
    console.log(`🔍 Probando llave (primeros 5 caracteres): ${key.substring(0, 5)}...`);
    
    // Intentamos una petición de lista cruda a la API
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            console.error("❌ ERROR DE LA API DE GOOGLE:", data.error.message);
            if (data.error.status === "INVALID_ARGUMENT") {
                console.log("💡 Sugerencia: Revisa si la API Key es correcta y no tiene espacios extra.");
            }
        } else if (data.models) {
            console.log("✅ ¡CONEXIÓN EXITOSA! Modelos disponibles para tu llave:");
            data.models.forEach(m => console.log(`  - ${m.name}`));
        } else {
            console.log("❓ Respuesta inesperada:", data);
        }
    } catch (e) {
        console.error("❌ Error de red:", e.message);
    }
}

checkRealAccess();
