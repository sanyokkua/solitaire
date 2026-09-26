import { useState } from 'react';
import { useAppSelector } from './app/hooks';
import { selectRoute } from './app/appSlice';
import { HomeScreen } from './ui/screens/HomeScreen';
import { GameScreen } from './ui/screens/GameScreen';
import { DealtEpochContext, createDealtEpochStore } from './ui/board/DealtEpochContext';
import { BuildStamp } from './ui/components/BuildStamp';
import './ui/styles/global.css';

export function App() {
    const route = useAppSelector(selectRoute);
    const [dealtEpoch] = useState(() => createDealtEpochStore());

    return (
        <DealtEpochContext.Provider value={dealtEpoch}>
            {route === 'home' ? <HomeScreen /> : <GameScreen />}
            {route !== 'game' && <BuildStamp />}
        </DealtEpochContext.Provider>
    );
}
