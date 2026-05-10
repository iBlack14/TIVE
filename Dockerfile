FROM node:20-slim

# Instalamos poppler-utils y fuentes estándar para evitar el error de "font not found"
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
    fonts-liberation \
    fontconfig \
    gsfonts \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f -v

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY ./tarjeta ./tarjeta
COPY . .

RUN mkdir -p servicio/verCertificado

CMD ["node", "bot.js"]
