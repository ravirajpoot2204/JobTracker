import { useState } from 'react';
import { addJob } from '../../services/api';

interface Props {
  onJobAdded: () => void;
}

const statuses = [
  'saved',
  'applied',
  'processing',
  'interview',
  'offer',
  'rejected',
  'no_response',
  'interview_scheduled',
  'technical_interview',
  'offer_letter_received',
  'follow_up_sent',
  'withdrawn',
];

const JobForm = ({ onJobAdded }: Props) => {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [platform, setPlatform] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [status, setStatus] = useState('applied');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !role || !platform) {
      alert('Company, role, and platform are required');
      return;
    }
    try {
      await addJob({ company, role, platform, companyEmail, status, notes });
      setCompany('');
      setRole('');
      setPlatform('');
      setCompanyEmail('');
      setStatus('applied');
      setNotes('');
      onJobAdded();
    } catch (error) {
      console.error('Failed to add job', error);
      alert('Error adding job');
    }
  };

  const inputClass = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm";
  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Add New Application</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Company *</label>
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className={labelClass}>Role *</label>
          <input type="text" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className={labelClass}>Platform *</label>
          <input type="text" value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className={labelClass}>Contact Email (optional)</label>
          <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            {statuses.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} />
        </div>
      </div>

      <button
        type="submit"
        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors"
      >
        Add Job
      </button>
    </form>
  );
};

export default JobForm;