import { useEffect, useState } from 'react';
import { fetchJobs, binJob, generateCoverLetter, sendFollowUp, type JobData } from '../../services/api';

const statusColors: Record<string, string> = {
  saved: 'bg-gray-100 text-gray-800',
  applied: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  interview: 'bg-purple-100 text-purple-800',
  offer: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  no_response: 'bg-gray-100 text-gray-800',
  interview_scheduled: 'bg-indigo-100 text-indigo-800',
  technical_interview: 'bg-cyan-100 text-cyan-800',
  offer_letter_received: 'bg-emerald-100 text-emerald-800',
  follow_up_sent: 'bg-orange-100 text-orange-800',
  withdrawn: 'bg-rose-100 text-rose-800',
};

const JobList = () => {
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [coverLetterText, setCoverLetterText] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [jobDescriptionInput, setJobDescriptionInput] = useState('');

  const loadJobs = async () => {
    try {
      const res = await fetchJobs();
      setJobs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleBin = async (id: string) => {
    if (window.confirm('Move to bin?')) {
      await binJob(id);
      loadJobs();
    }
  };

  const handleGenerateCoverLetter = async (id: string) => {
    setGeneratingId(id);
    setCoverLetterText('');
    setDownloadUrl('');
    try {
      const res = await generateCoverLetter(id, jobDescriptionInput);
      setCoverLetterText(res.data.coverLetterText);
      setDownloadUrl(res.data.downloadUrl);
      setExpandedJobId(id);
    } catch (err) {
      console.error(err);
      alert('Failed to generate cover letter');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleSendFollowUp = async (id: string) => {
    try {
      await sendFollowUp(id);
      alert('Follow-up sent');
      loadJobs();
    } catch (err) {
      console.error(err);
      alert('Follow-up failed');
    }
  };

  if (loading) return <div className="text-center py-8">Loading jobs...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Applications ({jobs.length})</h2>
      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-8 text-center text-gray-500">
          No active jobs. Add your first application above.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jobs.map((job) => {
            const gmailLink = job.emailLog?.find(log => log.direction === 'inbound')?.link || '';
            return (
              <div key={job._id} className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{job.role}</h3>
                    <p className="text-sm text-gray-600">{job.company} · {job.platform}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[job.status] || 'bg-gray-100 text-gray-800'}`}>
                    {job.status.replace(/_/g, ' ')}
                  </span>
                </div>
                {job.notes && <p className="mt-2 text-sm text-gray-500">{job.notes}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="text-gray-400">Follow-ups: {job.followUpCount || 0}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSendFollowUp(job._id!)}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    📧 Follow-up
                  </button>
                  <button
                    onClick={() => setExpandedJobId(expandedJobId === job._id ? null : job._id!)}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    {expandedJobId === job._id ? 'Hide Cover Letter' : 'Generate Cover Letter'}
                  </button>
                  <button
                    onClick={() => handleBin(job._id!)}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
                  >
                    🗑 Bin
                  </button>
                  <button
                    onClick={() => {
                      if (gmailLink) {
                        window.open(gmailLink, '_blank', 'noopener,noreferrer');
                      } else {
                        alert('No email link available for this job.');
                      }
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    ✉️ Open Email
                  </button>
                </div>

                {expandedJobId === job._id && (
                  <div className="mt-4 border-t pt-4">
                    <textarea
                      value={jobDescriptionInput}
                      onChange={(e) => setJobDescriptionInput(e.target.value)}
                      placeholder="Paste job description here..."
                      rows={3}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                    <button
                      onClick={() => handleGenerateCoverLetter(job._id!)}
                      disabled={generatingId === job._id}
                      className="mt-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {generatingId === job._id ? 'Generating...' : 'Generate'}
                    </button>
                    {coverLetterText && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md whitespace-pre-wrap text-sm text-gray-700">
                        {coverLetterText}
                      </div>
                    )}
                    {downloadUrl && (
                      <a
                        href={`http://localhost:5000${downloadUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-blue-600 hover:text-blue-700 font-medium"
                      >
                        📄 Download PDF
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default JobList;