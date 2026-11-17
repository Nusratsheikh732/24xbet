import { useState, useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { NotificationProvider } from '@/context/NotificationContext';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import DepositModal from '@/components/DepositModal';
import WithdrawModal from '@/components/WithdrawModal';
import SplashScreen from '@/components/SplashScreen';
import AuthPage from '@/pages/AuthPage';
import HomePage from '@/pages/HomePage';
import ProfilePage from '@/pages/ProfilePage';
import ReferPage from '@/pages/ReferPage';
import AdminPage from '@/pages/AdminPage';
import AviatorPage from '@/pages/AviatorPage';
import SuperAcePage from '@/pages/SuperAcePage';
import SlotsPage from '@/pages/SlotsPage';
import SuperElementsPage from '@/pages/SuperElementsPage';
import FlyXPage from '@/pages/FlyXPage';
import LudoGame from './LudoGame.jsx';
import PromotionPage from '@/pages/PromotionPage';
import PromotionBannersPage from '@/pages/PromotionBannersPage';
import MissionPage from '@/pages/MissionPage';
import SignInPage from '@/pages/SignInPage';
import BonusPage from '@/pages/BonusPage';
import RescueFundPage from '@/pages/RescueFundPage';
import StandaloneGamePage from '@/pages/StandaloneGamePage';
import CoinTossLoader from '@/components/CoinTossLoader';
import AirdropPage from '@/pages/AirdropPage';
import TradingApp from '@/TradingDemo';
import SpinWheelGame from '@/SpinWheelGame';
import PredictionMarketPage from '@/pages/PredictionMarketPage';
import WildBountyPage from '@/pages/WildBountyPage';
import WildFrontierGame from '@/components/WildFrontierGame';
import SupportWidget from '@/components/SupportWidget';
import GameModal from '@/components/GameModal';
import { casinoGames } from '@/data/games';
import type { Game, Page, Prediction } from '@/types';
import { loadPredictions, savePredictions, addTransaction, loadTransactions } from '@/lib/localStorage';
import { useModalActive } from '@/hooks/useModalState';
import { db, ref, push, set, onValue, runTransaction } from '@/lib/firebase';

function AppContent() {
  const { user, loading, deductBalance, addBalance, updateBalance } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [activePage, setActivePage] = useState<Page>('home');
  const hadUserRef = useRef(Boolean(user));
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>(loadPredictions);
  const sportsModalOpen = useModalActive();
  const settledIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      hadUserRef.current = true;
      setShowAuth(false);
    } else if (hadUserRef.current) {
      setShowAuth(true);
      setActivePage('home');
    }
  }, [user]);

  // Unified back-button interception for all non-home states: games, main
  // sections (profile, refer, admin), and modal overlays (deposit, withdraw).
  // A single history stub is pushed when entering any intercept-eligible
  // state. On popstate (back pressed), we redirect to the right place instead
  // of exiting the app. The stub is cleaned up when returning to home via
  // in-app navigation.
  const stateRef = useRef({ activePage, showDeposit, showWithdraw });
  stateRef.current = { activePage, showDeposit, showWithdraw };

  useEffect(() => {
    const handlePopState = () => {
      const { activePage: page, showDeposit: dep, showWithdraw: wd } = stateRef.current;
      if (dep) {
        setShowDeposit(false);
        window.history.pushState({ intercept: true }, '');
      } else if (wd) {
        setShowWithdraw(false);
        window.history.pushState({ intercept: true }, '');
      } else if (page !== 'home') {
        setActivePage('home');
      }
    };
    window.addEventListener('popstate', handlePopState);

    const backButtonPromise = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      backButtonPromise.then((handle) => handle.remove());
    };
  }, []);

  const needsIntercept = activePage !== 'home' || showDeposit || showWithdraw;
  const prevInterceptRef = useRef(false);

  useEffect(() => {
    if (needsIntercept && !prevInterceptRef.current) {
      window.history.pushState({ intercept: true }, '');
    } else if (!needsIntercept && prevInterceptRef.current) {
      const st = window.history.state as { intercept?: boolean } | null;
      if (st?.intercept) window.history.back();
    }
    prevInterceptRef.current = needsIntercept;
  }, [needsIntercept]);

  const handleBetPlaced = (amount: number) => {
    deductBalance(amount);
  };

  const handleWin = (amount: number) => {
    addBalance(amount);
    addTransaction({ id: `${Date.now()}-win`, type: 'win', amount, timestamp: Date.now() });
  };

  const handleDepositComplete = (amount: number) => {
    addTransaction({ id: `${Date.now()}-dep`, type: 'deposit', amount, timestamp: Date.now() });
  };

  const handleWithdraw = (amount: number) => {
    addTransaction({ id: `${Date.now()}-wd`, type: 'withdraw', amount, timestamp: Date.now() });
  };

  const handleAddPrediction = async (p: Prediction) => {
    setPredictions((prev) => {
      const updated = [...prev, p];
      savePredictions(updated);
      return updated;
    });

    if (user) {
      try {
        const predRef = push(ref(db, 'sports_predictions'));
        await set(predRef, {
          predictionId: p.id,
          userId: user.uid,
          matchId: p.matchId,
          selection: p.selection,
          amount: p.amount,
          odds: p.odds,
          team: p.team,
          status: 'pending',
          payout: 0,
          createdAt: Date.now(),
        });
      } catch {
        // RTDB write failed — prediction still saved locally
      }
    }
  };

  // Listen for settled predictions belonging to this user
  useEffect(() => {
    if (!user) return;

    const unsub = onValue(ref(db, 'sports_predictions'), (snap) => {
      if (!snap.exists()) return;
      const val = snap.val();
      Object.entries(val).forEach(([id, data]) => {
        const d = data as Record<string, unknown>;
        if (d.userId !== user.uid || d.status !== 'won') return;
        const payout = Number(d.payout) || 0;
        setPredictions((prev) => {
          const updated = prev.map((prediction) => {
            const matchesRecord = d.predictionId
              ? prediction.id === d.predictionId
              : prediction.matchId === d.matchId && prediction.amount === d.amount && prediction.team === d.team;
            return matchesRecord
              ? { ...prediction, status: 'won' as const, payout }
              : prediction;
          });
          savePredictions(updated);
          return updated;
        });
        if (d.paidAt || settledIdsRef.current.has(id)) return;
        const alreadyPaid = loadTransactions().some((transaction) => transaction.id === `${id}-win`);
        runTransaction(ref(db, `sports_predictions/${id}`), (current) => {
          if (!current || current.status !== 'won' || current.paidAt) return current;
          return { ...current, paidAt: Date.now() };
        }).then((result) => {
          if (!result.committed) return;
          settledIdsRef.current.add(id);
          if (!alreadyPaid) {
            addBalance(payout);
            addTransaction({
              id: `${id}-win`,
              type: 'win',
              amount: payout,
              timestamp: Date.now(),
            });
          }
        }).catch(() => {});
      });
    });

    return () => unsub();
  }, [user, addBalance]);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const openProtectedPage = (page: Page) => {
    if (page === 'home') {
      setActivePage('home');
      return;
    }
    if (!user) {
      setShowAuth(true);
      return;
    }
    setActivePage(page);
  };

  if (showAuth) {
    return <AuthPage />;
  }

  const balance = user?.balance ?? 0;

  return (
    <div className={`min-h-screen max-w-md mx-auto relative pb-32 ${
      activePage === 'home' ? 'bg-[#072b26]' :
      activePage === 'profile' ? 'bg-[#f4f4f6]' :
      activePage === 'refer' ? 'bg-white' :
      activePage === 'reward' || activePage === 'promotion' ? 'bg-slate-100' :
      'bg-dark-bg'
    }`}>
      {activePage === 'home' && (
        <a
          href="https://appsgeyser.io/20222339/24xbet"
          target="_blank"
          rel="noreferrer"
          className="block w-full overflow-hidden bg-[#075b43]"
          aria-label="Download 24XBET app"
        >
          <img
            src="/assets/IMG_20261111_125338.jpg"
            alt="Download 24XBET app"
            className="block h-auto w-full object-cover"
          />
        </a>
      )}
      {activePage !== 'aviator' && activePage !== 'superace' && activePage !== 'roulette' && activePage !== 'slots' && activePage !== 'wildfrontier' && activePage !== 'superelements' && activePage !== 'flyx' && activePage !== 'promotion' && activePage !== 'reward' && activePage !== 'mission' && activePage !== 'signin' && activePage !== 'bonus' && activePage !== 'rescue' && activePage !== 'sevenup' && activePage !== 'crazytime' && activePage !== 'cointoss' && activePage !== 'airdrop' && activePage !== 'ludo' && activePage !== 'trading' && activePage !== 'spinwheel' && activePage !== 'predictionmarket' && activePage !== 'wildbounty' && (
        <Header
          balance={balance}
          onNavigate={openProtectedPage}
          onDeposit={() => {
            if (!user) { setShowAuth(true); return; }
            setShowDeposit(true);
          }}
          onAdminAccess={() => openProtectedPage('admin')}
        />
      )}

      <main>
        {activePage === 'home' && (
          <HomePage
            balance={balance}
            onBetPlaced={handleBetPlaced}
            onWin={handleWin}
            predictions={predictions}
            onAddPrediction={handleAddPrediction}
            isAuthenticated={Boolean(user)}
            onRequireAuth={() => setShowAuth(true)}
            onDeposit={() => {
              if (!user) { setShowAuth(true); return; }
              setShowDeposit(true);
            }}
            onWithdraw={() => {
              if (!user) { setShowAuth(true); return; }
              setShowWithdraw(true);
            }}
            onOpenAviator={() => openProtectedPage('aviator')}
            onOpenSuperAce={() => openProtectedPage('superace')}
            onOpenRoulette={() => {
              if (!user) { setShowAuth(true); return; }
              setSelectedGame(casinoGames[0]);
            }}
            onOpenLiveRoulette={() => openProtectedPage('roulette')}
            onOpenSlots={() => openProtectedPage('slots')}
            onOpenWildFrontier={() => openProtectedPage('wildfrontier')}
            onOpenSuperElements={() => openProtectedPage('superelements')}
            onOpenFlyX={() => openProtectedPage('flyx')}
            onOpenLudo={() => openProtectedPage('ludo')}
            onOpenTrading={() => openProtectedPage('trading')}
            onOpenSpinWheel={() => openProtectedPage('spinwheel')}
            onOpenPredictionMarket={() => openProtectedPage('predictionmarket')}
            onOpenWildBounty={() => openProtectedPage('wildbounty')}
            onOpenSevenUp={() => openProtectedPage('sevenup')}
            onOpenCrazyTime={() => openProtectedPage('crazytime')}
            onOpenCoinToss={() => openProtectedPage('cointoss')}
          />
        )}
        {activePage === 'profile' && (
          <ProfilePage
            balance={balance}
            onDeposit={() => setShowDeposit(true)}
            onWithdraw={() => setShowWithdraw(true)}
            predictions={predictions}
            onNavigate={openProtectedPage}
          />
        )}
        {activePage === 'mission' && <MissionPage balance={balance} onBack={() => setActivePage('profile')} />}
        {activePage === 'refer' && <ReferPage onBack={() => setActivePage('home')} />}
        {activePage === 'admin' && <AdminPage onBack={() => setActivePage('home')} />}
        {activePage === 'promotion' && <PromotionBannersPage onBack={() => setActivePage('home')} />}
        {activePage === 'reward' && (
          <PromotionPage
            onBack={() => setActivePage('home')}
            onOpenRefer={() => setActivePage('refer')}
            onOpenSignIn={() => setActivePage('signin')}
            onOpenBonus={() => setActivePage('bonus')}
            onOpenRescue={() => setActivePage('rescue')}
          />
        )}
        {activePage === 'signin' && <SignInPage onBack={() => setActivePage('reward')} />}
        {activePage === 'bonus' && (
          <BonusPage onBack={() => setActivePage('reward')} onDeposit={() => setShowDeposit(true)} />
        )}
        {activePage === 'rescue' && <RescueFundPage onBack={() => setActivePage('reward')} />}
        {activePage === 'airdrop' && (
          <AirdropPage
            onBack={() => setActivePage('reward')}
          />
        )}
        {activePage === 'aviator' && (
          <AviatorPage
            balance={balance}
            onBetPlaced={handleBetPlaced}
            onWin={handleWin}
            onBack={() => setActivePage('home')}
          />
        )}
        {activePage === 'superace' && (
          <SuperAcePage
            balance={balance}
            onBetPlaced={handleBetPlaced}
            onWin={handleWin}
            onBack={() => setActivePage('home')}
          />
        )}
        {activePage === 'roulette' && (
          <StandaloneGamePage title="24x Live Roulette" src="/24x-roulette/index.html" onBack={() => setActivePage('home')} />
        )}
        {activePage === 'slots' && (
          <SlotsPage
            balance={balance}
            onBetPlaced={handleBetPlaced}
            onWin={handleWin}
            onBack={() => setActivePage('home')}
          />
        )}
        {activePage === 'wildfrontier' && (
          <WildFrontierGame
            balance={balance}
            onBetPlaced={handleBetPlaced}
            onWin={handleWin}
            onBack={() => setActivePage('home')}
          />
        )}
        {activePage === 'superelements' && (
          <SuperElementsPage
            balance={balance}
            onBetPlaced={handleBetPlaced}
            onWin={handleWin}
            onBack={() => setActivePage('home')}
          />
        )}
        {activePage === 'flyx' && (
          <FlyXPage
            balance={balance}
            onBetPlaced={handleBetPlaced}
            onWin={handleWin}
            onBack={() => setActivePage('home')}
          />
        )}
        {activePage === 'ludo' && (
          <LudoGame
            onClose={() => setActivePage('home')}
            balance={balance}
            onBalanceChange={(v) => updateBalance(v)}
            user={user}
          />
        )}
        {activePage === 'trading' && (
          <TradingApp
            onClose={() => setActivePage('home')}
            mainBalance={balance}
            onMainBalanceChange={(v) => updateBalance(v)}
          />
        )}
        {activePage === 'spinwheel' && (
          <SpinWheelGame
            onClose={() => setActivePage('home')}
            balance={balance}
            onBalanceChange={(v) => updateBalance(v)}
          />
        )}
        {activePage === 'wildbounty' && <WildBountyPage onBack={() => setActivePage('home')} />}
        {activePage === 'sevenup' && (
          <StandaloneGamePage title="7 Up 7 Down" src="/seven-up-seven-down/index.html" onBack={() => setActivePage('home')} />
        )}
        {activePage === 'crazytime' && (
          <StandaloneGamePage title="Crazy Time" src="/crazy-time/index.html" onBack={() => setActivePage('home')} />
        )}
        {activePage === 'cointoss' && (
          <>
            <StandaloneGamePage title="Coin Toss" src="/coin-toss-game.html" onBack={() => setActivePage('home')} />
            <CoinTossLoader />
          </>
        )}
        {activePage === 'predictionmarket' && (
          <PredictionMarketPage
            balance={balance}
            onBetPlaced={handleBetPlaced}
            onWin={handleWin}
            onBack={() => setActivePage('home')}
          />
        )}
      </main>

      {activePage === 'home' && (
        <div className="w-full overflow-hidden bg-[#0b3f37]">
          <img
            src="/1794408178824.jpg"
            alt="24XBET license and game providers"
            className="block h-auto w-full"
          />
        </div>
      )}

      {activePage !== 'aviator' && activePage !== 'superace' && activePage !== 'roulette' && activePage !== 'slots' && activePage !== 'wildfrontier' && activePage !== 'superelements' && activePage !== 'flyx' && activePage !== 'airdrop' && activePage !== 'signin' && activePage !== 'bonus' && activePage !== 'rescue' && activePage !== 'sevenup' && activePage !== 'crazytime' && activePage !== 'cointoss' && activePage !== 'ludo' && activePage !== 'trading' && activePage !== 'predictionmarket' && activePage !== 'spinwheel' && activePage !== 'wildbounty' && activePage !== 'reward' && <BottomNav activePage={activePage} onNavigate={openProtectedPage} />}

      {activePage === 'home' && !sportsModalOpen && <SupportWidget />}

      {selectedGame && (
        <GameModal
          game={selectedGame}
          balance={balance}
          onClose={() => setSelectedGame(null)}
          onBetPlaced={handleBetPlaced}
          onWin={handleWin}
        />
      )}

      <DepositModal
        isOpen={showDeposit}
        onClose={() => setShowDeposit(false)}
        onDepositComplete={handleDepositComplete}
      />
      <WithdrawModal
        isOpen={showWithdraw}
        balance={balance}
        onClose={() => setShowWithdraw(false)}
        onWithdraw={handleWithdraw}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
