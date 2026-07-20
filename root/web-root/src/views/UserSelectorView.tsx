import React from 'react';
import { useQuery, gql } from '@apollo/client';

const GET_ALL_USERS = gql`
  query GetAllUsers {
    getAllUsers {
      id
      email
      fullName
      role
    }
  }
`;

interface Props {
  onUserSelected: (user: any) => void;
}

export function UserSelectorView({ onUserSelected }: Props) {
  const { data, loading, error } = useQuery(GET_ALL_USERS);

  if (loading) return <p>Fetching users...</p>;
  if (error) return (
    <div>
        <p>Error connecting to Gateway: {error.message}</p>
        <p><small>Ensure svc-root (4000) and svc-users (4001) are running.</small></p>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', padding: '1rem' }}>
      {data?.getAllUsers.length === 0 && <p>No users found in database. Use web-users to add some!</p>}
      {(data?.getAllUsers || []).map((user: any) => (
        <div 
          key={user.id} 
          onClick={() => onUserSelected(user)}
          style={{ 
            border: '1px solid #ccc', 
            padding: '1rem', 
            cursor: 'pointer',
            borderRadius: '8px',
            textAlign: 'center'
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#f9f9f9')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'white')}
        >
          <strong>{user.fullName}</strong>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>{user.role}</div>
          <div style={{ fontSize: '0.7rem' }}>{user.email}</div>
        </div>
      ))}
    </div>
  );
}
