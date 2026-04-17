import { useState } from 'react';
import { ManagementSidebar } from '@/components/layout';
import { InstructorDashboard } from './Dashboard';
import { CoursesManagement as UnitsManagement } from './CoursesManagement';
import { InstructorAssessments } from './AssessmentsManagement';

export function InstructorManagement() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'units' | 'assessments'>('dashboard');

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Management Sidebar */}
      <ManagementSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {activeTab === 'dashboard' && <InstructorDashboard />}
          {activeTab === 'units' && <UnitsManagement />}
          {activeTab === 'assessments' && <InstructorAssessments />}
        </div>
      </main>
    </div>
  );
}
