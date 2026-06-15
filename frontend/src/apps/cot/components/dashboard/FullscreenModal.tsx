/**
 * FullscreenModal — portal overlay for viewing charts at full viewport size.
 * Close on Escape key or backdrop click.
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { domToBlob } from 'modern-screenshot';

interface FullscreenModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
}

export default function FullscreenModal({ isOpen, onClose, title, subtitle, children }: FullscreenModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);

    const handleScreenshot = async () => {
        if (!modalRef.current) return;
        try {
            const blob = await domToBlob(modalRef.current, {
                scale: 2,
                backgroundColor: '#0a0a0a',
                style: {
                    backgroundColor: '#0a0a0a',
                }
            });
            if (blob) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error('Failed to capture screenshot', err);
        }
    };
    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;
        document.addEventListener('keydown', handleEscape);
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleEscape]);

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={modalRef}
            className="fixed inset-0 z-[100] flex flex-col"
            style={{ background: '#0a0a0a' }}
        >
            {/* Header bar */}
            <div className="flex-shrink-0 h-12 flex items-center justify-between px-5 border-b border-white/[0.06]">
                <div>
                    {title && (
                        <h2 className="text-[13px] font-medium text-white/80 tracking-wide">
                            {title}
                        </h2>
                    )}
                    {subtitle && (
                        <p className="text-[10px] text-white/25 mt-0.5">{subtitle}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleScreenshot}
                        className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${copied ? 'text-emerald-400 bg-emerald-400/10' : 'text-white/30 hover:text-white/70 hover:bg-white/[0.06]'}`}
                        title="Copy screenshot to clipboard"
                    >
                        {copied ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                <circle cx="12" cy="13" r="4" />
                            </svg>
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all duration-300"
                        title="Close (Esc)"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Chart body — full remaining space */}
            <div className="flex-1 min-h-0 p-4">
                {children}
            </div>
        </div>,
        document.body,
    );
}
