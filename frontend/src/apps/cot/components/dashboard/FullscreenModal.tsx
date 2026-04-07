/**
 * FullscreenModal — portal overlay for viewing charts at full viewport size.
 * Close on Escape key or backdrop click.
 */

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface FullscreenModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
}

export default function FullscreenModal({ isOpen, onClose, title, subtitle, children }: FullscreenModalProps) {
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
            className="fixed inset-0 z-[100] flex flex-col"
            style={{ background: 'rgba(0,0,0,0.92)' }}
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

            {/* Chart body — full remaining space */}
            <div className="flex-1 min-h-0 p-4">
                {children}
            </div>
        </div>,
        document.body,
    );
}
