# Weapon Detection Mobile App

Application mobile React Native pour la détection d'armes en temps réel.

## 🚀 Installation

```bash
# Installer les dépendances
npm install

# Démarrer l'application
npx expo start
```

## 📱 Utilisation avec Expo Go

1. **Installer Expo Go** sur votre iPhone XR depuis l'App Store
2. **Démarrer l'API FastAPI** sur votre ordinateur :

   ```bash
   cd ../
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Trouver votre adresse IP locale** :

   - Windows : `ipconfig` dans le terminal
   - Cherchez l'adresse IPv4 (ex: 192.168.1.100)

4. **Démarrer l'app mobile** :

   ```bash
   npx expo start --clear
   ```

5. **Scanner le QR code** avec Expo Go sur votre iPhone

6. **Configurer l'URL de l'API** dans l'app :
   - Remplacez `http://192.168.1.100:8000` par votre IP locale
   - Format: `http://VOTRE_IP:8000`

## ⚙️ Configuration

### URL de l'API

Dans [App.js](App.js), ligne 23, modifiez l'URL par défaut :

```javascript
const [apiUrl, setApiUrl] = useState("http://VOTRE_IP:8000");
```

### Permissions requises

- 📷 Caméra : Pour prendre des photos
- 📁 Galerie : Pour sélectionner des images

## 🎯 Fonctionnalités

- ✅ Prise de photo depuis la caméra
- ✅ Sélection d'image depuis la galerie
- ✅ Détection d'armes en temps réel
- ✅ Affichage des résultats avec confiance
- ✅ Interface simple et intuitive
- ✅ Compatible iOS et Android

## 🔧 Dépannage

### Erreur de connexion à l'API

- Vérifiez que l'API FastAPI est démarrée
- Vérifiez que votre téléphone et ordinateur sont sur le même réseau WiFi
- Vérifiez l'URL de l'API dans l'application
- Désactivez temporairement le pare-feu si nécessaire

### App ne démarre pas

```bash
# Nettoyer le cache et redémarrer
npx expo start --clear
```

## 📋 Compatibilité

- ✅ Expo SDK 54
- ✅ Expo Go Client 1017756
- ✅ iOS (iPhone XR testé)
- ✅ Android

## 📦 Dépendances principales

- `expo` : ~54.0.0
- `react-native` : 0.76.5
- `expo-image-picker` : ~16.0.0
- `axios` : ^1.7.2
