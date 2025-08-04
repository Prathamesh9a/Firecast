// src/components/Header.jsx
import React from 'react';
import Welpun_Logo from '../assets/logo_GEN.png';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiSettings } from 'react-icons/fi';
import { jwtDecode } from 'jwt-decode';
import './Existing.css';

/**
 * Optional prop:
 *  - hideAdminButton: boolean (default false). If true, hides the Admin button even if user is admin.
 */
const Header = ({ hideAdminButton = false }) => {
  const navigate = useNavigate();
  const location = useLocation();

  let isAdmin = false;

  try {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      isAdmin = decoded.isAdmin === true;
    }
  } catch (error) {
    console.error('Invalid token:', error);
  }

  // Hide admin button on /admin-dashboard route
  const onAdminPage = location.pathname.startsWith('/admin-dashboard');
  const showAdminBtn = isAdmin && !onAdminPage && !hideAdminButton;

  const handleLogout = () => {
    navigate('/logout');
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  const handleAdmin = () => {
    navigate('/admin-dashboard');
  };

  return (
    <header className="flex justify-between items-center px-4 py-2 bg-white shadow-md">
      <div className="navMiniCont flex items-center justify-between w-[80%] mx-auto md:w-[90%]">
        <img
          src={Welpun_Logo}
          alt="Logo"
          className="h-10 cursor-pointer"
          onClick={() => navigate('/editUrl')}
        />
        <div className="flex gap-3 items-center">
          {showAdminBtn && (
            <button
              onClick={handleAdmin}
              className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition"
              aria-label="Open Admin Dashboard"
              title="Admin Dashboard"
            >
              Admin Dashboard
            </button>
          )}

          <button
            onClick={handleSettings}
            className="flex items-center gap-1 bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition"
            aria-label="Settings"
            title="Settings"
          >
            <FiSettings size={20} />
          </button>

          <button
            onClick={handleLogout}
            className="bg-[#ff9f00] text-white px-4 py-1.5 rounded-full hover:bg-[#e68900] transition"
            aria-label="Logout"
            title="Logout"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
