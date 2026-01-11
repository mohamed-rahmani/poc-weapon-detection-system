import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function App() {
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [apiUrl, setApiUrl] = useState("http://192.168.1.85:8000"); // Modifier avec votre IP locale

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
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.title}>🔍 Détection d'Armes</Text>
          <Text style={styles.subtitle}>IA de Sécurité</Text>
        </View>

        {/* Configuration API */}
        <View style={styles.configSection}>
          <Text style={styles.configLabel}>URL de l'API:</Text>
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="http://192.168.1.100:8000"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Zone d'image */}
        <View style={styles.imageSection}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>📸</Text>
              <Text style={styles.placeholderSubtext}>
                Aucune image sélectionnée
              </Text>
            </View>
          )}
        </View>

        {/* Boutons d'action */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.buttonSecondary} onPress={pickImage}>
            <Text style={styles.buttonSecondaryText}>📁 Galerie</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonSecondary} onPress={takePhoto}>
            <Text style={styles.buttonSecondaryText}>📷 Photo</Text>
          </TouchableOpacity>
        </View>

        {imageUri && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={analyzeImage}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>🔍 Analyser</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonReset} onPress={reset}>
              <Text style={styles.buttonResetText}>🔄 Reset</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Résultats */}
        {results && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>📊 Résultats</Text>

            <View style={styles.resultCard}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Détections:</Text>
                <Text
                  style={[
                    styles.resultValue,
                    results.detection_count > 0
                      ? styles.resultDanger
                      : styles.resultSafe,
                  ]}
                >
                  {results.detection_count}
                </Text>
              </View>

              {results.detection_count > 0 && (
                <>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Confiance Max:</Text>
                    <Text style={styles.resultValue}>
                      {(results.max_confidence * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Temps:</Text>
                    <Text style={styles.resultValue}>
                      {results.inference_time_ms.toFixed(0)}ms
                    </Text>
                  </View>
                </>
              )}
            </View>

            {results.detections && results.detections.length > 0 && (
              <View style={styles.detectionsList}>
                <Text style={styles.detectionsTitle}>Armes détectées:</Text>
                {results.detections.map((detection, index) => (
                  <View key={index} style={styles.detectionItem}>
                    <Text style={styles.detectionClass}>
                      {detection.class_name.toUpperCase()}
                    </Text>
                    <Text style={styles.detectionConfidence}>
                      {(detection.confidence * 100).toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 50,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  configSection: {
    marginBottom: 20,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 14,
  },
  imageSection: {
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 15,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: "100%",
    height: 300,
    resizeMode: "contain",
  },
  placeholderImage: {
    height: 300,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  placeholderText: {
    fontSize: 60,
    marginBottom: 10,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: "#999",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  button: {
    flex: 1,
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 10,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: "#999",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonSecondary: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  buttonSecondaryText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonReset: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FF3B30",
  },
  buttonResetText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "bold",
  },
  resultsSection: {
    marginTop: 10,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  resultCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  resultValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  resultDanger: {
    color: "#FF3B30",
  },
  resultSafe: {
    color: "#34C759",
  },
  detectionsList: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detectionsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  detectionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#FFF3F3",
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#FF3B30",
  },
  detectionClass: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FF3B30",
  },
  detectionConfidence: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
});
