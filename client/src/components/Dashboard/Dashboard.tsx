import { useEffect, useState } from 'react';
import { fetchStats, checkEmails, type StatsData } from '../../services/api';

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
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');

const handleCheckEmails = async () => {
  setChecking(true);
  setCheckMessage('');
  try {
    const result = await checkEmails();
    setCheckMessage(result.message || 'Email check completed.');
    // Refresh stats after checking
    const res = await fetchStats();
    setStats(res.data);
  } catch (err) {
    console.error(err);
    setCheckMessage('Failed to check emails.');
  } finally {
    setChecking(false);
  }
};

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchStats();
        setStats(res.data);
      } catch (err) {
        console.error(err);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      {/* Manual Email Check Button – ALWAYS VISIBLE */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleCheckEmails}
          disabled={checking}
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          {checking ? 'Checking...' : '📬 Check Emails'}
        </button>
        {checkMessage && <span className="text-sm text-gray-600">{checkMessage}</span>}
      </div>

      {/* Stats Section */}
      {loading ? (
        <div className="text-center py-8">Loading stats...</div>
      ) : !stats ? (
        <div className="text-center py-8">No stats available.</div>
      ) : (
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
      )}
    </div>
  );
};

export default Dashboard;