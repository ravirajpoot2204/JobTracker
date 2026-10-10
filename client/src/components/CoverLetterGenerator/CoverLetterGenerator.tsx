import { useState } from 'react';
import { generateCoverLetterStandalone, downloadCoverLetter } from '../../services/api';

const inputClass =
  'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm';
const labelClass = 'block text-sm font-medium text-gray-700';

const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

const CoverLetterGenerator = () => {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [coverLetterText, setCoverLetterText] = useState('');
  const [detected, setDetected] = useState<{
    company: string;
    role: string;
    location?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const [recipientName, setRecipientName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const handleGenerate = async () => {
    if (!jobDescription) return alert('Please paste the job description');
    setLoading(true);
    try {
      const res = await generateCoverLetterStandalone({
        company: company.trim() || undefined,
        role: role.trim() || undefined,
        jobDescription,
      });

      if (res.data.needsInput) {
        let c = company;
        let r = role;
        if (res.data.missing.company) {
          const input = window.prompt('Could not detect company name. Please enter it:');
          if (!input) return;
          c = input;
          setCompany(input);
        }
        if (res.data.missing.role) {
          const input = window.prompt('Could not detect role. Please enter it:');
          if (!input) return;
          r = input;
          setRole(input);
        }
        const retry = await generateCoverLetterStandalone({
          company: c,
          role: r,
          jobDescription,
        });
        setCoverLetterText(retry.data.coverLetterText);
        setDetected({
          company: retry.data.company,
          role: retry.data.role,
          location: retry.data.location,
        });
        return;
      }

      setCoverLetterText(res.data.coverLetterText);
      setDetected({
        company: res.data.company,
        role: res.data.role,
        location: res.data.location,
      });
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
        company: detected?.company || company,
        role: detected?.role || role,
        recipientName,
        street,
        city,
        state,
        zip,
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      const cName = safe(detected?.company || company || 'Company');
      const rName = safe(detected?.role || role || 'Role');
      link.href = url;
      link.setAttribute('download', `Ravi_Rajpoot_CoverLetter_${cName}_${rName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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
            <label className={labelClass}>Company (optional)</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={inputClass}
              placeholder="Auto-detected if left blank"
            />
          </div>
          <div>
            <label className={labelClass}>Role (optional)</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputClass}
              placeholder="Auto-detected if left blank"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Job Description *</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={6}
              className={inputClass}
              placeholder="Paste the full job description here..."
            />
          </div>
        </div>

        <details>
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-blue-600">
            Recipient Details (optional)
          </summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Recipient Name</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Street</label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>ZIP</label>
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </details>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Cover Letter'}
        </button>

        {detected && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
              {detected.role}
            </span>
            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
              {detected.company}
            </span>
            {detected.location && detected.location !== 'Not specified' && (
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                📍 {detected.location}
              </span>
            )}
          </div>
        )}

        {coverLetterText && (
          <div className="space-y-3">
            <label className={labelClass}>Generated Cover Letter</label>
            <textarea
              value={coverLetterText}
              readOnly
              rows={12}
              className={`${inputClass} bg-gray-50`}
            />
            <button
              onClick={handleDownload}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
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