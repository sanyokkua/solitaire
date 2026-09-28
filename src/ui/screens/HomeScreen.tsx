import { HomeActions } from './home/HomeActions';
import { HomeHero } from './home/HomeHero';
import { HomeLinks } from './home/HomeLinks';
import { HomeTopbar } from './home/HomeTopbar';
import { ModeTiles } from './home/ModeTiles';
import { RecordStrip } from './home/RecordStrip';
import { WinnableToggle } from './home/WinnableToggle';

export function HomeScreen() {
    return (
        <div className="screen screen--home">
            <HomeTopbar />
            <main className="home-body">
                <HomeHero />
                <ModeTiles />
                <WinnableToggle />
                <HomeActions />
                <RecordStrip />
                <HomeLinks />
            </main>
        </div>
    );
}
