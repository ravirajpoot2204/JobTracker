import { useState } from 'react';
import { generateResume, downloadResume } from '../../services/api';

const inputClass =
  'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm';
const labelClass = 'block text-sm font-medium text-gray-700';

const safe = (s: string) =>
  (s || 'Unknown').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

const ResumeGenerator = () => {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [cvData, setCvData] = useState<any>(null);
  const [detected, setDetected] = useState<{ company: string; role: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!jobDescription) return alert('Please paste the job description');
    setLoading(true);
    try {
      const res = await generateResume({
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
        const retry = await generateResume({ company: c, role: r, jobDescription });
        setCvData(retry.data.cvData);
        setDetected({ company: retry.data.company, role: retry.data.role });
        return;
      }

      setCvData(res.data.cvData);
      setDetected({ company: res.data.company, role: res.data.role });
    } catch (err) {
      console.error(err);
      alert('Failed to generate resume');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!cvData) return;
    try {
      const cName = detected?.company || company || 'Company';
      const rName = detected?.role || role || 'Role';
      const res = await downloadResume(cvData, cName, rName);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ravi_Rajpoot_Resume_${safe(cName)}_${safe(rName)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Download failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-card p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Resume Generator</h2>

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

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Resume'}
        </button>

        {detected && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
              {detected.role}
            </span>
            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
              {detected.company}
            </span>
          </div>
        )}

        {cvData?.matchedKeywords?.length > 0 && (
          <div className="text-xs text-gray-600">
            <strong>ATS keywords matched:</strong>{' '}
            <span className="text-gray-700">{cvData.matchedKeywords.join(', ')}</span>
          </div>
        )}

        {cvData && (
          <div className="space-y-3">
            <label className={labelClass}>Preview</label>
            <pre className="bg-gray-50 p-3 text-xs overflow-auto max-h-96 rounded-md border">
              {JSON.stringify(cvData, null, 2)}
            </pre>
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

export default ResumeGenerator;