FROM node:20-slim

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

WORKDIR /app

COPY package*.json ./
RUN npm install --production

# COPIA EXPLICITA DE CARPETAS CRÍTICAS
COPY ./tarjeta ./tarjeta
COPY . .

RUN mkdir -p servicio/verCertificado

CMD ["node", "bot.js"]
