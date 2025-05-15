import React from 'react';
import Welpun_Logo from '../assets/logo_GEN.png';
import { useNavigate } from 'react-router-dom';
import { FiSettings } from 'react-icons/fi'; // Import the settings icon
import './Existing.css';

const Header = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/logout');
  };

  const handleSettings = () => {
    navigate('/settings');
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
          <button
            onClick={handleSettings}
            className="flex items-center gap-1 bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition"
          >
            <FiSettings size={20} />
            {/* Settings */}
          </button>
          <button
            onClick={handleLogout}
            className="bg-[#ff9f00] text-white px-4 py-1.5 rounded-full hover:bg-[#e68900] transition"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
