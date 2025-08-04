// src/pages/UserManagement.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import Illustration from '../../assets/Group.png';
import Header from '../Header';
import {
  FaUserPlus,
  FaSpinner,
  FaUser,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaQrcode,
  FaArrowLeft,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const UserManagement = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    accountId: '1', // default to 1 (read-only field)
    isAdmin: false,
    certification: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userCount, setUserCount] = useState(0); // Track total number of users

  const apiBaseUrl =
    process.env.REACT_APP_API_BASE_URL || 'https://122.179.140.84:4082';
  const MAX_USERS = 10; // Total user limit across all accountIds

  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Please log in to fetch user count');
        const response = await axios.get(`${apiBaseUrl}/api/upload/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const count = response.data.length; // Count all users, not filtered by accountId
        setUserCount(count);
      } catch (error) {
        console.error('Error fetching user count:', error);
        setUserCount(0); // Default to 0 on error
      }
    };
    fetchUserCount();
  }, [apiBaseUrl]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Please log in to create a user');

      const payload = {
        username: formData.username,
        password: formData.password,
        accountId: formData.accountId || '1', // safety
        isAdmin: formData.isAdmin,
        certification: formData.certification,
      };

      const response = await axios.post(
        `${apiBaseUrl}/api/upload/create-user`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      Swal.fire({
        title: 'User Created!',
        text: response.data.message || 'The user was created successfully.',
        icon: 'success',
        confirmButtonText: 'OK',
      });

      setFormData({
        username: '',
        password: '',
        accountId: '1',
        isAdmin: false,
        certification: false,
      });
      setUserCount((prev) => prev + 1); // Increment total count on successful creation
    } catch (err) {
      console.error('API call error:', err);
      const errorMessage =
        err.response?.data?.message || err.message || 'Failed to create user';
      setError(errorMessage);
      if (err.response?.status === 403 && errorMessage.includes('limit of 10 reached')) {
        Swal.fire({
          title: 'Limit Reached',
          text: 'The maximum limit of 10 users has been reached. No more users can be created.',
          icon: 'warning',
          confirmButtonText: 'OK',
        });
      } else {
        Swal.fire({
          title: 'Error',
          text: errorMessage,
          icon: 'error',
          confirmButtonText: 'OK',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const remainingUsers = MAX_USERS - userCount;

  return (
    <div className="min-h-screen w-full bg-[#F5F6FA]">
      {/* 🔹 Shared Header; hide/disable Admin button on this page */}
      <Header hideAdminButton />

      {/* ------------ Top Hero / Wave Header ------------- */}
      <div className="relative overflow-hidden">
        <div className="h-32 sm:h-40 w-full bg-gradient-to-r from-[#b74e0a] via-[#cf6316] to-[#e57822]" />
        <div className="absolute top-0 right-0 h-32 sm:h-40 w-1/3 rounded-bl-[56px] bg-[#8a3a09] opacity-60" />

        {/* Title + subtitle aligned with content width */}
        <div className="mx-auto max-w-6xl px-4">
          {/* reduced bottom padding to tighten gap */}
          <div className="relative -mt-20 sm:-mt-24 pb-6 sm:pb-8">
            {/* Back button + Title */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 transition"
                aria-label="Go back"
                title="Go back"
              >
                <FaArrowLeft className="text-white" />
              </button>

              <h1 className="text-white text-3xl sm:text-4xl md:text-5xl font-extrabold drop-shadow">
                Add a New User
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* After heading, before the form — aligned with the form column */}
      <div className="mx-auto max-w-6xl px-4">
        <div className="lg:grid lg:grid-cols-12">
          <p className="mt-4 text-black/90 text-sm sm:text-base lg:col-span-7 lg:ml-6">
            Please Fill The Below Form
            <br />
            <span className="text-sm font-medium">
              Users Created: {userCount} / {MAX_USERS} | Remaining: {remainingUsers}
            </span>
          </p>
        </div>
      </div>

      {/* ------------ Body / Form + Illustration ------------- */}
      {/* reduced top padding to pull form up */}
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* LEFT: form card */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl shadow-xl p-6 sm:p-8 bg-gradient-to-br from-[#f3ebe5] via-white to-[#eef3f9]">
              {error && (
                <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-[#17914b] mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-9 w-9 rounded-full bg-white shadow-sm border border-gray-200">
                      <FaUser className="text-gray-600" />
                    </span>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter Username"
                      className="w-full rounded-full border bg-white pl-14 pr-4 py-3 text-gray-800 shadow-sm outline-none transition focus:ring-2 focus:ring-[#2ecc71] focus:border-[#2ecc71] border-gray-300"
                    />
                    <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-transparent focus-within:ring-[#2ecc71]" />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-9 w-9 rounded-full bg-white shadow-sm border border-gray-200">
                      <FaLock className="text-gray-600" />
                    </span>

                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter Password"
                      className="w-full rounded-full border bg-white pl-14 pr-12 py-3 text-gray-800 shadow-sm outline-none transition focus:ring-2 focus:ring-[#5e7cf2] focus:border-[#5e7cf2] border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <FaEyeSlash className="text-gray-600" />
                      ) : (
                        <FaEye className="text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Account ID (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account ID <span className="ml-2 text-xs text-gray-500">(fixed to 1)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-9 w-9 rounded-full bg-white shadow-sm border border-gray-200">
                      <FaQrcode className="text-gray-600" />
                    </span>
                    <input
                      type="text"
                      name="accountId"
                      value={formData.accountId}
                      readOnly
                      aria-readonly="true"
                      className="w-full rounded-full border bg-gray-100 pl-14 pr-4 py-3 text-gray-700 shadow-sm outline-none cursor-not-allowed border-gray-300"
                    />
                  </div>
                </div>

                {/* Options */}
                <div className="flex flex-col gap-3">
                  <label className="inline-flex items-center gap-2 text-[15px] text-gray-700">
                    <input
                      type="checkbox"
                      name="isAdmin"
                      checked={formData.isAdmin}
                      onChange={handleInputChange}
                      className="h-4 w-4 rounded border-gray-300 text-[#2ecc71] focus:ring-[#2ecc71]"
                    />
                    Grant Admin Access
                  </label>
                  {/* <label className="inline-flex items-center gap-2 text-[15px] text-gray-700">
                    <input
                      type="checkbox"
                      name="certification"
                      checked={formData.certification}
                      onChange={handleInputChange}
                      className="h-4 w-4 rounded border-gray-300 text-[#2ecc71] focus:ring-[#2ecc71]"
                    />
                    Certification Required
                  </label> */}
                </div>

                {/* CTA (centered) */}
                <div className="pt-2 flex justify-center">
                  <button
                    type="submit"
                    disabled={loading || remainingUsers <= 0}
                    className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-white font-semibold shadow-md transition active:scale-[0.99] ${
                      (loading || remainingUsers <= 0)
                        ? 'opacity-60 cursor-not-allowed bg-gradient-to-r from-[#d87a1a] to-[#b45d0e]'
                        : 'bg-gradient-to-r from-[#d87a1a] to-[#b45d0e] hover:brightness-110'
                    }`}
                  >
                    {loading ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaUserPlus />
                    )}
                    {loading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* RIGHT: Illustration */}
          <div className="hidden lg:flex lg:col-span-5 items-center justify-center">
            <img
              src={Illustration}
              alt="People with mobile UI"
              className="max-h-[420px] w-auto object-contain drop-shadow-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
