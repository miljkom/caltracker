import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
  TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import AnalysisOverlay from '../components/AnalysisOverlay';
import { analyzeFood, reanalyzeItem, analyzeText } from '../services/foodAnalyzer';
import { lookupBarcode } from '../services/barcodeService';
import { saveMeal, addFavorite, getFavorites, useFavorite } from '../services/mealStorage';
import { savePhoto } from '../services/photoStorage';
import { AnalysisResult } from '../types/nutrition';

interface Props {
  navigation: any;
}

const ScanScreen: React.FC<Props> = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [favorites, setFavorites] = useState<any[]>([]);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualText, setManualText] = useState('');
  const [scanMode, setScanMode] = useState<'photo' | 'barcode'>('photo');
  const [barcodeScanned, setBarcodeScanned] = useState(false);

  React.useEffect(() => {
    if (!photoUri) {
      getFavorites(5).then(setFavorites);
    }
  }, [photoUri]);

  const analyzePhoto = async (uri: string) => {
    setPhotoUri(uri);
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const analysisResult = await analyzeFood(uri);
      setResult(analysisResult);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const message = err?.message ?? 'Failed to analyze photo';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || !cameraReady || isAnalyzing) {
      Alert.alert('Error', 'Camera not ready. Please wait a moment and try again.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
      });

      if (photo?.uri) {
        await analyzePhoto(photo.uri);
      } else {
        Alert.alert('Error', 'Camera did not return a photo. Try using the gallery instead.');
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err?.message ?? 'Failed to take photo. Try using the gallery instead.');
    }
  };

  const handlePickImage = async () => {
    if (isAnalyzing) return;
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]?.uri) {
      await analyzePhoto(pickerResult.assets[0].uri);
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (barcodeScanned || isAnalyzing) return;
    setBarcodeScanned(true);
    setPhotoUri('barcode');
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const barcodeResult = await lookupBarcode(data);
      if (barcodeResult) {
        setResult(barcodeResult);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError(`Product not found for barcode: ${data}. Try scanning the food with the camera instead.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Barcode lookup failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!result || !photoUri) return;

    try {
      const persistentUri = photoUri && photoUri !== 'manual' && photoUri !== 'barcode'
        ? await savePhoto(photoUri)
        : null;
      await saveMeal(persistentUri, result.mealType, result.items, result.totals, notes || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset and navigate to dashboard
      setPhotoUri(null);
      setResult(null);
      setNotes('');
      navigation.navigate('Dashboard');
    } catch (err) {
      Alert.alert('Error', 'Failed to save meal. Please try again.');
    }
  };

  const handleRemoveItem = (index: number) => {
    if (!result) return;
    const newItems = result.items.filter((_, i) => i !== index);
    if (newItems.length === 0) {
      Alert.alert('No Items', 'You removed all items. Retake the photo or add items back.', [
        { text: 'Retake', onPress: handleRetake },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    const newTotals = {
      calories: newItems.reduce((s, i) => s + i.calories, 0),
      protein: newItems.reduce((s, i) => s + i.protein, 0),
      carbs: newItems.reduce((s, i) => s + i.carbs, 0),
      fat: newItems.reduce((s, i) => s + i.fat, 0),
      fiber: newItems.reduce((s, i) => s + i.fiber, 0),
      sugar: newItems.reduce((s, i) => s + i.sugar, 0),
    };
    setResult({ ...result, items: newItems, totals: newTotals });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleChangeMealType = (mealType: string) => {
    if (!result) return;
    setResult({ ...result, mealType: mealType as AnalysisResult['mealType'] });
  };

  const handleEditItem = async (index: number, newName: string, portion: string) => {
    if (!result) return;
    const updatedItem = await reanalyzeItem(newName, portion);
    const newItems = [...result.items];
    newItems[index] = updatedItem;
    const newTotals = {
      calories: newItems.reduce((s, i) => s + i.calories, 0),
      protein: newItems.reduce((s, i) => s + i.protein, 0),
      carbs: newItems.reduce((s, i) => s + i.carbs, 0),
      fat: newItems.reduce((s, i) => s + i.fat, 0),
      fiber: newItems.reduce((s, i) => s + i.fiber, 0),
      sugar: newItems.reduce((s, i) => s + i.sugar, 0),
    };
    setResult({ ...result, items: newItems, totals: newTotals });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAddItem = async (name: string, portion: string) => {
    if (!result) return;
    const newItem = await reanalyzeItem(name, portion);
    const newItems = [...result.items, newItem];
    const newTotals = {
      calories: newItems.reduce((s, i) => s + i.calories, 0),
      protein: newItems.reduce((s, i) => s + i.protein, 0),
      carbs: newItems.reduce((s, i) => s + i.carbs, 0),
      fat: newItems.reduce((s, i) => s + i.fat, 0),
      fiber: newItems.reduce((s, i) => s + i.fiber, 0),
      sugar: newItems.reduce((s, i) => s + i.sugar, 0),
    };
    setResult({ ...result, items: newItems, totals: newTotals });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSaveAsFavorite = async () => {
    if (!result) return;
    const name = result.items.map(i => i.name).join(', ');
    await addFavorite(name, result.mealType, result.items, result.totals);
    Alert.alert('Saved!', 'This meal has been added to your favorites.');
  };

  const handleRetake = () => {
    setPhotoUri(null);
    setResult(null);
    setError(null);
    setNotes('');
    setBarcodeScanned(false);
  };

  // --- Manual entry view ---
  if (showManualInput) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permTitle}>Manual Entry</Text>
        <Text style={styles.permText}>Describe your meal and we'll estimate the nutrition</Text>
        <TextInput
          style={styles.manualInput}
          value={manualText}
          onChangeText={setManualText}
          placeholder="e.g. 2 eggs, toast with butter, orange juice"
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          autoFocus
        />
        <TouchableOpacity
          style={[styles.permBtn, !manualText.trim() && { opacity: 0.4 }]}
          onPress={async () => {
            if (!manualText.trim()) return;
            setShowManualInput(false);
            setPhotoUri('manual');
            setIsAnalyzing(true);
            setError(null);
            setResult(null);
            try {
              const result = await analyzeText(manualText.trim());
              setResult(result);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              setError(err?.message ?? 'Failed to analyze');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setIsAnalyzing(false);
              setManualText('');
            }
          }}
          disabled={!manualText.trim()}
        >
          <Text style={styles.permBtnText}>Analyze</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginTop: 10 }]}
          onPress={() => { setShowManualInput(false); setManualText(''); }}
        >
          <Text style={[styles.permBtnText, { color: 'rgba(255,255,255,0.6)' }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Permission check ---
  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permText}>
          We need your camera to scan food and estimate calories.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginTop: 10 }]}
          onPress={() => Linking.openURL('app-settings:')}
        >
          <Text style={[styles.permBtnText, { color: 'rgba(255,255,255,0.6)' }]}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Analysis result view ---
  if (photoUri) {
    return (
      <AnalysisOverlay
        photoUri={photoUri}
        result={result}
        isAnalyzing={isAnalyzing}
        error={error}
        onSave={handleSave}
        onRetake={handleRetake}
        onRemoveItem={handleRemoveItem}
        onChangeMealType={handleChangeMealType}
        onEditItem={handleEditItem}
        onSaveAsFavorite={handleSaveAsFavorite}
        onAddItem={handleAddItem}
        notes={notes}
        onChangeNotes={setNotes}
      />
    );
  }

  // --- Camera view ---
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setCameraReady(true)}
        barcodeScannerSettings={scanMode === 'barcode' ? { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] } : undefined}
        onBarcodeScanned={scanMode === 'barcode' && !barcodeScanned ? handleBarcodeScanned : undefined}
      >
        {/* Viewfinder overlay */}
        <View style={styles.viewfinder}>
          <View style={styles.viewfinderTop} />
          <View style={styles.viewfinderMiddle}>
            <View style={styles.viewfinderSide} />
            <View style={styles.viewfinderFrame}>
              {/* Corner markers */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.viewfinderSide} />
          </View>
          <View style={styles.viewfinderBottom}>
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, scanMode === 'photo' && styles.modeBtnActive]}
                onPress={() => setScanMode('photo')}
                accessibilityLabel="Photo scan mode" accessibilityRole="button"
              >
                <Text style={[styles.modeBtnText, scanMode === 'photo' && styles.modeBtnTextActive]}>📸 Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, scanMode === 'barcode' && styles.modeBtnActive]}
                onPress={() => { setScanMode('barcode'); setBarcodeScanned(false); }}
                accessibilityLabel="Barcode scan mode" accessibilityRole="button"
              >
                <Text style={[styles.modeBtnText, scanMode === 'barcode' && styles.modeBtnTextActive]}>📊 Barcode</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              {scanMode === 'photo' ? 'Point camera at your food' : 'Point camera at barcode'}
            </Text>
          </View>
        </View>
      </CameraView>

      {favorites.length > 0 && (
        <View style={styles.favoritesBar}>
          <Text style={styles.favoritesLabel}>Quick Add</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoritesScroll}>
            {favorites.map((fav) => (
              <TouchableOpacity
                key={fav.id}
                style={styles.favoriteChip}
                onPress={async () => {
                  await useFavorite(fav.id);
                  await saveMeal(null, fav.mealType, fav.items, fav.totals);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  navigation.navigate('Dashboard');
                }}
              >
                <Text style={styles.favoriteChipText} numberOfLines={1}>{fav.name}</Text>
                <Text style={styles.favoriteChipCal}>{Math.round(fav.totals.calories)} kcal</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Bottom controls */}
      {scanMode === 'photo' && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.galleryBtn} onPress={handlePickImage} accessibilityLabel="Pick from gallery" accessibilityRole="button">
            <Text style={styles.galleryIcon}>🖼️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureBtn, (!cameraReady || isAnalyzing) && { opacity: 0.4 }]}
            onPress={handleCapture}
            accessibilityLabel="Take photo" accessibilityRole="button"
            disabled={!cameraReady || isAnalyzing}
          >
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.galleryBtn} onPress={() => setShowManualInput(true)} accessibilityLabel="Manual food entry" accessibilityRole="button">
            <Text style={styles.galleryIcon}>✏️</Text>
          </TouchableOpacity>
        </View>
      )}
      {scanMode === 'barcode' && (
        <View style={styles.controls}>
          <View style={styles.galleryBtn} />
          <View style={[styles.captureBtn, { borderColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center' }}>Auto{'\n'}scan</Text>
          </View>
          <View style={styles.galleryBtn} />
        </View>
      )}
    </View>
  );
};

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  // Viewfinder
  viewfinder: {
    flex: 1,
  },
  viewfinderTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  viewfinderMiddle: {
    flexDirection: 'row',
    height: 280,
  },
  viewfinderSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  viewfinderFrame: {
    width: 280,
    height: 280,
  },
  viewfinderBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    paddingTop: 24,
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 3,
    marginBottom: 12,
  },
  modeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 17,
  },
  modeBtnActive: {
    backgroundColor: '#FF6B35',
  },
  modeBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: '#FAFAFA',
  },
  // Corner markers
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: '#FF6B35',
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: '#FF6B35',
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: '#FF6B35',
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: '#FF6B35',
    borderBottomRightRadius: 4,
  },
  // Controls
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 100,
    paddingHorizontal: 40,
    backgroundColor: '#0A0A0A',
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B35',
  },
  galleryBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryIcon: {
    fontSize: 22,
  },
  manualInput: {
    color: '#FAFAFA',
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  favoritesBar: {
    backgroundColor: '#0A0A0A',
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  favoritesLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  favoritesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  favoriteChip: {
    backgroundColor: 'rgba(255,217,61,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,217,61,0.2)',
    maxWidth: 160,
  },
  favoriteChipText: {
    color: '#FAFAFA',
    fontSize: 12,
    fontWeight: '600',
  },
  favoriteChipCal: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 2,
  },
  // Permission screen
  centered: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  permTitle: {
    color: '#FAFAFA',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  permText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  permBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  permBtnText: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ScanScreen;
