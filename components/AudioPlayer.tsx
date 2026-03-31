import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

interface AudioPlayerProps {
  uri: string;
  duration?: number;
}

export default function AudioPlayer({ uri, duration }: AudioPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setTotalDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        sound?.setPositionAsync(0);
      }
    }
  };

  const playPause = async () => {
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } else {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      setSound(newSound);
    }
  };

  const getProgress = () => {
    if (totalDuration === 0) return 0;
    return (position / totalDuration) * 100;
  };

  const formatTime = (millis: number) => {
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={playPause} style={styles.playButton}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
      </TouchableOpacity>
      <View style={styles.waveformContainer}>
        <View style={styles.progressBar}>
           <View style={[styles.progressIndicator, { width: `${getProgress()}%` }]} />
        </View>
        <Text style={styles.timeText}>{formatTime(position)} / {formatTime(totalDuration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    minWidth: 180,
  },
  playButton: {
    marginRight: 10,
  },
  waveformContainer: {
    flex: 1,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressIndicator: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  timeText: {
    color: '#fff',
    fontSize: 10,
  }
});
