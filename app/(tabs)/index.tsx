import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Modal, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { encryptVault, decryptVault } from '../../utils/vault';

const SIGNAL_SERVER_URL = 'http://localhost:3000';

export default function HomeScreen() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roomOrToken, setRoomOrToken] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);

  const [loading, setLoading] = useState(false);
  const [recentTokens, setRecentTokens] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkLoggedIn();
  }, []);

  const checkLoggedIn = async () => {
    const user = await AsyncStorage.getItem('auth_user');
    if (user) {
        const parsed = JSON.parse(user);
        setUsername(parsed.username);
        setPassword(parsed.password);
        setIsLoggedIn(true);
        loadLocalData();
    }
  };

  const loadLocalData = async () => {
    const savedTokens = await AsyncStorage.getItem('recent_tokens');
    if (savedTokens) setRecentTokens(JSON.parse(savedTokens));

    const savedProfile = await AsyncStorage.getItem('user_profile');
    if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        setDisplayName(profile.name || '');
        setAvatar(profile.avatar || null);
    }
  };

  const handleAuth = async () => {
    if (!username || !password) return Alert.alert('Error', 'Please fill username and password');
    setLoading(true);
    try {
        const endpoint = isLoginMode ? '/auth/login' : '/auth/signup';
        const response = await fetch(`${SIGNAL_SERVER_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            await AsyncStorage.setItem('auth_user', JSON.stringify({ username, password }));
            setIsLoggedIn(true);
            
            if (isLoginMode && data.vault) {
                const decrypted = await decryptVault(data.vault, password);
                if (decrypted.tokens) {
                    setRecentTokens(decrypted.tokens);
                    await AsyncStorage.setItem('recent_tokens', JSON.stringify(decrypted.tokens));
                }
                if (decrypted.profile) {
                    setDisplayName(decrypted.profile.name || '');
                    setAvatar(decrypted.profile.avatar || null);
                    await AsyncStorage.setItem('user_profile', JSON.stringify(decrypted.profile));
                }
            }
            if (!isLoginMode) setProfileModalVisible(true);
            Alert.alert('Success', isLoginMode ? 'Logged in' : 'Account created. Please set your profile.');
        } else {
            const err = await response.text();
            Alert.alert('Error', err);
        }
    } catch (e) {
        Alert.alert('Error', 'Connection failed');
    } finally {
        setLoading(false);
    }
  };

  const syncVault = async (updatedTokens: string[], updatedProfile?: any) => {
      if (!isLoggedIn) return;
      try {
          const profileToSync = updatedProfile || { name: displayName, avatar };
          const vault = await encryptVault({ tokens: updatedTokens, profile: profileToSync }, password);
          await fetch(`${SIGNAL_SERVER_URL}/sync/push`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password, vault })
          });
      } catch (e) {
          console.error('Sync failed', e);
      }
  };

  const saveProfile = async () => {
    const profile = { name: displayName, avatar };
    await AsyncStorage.setItem('user_profile', JSON.stringify(profile));
    setProfileModalVisible(false);
    syncVault(recentTokens, profile);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setAvatar(result.assets[0].base64);
    }
  };

  const saveToken = async (token: string) => {
    const updated = [token, ...recentTokens.filter(t => t !== token)].slice(0, 10);
    setRecentTokens(updated);
    await AsyncStorage.setItem('recent_tokens', JSON.stringify(updated));
    syncVault(updated);
  };

  const handleJoin = async () => {
    if (!isLoggedIn) return Alert.alert('Auth Required', 'Please login or signup first');

    let finalRoom = roomOrToken;
    let finalPass = roomPassword;

    if (roomOrToken.length === 5 && !roomPassword) {
        setLoading(true);
        try {
            const response = await fetch(`${SIGNAL_SERVER_URL}/resolveToken/${roomOrToken.toLowerCase()}`);
            if (response.ok) {
                const data = await response.json();
                finalRoom = data.roomId;
                finalPass = data.password;
                saveToken(roomOrToken.toUpperCase());
            } else {
                Alert.alert('Invalid Token', 'Token not found');
                return;
            }
        } catch (e) {
            Alert.alert('Error', 'Connection failed');
            return;
        } finally {
            setLoading(false);
        }
    }

    if (finalRoom && username && finalPass) {
      router.push({
        pathname: '/room',
        params: { room: finalRoom, username: displayName || username, password: finalPass }
      });
    } else {
        Alert.alert('Error', 'Please provide Token or Room/Password');
    }
  };

  const logout = async () => {
      await AsyncStorage.multiRemove(['auth_user', 'recent_tokens', 'user_profile']);
      setIsLoggedIn(false);
      setRecentTokens([]);
      setUsername('');
      setPassword('');
      setDisplayName('');
      setAvatar(null);
  };

  return (
    <LinearGradient colors={['#0b141a', '#2e0101']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <BlurView intensity={40} tint="dark" style={styles.glassCard}>
            <TouchableOpacity style={styles.profileBtn} onPress={() => isLoggedIn && setProfileModalVisible(true)}>
               {avatar ? (
                   <Image source={{ uri: `data:image/jpeg;base64,${avatar}` }} style={styles.avatarImg} />
               ) : (
                   <View style={styles.avatarPlaceholder}>
                       <Ionicons name="person" size={40} color="#fff" />
                   </View>
               )}
            </TouchableOpacity>
            
            <Text style={styles.title}>Silo Secure</Text>
            <Text style={styles.subtitle}>{isLoggedIn ? `Welcome, ${displayName || username}` : 'Private Account System'}</Text>

            {!isLoggedIn ? (
                <View style={styles.authForm}>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="person" size={20} color="#ef4444" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor="#888"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                    </View>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="lock-closed" size={20} color="#ef4444" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Account Password"
                            placeholderTextColor="#888"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>
                    <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
                        <LinearGradient colors={['#ef4444', '#991b1b']} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.buttonGradient}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isLoginMode ? 'Login to Silo' : 'Create Account'}</Text>}
                        </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)} style={styles.toggleAuth}>
                        <Text style={styles.toggleText}>{isLoginMode ? "Don't have an account? Sign up" : 'Already have an account? Login'}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.mainForm}>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="key" size={20} color="#ef4444" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Silo Token or Room Name"
                            placeholderTextColor="#888"
                            value={roomOrToken}
                            onChangeText={setRoomOrToken}
                            autoCapitalize="none"
                        />
                    </View>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="lock-open" size={20} color="#ef4444" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Room Key (Optional for Token)"
                            placeholderTextColor="#888"
                            value={roomPassword}
                            onChangeText={setRoomPassword}
                            secureTextEntry
                        />
                    </View>
                    <TouchableOpacity style={styles.button} onPress={handleJoin} disabled={loading}>
                        <LinearGradient colors={['#ef4444', '#991b1b']} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.buttonGradient}>
                            <Text style={styles.buttonText}>{loading ? 'Resolving...' : 'Connect to Room'}</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {recentTokens.length > 0 && (
                        <View style={styles.recentSection}>
                            <Text style={styles.recentTitle}>Synced Contacts / Tokens</Text>
                            <View style={styles.tokenContainer}>
                                {recentTokens.map(t => (
                                    <TouchableOpacity key={t} style={styles.tokenBadge} onPress={() => { setRoomOrToken(t); setRoomPassword(''); }}>
                                        <Text style={styles.tokenText}>{t}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                        <Text style={styles.logoutText}>Logout from this device</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.footer}>
              <Ionicons name="shield-half" size={16} color="#ef4444" />
              <Text style={styles.footerText}>E2EE: Server cannot read your profile.</Text>
            </View>
          </BlurView>
        </ScrollView>

        <Modal
            visible={isProfileModalVisible}
            transparent={true}
            animationType="slide"
        >
            <View style={styles.modalBg}>
                <BlurView intensity={90} tint="dark" style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Your Identity</Text>
                    <TouchableOpacity style={styles.modalAvatar} onPress={pickImage}>
                        {avatar ? (
                            <Image source={{ uri: `data:image/jpeg;base64,${avatar}` }} style={styles.modalAvatarImg} />
                        ) : (
                            <View style={styles.modalAvatarPlaceholder}>
                                <Ionicons name="camera" size={40} color="#888" />
                            </View>
                        )}
                        <View style={styles.editBadge}>
                            <Ionicons name="pencil" size={12} color="#fff" />
                        </View>
                    </TouchableOpacity>

                    <TextInput
                        style={styles.modalInput}
                        placeholder="Display Name"
                        placeholderTextColor="#888"
                        value={displayName}
                        onChangeText={setDisplayName}
                    />

                    <TouchableOpacity style={styles.button} onPress={saveProfile}>
                        <LinearGradient colors={['#ef4444', '#991b1b']} style={styles.buttonGradient}>
                            <Text style={styles.buttonText}>Save Profile</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </BlurView>
            </View>
        </Modal>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  glassCard: { padding: 30, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden', alignItems: 'center' },
  profileBtn: { marginBottom: 20 },
  avatarImg: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#ef4444' },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ef4444' },
  title: { color: '#fff', fontSize: 32, fontWeight: 'bold', letterSpacing: 1 },
  subtitle: { color: '#888', fontSize: 14, marginTop: 8, marginBottom: 30 },
  authForm: { width: '100%', gap: 15 },
  mainForm: { width: '100%', gap: 15 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, color: '#fff', fontSize: 16 },
  button: { width: '100%', borderRadius: 15, overflow: 'hidden', marginTop: 10 },
  buttonGradient: { paddingVertical: 18, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  toggleAuth: { marginTop: 10, alignItems: 'center' },
  toggleText: { color: '#aaa', fontSize: 14 },
  recentSection: { width: '100%', marginTop: 20 },
  recentTitle: { color: '#aaa', fontSize: 10, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase' },
  tokenContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tokenBadge: { backgroundColor: 'rgba(255, 255, 255, 0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  tokenText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  logoutBtn: { marginTop: 20, alignItems: 'center' },
  logoutText: { color: '#ef4444', fontSize: 12, opacity: 0.7 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 30, gap: 8 },
  footerText: { color: '#666', fontSize: 11 },
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { padding: 40, borderTopLeftRadius: 30, borderTopRightRadius: 30, alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  modalAvatar: { marginBottom: 20 },
  modalAvatarImg: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#ef4444' },
  modalAvatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#444' },
  editBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: '#ef4444', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalInput: { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, padding: 18, color: '#fff', fontSize: 18, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }
});
