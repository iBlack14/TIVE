# Usar una imagen ligera de Node.js
FROM node:18-slim

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el resto del código
COPY . .

# Crear la carpeta de certificados y asignar permisos
RUN mkdir -p servicio/verCertificado && chmod -R 777 servicio/verCertificado

# Exponer el puerto configurado (3000)
EXPOSE 3000

# Comando para iniciar tanto el servidor como el bot
CMD ["npm", "run", "all"]
