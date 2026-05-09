# Usamos una versión estable de Node.js
FROM node:20-slim

# Instalamos dependencias del sistema necesarias para 'canvas' y 'pdf-lib'
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de la app
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el resto del código
COPY . .

# Asegurar que existan las carpetas necesarias
RUN mkdir -p servicio/verCertificado tarjeta

# Comando para iniciar el bot
CMD ["node", "bot.js"]
