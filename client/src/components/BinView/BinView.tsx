import { useEffect, useState } from 'react';
import { fetchJobs, restoreJob, permanentDeleteJob,type JobData } from '../../services/api';

interface Props {
  onDataChange: () => void;
}

const BinView = ({ onDataChange }: Props) => {
  const [binJobs, setBinJobs] = useState<JobData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBin = async () => {
    try {
      const res = await fetchJobs({ bin: 'true' });
      setBinJobs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBin();
  }, []);

  const handleRestore = async (id: string) => {
    await restoreJob(id);
    onDataChange();
    loadBin();
  };

  const handlePermanentDelete = async (id: string) => {
    if (window.confirm('Permanently delete this job? This cannot be undone.')) {
      await permanentDeleteJob(id);
      onDataChange();
      loadBin();
    }
  };

  if (loading) return <div className="text-center py-8">Loading bin...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Bin ({binJobs.length})</h2>
      {binJobs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-8 text-center text-gray-500">
          Bin is empty.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {binJobs.map((job) => (
            <div key={job._id} className="bg-white rounded-xl shadow-card p-5">
              <h3 className="text-lg font-medium text-gray-900">{job.role}</h3>
              <p className="text-sm text-gray-600">{job.company} · {job.platform}</p>
              <p className="text-xs text-gray-400 mt-1">
                Deleted: {job.deletedAt ? new Date(job.deletedAt).toLocaleDateString() : 'Unknown'}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleRestore(job._id!)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  ↩ Restore
                </button>
                <button
                  onClick={() => handlePermanentDelete(job._id!)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  🗑 Delete Permanently
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BinView;