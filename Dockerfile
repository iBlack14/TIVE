FROM node:20-slim

# Instalamos poppler-utils, poppler-data y fuentes estándar
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
    poppler-data \
    fonts-liberation \
    fontconfig \
    gsfonts \
    procps \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f -v

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY ./tarjeta ./tarjeta
COPY . .

RUN mkdir -p servicio/verCertificado

# Arrancamos tanto el bot como el servidor web (usando el script 'all' de package.json)
CMD ["npm", "run", "all"]
