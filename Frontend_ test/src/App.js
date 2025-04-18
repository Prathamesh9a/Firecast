import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Register from './Pages/Register';
import Login from './Pages/Login';
import Home from './Pages/Home';
import AdminPage from './Pages/AdminPage';
import Preview from './Pages/Preview';
import Logout from './Pages/Logout';
import Home1 from './Pages/Home1';
import EditUrl from './Pages/EditUrl';
import ExistingURL from './Pages/ExistingURL';

function App() {
  return (
    <div className="App">
      <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<Home1 />} />
          <Route path="/editUrl" element={<ExistingURL />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/:url" element={<Preview />} />
        </Routes>
      </div>
    </Router>
    </div>
  );
}

export default App;

//8879541671
// import React, { useState } from 'react';
// import { BrowserRouter as Routes, Route, Link, useNavigate } from 'react-router-dom';
// import Register from './Pages/Register';
// import Login from './Pages/Login';
// import Home from './Pages/Home'; // Import the Home component
// import axios from 'axios';

// const App = () => {
//   const [token, setToken] = useState(null);
//   const navigate = useNavigate();

//   const handleLogout = async () => {
//     try {
//       // Optionally call logout endpoint here
//       await axios.post('http://localhost:5000/api/auth/logout', {}, {
//         headers: {
//           Authorization: `Bearer ${token}`, // Include the token if you want
//         },
//       });
//       setToken(null);
//       alert('Logout successful');
//       navigate('/login');
//     } catch (error) {
//       console.error('Logout error:', error);
//     }
//   };

//   return (
//     <div className="App">
//       <nav>
//         <Link to="/">Home</Link>
//         <Link to="/register">Register</Link>
//         <Link to="/login">Login</Link>
//         {token && <button onClick={handleLogout}>Logout</button>}
//       </nav>
//       <Routes>
//         <Route path="/" element={<Home />} />
//         <Route path="/register" element={<Register />} />
//         <Route path="/login" element={<Login setToken={setToken} />} />
//       </Routes>
//     </div>
//   );
// };

// export default App;
