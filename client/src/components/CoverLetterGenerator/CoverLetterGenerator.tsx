import { useState } from 'react';
import { generateCoverLetterStandalone, downloadCoverLetter } from '../../services/api';

const inputClass = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm";
const labelClass = "block text-sm font-medium text-gray-700";

const CoverLetterGenerator = () => {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [coverLetterText, setCoverLetterText] = useState('');
  const [loading, setLoading] = useState(false);

  const [recipientName, setRecipientName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const handleGenerate = async () => {
    if (!company || !role || !jobDescription) {
      alert('Please fill company, role, and job description');
      return;
    }
    setLoading(true);
    try {
      const res = await generateCoverLetterStandalone({ company, role, jobDescription });
      setCoverLetterText(res.data.coverLetterText);
    } catch (err) {
      console.error(err);
      alert('Failed to generate cover letter');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!coverLetterText) return;
    try {
      const res = await downloadCoverLetter({
        text: coverLetterText,
        company,
        role,
        recipientName,
        street,
        city,
        state,
        zip,
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'CoverLetter.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      alert('Download failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-card p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Cover Letter Generator</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Company *</label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Role *</label>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Job Description *</label>
            <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={5} className={inputClass} />
          </div>
        </div>

        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-brand-600">
            Recipient Details (optional)
          </summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Recipient Name</label>
              <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Street</label>
              <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ZIP</label>
              <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} className={inputClass} />
            </div>
          </div>
        </details>

        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Generating...' : 'Generate Cover Letter'}
          </button>
        </div>

        {coverLetterText && (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Generated Cover Letter</label>
              <textarea
                value={coverLetterText}
                readOnly
                rows={10}
                className={`${inputClass} bg-gray-50`}
              />
            </div>
            <button
              onClick={handleDownload}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              Download PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoverLetterGenerator;