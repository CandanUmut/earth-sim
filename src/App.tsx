import { useEffect, useRef } from 'react';
import WorldMap from './components/WorldMap';
import CountryInfoPanel from './components/CountryInfoPanel';
import Header from './components/Header';
import StartScreen from './components/StartScreen';
import TimeControls from './components/TimeControls';
import PlayerHUD from './components/PlayerHUD';
import SendTroopsModal from './components/SendTroopsModal';
import BattleHub from './components/BattleHub';
import BattleLog from './components/BattleLog';
import WarRoom from './components/WarRoom';
import EventToast from './components/EventToast';
import EndScreen from './components/EndScreen';
import Tutorial from './components/Tutorial';
import TechTreePanel from './components/TechTreePanel';
import DeclareWarModal from './components/DeclareWarModal';
import PeaceModal from './components/PeaceModal';
import PendingDecisionToast from './components/PendingDecisionToast';
import CinematicCard from './components/CinematicCard';
import WorldNewsBanner from './components/WorldNewsBanner';
import { useGameStore } from './store/gameStore';
import {
  setMusicMode,
  playBattleLoop,
  stopBattleLoop,
  play as playSound,
} from './sound/sound';

export default function App() {
  const loadInitialWorld = useGameStore((s) => s.loadInitialWorld);
  const error = useGameStore((s) => s.error);

  useEffect(() => {
    loadInitialWorld();
  }, [loadInitialWorld]);

  // Wire ambient music + battle loop + event warning chime to store changes.
  // The main reason this is in App and not the store is that AudioContext
  // playback must be triggered after a user gesture; we kick it off after a
  // first non-empty state change (game started) anyway.
  const lastWarStateRef = useRef<boolean>(false);
  const lastBattleCountRef = useRef<number>(0);
  const lastEventIdRef = useRef<string | null>(null);
  const lastGameStartedRef = useRef<boolean>(false);

  useEffect(() => {
    const apply = (state: ReturnType<typeof useGameStore.getState>) => {
      // Music: menu → peace → war crossfades.
      if (!state.gameStarted) {
        if (lastGameStartedRef.current) {
          // Returning to start screen.
          void setMusicMode('menu');
        }
      } else {
        const player = state.playerCountryId
          ? state.nations[state.playerCountryId]
          : null;
        const atWar = player
          ? Object.values(player.stance).some((s) => s === 'war')
          : false;
        if (atWar !== lastWarStateRef.current || !lastGameStartedRef.current) {
          void setMusicMode(atWar ? 'war' : 'peace');
          lastWarStateRef.current = atWar;
        }
      }
      lastGameStartedRef.current = state.gameStarted;

      // Battle loop: only while there's at least one active battle.
      const battleCount = Object.keys(state.activeBattles).length;
      if (battleCount > 0 && lastBattleCountRef.current === 0) {
        void playBattleLoop();
      } else if (battleCount === 0 && lastBattleCountRef.current > 0) {
        stopBattleLoop();
      }
      lastBattleCountRef.current = battleCount;

      // New world events → warning ping.
      const newest = state.unreadEvents[state.unreadEvents.length - 1];
      if (newest && newest.id !== lastEventIdRef.current) {
        lastEventIdRef.current = newest.id;
        playSound('event_warning');
      }
    };
    apply(useGameStore.getState());
    return useGameStore.subscribe(apply);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <WorldMap />
      <Header />
      <PlayerHUD />
      <CountryInfoPanel />
      <TimeControls />
      <BattleLog />
      <WarRoom />
      <EventToast />
      <SendTroopsModal />
      <BattleHub />
      <TechTreePanel />
      <DeclareWarModal />
      <PeaceModal />
      <PendingDecisionToast />
      <CinematicCard />
      <WorldNewsBanner />
      <StartScreen />
      <Tutorial />
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
