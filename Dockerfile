# Dockerfile optimizado para Railway con soporte para Playwright
FROM node:18-slim

# Instalar dependencias del sistema necesarias para Playwright/Chromium
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar TODAS las dependencias (incluye devDependencies necesarias para build)
RUN npm ci

# Copiar el resto de la aplicación
COPY . .

# Build de Next.js
RUN npm run build

# Instalar Playwright y sus navegadores después del build
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Limpiar devDependencies después del build para reducir tamaño
RUN npm prune --production

# Exponer puerto
EXPOSE 3000

# Variables de entorno para Playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Comando de inicio usando standalone
CMD ["node", ".next/standalone/server.js"]
