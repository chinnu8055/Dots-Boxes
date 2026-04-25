import { useState, useEffect, useRef, Component, type ReactNode } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { RoomCodeScreen } from './components/RoomCodeScreen';
import { ModeSelectionModal } from './components/ModeSelectionModal';
import { GameScreen } from './components/GameScreen';
import { EndScreen } from './components/EndScreen';
import Peer, { type DataConnection } from 'peerjs';

type Screen = 'home' | 'roomCode' | 'game' | 'end';
type GameMode = 'quick' | 'online' | 'local';

const APP_PREFIX = 'db-v1'; // Shorter prefix
const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.voipbuster.com' },
    { urls: 'stun:stun.voipstunt.com' },
    { urls: 'stun:stun.voxgratia.org' },
  ],
  reliable: true,
  debug: 1
};

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('App Crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[var(--paper)]">
          <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--ink)' }}>Something went wrong</h1>
          <p className="mb-6 opacity-70" style={{ color: 'var(--ink)' }}>The game encountered an unexpected error.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[var(--ink)] text-[var(--paper)] rounded-xl"
          >
            Reload Game
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <GameApp />
    </ErrorBoundary>
  );
}

function GameApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [isDark, setIsDark] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('quick');
  const [turnTime, setTurnTime] = useState(30);
  const [showModeModal, setShowModeModal] = useState(false);
  const [winner, setWinner] = useState(0);
  const [finalScores, setFinalScores] = useState<[number, number]>([0, 0]);
  const [finalNames, setFinalNames] = useState<[string, string]>(['Player 1', 'Player 2']);
  
  // Networking state
  const [peer, setPeer] = useState<Peer | null>(null);
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const [isHost, setIsHost] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [playerLeft, setPlayerLeft] = useState(false);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);
  const [searchTimeLeft, setSearchTimeLeft] = useState(60);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Clean up connection on unmount or screen change
  useEffect(() => {
    if (screen === 'home') {
      console.log('Cleaning up peer and connection...');
      connectionRef.current?.close();
      peerRef.current?.destroy();
      setConnection(null);
      setPeer(null);
      connectionRef.current = null;
      peerRef.current = null;
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    };
  }, [screen]);

  const initPeer = (id?: string) => {
    try {
      console.log('Initializing Peer with ID:', id || 'random');
      // Destroy existing peer if it exists
      peerRef.current?.destroy();
      
      const newPeer = new Peer(id, PEER_CONFIG);
      peerRef.current = newPeer;
      setPeer(newPeer);

      newPeer.on('connection', (conn) => {
      console.log('Peer received connection');
      setConnection(conn);
      connectionRef.current = conn;
      setIsHost(true);
      setScreen('game');
      setPlayerLeft(false);

      conn.on('close', () => {
        console.log('Connection closed by peer');
        setPlayerLeft(true);
      });
    });

      newPeer.on('error', (err) => {
        console.error('Peer error:', err.type, err.message);
        if (err.type === 'unavailable-id') {
          setSearchError('Room code is already in use or unavailable.');
        } else if (err.type === 'peer-unavailable') {
          // This is expected during matchmaking, handled in tryConnect
        } else {
          setSearchError(`Connection error: ${err.type}. Please try again.`);
        }
        setIsSearching(false);
      });

      newPeer.on('open', (myId) => {
        console.log('Peer opened with ID:', myId);
      });

      return newPeer;
    } catch (e) {
      console.error('Failed to init Peer:', e);
      setSearchError('Could not initialize networking. Please check your connection.');
      return null;
    }
  };

  const handleQuickPlay = async () => {
    console.log('Starting Quick Play (Robust Sequential)...');
    setGameMode('quick');
    setTurnTime(30);
    setIsSearching(true);
    setSearchStatus('Starting search...');
    setSearchTimeLeft(60);
    setSearchError(null);
    connectionRef.current = null;

    // Symmetry breaking: random delay to prevent two devices from 
    // trying to host/join the exact same slot at the exact same millisecond
    const jitter = Math.random() * 1500;
    await new Promise(r => setTimeout(r, jitter));

    const trySlot = (index: number) => {
      if (!isSearching && screen !== 'home') return; // Stop if cancelled
      
      if (index > 5) { // Try up to 5 slots
        const fallbackId = `${APP_PREFIX}-q-${Math.floor(Math.random() * 1000)}`;
        setSearchStatus('Lobbies busy, hosting new...');
        startHostingSlot(fallbackId, index, true);
        return;
      }

      const lobbyId = `${APP_PREFIX}-lobby-${index}`;
      setSearchStatus(`Searching Lobby ${index}...`);
      
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }

      // Step 1: Create a generic peer to check if the lobby exists
      const p = new Peer(PEER_CONFIG);
      peerRef.current = p;
      setPeer(p);

      p.on('open', () => {
        console.log(`Checking slot ${index}...`);
        const conn = p.connect(lobbyId, { reliable: true });
        
        let hasTimedOut = false;
        const joinTimeout = setTimeout(() => {
          hasTimedOut = true;
          console.log(`Slot ${index} empty, becoming host...`);
          conn.close();
          p.destroy();
          startHostingSlot(lobbyId, index);
        }, 3500);

        conn.on('open', () => {
          if (hasTimedOut) return;
          clearTimeout(joinTimeout);
          console.log(`Connected to Lobby ${index}`);
          setSearchStatus('Found opponent! Handshaking...');
          finalizeConnection(conn, false);
        });

        conn.on('error', (err) => {
          if (hasTimedOut) return;
          clearTimeout(joinTimeout);
          console.log(`Lobby ${index} unavailable (${err.type}), hosting...`);
          p.destroy();
          startHostingSlot(lobbyId, index);
        });
      });

      p.on('error', (err) => {
        console.error('Peer creation error:', err);
        if (isSearching) setTimeout(() => trySlot(index + 1), 1000);
      });
    };

    const startHostingSlot = (lobbyId: string, index: number, isFallback = false) => {
      if (peerRef.current) peerRef.current.destroy();
      
      const p = new Peer(lobbyId, PEER_CONFIG);
      peerRef.current = p;
      setPeer(p);

      p.on('open', (id) => {
        console.log(`Hosting Lobby ${index} (${id})`);
        setSearchStatus(`Waiting in Lobby ${index}...`);
        setupHostListeners(p);
      });

      p.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          console.log(`Lobby ${index} just got taken, joining it instead...`);
          p.destroy();
          // Someone else just claimed it, try to join them
          setTimeout(() => tryJoin(lobbyId, index), 500);
        } else {
          console.error(`Host error on ${index}:`, err.type);
          p.destroy();
          if (!isFallback) trySlot(index + 1);
        }
      });
    };

    const tryJoin = (lobbyId: string, index: number) => {
      if (peerRef.current) peerRef.current.destroy();
      const p = new Peer(PEER_CONFIG);
      peerRef.current = p;
      setPeer(p);

      p.on('open', () => {
        setSearchStatus(`Joining Lobby ${index}...`);
        const conn = p.connect(lobbyId, { reliable: true });
        
        const t = setTimeout(() => {
          conn.close();
          p.destroy();
          trySlot(index + 1);
        }, 5000);

        conn.on('open', () => {
          clearTimeout(t);
          finalizeConnection(conn, false);
        });
        
        conn.on('error', () => {
          clearTimeout(t);
          p.destroy();
          trySlot(index + 1);
        });
      });
    };

    const startHosting = (id: string) => {
      const p = new Peer(id, PEER_CONFIG);
      peerRef.current = p;
      setPeer(p);
      p.on('open', () => setupHostListeners(p));
      p.on('error', () => {
        setSearchError('Networking error. Please try again.');
        setIsSearching(false);
      });
    };

    const setupHostListeners = (p: Peer) => {
      p.on('connection', (conn) => {
        console.log('Matchmaking: Guest joined our lobby! Waiting for data channel to open...');
        setSearchStatus('Connecting to guest...');
        
        // Host MUST wait for the 'open' event before sending any data or switching screens
        conn.on('open', () => {
          console.log('Matchmaking: Host data channel opened');
          finalizeConnection(conn, true);
        });

        conn.on('error', (err) => {
          console.error('Matchmaking: Host connection error:', err);
          setIsSearching(false);
          setSearchError('Failed to establish connection with player.');
        });
      });
    };

    const finalizeConnection = (conn: DataConnection, hostStatus: boolean) => {
      console.log('Finalizing connection, hostStatus:', hostStatus);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
      
      setConnection(conn);
      connectionRef.current = conn;
      setIsHost(hostStatus);
      setScreen('game');
      setIsSearching(false);
      setSearchStatus('');
      setSearchError(null);
      setPlayerLeft(false);

      conn.on('close', () => {
        console.log('Connection closed');
        setPlayerLeft(true);
      });

      // Heartbeat to keep connection alive, especially on mobile
      const heartbeat = setInterval(() => {
        if (conn.open) {
          conn.send({ type: 'heartbeat' });
        } else {
          clearInterval(heartbeat);
        }
      }, 5000);

      // Add a small delay for state to propagate
      setTimeout(() => {
        if (hostStatus) {
          console.log('Host sending initial sync...');
          conn.send({ type: 'handshake', from: 'host' });
        }
      }, 500);
    };

    // Start search from slot 1
    trySlot(1);

    // Global Timeout logic
    searchTimeoutRef.current = setTimeout(() => {
      if (!connectionRef.current) {
        setIsSearching(false);
        setSearchError('No players available at the moment. Please try again!');
        peerRef.current?.destroy();
        setPeer(null);
      }
    }, 60000);

    searchIntervalRef.current = setInterval(() => {
      setSearchTimeLeft(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
  };

  const handlePlayOnline = () => {
    setGameMode('online');
    setIsHost(true);
    setScreen('roomCode');
  };

  const handleSameDevice = () => {
    setGameMode('local');
    setIsHost(true);
    setShowModeModal(true);
  };

  const handleSelectMode = (seconds: number) => {
    setTurnTime(seconds);
    setShowModeModal(false);

    if (gameMode === 'online' && pendingRoomCode) {
      initPeer(`${APP_PREFIX}-room-${pendingRoomCode}`);
      // The RoomCodeScreen will transition itself based on the modal closing
    } else if (gameMode === 'local') {
      setScreen('game');
    }
  };

  const handleCreateRoom = (code: string) => {
    setPendingRoomCode(code);
    setShowModeModal(true);
  };

  const handleJoinRoom = (code: string) => {
    setIsHost(false);
    setGameMode('online');
    const p = initPeer();
    if (!p) return;
    
    p.on('open', () => {
      const conn = p.connect(`${APP_PREFIX}-room-${code}`, { reliable: true });
      conn.on('open', () => {
        setConnection(conn);
        connectionRef.current = conn;
        // Turn time will be synced from the host via names packet or a new config packet
        setScreen('game');
        setPlayerLeft(false);

        conn.on('close', () => {
          console.log('Connection closed by host');
          setPlayerLeft(true);
        });
      });
      conn.on('error', (err) => {
        console.error('Connection error:', err);
        setSearchError('Failed to join the room. Please check the code.');
      });
    });
  };

  const handleGameEnd = (winnerPlayer: number, scores: [number, number], names: [string, string]) => {
    setWinner(winnerPlayer);
    setFinalScores(scores);
    setFinalNames(names);
    setScreen('end');
  };

  const handlePlayAgain = () => {
    setScreen('game');
  };

  const handleBackToHome = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    peerRef.current?.destroy();
    setPeer(null);
    setConnection(null);
    connectionRef.current = null;
    peerRef.current = null;
    setIsSearching(false);
    setSearchError(null);
    setPlayerLeft(false);
    setScreen('home');
  };

  return (
    <div className="size-full">
      {playerLeft && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-6">
          <div className="bg-[var(--paper)] p-8 rounded-2xl border-3 border-[var(--ink)] max-w-sm w-full text-center">
            <h3 className="text-2xl mb-4" style={{ color: 'var(--ink)' }}>Opponent Left</h3>
            <p className="mb-6 opacity-70" style={{ color: 'var(--ink)' }}>The other player has disconnected from the game.</p>
            <button 
              onClick={() => {
                setPlayerLeft(false);
                handleBackToHome();
              }}
              className="w-full py-3 bg-[var(--ink)] text-[var(--paper)] rounded-xl transition-all active:scale-95 shadow-lg"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {isSearching && screen === 'home' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-[var(--paper)] p-8 rounded-2xl border-3 border-[var(--ink)] max-w-sm w-full text-center">
            <h3 className="text-2xl mb-2" style={{ color: 'var(--ink)' }}>Finding Player...</h3>
            <p className="text-sm mb-4 opacity-70 italic" style={{ color: 'var(--ink)' }}>{searchStatus}</p>
            <div className="text-4xl font-bold mb-6" style={{ color: 'var(--ink)' }}>
              {Math.floor(searchTimeLeft / 60)}:{(searchTimeLeft % 60).toString().padStart(2, '0')}
            </div>
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2].map(i => (
                <div 
                  key={i}
                  className="w-3 h-3 rounded-full animate-bounce"
                  style={{ backgroundColor: 'var(--ink)', animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
            <button 
              onClick={() => {
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
                setIsSearching(false);
                peer?.destroy();
                setPeer(null);
              }}
              className="w-full py-3 border-2 border-[var(--ink)] rounded-xl transition-all active:scale-95"
              style={{ color: 'var(--ink)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {searchError && screen === 'home' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-[var(--paper)] p-8 rounded-2xl border-3 border-[var(--ink)] max-w-sm w-full text-center">
            <h3 className="text-2xl mb-4" style={{ color: 'var(--ink)' }}>No Players Found</h3>
            <p className="mb-6 opacity-70" style={{ color: 'var(--ink)' }}>{searchError}</p>
            <button 
              onClick={() => setSearchError(null)}
              className="w-full py-3 bg-[var(--ink)] text-[var(--paper)] rounded-xl transition-all active:scale-95 shadow-lg"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {screen === 'home' && (
        <HomeScreen
          onQuickPlay={handleQuickPlay}
          onPlayOnline={handlePlayOnline}
          onSameDevice={handleSameDevice}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
        />
      )}

      {screen === 'roomCode' && (
        <RoomCodeScreen
          onBack={handleBackToHome}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          isWaiting={!!(connection || (gameMode === 'online' && !showModeModal && pendingRoomCode === null && peer))}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          gridSize={5}
          mode={gameMode}
          turnTime={turnTime}
          onBack={handleBackToHome}
          onGameEnd={handleGameEnd}
          connection={connection}
          isHost={isHost}
        />
      )}

      {screen === 'end' && (
        <EndScreen
          winner={winner}
          scores={finalScores}
          names={finalNames}
          onPlayAgain={handlePlayAgain}
          onBackToHome={handleBackToHome}
          isHost={isHost}
          mode={gameMode}
        />
      )}

      {showModeModal && (
        <ModeSelectionModal
          onClose={() => {
            setShowModeModal(false);
            setPendingRoomCode(null);
          }}
          onSelectMode={handleSelectMode}
        />
      )}
    </div>
  );
}