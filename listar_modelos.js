const { GoogleGenerativeAI } = require("@google/generative-ai");
const API_KEY = "AIzaSyBQMCOse-Af9uQwW6W-kCp_eRzmA9jNgxw";
const genAI = new GoogleGenerativeAI(API_KEY);

async function main() {
    console.log("📋 Listando modelos disponibles...");
    try {
        // Usamos fetch directamente para ver la respuesta real de la API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        
        if (data.models) {
            console.log("\n✅ Modelos encontrados:");
            data.models.forEach(m => {
                console.log(`- ${m.name} (Soporta: ${m.supportedGenerationMethods.join(', ')})`);
            });
        } else {
            console.log("❌ No se encontraron modelos o la clave es inválida.");
            console.log("Respuesta completa:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("❌ Error de red:", e.message);
    }
}
main();
