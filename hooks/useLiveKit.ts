import { useEffect, useState, useMemo } from 'react';
import { 
  Room, 
  RoomEvent, 
  VideoPresets,
  ConnectionState
} from 'livekit-client';
const { E2EEManager, ExternalE2EEKeyProvider } = require('livekit-client') as any;
import { deriveKey } from '../utils/encryption';

const SIGNAL_SERVER_URL = 'http://localhost:3000'; // Change to your server URL

export function useLiveKit(roomName: string, identity: string, passwordString: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const e2eeManager = useMemo(() => {
    const keyProvider = new ExternalE2EEKeyProvider();
    return new E2EEManager({ keyProvider });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function connect() {
      try {
        const key = await deriveKey(passwordString);
        await (e2eeManager.keyProvider as any).setKey(key);

        const response = await fetch(`${SIGNAL_SERVER_URL}/getToken?room=${roomName}&identity=${identity}`);
        const { token } = await response.json();

        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: VideoPresets.h720.resolution,
          },
          e2ee: {
              keyProvider: e2eeManager.keyProvider,
          } as any
        });

        newRoom.on(RoomEvent.ParticipantConnected, () => {
          setParticipants([...newRoom.remoteParticipants.values()]);
        });
        
        newRoom.on(RoomEvent.ParticipantDisconnected, () => {
          setParticipants([...newRoom.remoteParticipants.values()]);
        });

        await newRoom.connect('ws://localhost:7800', token); // Change to your LiveKit URL
        
        if (isMounted) {
          setRoom(newRoom);
          setParticipants([...newRoom.remoteParticipants.values()]);
        }
      } catch (e: any) {
        console.error('Failed to connect to LiveKit:', e);
        setError(e.message);
      }
    }

    connect();

    return () => {
      isMounted = false;
      room?.disconnect();
    };
  }, [roomName, identity, passwordString]);

  const toggleMicrophone = async (enabled: boolean) => {
    await room?.localParticipant.setMicrophoneEnabled(enabled);
  };

  const toggleCamera = async (enabled: boolean) => {
    await room?.localParticipant.setCameraEnabled(enabled);
  };

  return { room, participants, error, toggleMicrophone, toggleCamera };
}
