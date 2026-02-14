# Desplegar el backend en Railway (gratis)

Para que la app funcione en Firebase Hosting sin plan Blaze, despliega el backend en Railway.

## 1. Crear cuenta en Railway

https://railway.app → Sign up (gratis con GitHub)

## 2. Nuevo proyecto

1. New Project → Deploy from GitHub (conecta tu repo)
2. O: Deploy from local → sube la carpeta del proyecto
3. Railway detectará Node.js automáticamente

## 3. Configurar

1. En tu proyecto Railway → Variables
2. Añade: `XAI_API_KEY` = tu API key de xAI (Grok)
3. Railway usa `PORT` automáticamente, no hace falta configurarlo

## 4. Obtener URL

Railway te dará una URL tipo: `https://tu-proyecto.up.railway.app`

## 5. Configurar en la app

1. Abre tu app en Firebase
2. Click en el ícono de ajustes (Settings)
3. Pega la URL de Railway en "Backend URL (Railway)"
4. La app se conectará al backend y funcionará

## 6. Guardar API key (opcional)

La primera vez que alguien ingrese la API key en la app, se guardará en el .env del servidor de Railway (hasta que reinicie). Para que quede fija, usa la variable XAI_API_KEY en Railway.
