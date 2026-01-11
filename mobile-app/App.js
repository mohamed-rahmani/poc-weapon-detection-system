import axios from "axios";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function App() {
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [apiUrl, setApiUrl] = useState("http://192.168.1.85:8000");
  const [showCamera, setShowCamera] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const analysisInterval = useRef(null);

  // Fonction pour choisir une image depuis la galerie
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission refusée",
        "Nous avons besoin de la permission pour accéder à vos photos"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setResults(null); // Reset results
    }
  };

  // Fonction pour prendre une photo
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission refusée",
        "Nous avons besoin de la permission pour accéder à la caméra"
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setResults(null); // Reset results
    }
  };

  // Fonction pour analyser l'image
  const analyzeImage = async () => {
    if (!imageUri) {
      Alert.alert("Erreur", "Veuillez sélectionner une image d'abord");
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      // Créer FormData pour l'upload
      const formData = new FormData();
      const filename = imageUri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      formData.append("file", {
        uri: imageUri,
        name: filename,
        type: type,
      });

      // Envoyer la requête à l'API
      const response = await axios.post(`${apiUrl}/detect/image`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000, // 30 secondes
      });

      setResults(response.data);

      // Afficher une alerte si des armes sont détectées
      if (response.data.detection_count > 0) {
        Alert.alert(
          "⚠️ Armes Détectées!",
          `${
            response.data.detection_count
          } arme(s) détectée(s) avec un score de ${(
            response.data.max_confidence * 100
          ).toFixed(1)}%`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("✅ Aucune Arme", "Aucune arme détectée dans l'image", [
          { text: "OK" },
        ]);
      }
    } catch (error) {
      console.error("Erreur:", error);
      let errorMessage = "Impossible de se connecter à l'API";

      if (error.response) {
        errorMessage = error.response.data?.detail || "Erreur du serveur";
      } else if (error.request) {
        errorMessage =
          "Pas de réponse du serveur. Vérifiez l'URL de l'API et votre connexion.";
      }

      Alert.alert("Erreur", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour réinitialiser
  const reset = () => {
    setImageUri(null);
    setResults(null);
    setShowCamera(false);
    stopLiveDetection();
  };

  // Fonction pour démarrer la caméra en temps réel
  const startLiveDetection = async () => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert(
          "Permission refusée",
          "La permission caméra est nécessaire pour la détection en temps réel"
        );
        return;
      }
    }

    setShowCamera(true);
    setImageUri(null);
    setResults(null);
  };

  // Effet pour démarrer/arrêter l'analyse automatique
  useEffect(() => {
    if (showCamera && cameraRef.current) {
      // Démarrer l'analyse automatique toutes les 2 secondes
      const interval = setInterval(() => {
        analyzeCameraFrame();
      }, 2000);

      analysisInterval.current = interval;

      // Cleanup quand la caméra est fermée
      return () => {
        if (analysisInterval.current) {
          clearInterval(analysisInterval.current);
          analysisInterval.current = null;
        }
      };
    }
  }, [showCamera]);

  // Fonction pour arrêter la détection
  const stopLiveDetection = () => {
    if (analysisInterval.current) {
      clearInterval(analysisInterval.current);
      analysisInterval.current = null;
    }
    setIsAnalyzing(false);
    setResults(null);
  };

  // Fonction pour analyser une frame de la caméra
  const analyzeCameraFrame = async () => {
    if (!cameraRef.current || isAnalyzing) return;

    setIsAnalyzing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: false,
        skipProcessing: true,
      });

      const formData = new FormData();
      const filename = photo.uri.split("/").pop();

      formData.append("file", {
        uri: photo.uri,
        name: filename,
        type: "image/jpeg",
      });

      const response = await axios.post(`${apiUrl}/detect/image`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 10000,
      });

      setResults(response.data);

      if (response.data.detection_count > 0) {
        // Vibreur ou alerte sonore pourrait être ajouté ici
      }
    } catch (error) {
      console.error("Erreur d'analyse:", error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Fonction pour capturer depuis la caméra live
  const captureFromLive = async () => {
    if (!cameraRef.current) return;

    setLoading(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
      });

      setImageUri(photo.uri);
      setShowCamera(false);

      // Analyser automatiquement
      await analyzeImageUri(photo.uri);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de capturer l'image");
    } finally {
      setLoading(false);
    }
  };

  // Fonction helper pour analyser une URI
  const analyzeImageUri = async (uri) => {
    setLoading(true);

    try {
      const formData = new FormData();
      const filename = uri.split("/").pop();

      formData.append("file", {
        uri: uri,
        name: filename,
        type: "image/jpeg",
      });

      const response = await axios.post(`${apiUrl}/detect/image`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000,
      });

      setResults(response.data);

      if (response.data.detection_count > 0) {
        Alert.alert(
          "⚠️ Armes Détectées",
          `${response.data.detection_count} arme(s) détectée(s)`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Erreur:", error);
      Alert.alert("Erreur", "Impossible d'analyser l'image");
    } finally {
      setLoading(false);
    }
  };

  // Vue caméra en temps réel
  if (showCamera) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          {/* Overlay avec informations */}
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowCamera(false);
                  stopLiveDetection();
                }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
              <View style={styles.cameraTitleContainer}>
                <Text style={styles.cameraTitle}>Détection en Direct</Text>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveIndicatorDot} />
                  <Text style={styles.liveIndicatorText}>LIVE</Text>
                </View>
              </View>
              <View style={{ width: 40 }} />
            </View>

            {/* Compteur principal en temps réel */}
            <View style={styles.mainCounter}>
              <View
                style={[
                  styles.counterCard,
                  results?.detection_count > 0
                    ? styles.counterDanger
                    : styles.counterSafe,
                ]}
              >
                <Text style={styles.counterValue}>
                  {results?.detection_count ?? 0}
                </Text>
                <Text style={styles.counterLabel}>
                  {results?.detection_count > 0
                    ? "ARME(S) DÉTECTÉE(S)"
                    : "AUCUNE MENACE"}
                </Text>
                {isAnalyzing && (
                  <View style={styles.scanningIndicator}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.scanningText}>Analyse...</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Stats détaillées */}
            {results && results.detection_count > 0 && (
              <View style={styles.detailsContainer}>
                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>Confiance Max</Text>
                  <Text style={styles.detailValue}>
                    {(results.max_confidence * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>Temps Analyse</Text>
                  <Text style={styles.detailValue}>
                    {results.inference_time_ms?.toFixed(0) ?? 0}ms
                  </Text>
                </View>
              </View>
            )}

            {/* Bouton de capture uniquement */}
            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={captureFromLive}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* En-tête moderne */}
        <View style={styles.header}>
          <Text style={styles.title}>Détecteur d'armes</Text>
          <Text style={styles.subtitle}>Powered by AI</Text>
        </View>

        {/* Configuration API */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Configuration</Text>
          <View style={styles.card}>
            <Text style={styles.inputLabel}>URL de l'API</Text>
            <TextInput
              style={styles.input}
              value={apiUrl}
              onChangeText={setApiUrl}
              placeholder="http://192.168.1.85:8000"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Bouton Caméra Live */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Détection en Temps Réel</Text>
          <TouchableOpacity
            style={styles.liveButton}
            onPress={startLiveDetection}
          >
            <View style={styles.liveButtonContent}>
              <Text style={styles.liveButtonIcon}>📹</Text>
              <View>
                <Text style={styles.liveButtonText}>Caméra en Direct</Text>
                <Text style={styles.liveButtonSubtext}>
                  Analyse continue en temps réel
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Zone d'image */}
        {imageUri ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Image Capturée</Text>
            <View style={styles.imageCard}>
              <Image source={{ uri: imageUri }} style={styles.image} />
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Analyse d'Image</Text>
            <View style={styles.card}>
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📸</Text>
                <Text style={styles.emptyText}>Aucune image</Text>
                <Text style={styles.emptySubtext}>
                  Sélectionnez une photo pour l'analyser
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Boutons d'action */}
        <View style={styles.section}>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
              <Text style={styles.actionIcon}>📁</Text>
              <Text style={styles.actionText}>Galerie</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
              <Text style={styles.actionIcon}>📷</Text>
              <Text style={styles.actionText}>Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {imageUri && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={analyzeImage}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Analyser l'Image</Text>
                  <Text style={styles.primaryButtonIcon}>→</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={reset}>
              <Text style={styles.secondaryButtonText}>Réinitialiser</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Résultats */}
        {results && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Résultats de l'Analyse</Text>

            <View
              style={[
                styles.card,
                results.detection_count > 0
                  ? styles.dangerCard
                  : styles.successCard,
              ]}
            >
              <View style={styles.resultHeader}>
                <Text style={styles.resultIcon}>
                  {results.detection_count > 0 ? "⚠️" : "✅"}
                </Text>
                <Text style={styles.resultTitle}>
                  {results.detection_count > 0
                    ? "Armes Détectées"
                    : "Aucune Menace"}
                </Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {results.detection_count}
                  </Text>
                  <Text style={styles.statLabel}>Détections</Text>
                </View>

                {results.detection_count > 0 && (
                  <>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {results.inference_time_ms.toFixed(0)}ms
                      </Text>
                      <Text style={styles.statLabel}>Temps</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {results.detections && results.detections.length > 0 && (
              <View style={styles.detectionsList}>
                <Text style={styles.detectionsTitle}>
                  Détails des Détections
                </Text>
                {results.detections.map((detection, index) => (
                  <View key={index} style={styles.detectionItem}>
                    <View style={styles.detectionBadge}>
                      <Text style={styles.detectionBadgeText}>{index + 1}</Text>
                    </View>
                    <View style={styles.detectionInfo}>
                      <Text style={styles.detectionClass}>
                        {detection.class_name.toUpperCase()}
                      </Text>
                      <Text style={styles.detectionConfidence}>
                        Confiance: {(detection.confidence * 100).toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Styles généraux
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
  },

  // En-tête
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    color: "#8E8E93",
    marginTop: 4,
    fontWeight: "400",
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imageCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  // Input
  inputLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F2F2F7",
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    color: "#000",
    borderWidth: 0,
  },

  // Bouton Live
  liveButton: {
    backgroundColor: "#007AFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  liveButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  liveButtonIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  liveButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  liveButtonSubtext: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },

  // Image
  image: {
    width: "100%",
    height: 280,
    resizeMode: "cover",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
  },

  // Action Grid
  actionGrid: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },

  // Boutons principaux
  primaryButton: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    marginRight: 8,
  },
  primaryButtonIcon: {
    fontSize: 20,
    color: "#fff",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#007AFF",
  },
  buttonDisabled: {
    backgroundColor: "#8E8E93",
    opacity: 0.5,
  },

  // Résultats
  dangerCard: {
    backgroundColor: "#FFF3F3",
    borderWidth: 2,
    borderColor: "#FF3B30",
  },
  successCard: {
    backgroundColor: "#F0FFF4",
    borderWidth: 2,
    borderColor: "#34C759",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  resultIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "500",
  },

  // Liste détections
  detectionsList: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detectionsTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    marginBottom: 16,
  },
  detectionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    marginBottom: 8,
  },
  detectionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  detectionBadgeText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  detectionInfo: {
    flex: 1,
  },
  detectionClass: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  detectionConfidence: {
    fontSize: 14,
    color: "#8E8E93",
  },

  // Caméra
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "600",
  },
  cameraTitleContainer: {
    alignItems: "center",
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,59,48,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
    marginRight: 4,
  },
  liveIndicatorText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
  },

  // Compteur principal
  mainCounter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  counterCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 32,
    paddingHorizontal: 48,
    borderRadius: 24,
    alignItems: "center",
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  counterDanger: {
    backgroundColor: "rgba(255,59,48,0.95)",
  },
  counterSafe: {
    backgroundColor: "rgba(52,199,89,0.95)",
  },
  counterValue: {
    fontSize: 72,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  counterLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
    textAlign: "center",
  },
  scanningIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.3)",
  },
  scanningText: {
    fontSize: 13,
    color: "#fff",
    marginLeft: 8,
    fontWeight: "600",
  },

  // Détails
  detailsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  detailCard: {
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },

  // Stats live (garder pour compatibilité)
  liveInfo: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  liveStats: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
  },
  statCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    minWidth: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  // Contrôles caméra
  cameraControls: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
});
