/**
 * Default pinned markets that appear at the top of the screener.
 * Users can star/unstar additional markets — stored in localStorage.
 */

export const DEFAULT_PINNED_CODES = new Set<string>([
    // Crypto — BTC
    '133LM4', // Nano BTC Perp Style
    '133741', // Bitcoin (CME)
    '133742', // Micro Bitcoin
    '133LM1', // Nano BTC Perp (Legacy)
    // Crypto — ETH
    '146021', // Ether
    '146022', // Micro Ether
    '146LM3', // Nano Ether Perp Style
    '146LM1', // Nano Ether Perp (Legacy)
    // Crypto — SOL
    '177741', // SOL
    '177LM1', // Nano SOL Perp
    // FX Majors
    '099741', // Euro FX
    '096742', // British Pound
    '097741', // Japanese Yen
    '090741', // Canadian Dollar
    '092741', // Swiss Franc
    '232741', // Australian Dollar
    '112741', // New Zealand Dollar
    '098662', // USD Index
    // Indices
    '13874A', // E-Mini S&P 500
    '209742', // E-Mini Nasdaq 100
    '239742', // E-Mini Russell 2000
    '13874U', // Micro E-Mini S&P
    '209747', // Micro Nasdaq 100
    // Metals
    '088691', // Gold (GC)
    '088695', // Micro Gold
]);

/** Quick-access pill market list for screener header bar */
export const QUICK_ACCESS_MARKETS: { code: string; label: string; sector: string }[] = [
    { code: '133741', label: 'BTC', sector: 'Crypto' },
    { code: '133742', label: 'MBT', sector: 'Crypto' },
    { code: '133LM4', label: 'nBTC', sector: 'Crypto' },
    { code: '146021', label: 'ETH', sector: 'Crypto' },
    { code: '146022', label: 'mETH', sector: 'Crypto' },
    { code: '177741', label: 'SOL', sector: 'Crypto' },
    { code: '099741', label: 'EUR', sector: 'FX' },
    { code: '096742', label: 'GBP', sector: 'FX' },
    { code: '097741', label: 'JPY', sector: 'FX' },
    { code: '090741', label: 'CAD', sector: 'FX' },
    { code: '092741', label: 'CHF', sector: 'FX' },
    { code: '232741', label: 'AUD', sector: 'FX' },
    { code: '098662', label: 'DXY', sector: 'FX' },
    { code: '13874A', label: 'ES', sector: 'Indices' },
    { code: '209742', label: 'NQ', sector: 'Indices' },
    { code: '239742', label: 'RTY', sector: 'Indices' },
    { code: '088691', label: 'GC', sector: 'Metals' },
];
