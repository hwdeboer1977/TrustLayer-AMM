// Constants and helpers

export const TIER_NAMES = {
    0: 'Unregistered',
    1: 'Tier C (Basic)',
    2: 'Tier B (Pro)',
    3: 'Tier A (Whale)'
};

export const TIER_COLORS = {
    0: 'tier-0',
    1: 'tier-1',
    2: 'tier-2',
    3: 'tier-3'
};

export function formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatAmount(amount) {
    const num = parseFloat(amount);
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toFixed(2);
}
