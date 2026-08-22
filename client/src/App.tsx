import { useState } from 'react';
import Dashboard from './components/Dashboard/Dashboard';
import JobForm from './components/JobForm/JobForm';
import JobList from './components/JobList/JobList';
import KanbanBoard from './components/KanbanBoard/KanbanBoard';
import BinView from './components/BinView/BinView';
import CoverLetterGenerator from './components/CoverLetterGenerator/CoverLetterGenerator';

type Tab = 'dashboard' | 'jobs' | 'kanban' | 'bin' | 'cover-letter';

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'jobs', label: 'Jobs', icon: '💼' },
  { id: 'kanban', label: 'Kanban', icon: '📋' },
  { id: 'bin', label: 'Bin', icon: '🗑️' },
  { id: 'cover-letter', label: 'Cover Letter', icon: '📝' },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDataChange = () => setRefreshKey((prev) => prev + 1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-brand-600">Job Tracker</h1>
            <nav className="flex space-x-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors
                    ${activeTab === tab.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard key={refreshKey} />}
        {activeTab === 'cover-letter' && <CoverLetterGenerator />}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <JobForm onJobAdded={handleDataChange} />
            <JobList key={refreshKey} />
          </div>
        )}
        {activeTab === 'kanban' && <KanbanBoard key={refreshKey} onDataChange={handleDataChange} />}
        {activeTab === 'bin' && <BinView key={refreshKey} onDataChange={handleDataChange} />}
      </main>
    </div>
  );
}

export default App;