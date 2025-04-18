import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios';

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const performLogout = async () => {
      // Clear the token from localStorage (or sessionStorage)
      // await axios.post('http://localhost:5000/api/auth/logout', {}, {
      //   headers: {
      //     Authorization: `Bearer ${localStorage.getItem('token')}`,// Include the token if you want
      //   },
      // });
      // localStorage.removeItem('token');
      sessionStorage.removeItem("userInfo");
      localStorage.removeItem("token");
      // Optional: Add any additional cleanup (e.g., clearing user state, cookies, etc.)

      // Redirect to the login page after logout
      navigate('/login');

      // alert('You have been logged out successfully');
    };

    performLogout();
  }, [navigate]);

  return null; // No UI needed for the Logout component
};

export default Logout;
//