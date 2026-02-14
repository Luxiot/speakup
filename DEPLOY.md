# Desplegar en Firebase

## Opción 1: Solo Hosting (SIN plan Blaze - gratis)

```bash
cd C:\Users\Luxio\Desktop\l\english-conversation
npm run deploy:hosting
```

- La API key se guarda en **localStorage** del navegador de cada usuario
- Cada persona ingresa la key **una vez** en su dispositivo, queda guardada
- No necesitas plan Blaze

## Opción 2: Hosting + Cloud Functions (plan Blaze)

Necesitas plan Blaze (pago por uso, tiene tier gratis).

1. Activar Firestore en Firebase Console
2. `firebase deploy` (o `npm run deploy`)

- La API key se guarda en Firestore, compartida para todos
- Solo la primera persona la ingresa, los demás no

## Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```
