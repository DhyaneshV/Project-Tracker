import React, { useState, lazy, Suspense } from 'react';
import { DashboardShell, NavItem } from './DashboardShell';
import { SkeletonCard } from '../components/Skeleton';

// Lazy-loaded views (only downloaded when tab is first selected)
const ProjectListView = lazy(() => import('./ProjectListView').then(m => ({ default: m.ProjectListView })));
const UserManagementView = lazy(() => import('./users/UserManagementView').then(m => ({ default: m.UserManagementView })));
const ExecutiveDashboard = lazy(() => import('./ExecutiveDashboard').then(m => ({ default: m.ExecutiveDashboard })));
const InternalMessaging = lazy(() => import('./InternalMessaging').then(m => ({ default: m.InternalMessaging })));
const ActivityFeedView = lazy(() => import('./ActivityFeedView').then(m => ({ default: m.ActivityFeedView })));
const CalendarView = lazy(() => import('./CalendarView').then(m => ({ default: m.CalendarView })));
const MyTasksView = lazy(() => import('./MyTasksView').then(m => ({ default: m.MyTasksView })));
const ReportsView = lazy(() => import('./ReportsView').then(m => ({ default: m.ReportsView })));
const DirectoryView = lazy(() => import('./DirectoryView').then(m => ({ default: m.DirectoryView })));
const PendingApprovalsView = lazy(() => import('./PendingApprovalsView').then(m => ({ default: m.PendingApprovalsView })));
const PayrollView = lazy(() => import('./PayrollView').then(m => ({ default: m.PayrollView })));

function LazyFallback() {
  return <SkeletonCard height={300} />;
}

interface Props {
  user: any;
  onLogout: () => void;
  token: string;
}

/**
 * AdminDashboard - Full-featured management interface for Hierarchy Levels 1-3
 * (C-Suite, SVP, VP)
 * 
 * Includes: Executive overview, full team management, reports, approvals, payroll,
 * and all standard work/communication features.
 */
export function AdminDashboard({ user, onLogout, token }: Props) {
  const [activeTab, setActiveTab] = useState('executive');

  const sections = ['OVERVIEW', 'WORK', 'COMMS', 'ORG'];

  const navItems: NavItem[] = [
    { id: 'executive', label: 'Executive', icon: '◈', section: 'OVERVIEW' },
    { id: 'mytasks', label: 'My Tasks', icon: '◉', section: 'WORK' },
    { id: 'projects', label: 'Projects', icon: '▦', section: 'WORK' },
    { id: 'calendar', label: 'Deadlines', icon: '◷', section: 'WORK' },
    { id: 'messages', label: 'Messages', icon: '◫', section: 'COMMS' },
    { id: 'activity', label: 'Activity', icon: '◌', section: 'COMMS' },
    { id: 'reports', label: 'Reports', icon: '▤', section: 'ORG' },
    { id: 'directory', label: 'Directory', icon: '◎', section: 'ORG' },
    { id: 'team', label: 'Team Mgmt', icon: '◇', section: 'ORG' },
    { id: 'approvals', label: 'Approvals', icon: '◈', section: 'ORG' },
    { id: 'compensation', label: 'Payroll', icon: '◆', section: 'ORG' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'executive':
        return <ExecutiveDashboard />;
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
      case 'reports':
        return <ReportsView isExecutive={true} />;
      case 'directory':
        return <DirectoryView />;
      case 'team':
        return <UserManagementView token={token} />;
      case 'approvals':
        return <PendingApprovalsView />;
      case 'compensation':
        return <PayrollView />;
      default:
        return <ExecutiveDashboard />;
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
      <Suspense fallback={<LazyFallback />}>
        {renderContent()}
      </Suspense>
    </DashboardShell>
  );
}
