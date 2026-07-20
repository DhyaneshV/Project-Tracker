import React, { useState, lazy, Suspense } from 'react';
import { DashboardShell, NavItem } from './DashboardShell';
import { SkeletonCard } from '../components/Skeleton';

const ProjectListView = lazy(() => import('./ProjectListView').then(m => ({ default: m.ProjectListView })));
const TeamManagementContent = lazy(() => import('./TeamManagementContent').then(m => ({ default: m.TeamManagementContent })));
const InternalMessaging = lazy(() => import('./InternalMessaging').then(m => ({ default: m.InternalMessaging })));
const ActivityFeedView = lazy(() => import('./ActivityFeedView').then(m => ({ default: m.ActivityFeedView })));
const CalendarView = lazy(() => import('./CalendarView').then(m => ({ default: m.CalendarView })));
const MyTasksView = lazy(() => import('./MyTasksView').then(m => ({ default: m.MyTasksView })));
const DirectoryView = lazy(() => import('./DirectoryView').then(m => ({ default: m.DirectoryView })));
const PendingApprovalsView = lazy(() => import('./PendingApprovalsView').then(m => ({ default: m.PendingApprovalsView })));
const ReportsView = lazy(() => import('./ReportsView').then(m => ({ default: m.ReportsView })));

interface Props {
  user: any;
  onLogout: () => void;
  token: string;
}

/**
 * TeamManagementDashboard - Scoped management interface for Hierarchy Levels 4-5
 * (Senior Manager, Team Manager)
 * 
 * Defaults to "My Team" tab — a manager's primary job is team oversight.
 * Includes Approvals and Reports tabs that were previously admin-only.
 */
export function TeamManagementDashboard({ user, onLogout, token }: Props) {
  const [activeTab, setActiveTab] = useState('team');

  const sections = ['TEAM', 'WORK', 'COMMS', 'ORG'];

  const navItems: NavItem[] = [
    { id: 'team', label: 'My Team', icon: '◇', section: 'TEAM' },
    { id: 'approvals', label: 'Approvals', icon: '◈', section: 'TEAM' },
    { id: 'mytasks', label: 'My Tasks', icon: '◉', section: 'WORK' },
    { id: 'projects', label: 'Projects', icon: '▦', section: 'WORK' },
    { id: 'calendar', label: 'Deadlines', icon: '◷', section: 'WORK' },
    { id: 'messages', label: 'Messages', icon: '◫', section: 'COMMS' },
    { id: 'activity', label: 'Activity', icon: '◌', section: 'COMMS' },
    { id: 'reports', label: 'Reports', icon: '▤', section: 'ORG' },
    { id: 'directory', label: 'Directory', icon: '◎', section: 'ORG' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'team':
        return <TeamManagementContent />;
      case 'approvals':
        return <PendingApprovalsView />;
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
        return <ReportsView isExecutive={false} />;
      case 'directory':
        return <DirectoryView />;
      default:
        return <TeamManagementContent />;
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
