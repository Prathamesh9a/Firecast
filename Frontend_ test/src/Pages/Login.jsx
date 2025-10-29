// import React, { useState } from 'react';
// import axios from 'axios';
// import { useNavigate } from 'react-router-dom';
// import logo_gen from '../assets/logo_GEN.png';
// // import logo_gen from '../assets/Welspun-Enterprises-logo.svg';
// import ArrowLine from '../assets/arrow-line.png';
// import ArrowHead from '../assets/arrow-head.png';
// import Background from '../assets/BgHome1.png'
// import { AiFillEye, AiFillEyeInvisible } from 'react-icons/ai'; // Add icons for visibility toggle
// import ImageLogin1 from '../assets/ImageLogin1.png'
// import ImageLogin2 from '../assets/ImageLogin2.png'
// import ImageLogin3 from '../assets/ImageLogin3.png'
// import ImageLogin4 from '../assets/ImageLogin4.png'

// const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

// const Login = ({ onChange, value }) => {
//   const [username, setUsername] = useState('');
//   const [password, setPassword] = useState('');
//   const [token, setToken] = useState('');
//   const [isPasswordVisible, setIsPasswordVisible] = useState(false); // State to toggle password visibility
//   const [errorMessage, setErrorMessage] = useState('');

//   const togglePasswordVisibility = () => {
//     setIsPasswordVisible((prev) => !prev);
//   };
  
//   const navigate = useNavigate();

//   const handleLogin = async (e) => {
//     e.preventDefault();

//     // Clear previous error messages
//     setErrorMessage('');

//     try {
//       const response = await axios.post(`${apiBaseUrl}/api/auth/login`, { username, password });
//       const token = response.data.token;
//       setToken(token);

//       sessionStorage.setItem("userInfo", response.data.userId);
//       localStorage.setItem('token', token);
//       navigate('/editUrl');
//     } catch (error) {
//       const message = error.response?.data?.message || 'An unexpected error occurred.';
//       // alert(message);
//       //Handle network and timeout errors
//       if (error.message === 'Network Error') {
//         setErrorMessage('Network error. Please check your internet connection or server status');
//       }
//      // Handle timeout errors
//       else  if (error.code === 'ECONNABORTED') {
//         setErrorMessage('Request timed out. Please try again.');
//       }
//       // Handle server errors or other errors with response data
//       else if (error.response) {
//         const message = error.response?.data?.message || 'An unexpected error occurred.';
//         setErrorMessage(message);
//       } else {
//         setErrorMessage('An unknown error occurred.');
//       }
//     }
//   };

//   return (
//     <div>
//       <div
//         style={{
//           backgroundImage: `url(${Background})`,
//           backgroundSize: 'cover',
//           backgroundPosition: 'center',
//           position: 'fixed',
//           width: '1289.5px',
//           height: '800px',
//           zIndex: -1,
//         }}
//       />
//       <div className="justify-items-center">
//         <img src={logo_gen} alt="Welspun Logo" className="w-[250px] pt-5" />
//       </div>

//       <div className="flex justify-center items-center">
//         {/* Full-Screen Content Section */}
//         <div className="flex flex-col justify-center items-start w-full max-w-2xl p-10 mt-16">
//           <h2 className="mb-4 text-left" style={{ fontFamily: 'poppins', fontSize: '52px', lineHeight: '62px', fontWeight: '700', color: '#FFFFFF' }}>
//             Login In To <br /> Your Account
//           </h2>
//           <p className="mb-6 text-left" style={{ fontWeight: 'lighter', fontSize: '16px', lineHeight: '24px', color: '#A7A6F1' }}>
//             Enter your email and password to <br /> access your account
//           </p>
//           <div className="relative">
//             <img src={ArrowLine} alt="Arrow Line" style={{ width: '339.59px', height: '120.56px', marginLeft: '100px' }} />
//             <img src={ArrowHead} alt="Arrow Head" className="absolute right-0" style={{ width: '36px', height: '33.43px', top: '58%', transform: 'translateY(-50%)', marginRight: '-30px' }} />
//           </div>
//         </div>

//         {/* Right Side - Login Form */}
//         <div className="flex justify-center items-center w-full max-w-md p-10 bg-white border border-1 rounded-2xl mt-10">
//           <div className="login-form">
//             <div className="relative z-10">
//               {/* Form */}
//               <form onSubmit={handleLogin} className="space-y-6">
//                 <input
//                   type="text"
//                   placeholder="Enter Your Username"
//                   className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 ease-in-out"
//                   onChange={(e) => setUsername(e.target.value)}
//                   required
//                 />
//                 <input
//                   type="password"
//                   id="password"
//                   aria-label="Password"
//                   placeholder="Enter Your Password"
//                   className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 ease-in-out"
//                   onChange={(e) => setPassword(e.target.value)}
//                   required
//                 />
//     {/* <div className="relative w-full">
//       <input
//         type={isPasswordVisible ? 'text' : 'password'} // Toggle input type
//         placeholder="Enter Your Password"
//         className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 ease-in-out"
//         onChange={onChange}
//         value={value}
//         required
//       />
//       <span
//         onClick={togglePasswordVisibility} // Toggle visibility on click
//         className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-500"
//         style={{ zIndex: 10 }} // Ensure icon is on top of other elements
//       >
//         {isPasswordVisible ? <AiFillEyeInvisible size={20} /> : <AiFillEye size={20} />}
//       </span>
//     </div> */}

//                 <button
//                   type="submit"
//                   className="w-full py-3 text-white"
//                   style={{ backgroundColor: '#504EE2', borderRadius: '50px', fontFamily: 'poppins', fontSize: '16px' }}
//                 >
//                   Login
//                 </button>
//               </form>

//               {/* Show error message if available */}
//               {errorMessage && (
//                 <div className="text-red-500 mt-4 text-center">{errorMessage}</div>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="fixed bottom-0 left-[20%] flex space-x-4 z-0">
//         {/* Fixed background images */}
//       </div>
//     </div>
//   );
// };

// export default Login;


import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import logo_gen from '../assets/logo_GEN.png';
import ArrowLine from '../assets/arrow-line.png';
import ArrowHead from '../assets/arrow-head.png';
import Background from '../assets/BgHome1.png';
import { AiFillEye, AiFillEyeInvisible } from 'react-icons/ai';
import { jwtDecode } from 'jwt-decode';
import Swal from 'sweetalert2';

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const togglePasswordVisibility = () => {
    setIsPasswordVisible((prev) => !prev);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
  
    try {
      const response = await axios.post(`${apiBaseUrl}/api/auth/login`, { username, password });
  
      const token = response.data.token;
      localStorage.setItem('token', token);
      sessionStorage.setItem("userInfo", response.data.userId);
  
      const decoded = jwtDecode(token);      const currentTime = Date.now();
      const expiryTime = decoded.exp * 1000; // convert to ms
  
      const timeUntilExpiry = expiryTime - currentTime;
  
      // TEMPORARY override for testing:
      // const timeUntilExpiry = 10000; // 10 seconds
      // console.log(`Token will expire in ${timeUntilExpiry / 1000} seconds`);
      
      // Set timeout to logout user automatically when token expires
      setTimeout(() => {
        localStorage.removeItem('token');
        sessionStorage.clear();
        Swal.fire({
          title: 'Session Expired',
          text: 'Your session has expired. Please log in again.',
          icon: 'warning',
          confirmButtonText: 'OK'
        }).then(() => {
          window.location.href = '/login';
        });
      }, timeUntilExpiry);
  
      navigate('/editUrl');
    } catch (error) {
      if (error.message === 'Network Error') {
        setErrorMessage('Network error. Please check your internet connection or server status');
      } else if (error.code === 'ECONNABORTED') {
        setErrorMessage('Request timed out. Please try again.');
      } else {
        setErrorMessage(error.response?.data?.message || 'An unknown error occurred.');
      }
    }
  };
  

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cover bg-center p-4 sm:p-6 md:p-8 lg:p-10"
      style={{ backgroundImage: `url(${Background})` }}>
      <img src={logo_gen} alt="Welspun Logo" className="w-48 sm:w-56 md:w-64 lg:w-72 mb-6" />

      <div className="flex flex-col md:flex-row items-center justify-center w-full max-w-5xl">
        <div className="hidden md:flex flex-col justify-center items-start w-full md:w-1/2 p-4 md:p-10">
          <h2 className="text-white text-3xl md:text-4xl lg:text-5xl font-bold mb-4">Login To Your Account</h2>
          <p className="text-gray-300 text-sm md:text-base lg:text-lg mb-6">Enter your email and password to access your account</p>
          <div className="relative">
            <img src={ArrowLine} alt="Arrow Line" className="w-56 md:w-72 lg:w-80" />
            <img src={ArrowHead} alt="Arrow Head" className="absolute left-[320px] top-1/2 transform -translate-y-1/2 w-6 md:w-8 lg:w-10" />
          </div>
        </div>

        <div className="w-full md:w-1/2 flex justify-center">
          <div className="bg-white p-6 md:p-8 lg:p-10 rounded-2xl shadow-md w-full max-w-md">
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="text"
                placeholder="Enter Your Username"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <div className="relative w-full">
                <input
                  type={isPasswordVisible ? 'text' : 'password'}
                  placeholder="Enter Your Password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                {/* This <span> wraps the eye icon, acting like a clickable button */}
                
                {/* <span
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-500"
                >
                  {isPasswordVisible ? <AiFillEyeInvisible size={20} /> : <AiFillEye size={20} />}
                </span> */}
              </div>
              <button
                type="submit"
                className="w-full py-3 text-white bg-[#504EE2] rounded-full text-lg font-semibold hover:bg-blue-600 transition"
              >
                Login
              </button>
            </form>
            {errorMessage && <div className="text-red-500 mt-4 text-center">{errorMessage}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
