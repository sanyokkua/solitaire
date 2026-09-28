import { useState } from 'react';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { applyUpdate } from './app/pwaThunks';
import { selectRoute, selectSheet } from './app/selectors';
import { HomeScreen } from './ui/screens/HomeScreen';
import { GameScreen } from './ui/screens/GameScreen';
import { DealtEpochContext, createDealtEpochStore } from './ui/board/DealtEpochContext';
import { Announcer } from './ui/components/Announcer';
import { BuildStamp } from './ui/components/BuildStamp';
import { Notices } from './ui/components/Notices';
import { SheetHost } from './ui/sheets/SheetHost';
import './ui/styles/global.css';

export function App() {
    const dispatch = useAppDispatch();
    const route = useAppSelector(selectRoute);
    const sheet = useAppSelector(selectSheet);
    const [dealtEpoch] = useState(() => createDealtEpochStore());

    return (
        <DealtEpochContext.Provider value={dealtEpoch}>
            {/* While a sheet is open the screen behind it is inert (D2, SH "Background inert"): none of its
                controls or cards can be focused, activated or reached by assistive technology. Notices and the
                Announcer are mounted as siblings, outside this subtree, so they keep working. */}
            <div className="app-screen" inert={sheet !== null}>
                {route === 'home' ? <HomeScreen /> : <GameScreen />}
                {route !== 'game' && <BuildStamp />}
            </div>
            <SheetHost />
            <Notices
                onUpdate={() => {
                    void dispatch(applyUpdate());
                }}
            />
            <Announcer />
        </DealtEpochContext.Provider>
    );
}
