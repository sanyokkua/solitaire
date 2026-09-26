import { useAppSelector } from './app/hooks';
import { selectRoute } from './app/appSlice';
import { HomeScreen } from './ui/screens/HomeScreen';
import { GameScreen } from './ui/screens/GameScreen';
import { BuildStamp } from './ui/components/BuildStamp';
import './ui/styles/global.css';

export function App() {
    const route = useAppSelector(selectRoute);

    return (
        <>
            {route === 'home' ? <HomeScreen /> : <GameScreen />}
            {route !== 'game' && <BuildStamp />}
        </>
    );
}
