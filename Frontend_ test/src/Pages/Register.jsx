
// import React, { useState } from 'react';
// import axios from 'axios';

// const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

// const Register = () => {
//   const [username, setUsername] = useState('');
//   const [password, setPassword] = useState('');
//   const [errors, setErrors] = useState({});

//   const validateForm = () => {
//     let formErrors = {};

//     if (!username) {
//       formErrors.username = 'Username is required';
//     }

//     // Password validation: at least 6 characters, should include numbers and letters
//     if (!password) {
//       formErrors.password = 'Password is required';
//     } else if (password.length < 6) {
//       formErrors.password = 'Password must be at least 6 characters';
//     } else if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
//       formErrors.password = 'Password must contain both letters and numbers';
//     }

//     setErrors(formErrors);
//     return Object.keys(formErrors).length === 0;
//   };

//   const handleRegister = async (e) => {
//     e.preventDefault();
//     if (!validateForm()) return;

//     try {
//       const response = await axios.post(  `${apiBaseUrl}/api/auth/register`, { username, password });
//       alert('User registered successfully');
//       console.log('Registration response:', response.data); // Log the response
//     } catch (error) {
//       console.error('Registration error:', error); // More detailed error logging
//       alert('Registration failed');
//     }
//   };

//   return (
//     <div className="flex justify-center items-center min-h-screen bg-gray-100">
//       <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full animate-fadeIn transform transition duration-700 ease-in-out">
//         <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Register</h2>
//         <form onSubmit={handleRegister}>
//           <div className="mb-4">
//             <input
//               type="text"
//               placeholder="Username"
//               value={username}
//               className={`w-full p-3 border ${errors.username ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ease-in-out`}
//               onChange={(e) => setUsername(e.target.value)}
//               required
//             />
//             {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
//           </div>

//           <div className="mb-4">
//             <input
//               type="password"
//               placeholder="Password"
//               value={password}
//               className={`w-full p-3 border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ease-in-out`}
//               onChange={(e) => setPassword(e.target.value)}
//               required
//             />
//             {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
//           </div>

//           <button
//             type="submit"
//             className="w-full p-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 focus:bg-blue-700 active:scale-95 transition-transform duration-200 ease-in-out"
//           >
//             Register
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// };

// export default Register;

import React, { useState } from 'react';
import axios from 'axios';

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accountName, setAccountName] = useState('');
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    let formErrors = {};

    if (!username) {
      formErrors.username = 'Username is required';
    }

    if (!accountName) {
      formErrors.accountName = 'Account name is required';
    }

    // Password validation
    if (!password) {
      formErrors.password = 'Password is required';
    } else if (password.length < 6) {
      formErrors.password = 'Password must be at least 6 characters';
    } else if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      formErrors.password = 'Password must contain both letters and numbers';
    }

    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const response = await axios.post(`${apiBaseUrl}/api/auth/register`, {
        username,
        password,
        accountName,
      });

      alert('User registered successfully');
      console.log('Registration response:', response.data);

      // Reset form
      setUsername('');
      setPassword('');
      setAccountName('');
      setErrors({});
    } catch (error) {
      console.error('Registration error:', error?.response || error);
      alert(error?.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Register
        </h2>

        <form onSubmit={handleRegister}>
          {/* Username */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Username"
              value={username}
              className={`w-full p-3 border ${
                errors.username ? 'border-red-500' : 'border-gray-300'
              } rounded-lg`}
              onChange={(e) => setUsername(e.target.value)}
            />
            {errors.username && (
              <p className="text-red-500 text-sm mt-1">
                {errors.username}
              </p>
            )}
          </div>

          {/* Account Name */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Account Name"
              value={accountName}
              className={`w-full p-3 border ${
                errors.accountName ? 'border-red-500' : 'border-gray-300'
              } rounded-lg`}
              onChange={(e) => setAccountName(e.target.value)}
            />
            {errors.accountName && (
              <p className="text-red-500 text-sm mt-1">
                {errors.accountName}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="mb-4">
            <input
              type="password"
              placeholder="Password"
              value={password}
              className={`w-full p-3 border ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              } rounded-lg`}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">
                {errors.password}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full p-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600"
          >
            Register
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
