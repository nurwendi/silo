import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const [room, setRoom] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const onJoin = () => {
    if (room && username && password) {
      // Navigate to the room with params
      router.push({
        pathname: '/room',
        params: { room, username, password }
      });
    } else {
      alert('Please fill all fields');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ThemedView style={styles.inner}>
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={64} color="#075E54" />
          <ThemedText type="title" style={styles.title}>Silo Secure</ThemedText>
          <ThemedText style={styles.subtitle}>End-to-End Encrypted Communication</ThemedText>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Room Name (e.g. MyGroup)"
            placeholderTextColor="#888"
            value={room}
            onChangeText={setRoom}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Your Username"
            placeholderTextColor="#888"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Encryption Key (Password)"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.button} onPress={onJoin}>
            <Text style={styles.buttonText}>Join Securely</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Ionicons name="lock-closed" size={16} color="#888" />
          <Text style={styles.footerText}>Nothing is stored on our servers</Text>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: '#075E54',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
    gap: 8,
  },
  footerText: {
    color: '#888',
    fontSize: 14,
  },
});
