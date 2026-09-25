import type { Score } from '../utils/scoring';

interface BadgeCardProps {
  icon: React.ReactNode;
  label: string;
  score: Score;
  reason: string;
}

const scoreConfig = {
  GREEN: { bg: 'bg-emerald-600', text: 'text-emerald-600', bgLight: 'bg-emerald-50', border: 'border-emerald-200', label: 'Pass' },
  YELLOW: { bg: 'bg-amber-600', text: 'text-amber-600', bgLight: 'bg-amber-50', border: 'border-amber-200', label: 'Caution' },
  RED: { bg: 'bg-red-600', text: 'text-red-600', bgLight: 'bg-red-50', border: 'border-red-200', label: 'Warning' },
};

export default function BadgeCard({ icon, label, score, reason }: BadgeCardProps) {
  const config = scoreConfig[score];

  return (
    <div className={`rounded-2xl border ${config.border} ${config.bgLight} p-5 shadow-sm`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm">{label}</h3>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} text-white`}>
          {score}
        </span>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{reason}</p>
    </div>
  );
}