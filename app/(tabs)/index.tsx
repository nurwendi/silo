import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SIGNAL_SERVER_URL = 'http://localhost:3000';

export default function HomeScreen() {
  const [room, setRoom] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentTokens, setRecentTokens] = useState<string[]>([]);

  useEffect(() => {
    loadRecentTokens();
  }, []);

  const loadRecentTokens = async () => {
    try {
      const saved = await AsyncStorage.getItem('recent_tokens');
      if (saved) setRecentTokens(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load tokens');
    }
  };

  const saveToken = async (token: string) => {
    const updated = [token, ...recentTokens.filter(t => t !== token)].slice(0, 5);
    setRecentTokens(updated);
    await AsyncStorage.setItem('recent_tokens', JSON.stringify(updated));
  };

  const resolveToken = async (token: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${SIGNAL_SERVER_URL}/resolveToken/${token.toLowerCase()}`);
      if (response.ok) {
        const data = await response.json();
        setRoom(data.roomId);
        setPassword(data.password);
        saveToken(token.toUpperCase());
        setLoading(false);
        return data;
      } else {
        setLoading(false);
        Alert.alert('Invalid Token', 'This Silo Token is not registered or has expired.');
        return null;
      }
    } catch (e) {
      setLoading(false);
      Alert.alert('Error', 'Connection to signaling server failed.');
      return null;
    }
  };

  const handleJoin = async () => {
    let finalRoom = room;
    let finalPass = password;

    if (room.length === 5 && !password) {
        const data = await resolveToken(room);
        if (data) {
            finalRoom = data.roomId;
            finalPass = data.password;
        } else return;
    }

    if (finalRoom && username && finalPass) {
      router.push({
        pathname: '/room',
        params: { room: finalRoom, username, password: finalPass }
      });
    } else {
        Alert.alert('Missing Info', 'Please provide Username and either a Token or Room/Password combination.');
    }
  };

  return (
    <LinearGradient colors={['#0b141a', '#2e0101']} style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <BlurView intensity={40} tint="dark" style={styles.glassCard}>
            <View style={styles.iconContainer}>
               <LinearGradient colors={['#ef4444', '#004a87']} style={styles.iconGradient}>
                  <Ionicons name="shield-checkmark" size={60} color="#fff" />
               </LinearGradient>
            </View>
            
            <Text style={styles.title}>Silo Secure</Text>
            <Text style={styles.subtitle}>Privacy-First E2EE Communication</Text>

            <View style={styles.inputGroup}>
               <View style={styles.inputWrapper}>
                  <Ionicons name="key" size={20} color="#ef4444" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Silo Token or Room Name"
                    placeholderTextColor="#888"
                    value={room}
                    onChangeText={setRoom}
                    autoCapitalize="none"
                  />
               </View>

               <View style={styles.inputWrapper}>
                  <Ionicons name="person" size={20} color="#ef4444" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Your Alias"
                    placeholderTextColor="#888"
                    value={username}
                    onChangeText={setUsername}
                  />
               </View>

               <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed" size={20} color="#ef4444" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Room Key (Optional for Token)"
                    placeholderTextColor="#888"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
               </View>
            </View>

            <TouchableOpacity 
                style={styles.button} 
                onPress={handleJoin}
                disabled={loading}
            >
              <LinearGradient 
                colors={['#ef4444', '#991b1b']} 
                start={{x:0, y:0}} 
                end={{x:1, y:0}} 
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>{loading ? 'Connecting...' : 'Secure Connect'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {recentTokens.length > 0 && (
                <View style={styles.recentSection}>
                    <Text style={styles.recentTitle}>Recent Tokens</Text>
                    <View style={styles.tokenContainer}>
                        {recentTokens.map(t => (
                            <TouchableOpacity 
                                key={t} 
                                style={styles.tokenBadge} 
                                onPress={() => { setRoom(t); setPassword(''); }}
                            >
                                <Text style={styles.tokenText}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            <View style={styles.footer}>
              <Ionicons name="shield-half" size={16} color="#ef4444" />
              <Text style={styles.footerText}>Zero-Knowledge: Keys stay on your device.</Text>
            </View>
          </BlurView>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  glassCard: {
    padding: 30,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    alignItems: 'center',
  },
  iconContainer: {
     marginBottom: 20,
  },
  iconGradient: {
     width: 100,
     height: 100,
     borderRadius: 50,
     justifyContent: 'center',
     alignItems: 'center',
     shadowColor: '#ef4444',
     shadowOffset: { width: 0, height: 10 },
     shadowOpacity: 0.3,
     shadowRadius: 20,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 30,
  },
  inputGroup: {
    width: '100%',
    gap: 15,
    marginBottom: 30,
  },
  inputWrapper: {
     flexDirection: 'row',
     alignItems: 'center',
     backgroundColor: 'rgba(255, 255, 255, 0.05)',
     borderRadius: 15,
     borderWidth: 1,
     borderColor: 'rgba(255, 255, 255, 0.1)',
     paddingHorizontal: 15,
  },
  inputIcon: {
     marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    width: '100%',
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recentSection: {
      width: '100%',
      marginTop: 30,
  },
  recentTitle: {
      color: '#aaa',
      fontSize: 12,
      fontWeight: 'bold',
      marginBottom: 10,
      textTransform: 'uppercase',
  },
  tokenContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
  },
  tokenBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tokenText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    gap: 8,
  },
  footerText: {
    color: '#666',
    fontSize: 12,
  },
});
