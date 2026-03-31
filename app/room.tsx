import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ScrollView, Image, Animated, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { useLiveKit } from '../hooks/useLiveKit';
import { encryptChatMessage, decryptChatMessage, deriveKey } from '../utils/encryption';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import AudioPlayer from '../components/AudioPlayer';
import { VideoView, TrackReference, useTracks } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const SIGNAL_SERVER_URL = 'http://localhost:3000';

type Message = {
  id: string;
  type: 'text' | 'image' | 'voice' | 'file';
  content: string;
  fileName?: string;
  sender: string;
  timestamp: number;
  isSelf: boolean;
  status?: 'sent' | 'delivered';
  expiresAt?: number;
};

export default function RoomScreen() {
  const { room: roomName, username, password } = useLocalSearchParams<{ room: string; username: string; password: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [encryptionKey, setEncryptionKey] = useState<Uint8Array | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [disappearingTime, setDisappearingTime] = useState<number>(0); 
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [showChat, setShowChat] = useState(true);

  const socketRef = useRef<Socket | null>(null);

  const { room, participants, error } = useLiveKit(roomName!, username!, password!);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => prev.filter(m => !m.expiresAt || m.expiresAt > now));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function initEncryption() {
      const key = await deriveKey(password!);
      setEncryptionKey(key);
    }
    initEncryption();

    socketRef.current = io(SIGNAL_SERVER_URL);
    socketRef.current.emit('join-room', roomName);

    socketRef.current.on('receive-message', async (data) => {
      if (encryptionKey) {
        const decrypted = await decryptChatMessage(data.message, encryptionKey);
        
        let content = decrypted;
        if (data.type === 'voice' || data.type === 'file') {
           const dir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
           const fileName = data.fileName || `${data.id}.m4a`;
           const tempUri = `${dir}${fileName}`;
           await FileSystem.writeAsStringAsync(tempUri, decrypted, { encoding: 'base64' });
           content = tempUri;
        }

        const newMessage: Message = { 
          id: data.id,
          type: data.type || 'text', 
          content: content, 
          fileName: data.fileName,
          sender: data.sender, 
          timestamp: data.timestamp, 
          isSelf: false,
          expiresAt: data.expiresAt
        };

        setMessages((prev) => [...prev, newMessage]);
        socketRef.current?.emit('msg-ack', { roomId: roomName, msgId: data.id, from: username });
      }
    });

    socketRef.current.on('msg-delivered', (data) => {
      setMessages((prev) => 
        prev.map(m => m.id === data.msgId ? { ...m, status: 'delivered' } : m)
      );
    });

    socketRef.current.on('room-lock-status', (data) => {
      setIsRoomLocked(data.locked);
    });

    socketRef.current.on('room-error', (err) => {
      Alert.alert('Security Alert', err);
      router.back();
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [roomName, password, encryptionKey]);

  const sendData = async (content: string, type: Message['type'] = 'text', fileName?: string) => {
    if (encryptionKey && socketRef.current) {
      const msgId = Math.random().toString(36).substring(7);
      const isBlob = type === 'voice' || type === 'file';
      const rawContent = isBlob ? await FileSystem.readAsStringAsync(content, { encoding: 'base64' }) : content;
      const encrypted = await encryptChatMessage(rawContent, encryptionKey);
      
      const expiresAt = disappearingTime > 0 ? Date.now() + disappearingTime : undefined;

      socketRef.current.emit('send-message', {
        id: msgId,
        roomId: roomName,
        message: encrypted,
        type,
        fileName,
        sender: username,
        expiresAt
      });

      const newMessage: Message = { 
        id: msgId,
        type, 
        content, 
        fileName,
        sender: username!, 
        timestamp: Date.now(), 
        isSelf: true,
        status: 'sent',
        expiresAt
      };
      setMessages((prev) => [...prev, newMessage]);
    }
  };

  const sendMessage = () => {
    if (inputText.trim()) {
      sendData(inputText, 'text');
      setInputText('');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      sendData(result.assets[0].base64, 'image');
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      sendData(result.assets[0].uri, 'file', result.assets[0].name);
    }
  };

  const openFile = async (uri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
  };

  const toggleMic = async () => {
    if (room) {
      const enabled = !isMicEnabled;
      await room.localParticipant.setMicrophoneEnabled(enabled);
      setIsMicEnabled(enabled);
    }
  };

  const toggleCam = async () => {
    if (room) {
      const enabled = !isCamEnabled;
      await room.localParticipant.setCameraEnabled(enabled);
      setIsCamEnabled(enabled);
    }
  };

  const toggleRoomLock = () => {
    const newStatus = !isRoomLocked;
    socketRef.current?.emit('lock-room', { roomId: roomName, locked: newStatus });
    setIsRoomLocked(newStatus);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (e) {
      console.error('Failed to start recording', e);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (uri) {
      sendData(uri, 'voice');
    }
    setRecording(null);
  };

  const cycleDisappearing = () => {
    const times = [0, 60000, 3600000, 86400000]; 
    const nextIndex = (times.indexOf(disappearingTime) + 1) % times.length;
    setDisappearingTime(times[nextIndex]);
  };

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#0b141a', '#2e0101']} style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <BlurView intensity={40} tint="dark" style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
            <Text style={styles.roomName}>{roomName}</Text>
            <TouchableOpacity onPress={cycleDisappearing} style={styles.encryptionBadge}>
                <Ionicons name="time" size={12} color={disappearingTime > 0 ? '#ef4444' : '#888'} />
                <Text style={[styles.encryptionText, disappearingTime > 0 && { color: '#ef4444' }]}>
                {disappearingTime === 0 ? 'Persistent' : disappearingTime === 60000 ? '1 Min' : disappearingTime === 3600000 ? '1 Hour' : '24 Hours'}
                </Text>
            </TouchableOpacity>
            </View>
            <View style={styles.headerActions}>
            <TouchableOpacity onPress={toggleRoomLock} style={styles.actionIcon}>
                <Ionicons name={isRoomLocked ? 'lock-closed' : 'lock-open'} size={24} color={isRoomLocked ? '#ef4444' : '#fff'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowChat(!showChat)} style={styles.actionIcon}>
                <Ionicons name={showChat ? 'videocam' : 'chatbubbles'} size={24} color="#fff" />
            </TouchableOpacity>
            </View>
        </BlurView>

        <View style={[styles.mediaContainer, !showChat && { flex: 1 }]}>
            {room ? (
                <ParticipantVideoGrid room={room} />
            ) : (
                <View style={styles.loadingMedia}>
                <Text style={styles.loadingText}>Initializing E2EE Media...</Text>
                </View>
            )}
            
            <View style={styles.mediaFooter}>
                <TouchableOpacity onPress={toggleMic} style={[styles.mediaButton, !isMicEnabled && styles.mediaButtonOff]}>
                    <Ionicons name={isMicEnabled ? 'mic' : 'mic-off'} size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleCam} style={[styles.mediaButton, !isCamEnabled && styles.mediaButtonOff]}>
                    <Ionicons name={isCamEnabled ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>

        {showChat && (
            <>
            <FlatList
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                <View style={[styles.messageBubble, item.isSelf ? styles.selfMessage : styles.otherMessage]}>
                    {!item.isSelf && <Text style={styles.messageSender}>{item.sender}</Text>}
                    {item.type === 'text' && <Text style={styles.messageText}>{item.content}</Text>}
                    {item.type === 'image' && (
                    <Image source={{ uri: `data:image/jpeg;base64,${item.content}` }} style={styles.messageImage} />
                    )}
                    {item.type === 'voice' && <AudioPlayer uri={item.content} />}
                    {item.type === 'file' && (
                    <TouchableOpacity onPress={() => openFile(item.content)} style={styles.fileContainer}>
                        <Ionicons name="document" size={24} color="#fff" />
                        <Text style={styles.fileNameText} numberOfLines={1}>{item.fileName}</Text>
                    </TouchableOpacity>
                    )}
                    <View style={styles.messageFooter}>
                    <Text style={styles.messageTime}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {item.isSelf && (
                        <Ionicons 
                        name={item.status === 'delivered' ? 'checkmark-done' : 'checkmark'} 
                        size={14} 
                        color={item.status === 'delivered' ? '#ef4444' : '#888'} 
                        style={styles.tick}
                        />
                    )}
                    {item.expiresAt && <Ionicons name="time-outline" size={12} color="#aaa" style={{ marginLeft: 4 }} />}
                    </View>
                </View>
                )}
                contentContainerStyle={styles.chatList}
            />

            <BlurView intensity={30} tint="dark" style={styles.inputArea}>
                <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
                <Ionicons name="image" size={24} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={pickDocument}>
                <Ionicons name="attach" size={26} color="#ef4444" />
                </TouchableOpacity>
                
                {isRecording ? (
                <View style={styles.recordingIndicator}>
                    <View style={styles.dot} />
                    <Text style={styles.recordingText}>Recording...</Text>
                </View>
                ) : (
                <TextInput
                    style={styles.chatInput}
                    placeholder="E2EE Message"
                    placeholderTextColor="#888"
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                />
                )}

                {inputText.length > 0 ? (
                <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                    <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
                ) : (
                <TouchableOpacity 
                    style={[styles.sendButton, isRecording && styles.recordingButton]} 
                    onPressIn={startRecording}
                    onPressOut={stopRecording}
                >
                    <Ionicons name="mic" size={20} color="#fff" />
                </TouchableOpacity>
                )}
            </BlurView>
            </>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function ParticipantVideoGrid({ room }: { room: any }) {
    const tracks = useTracks(
      [
        { source: Track.Source.Camera, withPlaceholder: true },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
      ],
      { room }
    );

    return (
        <ScrollView contentContainerStyle={styles.videoGrid}>
            {tracks.map((track) => (
                <View key={track.participant.sid} style={styles.videoWrapper}>
                    <VideoView {...({ trackRef: track } as any)} style={styles.videoView as any} />
                    <View style={styles.participantOverlay}>
                        <Text style={styles.participantName}>{track.participant.identity}</Text>
                    </View>
                </View>
            ))}
            {tracks.length === 0 && (
                <View style={styles.noVideo}>
                    <Ionicons name="person" size={48} color="#888" />
                    <Text style={styles.noVideoText}>Waiting for video tracks...</Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b141a',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  roomName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  encryptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  encryptionText: {
    color: '#888',
    fontSize: 11,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 20,
  },
  actionIcon: {
    padding: 2,
  },
  mediaContainer: {
    height: 250,
    backgroundColor: 'rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  loadingMedia: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontStyle: 'italic',
  },
  videoGrid: {
     flexDirection: 'row',
     flexWrap: 'wrap',
     padding: 4,
  },
  videoWrapper: {
     width: '50%',
     height: 180,
     padding: 2,
  },
  videoView: {
     flex: 1,
     backgroundColor: '#1f2c34',
     borderRadius: 15,
     borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.1)',
  },
  participantOverlay: {
     position: 'absolute',
     bottom: 10,
     left: 10,
     backgroundColor: 'rgba(0,0,0,0.5)',
     paddingHorizontal: 8,
     paddingVertical: 2,
     borderRadius: 4,
  },
  participantName: {
     color: '#fff',
     fontSize: 10,
  },
  noVideo: {
     width: '100%',
     height: 180,
     justifyContent: 'center',
     alignItems: 'center',
  },
  noVideoText: {
     color: '#888',
     marginTop: 10,
  },
  mediaFooter: {
      position: 'absolute',
      bottom: 10,
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
  },
  mediaButton: {
      backgroundColor: 'rgba(0,0,0,0.6)',
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
  },
  mediaButtonOff: {
      backgroundColor: '#ef4444',
  },
  chatList: {
    padding: 16,
    paddingBottom: 30,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  selfMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#004a87', 
    borderBottomRightRadius: 2,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#9b1b1b', 
    borderBottomLeftRadius: 2,
  },
  messageSender: {
    color: '#fff', 
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    opacity: 0.8,
  },
  messageText: {
    color: '#e9edef',
    fontSize: 16,
    lineHeight: 22,
  },
  messageImage: {
    width: 240,
    height: 180,
    borderRadius: 15,
    marginBottom: 4,
  },
  fileContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     padding: 12,
     backgroundColor: 'rgba(255,255,255,0.05)',
     borderRadius: 15,
     gap: 10,
     borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.1)',
  },
  fileNameText: {
     color: '#fff',
     fontSize: 14,
     flex: 1,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  messageTime: {
    color: 'rgba(233, 237, 239, 0.6)',
    fontSize: 11,
  },
  tick: {
    marginLeft: 6,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  actionButton: {
    padding: 10,
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    maxHeight: 120,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginRight: 10,
  },
  recordingText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
  },
  sendButton: {
    backgroundColor: '#ef4444',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  recordingButton: {
    backgroundColor: '#ef4444',
    transform: [{ scale: 1.15 }],
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#ef4444',
    borderRadius: 10,
  },
  backText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
