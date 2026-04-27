import { useEffect } from 'react';
import WorldMap from './components/WorldMap';
import CountryInfoPanel from './components/CountryInfoPanel';
import Header from './components/Header';
import StartScreen from './components/StartScreen';
import TimeControls from './components/TimeControls';
import PlayerHUD from './components/PlayerHUD';
import SendTroopsModal from './components/SendTroopsModal';
import BattleLog from './components/BattleLog';
import EndScreen from './components/EndScreen';
import { useGameStore } from './store/gameStore';

export default function App() {
  const loadInitialWorld = useGameStore((s) => s.loadInitialWorld);
  const error = useGameStore((s) => s.error);

  useEffect(() => {
    loadInitialWorld();
  }, [loadInitialWorld]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <WorldMap />
      <Header />
      <PlayerHUD />
      <CountryInfoPanel />
      <TimeControls />
      <BattleLog />
      <SendTroopsModal />
      <StartScreen />
      <EndScreen />
      {error && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2"
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--accent-blood)',
            color: 'var(--accent-blood)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
