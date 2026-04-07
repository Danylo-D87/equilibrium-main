/**
 * /cot/screener — Main screener page.
 * Shows all markets in a single list; metrics use each asset's
 * primary report type (resolved server-side via screener-v2).
 */

import { useCallback, Suspense, lazy } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCotStore } from '../store/useCotStore';
import { QUICK_ACCESS_MARKETS } from '../utils/pinnedMarkets';
import ScreenerTable from '../components/ScreenerTable';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

const DocumentationModal = lazy(() => import('../components/DocumentationModal'));

export default function ScreenerPage() {
    const { docsOpen, setDocsOpen } = useCotStore();
    const navigate = useNavigate();

    const handleSelectMarket = useCallback(
        (code: string) => {
            navigate(`/cot/dashboard/${code}`);
        },
        [navigate],
    );

    return (
        <>
            <header className="flex-shrink-0 h-12 flex items-center px-3 sm:px-5 gap-0 app-topnav relative z-30">
                {/* EQ Logo */}
                <Link to="/" className="flex items-center gap-2 flex-shrink-0 select-none group mr-3">
                    <div
                        className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                    >
                        <span className="text-[10px] font-bold tracking-tight text-white/80 group-hover:text-white transition-colors duration-200">
                            EQ
                        </span>
                    </div>
                </Link>

                <div className="w-px h-4 bg-white/[0.06] flex-shrink-0 mr-3" />

                <nav className="flex items-center gap-1 flex-shrink-0 mr-3">
                    <span className="px-3 py-1 text-[11px] font-medium tracking-[0.1em] uppercase text-black bg-white rounded-full">
                        Screener
                    </span>
                </nav>

                <div className="w-px h-4 bg-white/[0.06] flex-shrink-0 mr-3" />

                {/* Quick-access pills */}
                <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 scrollbar-none pr-3">
                    {QUICK_ACCESS_MARKETS.map(m => (
                        <button
                            key={m.code}
                            onClick={() => handleSelectMarket(m.code)}
                            className="flex-shrink-0 px-2.5 py-1 text-[10px] font-semibold tracking-[0.06em] uppercase rounded-full transition-all duration-200 text-white/30 hover:text-white/70 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08]"
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                {/* Docs button */}
                <button
                    onClick={() => setDocsOpen(!docsOpen)}
                    className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-300"
                    title="Documentation"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        <path d="M9 7h6" /><path d="M9 11h6" /><path d="M9 15h4" />
                    </svg>
                </button>
            </header>

            {/* Documentation modal */}
            <Suspense fallback={null}>
                {docsOpen && <DocumentationModal isOpen={docsOpen} onClose={() => setDocsOpen(false)} />}
            </Suspense>

            <main className="flex-1 overflow-hidden relative">
                <ErrorBoundary>
                    <ScreenerTable onSelectMarket={handleSelectMarket} />
                </ErrorBoundary>
            </main>
        </>
    );
}
