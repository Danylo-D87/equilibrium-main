import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* Admin Bookmark Tab — rendered via portal */
function AdminBookmark() {
    return createPortal(
        <Link
            to="/admin"
            title="Admin Panel"
            className="group fixed left-0 bottom-20 z-[9999] opacity-50 hover:opacity-100 transition-opacity duration-400"
        >
            <div
                className="relative flex items-center justify-center bg-[#111111] border-r border-t border-b border-white/[0.10] group-hover:border-white/[0.25] transition-all duration-300 rounded-r-lg"
                style={{ width: '24px', height: '72px' }}
            >
                <span
                    className="text-[7px] font-medium tracking-[0.2em] text-white/40 group-hover:text-white/80 uppercase transition-colors duration-300 select-none"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                    ADMIN
                </span>
            </div>
        </Link>,
        document.body,
    );
}

/* Tool-card definitions */
interface ToolCard {
    key: string;
    title: string;
    subtitle: string;
    tags: string[];
    status: 'AVAILABLE' | 'COMING SOON';
    to?: string;
    icon: React.ReactNode;
    accentColor: string;
}

const TOOLS: ToolCard[] = [
    {
        key: 'cot',
        title: 'COT Analyzer',
        subtitle: 'Institutional positioning signals from CFTC Commitments of Traders reports.',
        tags: ['Screener', 'Dashboard', 'Signals'],
        status: 'AVAILABLE',
        to: '/cot',
        accentColor: 'rgba(139,92,246,0.15)',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M7 16l4-8 4 4 4-6" />
            </svg>
        ),
    },
    {
        key: 'journal',
        title: 'Analytical Space',
        subtitle: 'Track, analyze, and optimize your trading performance with advanced metrics.',
        tags: ['Journal', 'Stats', 'P&L'],
        status: 'AVAILABLE',
        to: '/journal',
        accentColor: 'rgba(20,184,166,0.12)',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20V10" />
                <path d="M18 20V4" />
                <path d="M6 20v-4" />
            </svg>
        ),
    },
    {
        key: 'library',
        title: 'Research Library',
        subtitle: 'Curated repository of market studies, methodologies, and reference data.',
        tags: ['Studies', 'Methods', 'Data'],
        status: 'COMING SOON',
        accentColor: 'rgba(71,85,105,0.10)',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
        ),
    },
];

/* Landing Page */
export default function Landing() {
    const { isAuthenticated, logout, isAdmin } = useAuth();
    const [showLogoutPopover, setShowLogoutPopover] = useState(false);
    const logoutRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showLogoutPopover) return;
        function handler(e: MouseEvent) {
            if (logoutRef.current && !logoutRef.current.contains(e.target as Node)) {
                setShowLogoutPopover(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showLogoutPopover]);

    return (
        <>
            {isAdmin() && <AdminBookmark />}

            {/* Static background */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                {/* Grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage: `
                            linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
                        `,
                        backgroundSize: '60px 60px',
                    }}
                />
                {/* Gradient blob top-right */}
                <div
                    className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.06]"
                    style={{
                        background: 'radial-gradient(circle, #8b5cf6 0%, #3b82f6 50%, transparent 70%)',
                        filter: 'blur(80px)',
                    }}
                />
                {/* Gradient blob bottom-left */}
                <div
                    className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.04]"
                    style={{
                        background: 'radial-gradient(circle, #14b8a6 0%, transparent 70%)',
                        filter: 'blur(80px)',
                    }}
                />
            </div>

            <div className="relative z-10 min-h-screen flex flex-col">

                {/* Navigation */}
                <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(5,5,5,0.80)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="px-6 md:px-10 h-14 flex items-center justify-between">
                        {/* Logo */}
                        <Link to="/" className="group flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                                <span className="text-[13px] font-bold tracking-tight text-white/90 group-hover:text-white transition-colors duration-200" style={{ fontFamily: "'Inter', sans-serif" }}>
                                    EQ
                                </span>
                            </div>
                            <span className="hidden sm:block text-[11px] font-medium tracking-[0.18em] text-white/25 group-hover:text-white/40 uppercase transition-colors duration-300">
                                Equilibrium
                            </span>
                        </Link>

                        {/* Right nav */}
                        <div className="flex items-center gap-3">
                            {isAuthenticated ? (
                                <div ref={logoutRef} className="relative">
                                    <button
                                        onClick={() => setShowLogoutPopover(v => !v)}
                                        className="px-4 py-1.5 text-[11px] font-medium tracking-[0.08em] text-white/30 hover:text-white/60 uppercase transition-colors duration-300 rounded-full"
                                        style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                                    >
                                        Log Out
                                    </button>

                                    {showLogoutPopover && (
                                        <div
                                            className="absolute right-0 top-[calc(100%+8px)] w-[168px] rounded-2xl z-50 overflow-hidden"
                                            style={{
                                                background: '#111111',
                                                border: '1px solid rgba(255,255,255,0.07)',
                                                animation: 'popoverIn 0.2s cubic-bezier(0.16,1,0.3,1) both',
                                            }}
                                        >
                                            <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <p className="text-[10px] font-medium tracking-[0.15em] text-white/40 uppercase text-center">Confirm</p>
                                            </div>
                                            <div className="p-2 flex flex-col gap-1">
                                                <button
                                                    onClick={() => { logout(); setShowLogoutPopover(false); }}
                                                    className="w-full py-2.5 text-[10px] font-medium tracking-[0.15em] uppercase text-red-400/60 hover:text-red-400 hover:bg-white/[0.03] transition-all duration-300 rounded-xl"
                                                >
                                                    Log Out
                                                </button>
                                                <button
                                                    onClick={() => setShowLogoutPopover(false)}
                                                    className="w-full py-2.5 text-[10px] font-medium tracking-[0.15em] uppercase text-white/30 hover:text-white/60 hover:bg-white/[0.03] transition-all duration-300 rounded-xl"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <Link
                                    to="/login"
                                    className="px-5 py-2 text-[11px] font-semibold tracking-[0.08em] rounded-full transition-all duration-300 uppercase"
                                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                                >
                                    Sign In
                                </Link>
                            )}
                        </div>
                    </div>
                </nav>

                {/* Hero */}
                <main className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 lg:px-20 pt-14 gap-16 lg:gap-24 min-h-screen">

                    {/* Left: Brand */}
                    <div className="flex-1 flex flex-col items-start justify-center max-w-lg">
                        {/* Logo mark large */}
                        <div
                            className="mb-8 w-14 h-14 rounded-xl flex items-center justify-center hero-headline"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                            <span className="text-2xl font-bold text-white/80" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em' }}>EQ</span>
                        </div>

                        <h1
                            className="hero-headline text-5xl lg:text-6xl font-semibold text-white/90 leading-tight"
                            style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em' }}
                        >
                            Analytical<br />
                            <span className="text-white/30">ecosystem</span>
                        </h1>

                        <p className="hero-sub mt-5 text-[13px] font-normal text-white/30 leading-relaxed max-w-[340px]">
                            Institutional data, positioning signals and trading analytics — in one place.
                        </p>

                        <div className="hero-sub mt-8 flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.6)' }} />
                            <span className="text-[11px] font-medium tracking-[0.12em] text-white/25 uppercase">Systems online</span>
                        </div>
                    </div>

                    {/* Right: Tool cards */}
                    <div className="flex-1 w-full max-w-[480px] flex flex-col gap-3">
                        <div className="mb-2 flex items-center gap-3">
                            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.07))' }} />
                            <span className="text-[10px] font-medium tracking-[0.25em] text-white/20 uppercase">Modules</span>
                            <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(255,255,255,0.07))' }} />
                        </div>

                        {TOOLS.map((tool, i) => {
                            const isAvailable = tool.status === 'AVAILABLE' && tool.to;
                            const Wrapper = isAvailable ? Link : 'div';
                            const wrapperProps = isAvailable ? { to: tool.to! } : {};

                            return (
                                <Wrapper
                                    key={tool.key}
                                    {...wrapperProps as any}
                                    className={`group relative overflow-hidden rounded-2xl transition-all duration-500 ${isAvailable ? 'cursor-pointer' : 'opacity-40 cursor-default'}`}
                                    style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.055)',
                                        animationDelay: `${0.1 + i * 0.1}s`,
                                    }}
                                >
                                    {/* Hover accent glow */}
                                    {isAvailable && (
                                        <div
                                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                            style={{ background: tool.accentColor }}
                                        />
                                    )}

                                    <div className="relative p-5 flex items-start gap-4">
                                        {/* Icon */}
                                        <div
                                            className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${isAvailable ? 'text-white/40 group-hover:text-white/80' : 'text-white/15'}`}
                                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                                        >
                                            {tool.icon}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <h3 className={`text-[13px] font-semibold tracking-tight transition-colors duration-300 ${isAvailable ? 'text-white/75 group-hover:text-white' : 'text-white/25'}`}
                                                    style={{ fontFamily: "'Inter', sans-serif" }}>
                                                    {tool.title}
                                                </h3>
                                                {tool.status === 'AVAILABLE' ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1 h-1 rounded-full bg-emerald-400/60 group-hover:bg-emerald-400 transition-colors duration-300" />
                                                        <span className="text-[9px] font-semibold tracking-[0.15em] text-emerald-400/50 group-hover:text-emerald-400/80 uppercase transition-colors duration-300">Live</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] font-medium tracking-[0.12em] uppercase text-white/15 px-2 py-0.5 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                                                        Soon
                                                    </span>
                                                )}
                                            </div>

                                            <p className={`text-[12px] leading-relaxed transition-colors duration-300 ${isAvailable ? 'text-white/30 group-hover:text-white/45' : 'text-white/15'}`}>
                                                {tool.subtitle}
                                            </p>

                                            {/* Tags */}
                                            <div className="flex items-center gap-1.5 mt-3">
                                                {tool.tags.map(tag => (
                                                    <span
                                                        key={tag}
                                                        className="text-[9px] font-medium tracking-[0.1em] uppercase px-2 py-0.5 rounded-full transition-all duration-300"
                                                        style={{
                                                            background: 'rgba(255,255,255,0.04)',
                                                            border: '1px solid rgba(255,255,255,0.05)',
                                                            color: 'rgba(255,255,255,0.25)',
                                                        }}
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                                {isAvailable && (
                                                    <span className="ml-auto text-[10px] text-white/15 group-hover:text-white/50 transition-colors duration-300 font-medium">
                                                        Open →
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Wrapper>
                            );
                        })}
                    </div>
                </main>
            </div>
        </>
    );
}
