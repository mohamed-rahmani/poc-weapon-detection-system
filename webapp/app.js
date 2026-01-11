// Configuration de l'API
const API_BASE_URL = "http://localhost:8000";

// État global de l'application
const appState = {
  webcamStream: null,
  webcamActive: false,
  detectionInterval: null,
  stats: {
    totalDetections: 0,
    weaponsDetected: 0,
    lastDetection: null,
  },
};

// Initialisation de l'application
document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners();
  checkAPIHealth();
});

// Initialiser tous les écouteurs d'événements
function initializeEventListeners() {
  // Image Upload
  document.getElementById("uploadBtn").addEventListener("click", () => {
    document.getElementById("imageInput").click();
  });

  document
    .getElementById("imageInput")
    .addEventListener("change", handleImageSelect);
  document
    .getElementById("detectImageBtn")
    .addEventListener("click", detectImage);

  // Threshold sliders
  document.getElementById("imageThreshold").addEventListener("input", (e) => {
    document.getElementById("imageThresholdValue").textContent = e.target.value;
  });

  document.getElementById("webcamThreshold").addEventListener("input", (e) => {
    document.getElementById("webcamThresholdValue").textContent =
      e.target.value;
  });

  // Webcam controls
  document
    .getElementById("startWebcamBtn")
    .addEventListener("click", startWebcam);
  document
    .getElementById("stopWebcamBtn")
    .addEventListener("click", stopWebcam);

  // Log des caméras disponibles au démarrage (pour debug)
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const videoDevices = devices.filter(
          (device) => device.kind === "videoinput"
        );
        console.log(`${videoDevices.length} caméra(s) détectée(s):`);
        videoDevices.forEach((device, index) => {
          console.log(
            `  ${index + 1}. ${device.label || "Caméra sans nom"} (${
              device.deviceId
            })`
          );
        });
        if (videoDevices.length === 0) {
          console.warn(
            "⚠️ Aucune caméra détectée. Vérifiez qu'une webcam est connectée."
          );
        }
      })
      .catch((err) =>
        console.error("Erreur lors de l'énumération des périphériques:", err)
      );
  }
}

// Vérifier la santé de l'API
async function checkAPIHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (response.ok) {
      showToast("API connectée avec succès", "success");
    } else {
      showToast("API non disponible", "error");
    }
  } catch (error) {
    showToast(
      "Impossible de se connecter à l'API. Assurez-vous qu'elle est démarrée.",
      "error"
    );
  }
}

// Gestion de la sélection d'image
function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const previewImage = document.getElementById("previewImage");
    previewImage.src = e.target.result;
    document.getElementById("imagePreview").classList.remove("hidden");
    document.getElementById("imageResults").classList.add("hidden");
  };
  reader.readAsDataURL(file);
}

// Détecter les armes dans une image
async function detectImage() {
  const fileInput = document.getElementById("imageInput");
  const file = fileInput.files[0];

  if (!file) {
    showToast("Veuillez sélectionner une image", "warning");
    return;
  }

  const threshold = parseFloat(document.getElementById("imageThreshold").value);
  showLoading(true);

  try {
    const formData = new FormData();
    formData.append("file", file);

    // Utiliser l'endpoint qui retourne l'image annotée
    const url = `${API_BASE_URL}/detect/image/annotated?confidence_threshold=${threshold}`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Erreur lors de la détection");
    }

    // Debug: Afficher tous les headers disponibles
    //console.log("=== Response Headers ===");
    //for (let [key, value] of response.headers.entries()) {
    //console.log(`${key}: ${value}`);
    //}
    //console.log("=======================");

    // Récupérer les métadonnées depuis les headers
    const detectionCount = parseInt(
      response.headers.get("X-Detection-Count") || "0"
    );
    const weaponCount = parseInt(response.headers.get("X-Weapon-Count") || "0");
    const inferenceTime = response.headers.get("X-Inference-Time") || "0ms";
    const hasWeapons = response.headers.get("X-Has-Weapons") === "true";
    const imageSize = response.headers.get("X-Image-Size") || "0x0";

    // Récupérer l'image annotée
    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);

    // Afficher l'image annotée
    const previewImage = document.getElementById("previewImage");
    previewImage.src = imageUrl;

    // Afficher les résultats
    displayImageResults({
      detection_count: detectionCount,
      inference_time_ms: parseFloat(inferenceTime),
      has_weapons: hasWeapons,
      image_size: imageSize,
    });

    updateStats(detectionCount, weaponCount);

    if (detectionCount > 0) {
      showToast(`${detectionCount} détection(s) trouvée(s)`, "success");
    } else {
      showToast("Aucune arme détectée", "success");
    }
  } catch (error) {
    console.error("Erreur de détection:", error);
    showToast(error.message, "error");
  } finally {
    showLoading(false);
  }
}

// Afficher les résultats de détection d'image
function displayImageResults(data) {
  const resultsDiv = document.getElementById("imageResults");
  resultsDiv.classList.remove("hidden");

  let html = `
        <h3>Résultats de détection</h3>
        <div class="detection-info">
            <p><strong>Temps d'inférence:</strong> ${data.inference_time_ms.toFixed(
              2
            )}ms</p>
            <p><strong>Nombre de détections:</strong> ${
              data.detection_count
            }</p>
            <p><strong>Armes détectées:</strong> ${
              data.has_weapons ? "⚠️ OUI" : "✓ NON"
            }</p>
            <p><strong>Taille image:</strong> ${data.image_size}</p>
        </div>
        <div class="detection-note">
            <p style="color: var(--text-secondary); font-style: italic; margin-top: 15px;">
                💡 Les bounding boxes et labels sont dessinés directement par YOLO sur l'image ci-dessus.
            </p>
        </div>
    `;

  resultsDiv.innerHTML = html;
}

// Démarrer la webcam
async function startWebcam() {
  let videoDevices = []; // Déclarer ici pour être accessible dans le catch

  try {
    // Vérifier si la webcam est déjà active
    if (appState.webcamStream) {
      showToast("La webcam est déjà active", "warning");
      return;
    }

    // Vérifier que l'API est disponible
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Votre navigateur ne supporte pas l'accès à la webcam");
    }

    // Vérifier d'abord si des caméras sont disponibles
    console.log("Vérification des caméras disponibles...");
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter((device) => device.kind === "videoinput");

    if (videoDevices.length === 0) {
      throw Object.assign(new Error("Aucune webcam détectée"), {
        name: "NotFoundError",
      });
    }

    console.log(`${videoDevices.length} caméra(s) trouvée(s)`);

    // Demander l'accès à la webcam avec des contraintes plus flexibles
    const constraints = {
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: "environment", // Préférer la caméra arrière sur mobile
      },
    };

    console.log("Demande d'accès à la webcam...");
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log("Accès accordé, démarrage du stream...");

    const video = document.getElementById("webcamVideo");
    video.srcObject = stream;
    appState.webcamStream = stream;
    appState.webcamActive = true;

    // Attendre que la vidéo soit prête
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        video
          .play()
          .then(() => {
            console.log("Vidéo démarrée avec succès");
            resolve();
          })
          .catch(reject);
      };
      video.onerror = reject;
    });

    // Afficher le conteneur webcam
    document.getElementById("webcamContainer").classList.remove("hidden");
    document.getElementById("startWebcamBtn").classList.add("hidden");
    document.getElementById("stopWebcamBtn").classList.remove("hidden");
    document.getElementById("webcamResults").classList.remove("hidden");

    // Configurer le canvas
    const canvas = document.getElementById("detectionCanvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    console.log(`Canvas configuré: ${canvas.width}x${canvas.height}`);

    // Démarrer la détection automatique si activée
    if (document.getElementById("autoDetect").checked) {
      startAutoDetection();
    }

    showToast("Webcam démarrée avec succès", "success");
  } catch (error) {
    console.error("Erreur webcam:", error);
    console.error("Type d'erreur:", error.name);
    console.error("Message:", error.message);

    // Messages d'erreur plus détaillés
    let errorMessage = "Impossible d'accéder à la webcam";

    if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
      errorMessage =
        "Aucune webcam détectée sur cet appareil. Veuillez connecter une caméra et réessayer.";
    } else if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      errorMessage =
        "Accès à la webcam refusé. Veuillez autoriser l'accès dans les paramètres du navigateur.";
    } else if (error.name === "NotReadableError") {
      // Vérifier si c'est une caméra virtuelle OBS ou sans nom
      const hasOBS = videoDevices.some(
        (device) => device.label && device.label.includes("OBS")
      );
      const hasNoName = videoDevices.some(
        (device) => !device.label || device.label.trim() === ""
      );

      if (hasOBS) {
        errorMessage =
          "OBS Virtual Camera détectée mais non disponible. Veuillez démarrer OBS et activer la caméra virtuelle, ou connectez une vraie webcam.";
      } else if (hasNoName) {
        errorMessage =
          "Une caméra virtuelle ou non disponible a été détectée. Si vous utilisez OBS Virtual Camera, démarrez OBS. Sinon, connectez une vraie webcam ou vérifiez que la caméra fonctionne.";
      } else {
        errorMessage =
          "La webcam est déjà utilisée par une autre application ou le pilote est défaillant. Veuillez fermer les autres applications et réessayer.";
      }
    } else if (error.name === "NotSupportedError") {
      errorMessage =
        "Votre navigateur ne supporte pas l'accès à la webcam via HTTP. Utilisez HTTPS ou localhost.";
    } else if (error.name === "OverconstrainedError") {
      errorMessage =
        "Les contraintes de la webcam ne peuvent pas être satisfaites. Essayez avec une résolution plus basse.";
    } else {
      errorMessage = `Erreur: ${error.message}`;
    }

    showToast(errorMessage, "error");

    // Nettoyer en cas d'erreur
    if (appState.webcamStream) {
      appState.webcamStream.getTracks().forEach((track) => track.stop());
      appState.webcamStream = null;
    }
    appState.webcamActive = false;
  }
}

// Arrêter la webcam
function stopWebcam() {
  console.log("Arrêt de la webcam...");

  // Arrêter tous les tracks du stream
  if (appState.webcamStream) {
    appState.webcamStream.getTracks().forEach((track) => {
      track.stop();
      console.log(`Track ${track.kind} arrêté`);
    });
    appState.webcamStream = null;
  }

  // Arrêter la détection automatique
  if (appState.detectionInterval) {
    clearInterval(appState.detectionInterval);
    appState.detectionInterval = null;
  }

  appState.webcamActive = false;

  // Masquer l'interface
  document.getElementById("webcamContainer").classList.add("hidden");
  document.getElementById("startWebcamBtn").classList.remove("hidden");
  document.getElementById("stopWebcamBtn").classList.add("hidden");
  document.getElementById("webcamResults").classList.add("hidden");

  // Nettoyer la vidéo
  const video = document.getElementById("webcamVideo");
  video.srcObject = null;
  video.pause();

  // Nettoyer le canvas
  const canvas = document.getElementById("detectionCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  console.log("Webcam arrêtée avec succès");
  showToast("Webcam arrêtée", "success");
}

// Démarrer la détection automatique
function startAutoDetection() {
  if (appState.detectionInterval) {
    clearInterval(appState.detectionInterval);
  }

  // Détecter toutes les 500ms
  appState.detectionInterval = setInterval(() => {
    if (
      appState.webcamActive &&
      document.getElementById("autoDetect").checked
    ) {
      detectWebcamFrame();
    }
  }, 500);
}

// Détecter dans une frame de la webcam
async function detectWebcamFrame() {
  const video = document.getElementById("webcamVideo");
  const canvas = document.getElementById("detectionCanvas");
  const ctx = canvas.getContext("2d");

  if (!video.videoWidth || !video.videoHeight) return;

  // Capturer la frame courante
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = video.videoWidth;
  tempCanvas.height = video.videoHeight;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(video, 0, 0);

  // Convertir en blob
  tempCanvas.toBlob(
    async (blob) => {
      if (!blob) return;

      try {
        const threshold = parseFloat(
          document.getElementById("webcamThreshold").value
        );
        const formData = new FormData();
        formData.append("file", blob, "frame.jpg");

        const url = `${API_BASE_URL}/detect/image?confidence_threshold=${threshold}`;
        const response = await fetch(url, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) return;

        const data = await response.json();

        // Dessiner les bounding boxes
        drawDetections(ctx, data.detections, canvas.width, canvas.height);

        // Afficher les résultats
        displayWebcamResults(data);

        // Mettre à jour les stats
        // Toutes les détections sont des armes (modèle de détection d'armes)
        if (data.detections.length > 0) {
          updateStats(data.detections.length, data.detections.length);
        }
      } catch (error) {
        console.error("Erreur détection webcam:", error);
      }
    },
    "image/jpeg",
    0.8
  );
}

// Dessiner les détections sur le canvas
function drawDetections(ctx, detections, canvasWidth, canvasHeight) {
  // Effacer le canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  detections.forEach((det) => {
    const bbox = det.bounding_box;
    const width = bbox.x2 - bbox.x1;
    const height = bbox.y2 - bbox.y1;

    // Style rouge pour toutes les armes détectées
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.fillStyle = "rgba(239, 68, 68, 0.2)";

    // Dessiner le rectangle
    ctx.fillRect(bbox.x1, bbox.y1, width, height);
    ctx.strokeRect(bbox.x1, bbox.y1, width, height);

    // Dessiner le label avec le nom de classe réel de YOLO
    const label = `${det.class_name} ${(det.confidence * 100).toFixed(1)}%`;
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#ef4444";

    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(bbox.x1, bbox.y1 - 25, textWidth + 10, 25);

    ctx.fillStyle = "white";
    ctx.fillText(label, bbox.x1 + 5, bbox.y1 - 5);
  });
}

// Afficher les résultats de la webcam
function displayWebcamResults(data) {
  const resultsDiv = document.getElementById("webcamResults");

  let html = "<h3>Détections en cours</h3>";

  if (data.detections.length > 0) {
    html += '<div class="detections-list">';
    data.detections.forEach((det) => {
      // Toutes les détections sont des armes, afficher le nom de classe réel
      html += `
                <div class="detection-item weapon">
                    <span class="detection-label">⚠️ ${det.class_name.toUpperCase()}</span>
                    <span class="detection-confidence">${(
                      det.confidence * 100
                    ).toFixed(1)}%</span>
                </div>
            `;
    });
    html += "</div>";
  } else {
    html +=
      '<p style="color: var(--text-secondary);">Aucune détection en cours.</p>';
  }

  resultsDiv.innerHTML = html;
}

// Mettre à jour les statistiques
function updateStats(detectionCount, weaponCount) {
  if (detectionCount > 0) {
    appState.stats.totalDetections += detectionCount;
    appState.stats.weaponsDetected += weaponCount;
    appState.stats.lastDetection = new Date().toLocaleTimeString("fr-FR");
  }

  document.getElementById("totalDetections").textContent =
    appState.stats.totalDetections;
  document.getElementById("weaponsDetected").textContent =
    appState.stats.weaponsDetected;
  document.getElementById("lastDetection").textContent =
    appState.stats.lastDetection || "-";
}

// Afficher/masquer le loader
function showLoading(show) {
  const overlay = document.getElementById("loadingOverlay");
  if (show) {
    overlay.classList.remove("hidden");
  } else {
    overlay.classList.add("hidden");
  }
}

// Afficher une notification toast
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Supprimer après 3 secondes
  setTimeout(() => {
    toast.style.animation = "slideIn 0.3s ease reverse";
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 3000);
}

// Nettoyer lors de la fermeture de la page
window.addEventListener("beforeunload", () => {
  if (appState.webcamActive) {
    stopWebcam();
  }
});
