import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { jwtDecode } from 'jwt-decode';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/admin') {
      if (!token) {
        Swal.fire({
          title: 'Access Denied',
          text: 'You must be logged in to access this page.',
          icon: 'error',
          confirmButtonText: 'OK',
        }).then(() => {
          localStorage.removeItem('token');
          navigate('/login', { replace: true });
        });
      } else {
        try {
          const decoded = jwtDecode(token);
          if (decoded.isAdmin !== true) {
            Swal.fire({
              title: 'Access Denied',
              text: 'Only admins can access this page.',
              icon: 'error',
              confirmButtonText: 'OK',
            }).then(() => {
              localStorage.removeItem('token');
              navigate('/login', { replace: true });
            });
          }
        } catch (error) {
          console.error('Invalid token:', error);
          Swal.fire({
            title: 'Access Denied',
            text: 'Invalid or expired token. Please log in again.',
            icon: 'error',
            confirmButtonText: 'OK',
          }).then(() => {
            localStorage.removeItem('token');
            navigate('/login', { replace: true });
          });
        }
      }
    }
  }, [token, location.pathname, navigate]);

  if (location.pathname !== '/admin') {
    return children;
  }

  if (!token) {
    return null;
  }

  try {
    const decoded = jwtDecode(token);
    if (decoded.isAdmin !== true) {
      return null;
    }
    return children;
  } catch (error) {
    return null;
  }
};

export default ProtectedRoute;