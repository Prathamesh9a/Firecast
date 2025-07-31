import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2'; // Import SweetAlert
import Header from '../Header'; 

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://192.168.1.27:4082';

// Inline icons (no extra packages needed)
const PlusIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
  </svg>
);
const PencilIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M4 20l4.586-1.146a2 2 0 00.894-.516l9.268-9.268a2 2 0 000-2.828l-1.89-1.89a2 2 0 00-2.828 0L4.762 13.62a2 2 0 00-.516.894L3.1 19.2A.8.8 0 004 20z" />
  </svg>
);
const TrashIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m3 0V5a2 2 0 012-2h4a2 2 0 012 2v2M4 7h16" />
  </svg>
);
const SearchIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <circle cx="11" cy="11" r="7" strokeWidth="2" />
    <path strokeWidth="2" strokeLinecap="round" d="M20 20l-3.5-3.5" />
  </svg>
);
// Back icon (used next to "ALL USERS" heading and in the modal)
const BackIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

// Show only a few characters of the password
const maskPassword = (pwd) => {
  if (!pwd) return '';
  const shown = 3;
  return pwd.length > shown ? `${pwd.slice(0, shown)}***` : pwd;
};

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', password: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${apiBaseUrl}/api/upload/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(response.data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
        if (error?.response?.status === 403) {
          alert('Admin access required. Please log in as an admin.');
        } else {
          alert(`Failed to fetch users: ${error.message}`);
        }
      }
    };
    fetchUsers();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        (u.username || '').toLowerCase().includes(term) ||
        (u.password || '').toLowerCase().includes(term)
    );
  }, [users, q]);

  const handleAddUser = () => {
    navigate('/admin');
  };

  const handleEdit = (id) => {
    const user = users.find((u) => u.id === id);
    if (user) {
      setSelectedUser(user);
      setEditForm({ username: user.username, password: '' }); // Leave password empty to prompt new input
      document.getElementById('edit-modal').classList.remove('hidden');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('token');
      const updateData = {};
      if (editForm.username && editForm.username !== selectedUser.username) updateData.username = editForm.username;
      if (editForm.password) updateData.password = editForm.password;

      if (Object.keys(updateData).length > 0) {
        await axios.put(`${apiBaseUrl}/api/upload/update-user/${selectedUser.id}`, updateData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(users.map((u) => (u.id === selectedUser.id ? { ...u, username: editForm.username || u.username } : u)));
        Swal.fire({
          title: 'Success',
          text: 'User updated successfully',
          icon: 'success',
          confirmButtonText: 'OK',
        });
      } else {
        Swal.fire({
          title: 'Info',
          text: 'No changes made',
          icon: 'info',
          confirmButtonText: 'OK',
        });
      }
      closeModal();
    } catch (error) {
      console.error('Error updating user:', error);
      Swal.fire({
        title: 'Error',
        text: `Failed to update user: ${error.response?.data?.message || error.message}`,
        icon: 'error',
        confirmButtonText: 'OK',
      });
    }
  };

  const handleDelete = async (id) => {
    const ok = window.confirm('Are you sure you want to delete this user?');
    if (!ok) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${apiBaseUrl}/api/upload/delete-user/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      Swal.fire({
        title: 'Success',
        text: 'User deleted successfully',
        icon: 'success',
        confirmButtonText: 'OK',
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      Swal.fire({
        title: 'Error',
        text: `Failed to delete user: ${error.response?.data?.message || error.message}`,
        icon: 'error',
        confirmButtonText: 'OK',
      });
    }
  };

  const closeModal = () => {
    document.getElementById('edit-modal').classList.add('hidden');
    setSelectedUser(null);
    setEditForm({ username: '', password: '' });
  };

  const handleBackFromModal = () => {
    closeModal();
    navigate(-1);
  };

  return (
    <div className="min-h-screen w-full bg-[#F5F5F5] text-sm"> {/* Reduced base font size */}
      {/* Shared header */}
      <Header />

      {/* Top bar */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* LEFT: back + title */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-1 rounded-full hover:bg-gray-100"
              aria-label="Go back"
              title="Go back"
            >
              <BackIcon className="h-5 w-5 text-gray-700" />
            </button>
            {/* Lighter title */}
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-black uppercase">
              ALL USERS
            </h1>
          </div>

          {/* RIGHT: actions */}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              onClick={handleAddUser}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-110 active:scale-[0.99]"
            >
              <PlusIcon className="h-4 w-4" />
              <span> Add new user</span>
            </button>

            <div className="relative sm:ml-2">
              <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="w-full sm:w-72 rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#1E90FF]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card/Table */}
      <div className="mx-auto mt-6 w-full max-w-7xl px-4 pb-8">
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
          {/* Orange header row */}
          <div className="grid grid-cols-4 items-center bg-[#FF9900] px-6 py-3 text-left text-white">
            <div className="font-medium text-sm">Username</div>
            <div className="font-medium text-sm">Password</div>
            <div className="font-medium text-sm">Edit</div>
            <div className="font-medium text-sm">Delete</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-200">
            {filtered.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-4 items-center bg-white px-6 py-3 text-[#333333] hover:bg-gray-50"
              >
                <div className="truncate text-sm font-normal">
                  {user.username}
                </div>
                <div className="truncate text-sm">
                  {maskPassword(user.password)}
                </div>
                <div>
                  <button
                    onClick={() => handleEdit(user.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-[#63D463] px-3 py-1.5 text-sm font-medium text-white shadow hover:brightness-110 active:scale-[0.99]"
                  >
                    <PencilIcon className="h-4 w-4" />
                    Edit
                  </button>
                </div>
                <div>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-[#FF4040] px-3 py-1.5 text-sm font-medium text-white shadow hover:brightness-110 active:scale-[0.99]"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="px-6 py-4 text-center text-sm text-gray-500">
                No users found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <div
        id="edit-modal"
        className="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center"
      >
        <div className="bg-white rounded-lg p-4 w-full max-w-md">
          {/* Modal header with back (optional; keep if you like) */}
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={handleBackFromModal}
              className="p-1 rounded-full hover:bg-gray-100"
              aria-label="Go back"
              title="Go back"
            >
              <BackIcon className="h-4 w-4 text-gray-700" />
            </button>
            <h2 className="text-lg font-semibold text-[#333333]">Edit User</h2>
          </div>

          <form onSubmit={handleUpdate}>
            <div className="mb-3">
              <label className="block text-xs font-medium text-[#333333]">Username</label>
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#63D463]"
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-[#333333]">Password</label>
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Leave blank to keep current"
                className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#63D463]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-3 py-1 bg-gray-300 text-xs text-[#333333] rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-full bg-[#63D463] px-3 py-1.5 text-sm font-medium text-white shadow hover:brightness-110 active:scale-[0.99]"
              >
                <PencilIcon className="h-4 w-4" />
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;