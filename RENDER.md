# Desplegar backend en Render

https://render.com

## 1. Cuenta en Render

1. Ve a https://render.com  
2. **Get Started for Free**  
3. Regístrate con GitHub  

## 2. Sube el proyecto a GitHub (si no está)

```bash
cd C:\Users\Luxio\Desktop\l\english-conversation
git init
git add .
git commit -m "Deploy to Render"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

## 3. Crear Web Service en Render

1. En https://dashboard.render.com → **New** → **Web Service**  
2. Conecta tu repositorio de GitHub  
3. Selecciona el repo del proyecto  
4. Configuración (Render usa `render.yaml` automáticamente, o ajusta manualmente):
   - **Name:** speakup-api (o el que quieras)  
   - **Region:** Oregon (US West) o el más cercano  
   - **Branch:** main  
   - **Runtime:** Node  
   - **Build Command:** `npm install`  
   - **Start Command:** `node server.js`  

## 4. Variables de entorno

1. En tu servicio → **Environment**  
2. **Add Environment Variable**  
3. `XAI_API_KEY` = tu API key de xAI (Grok)  
4. Guarda  

## 5. Deploy

1. **Create Web Service**  
2. Espera a que termine el deploy  
3. Render te dará una URL: `https://speakup-api.onrender.com`  

## 6. Configurar en la app

1. Abre tu app en Firebase: https://speakup-3e8cd.web.app  
2. Haz clic en **Settings** (ícono de engranaje)  
3. Pega la URL de Render en **"Backend URL (Railway)"**  
   (ej: `https://speakup-api.onrender.com`)  
4. La app usará el backend en Render  

---

**Nota:** El tier gratuito de Render puede tardar unos segundos en responder en el primer uso (cold start).
