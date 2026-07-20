import React, { useState, lazy, Suspense } from 'react';
import { DashboardShell, NavItem } from './DashboardShell';
import { SkeletonCard } from '../components/Skeleton';

const EmployeeProfileView = lazy(() => import('./EmployeeProfileView').then(m => ({ default: m.EmployeeProfileView })));
const ProjectListView = lazy(() => import('./ProjectListView').then(m => ({ default: m.ProjectListView })));
const InternalMessaging = lazy(() => import('./InternalMessaging').then(m => ({ default: m.InternalMessaging })));
const ActivityFeedView = lazy(() => import('./ActivityFeedView').then(m => ({ default: m.ActivityFeedView })));
const CalendarView = lazy(() => import('./CalendarView').then(m => ({ default: m.CalendarView })));
const MyTasksView = lazy(() => import('./MyTasksView').then(m => ({ default: m.MyTasksView })));
const DirectoryView = lazy(() => import('./DirectoryView').then(m => ({ default: m.DirectoryView })));

interface Props {
  user: any;
  onLogout: () => void;
  token: string;
}

/**
 * EmployeeDashboard - Personal dashboard for Hierarchy Levels 6-7
 * (Senior IC, Junior IC)
 * 
 * Execution-focused - users see their work, communicate with
 * colleagues, and track deadlines without any management overhead.
 */
export function EmployeeDashboard({ user, onLogout, token }: Props) {
  const [activeTab, setActiveTab] = useState('mytasks');

  const sections = ['OVERVIEW', 'WORK', 'COMMS', 'ORG'];

  const navItems: NavItem[] = [
    { id: 'profile', label: 'My Profile', icon: '◈', section: 'OVERVIEW' },
    { id: 'mytasks', label: 'My Tasks', icon: '◉', section: 'WORK' },
    { id: 'projects', label: 'Projects', icon: '▦', section: 'WORK' },
    { id: 'calendar', label: 'Deadlines', icon: '◷', section: 'WORK' },
    { id: 'messages', label: 'Messages', icon: '◫', section: 'COMMS' },
    { id: 'activity', label: 'Activity', icon: '◌', section: 'COMMS' },
    { id: 'directory', label: 'Directory', icon: '◎', section: 'ORG' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <EmployeeProfileView />;
      case 'mytasks':
        return <MyTasksView />;
      case 'projects':
        return <ProjectListView user={user} token={token} />;
      case 'calendar':
        return <CalendarView />;
      case 'messages':
        return <InternalMessaging user={user} />;
      case 'activity':
        return <ActivityFeedView />;
      case 'directory':
        return <DirectoryView />;
      default:
        return <EmployeeProfileView />;
    }
  };

  return (
    <DashboardShell
      user={user}
      onLogout={onLogout}
      navItems={navItems}
      sections={sections}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <Suspense fallback={<SkeletonCard height={300} />}>
        {renderContent()}
      </Suspense>
    </DashboardShell>
  );
}
