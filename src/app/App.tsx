import { useState, useEffect, useRef, Component, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { HomeScreen } from './components/HomeScreen';
import { ModeSelectionModal } from './components/ModeSelectionModal';
import { RoomCodeScreen } from './components/RoomCodeScreen';
import { GameScreen } from './components/GameScreen';
import { EndScreen } from './components/EndScreen';

type Screen = 'home' | 'roomCode' | 'game' | 'end';

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
  const [gameMode, setGameMode] = useState<'local' | 'online'>('local');
  const [turnTime, setTurnTime] = useState(30);
  const [gridSize, setGridSize] = useState(7);
  const [showModeModal, setShowModeModal] = useState(false);
  const [winner, setWinner] = useState(0);
  const [finalScores, setFinalScores] = useState<[number, number]>([0, 0]);
  const [finalNames, setFinalNames] = useState<[string, string]>(['Player 1', 'Player 2']);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerNumber, setPlayerNumber] = useState<1 | 2 | null>(null);
  const [isRoomMatched, setIsRoomMatched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [playerLeft, setPlayerLeft] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [hasConfig, setHasConfig] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<{ turnTime: number; gridSize: number } | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    if (!socket) return;

    const handleWaiting = ({ roomId: waitingRoomId, playerNumber: waitingPlayerNumber }: { roomId: string; playerNumber: number }) => {
      setRoomId(waitingRoomId);
      setPlayerNumber(waitingPlayerNumber === 1 ? 1 : 2);
      setIsRoomMatched(false);
      setSearchStatus('Waiting for another player...');
      if (pendingConfig) {
        socket.emit('game:config', { roomId: waitingRoomId, ...pendingConfig });
        setHasConfig(true);
      }
    };

    const handleMatched = ({ roomId: matchedRoomId, players }: { roomId: string; players: Array<{ id: string; playerNumber: number }> }) => {
      const mySocketId = socket.id;
      const me = players.find((player) => player.id === mySocketId);
      const assigned = me?.playerNumber === 2 ? 2 : 1;
      setRoomId(matchedRoomId);
      setPlayerNumber(assigned);
      setIsRoomMatched(true);
      setIsSearching(false);
      setSearchStatus('');
      setPlayerLeft(false);
      setGameMode('online');
      if (matchedRoomId.startsWith('code-') && !hasConfig) {
        setSearchStatus('Waiting for host to choose settings...');
      } else {
        setScreen('game');
      }
    };

    const handleOpponentLeft = () => {
      setPlayerLeft(true);
      setRoomId(null);
      setPlayerNumber(null);
      setIsSearching(false);
      setSearchStatus('');
    };

    const handlePlayAgain = () => {
      setScreen('game');
    };

    const handleConfig = ({ turnTime: configTurnTime, gridSize: configGridSize }: { turnTime: number; gridSize: number }) => {
      setTurnTime(configTurnTime);
      setGridSize(configGridSize);
      setHasConfig(true);
      setSearchStatus('');
      if (roomId?.startsWith('code-') && !isRoomMatched) {
        return;
      }
      setScreen('game');
    };

    const handleRoomError = ({ message }: { message: string }) => {
      setRoomError(message);
    };

    socket.on('quickplay:waiting', handleWaiting);
    socket.on('quickplay:matched', handleMatched);
    socket.on('room:waiting', handleWaiting);
    socket.on('room:matched', handleMatched);
    socket.on('room:error', handleRoomError);
    socket.on('game:config', handleConfig);
    socket.on('game:opponentLeft', handleOpponentLeft);
    socket.on('game:playAgain', handlePlayAgain);

    return () => {
      socket.off('quickplay:waiting', handleWaiting);
      socket.off('quickplay:matched', handleMatched);
      socket.off('room:waiting', handleWaiting);
      socket.off('room:matched', handleMatched);
      socket.off('room:error', handleRoomError);
      socket.off('game:config', handleConfig);
      socket.off('game:opponentLeft', handleOpponentLeft);
      socket.off('game:playAgain', handlePlayAgain);
    };
  }, [socket, pendingConfig, hasConfig]);

  // Clean up on unmount, screen change, or tab close
  useEffect(() => {
    const handleUnload = () => {
      if (socketRef.current && roomId) {
        socketRef.current.emit('game:leave');
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [screen, roomId]);
  const handleSameDevice = () => {
    setGameMode('local');
    setHasConfig(true);
    setPendingConfig(null);
    setShowModeModal(true);
  };

  const handleQuickPlay = () => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    if (!socketRef.current) {
      socketRef.current = io(socketUrl, { transports: ['websocket'] });
      setSocket(socketRef.current);
    }
    setGameMode('online');
    setTurnTime(30);
    setGridSize(5);
    setHasConfig(true);
    setPendingConfig(null);
    setIsSearching(true);
    setSearchStatus('Searching for a player...');
    setIsRoomMatched(false);
    socketRef.current.emit('quickplay:join', { name: 'Player' });
  };

  const handlePlayOnline = () => {
    setGameMode('online');
    setHasConfig(false);
    setPendingConfig(null);
    setIsRoomMatched(false);
    setScreen('roomCode');
  };

  const handleCreateRoom = (code: string) => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    if (!socketRef.current) {
      socketRef.current = io(socketUrl, { transports: ['websocket'] });
      setSocket(socketRef.current);
    }
    setPendingRoomCode(code);
    setHasConfig(false);
    setPendingConfig(null);
    setIsRoomMatched(false);
    setRoomError(null);
    socketRef.current.emit('room:create', { code, name: 'Player' });
    setShowModeModal(true);
  };

  const handleJoinRoom = (code: string) => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    if (!socketRef.current) {
      socketRef.current = io(socketUrl, { transports: ['websocket'] });
      setSocket(socketRef.current);
    }
    setHasConfig(false);
    setPendingConfig(null);
    setIsRoomMatched(false);
    setRoomError(null);
    socketRef.current.emit('room:join', { code, name: 'Player' });
  };

  const handleSelectMode = (seconds: number, selectedGridSize: number) => {
    setTurnTime(seconds);
    setGridSize(selectedGridSize);
    setShowModeModal(false);

    if (gameMode === 'online' && roomId) {
      const configPayload = { turnTime: seconds, gridSize: selectedGridSize };
      socketRef.current?.emit('game:config', { roomId, ...configPayload });
      setHasConfig(true);
      setPendingConfig(null);
      if (!roomId.startsWith('code-') || isRoomMatched) {
        setScreen('game');
      }
    } else if (gameMode === 'online') {
      setPendingConfig({ turnTime: seconds, gridSize: selectedGridSize });
    } else {
      setScreen('game');
    }
  };

  const handleGameEnd = (winnerPlayer: number, scores: [number, number], names: [string, string]) => {
    setWinner(winnerPlayer);
    setFinalScores(scores);
    setFinalNames(names);
    setScreen('end');
  };

  const handlePlayAgain = () => {
    if (gameMode === 'online' && socketRef.current && roomId) {
      socketRef.current.emit('game:playAgain', { roomId });
    }
    setScreen('game');
  };

  const handleBackToHome = () => {
    if (isSearching && socketRef.current) {
      socketRef.current.emit('quickplay:cancel');
    }
    if (screen === 'roomCode' && socketRef.current) {
      socketRef.current.emit('room:cancel');
    }
    if (gameMode === 'online' && socketRef.current) {
      socketRef.current.emit('game:leave');
    }
    setIsSearching(false);
    setSearchStatus('');
    setRoomId(null);
    setPlayerNumber(null);
    setPlayerLeft(false);
    setPendingRoomCode(null);
    setRoomError(null);
    setHasConfig(false);
    setPendingConfig(null);
    setIsRoomMatched(false);
    setScreen('home');
  };

  return (
    <div className="size-full">
      {roomError && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-6">
          <div className="bg-[var(--paper)] p-8 rounded-2xl border-3 border-[var(--ink)] max-w-sm w-full text-center">
            <h3 className="text-2xl mb-4" style={{ color: 'var(--ink)' }}>Room Error</h3>
            <p className="mb-6 opacity-70" style={{ color: 'var(--ink)' }}>{roomError}</p>
            <button 
              onClick={() => setRoomError(null)}
              className="w-full py-3 bg-[var(--ink)] text-[var(--paper)] rounded-xl transition-all active:scale-95 shadow-lg"
            >
              Okay
            </button>
          </div>
        </div>
      )}
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
                if (socketRef.current) {
                  socketRef.current.emit('quickplay:cancel');
                }
                setIsSearching(false);
                setSearchStatus('');
              }}
              className="w-full py-3 border-2 border-[var(--ink)] rounded-xl transition-all active:scale-95"
              style={{ color: 'var(--ink)' }}
            >
              Cancel
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
          activeRoomCode={pendingRoomCode}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          gridSize={gridSize}
          mode={gameMode}
          turnTime={turnTime}
          onBack={handleBackToHome}
          onGameEnd={handleGameEnd}
          socket={socket}
          roomId={roomId}
          playerNumber={playerNumber}
        />
      )}

      {screen === 'end' && (
        <EndScreen
          winner={winner}
          scores={finalScores}
          names={finalNames}
          onPlayAgain={handlePlayAgain}
          onBackToHome={handleBackToHome}
        />
      )}

      {showModeModal && (
        <ModeSelectionModal
          onClose={() => {
            setShowModeModal(false);
          }}
          onSelectMode={handleSelectMode}
        />
      )}
    </div>
  );
}