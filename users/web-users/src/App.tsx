import React from 'react';
import { UserManagementView } from './views/UserManagementView';

function App() {
  return (
    <div className="App">
      <header>
        <h1>User Management</h1>
      </header>
      <main>
        <UserManagementView />
      </main>
    </div>
  );
}

export default App;
