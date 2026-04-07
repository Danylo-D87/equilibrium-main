/**
 * GroupSelector — pill-style toggle to switch dashboard participant group.
 *
 * Renders available groups from the DashboardResponse and persists
 * the selection in the store. Null = default group from assetConfig.
 */

import { useCotStore } from '../../store/useCotStore';
import { getGroupLabel } from '../../utils/assetConfig';
import type { DashboardData } from '../../types/dashboard';

interface GroupSelectorProps {
    data: DashboardData;
}

export default function GroupSelector({ data }: GroupSelectorProps) {
    const dashboardGroupKey = useCotStore((s) => s.dashboardGroupKey);
    const setDashboardGroupKey = useCotStore((s) => s.setDashboardGroupKey);
    const { groups, market, specGroupKey } = data;

    // Current active key (resolved: store override or default)
    const activeKey = dashboardGroupKey || specGroupKey;

    if (!groups || groups.length <= 1) return null;

    return (
        <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.04] rounded-full p-0.5">
            {groups.map((g) => {
                const isActive = g.key === activeKey;
                const label = getGroupLabel(market.primary_report, g.key);
                // Truncate long names for pill display
                const shortLabel = g.short || label.split('/')[0].slice(0, 10);
                return (
                    <button
                        key={g.key}
                        onClick={() => setDashboardGroupKey(g.key === specGroupKey ? null : g.key)}
                        className={`px-2 py-0.5 text-[10px] font-medium tracking-[0.06em] transition-all duration-300 rounded-full whitespace-nowrap ${
                            isActive
                                ? 'text-white/90 bg-white/[0.10]'
                                : 'text-white/30 hover:text-white/50'
                        }`}
                        title={label}
                    >
                        {shortLabel}
                    </button>
                );
            })}
        </div>
    );
}
