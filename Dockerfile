# ==========================================================
# ETAPA 1: COMPILACIÓN (BUILD STAGE)
# Usamos una imagen base de Node para compilar la aplicación
# ==========================================================
FROM node:20-alpine AS build

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de definición de dependencias (package.json y package-lock.json)
COPY package.json package-lock.json ./

# Instala las dependencias
RUN npm install

# Copia el resto del código fuente del frontend
COPY . .

# Ejecuta la compilación de Vue (esto genera la carpeta 'dist')
RUN NODE_OPTIONS=--openssl-legacy-provider npm run build



# ==========================================================
# ETAPA 2: SERVIDOR DE PRODUCCIÓN (PRODUCTION STAGE)
# Usamos Nginx, una imagen mínima, para servir los archivos estáticos
# ==========================================================
FROM nginx:alpine AS production

# Copia la configuración personalizada de Nginx
# Esto es crucial para manejar el enrutamiento de Vue (modo history)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia los archivos de compilación de la etapa anterior a la ubicación de Nginx
# /usr/share/nginx/html es el directorio por defecto de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Exponer el puerto por defecto de Nginx
EXPOSE 80

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]