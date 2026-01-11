# 🚀 Guide de Démarrage Rapide

## Étape 1 : Démarrer l'API FastAPI

Ouvrez un terminal et exécutez :

```bash
cd c:\Users\moham\Dev\projects\weapon-detection
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

✅ L'API devrait être disponible sur `http://localhost:8000`

## Étape 2 : Trouver votre IP locale

Dans un nouveau terminal :

```bash
ipconfig
```

Cherchez votre **adresse IPv4** (ex: 192.168.1.100)

## Étape 3 : Démarrer l'application mobile

Dans un nouveau terminal :

```bash
cd c:\Users\moham\Dev\projects\weapon-detection\mobile-app
npx expo start --clear
```

## Étape 4 : Tester sur votre iPhone XR

1. **Ouvrez Expo Go** sur votre iPhone
2. **Scannez le QR code** affiché dans le terminal
3. **Attendez le chargement** de l'application
4. **Dans l'app**, modifiez l'URL de l'API avec votre IP :
   - Remplacez `http://192.168.1.100:8000` par `http://VOTRE_IP:8000`

## Étape 5 : Tester la détection

1. Cliquez sur **"📁 Galerie"** ou **"📷 Photo"**
2. Sélectionnez une image avec une arme
3. Cliquez sur **"🔍 Analyser"**
4. Attendez les résultats

## ⚠️ Problèmes courants

### "Impossible de se connecter à l'API"

- ✅ Vérifiez que l'API FastAPI est démarrée
- ✅ Vérifiez que téléphone et PC sont sur le même WiFi
- ✅ Vérifiez l'URL dans l'app (doit être votre IP locale)
- ✅ Testez l'API dans un navigateur : `http://VOTRE_IP:8000/health`

### "QR code ne fonctionne pas"

```bash
# Redémarrez avec nettoyage du cache
npx expo start --clear --tunnel
```

### "Metro bundler error"

```bash
# Supprimez node_modules et réinstallez
rm -rf node_modules
npm install
npx expo start --clear
```

## 📱 Versions testées

- ✅ Expo SDK : 54.0.0
- ✅ Expo Go Client : 1017756
- ✅ iPhone XR : iOS compatible

## 🎯 Fonctionnalités disponibles

- ✅ Prendre une photo
- ✅ Sélectionner depuis la galerie
- ✅ Détecter des armes
- ✅ Voir les résultats détaillés
- ✅ Score de confiance
- ✅ Temps d'analyse

Bonne détection ! 🔍
