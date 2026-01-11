# Interface Web - Weapon Detection

## 🚀 Démarrage Rapide

### 1. Démarrer l'API FastAPI

Depuis le dossier racine du projet :

```bash
# Activer l'environnement virtuel (si nécessaire)
python -m venv venv
.\venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Démarrer l'API
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Ouvrir l'interface web

Ouvrez simplement le fichier `index.html` dans votre navigateur :

- Double-cliquez sur `webapp/index.html`
- Ou utilisez un serveur local : `python -m http.server 3000`

L'interface se connectera automatiquement à `http://localhost:8000`

## ✨ Fonctionnalités

### 📷 Détection par Image

1. Cliquez sur "Choisir une image"
2. Sélectionnez une image depuis votre ordinateur
3. Ajustez le seuil de confiance si nécessaire (0.0 - 1.0)
4. Cliquez sur "Détecter les armes"
5. **L'image annotée par YOLO s'affichera avec les bounding boxes**

**Nouveautés :**

- ✅ Affichage de l'image annotée directement par YOLO
- ✅ Temps d'inférence correctement affiché (en millisecondes)
- ✅ Indicateur "Armes détectées" (OUI/NON)
- ✅ Taille de l'image

### 📹 Détection Webcam en Temps Réel

1. Cliquez sur "Démarrer la Webcam"
2. Autorisez l'accès à votre caméra
3. La détection se fait automatiquement toutes les 500ms
4. Les bounding boxes sont dessinés en temps réel sur la vidéo
5. Cliquez sur "Arrêter la Webcam" pour terminer

**Options :**

- Ajustez le seuil de confiance en temps réel
- Cochez/décochez "Détection automatique"

### 📊 Statistiques

- **Détections totales** : Nombre total de détections effectuées
- **Armes détectées** : Nombre de fois où une arme a été détectée
- **Dernière détection** : Heure de la dernière détection

## 🔧 Configuration

L'API doit être accessible sur `http://localhost:8000`

Pour changer l'URL de l'API, modifiez dans `app.js` :

```javascript
const API_BASE_URL = "http://localhost:8000";
```

## 📡 Endpoints API Utilisés

- `GET /health` - Vérifier la santé de l'API
- `POST /detect/image/annotated` - Détecter et retourner l'image annotée (NOUVEAU)
  - Headers de réponse :
    - `X-Detection-Count` : Nombre de détections
    - `X-Inference-Time` : Temps d'inférence (ms)
    - `X-Has-Weapons` : true/false
    - `X-Image-Size` : Dimensions (largeur x hauteur)

## 🎨 Interface

- Design moderne et sombre
- Responsive (fonctionne sur mobile et desktop)
- Notifications toast pour les actions
- Indicateur de chargement
- Visualisation en temps réel

## 🐛 Résolution de problèmes

### L'API ne répond pas

- Vérifiez que l'API est bien démarrée sur le port 8000
- Vérifiez la console du navigateur (F12) pour les erreurs CORS

### La webcam ne fonctionne pas

- Vérifiez que vous avez autorisé l'accès à la caméra
- Essayez avec un navigateur différent
- Certains navigateurs nécessitent HTTPS pour accéder à la webcam

### Les images ne s'affichent pas

- Vérifiez le format de l'image (JPG, PNG, BMP, WebP supportés)
- Vérifiez la taille de l'image (max 10MB)

## 📝 Notes Techniques

- L'image annotée est générée par YOLO avec `results[0].plot()`
- Les bounding boxes sont dessinées nativement par YOLO (plus précis et plus rapide)
- Les métadonnées sont transmises via les headers HTTP
- La webcam utilise l'API MediaDevices du navigateur
