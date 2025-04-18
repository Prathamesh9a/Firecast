import React from 'react';
// import Welpun_Logo from '../assets/Welspun-Enterprises-logo.svg';
import Welpun_Logo from '../assets/logo_GEN.png';
import { useNavigate } from 'react-router-dom';
import './Existing.css';

const Header = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear any session storage, cookies, or authentication tokens here
    navigate('/logout'); // Redirect to login or any other page
  };

  return (
    <header className="flex justify-between items-center px-4 py-2 bg-gray-100 h-15 w-full bg-white">
      <div className="navMiniCont flex items-center justify-between w-[80%] mx-auto md:w-[90%]">
        <img src={Welpun_Logo} alt="Logo" className="h-10" 
        onClick={() => { navigate('/editUrl'); }} />
        <button onClick={handleLogout} className="bg-[#ff9f00] text-white px-4 py-1.5 rounded-full">
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
