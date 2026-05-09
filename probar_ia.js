const { GoogleGenerativeAI } = require("@google/generative-ai");
const API_KEY = "AIzaSyBQMCOse-Af9uQwW6W-kCp_eRzmA9jNgxw";
const genAI = new GoogleGenerativeAI(API_KEY);

async function test() {
    console.log("🔍 Listando modelos disponibles para tu API Key...");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("✅ Conexión base establecida. Intentando una respuesta simple...");
        
        const result = await model.generateContent("Hola, responde con la palabra 'OK'");
        console.log("🤖 Respuesta de la IA:", result.response.text());
    } catch (e) {
        console.error("❌ Error de diagnóstico:", e.message);
    }
}
test();
