import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useThemedStyles } from '../hooks/use-themed-styles';

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
}

export function QRScannerModal({ visible, onClose, onScanned }: QRScannerModalProps) {
  const styles = useThemedStyles(createStyles);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) setScanned(false);
  }, [visible]);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScanned(data);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScanned}
          />
        ) : (
          <View style={styles.permissionBox}>
            <Ionicons name="camera-outline" size={48} color="#fff" />
            <Text style={styles.permissionText}>
              {permission?.canAskAgain === false
                ? 'Camera access denied. Enable it in Settings to scan QR codes.'
                : 'Camera access is needed to scan QR codes.'}
            </Text>
            {permission?.canAskAgain !== false && (
              <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                <Text style={styles.permissionBtnText}>Grant Access</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Overlay frame */}
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.frame} />
          <Text style={styles.hint}>Align the QR code within the frame</Text>
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const FRAME = 250;

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: FRAME,
    height: FRAME,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  hint: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 15,
    color: '#fff',
    marginTop: 24,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 20,
  },
  permissionText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionBtn: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.full,
  },
  permissionBtnText: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 16,
    color: '#fff',
  },
  });
}