import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ALL_USERS, INVITE_USER } from '../api/queries';

export function useUserManagementViewModel() {
  const { data, loading, error, refetch } = useQuery(GET_ALL_USERS);
  const [inviteUserMutation] = useMutation(INVITE_USER);

  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    category: 'JUNIOR_IC',
    role: 'BACKEND_DEV',
    department: 'BACKEND',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inviteUserMutation({
        variables: { ...formData }
      });
      setFormData({ email: '', fullName: '', category: 'JUNIOR_IC', role: 'BACKEND_DEV', department: 'BACKEND' });
      refetch();
    } catch (err) {
      console.error('Error creating user:', err);
    }
  };

  return {
    users: data?.getAllUsers || [],
    loading,
    error,
    formData,
    handleInputChange,
    handleCreateUser
  };
}
