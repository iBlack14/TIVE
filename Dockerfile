FROM node:20-slim

# Instalamos poppler-utils para una conversión de PDF a PNG perfecta
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY ./tarjeta ./tarjeta
COPY . .

RUN mkdir -p servicio/verCertificado

CMD ["node", "bot.js"]
