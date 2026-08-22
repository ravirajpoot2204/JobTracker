import { useEffect, useState } from 'react';
import { fetchStats, type StatsData } from '../../services/api';

const statusConfig = [
  { key: 'applied', label: 'Applied', color: 'bg-blue-100 text-blue-800' },
  { key: 'interview', label: 'Interviews', color: 'bg-purple-100 text-purple-800' },
  { key: 'processing', label: 'Processing', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' },
  { key: 'offer', label: 'Offer', color: 'bg-green-100 text-green-800' },
  { key: 'no_response', label: 'No Response', color: 'bg-gray-100 text-gray-800' },
];

const Dashboard = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchStats();
        setStats(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="text-center py-8">Loading stats...</div>;
  if (!stats) return <div className="text-center py-8">No stats available.</div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {statusConfig.map(({ key, label, color }) => (
        <div
          key={key}
          className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow p-6"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">{label}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
              {stats[key as keyof StatsData] || 0}
            </span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-gray-900">
              {stats[key as keyof StatsData] || 0}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;