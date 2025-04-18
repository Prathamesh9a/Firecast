import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { FaRegTrashAlt } from 'react-icons/fa';
import { AiOutlineArrowUp, AiOutlineArrowDown } from 'react-icons/ai';
import { IoTimeOutline } from "react-icons/io5";
import { FaFileArrowUp } from "react-icons/fa6";
import gif1 from '../assets/link.gif'
import gif2 from '../assets/image.gif'
import gif3 from '../assets/video-lecture.gif'
import backgroundImg from '../assets/backgroundImg.png'; // Import your background image
import { FiPlusCircle } from "react-icons/fi";

const Home1 = () => {
  const [links, setLinks] = useState([{ link: '', time: 60, file: null }]);
  const [previewUrl, setPreviewUrl] = useState('');
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const WelcomeValid = async () => {

    let token = localStorage.getItem("token");
    const res = await fetch("http://localhost:5000/api/auth/validuser", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      }
    });

    const data = await res.json();
    if (data.status === 401 || !data) {
      navigate("/")
    }
  };

  useEffect(() => {
    WelcomeValid();
  }, []);

  const addNewLink = () => {
    setLinks([...links, { link: '', time: 60, file: null }]);
  };

  const deleteLink = (index) => {
    const newLinks = [...links];
    newLinks.splice(index, 1);
    setLinks(newLinks);
  };

  const handleInputChange = (index, event) => {
    const newLinks = [...links];
    const file = event.target.files ? event.target.files[0] : null;
    if (file) {
      newLinks[index].link = URL.createObjectURL(file);
      newLinks[index].file = file;
    } else {
      newLinks[index].link = event.target.value;
      newLinks[index].file = null;
    }
    setLinks(newLinks);
  };

  const handleTimeChange = (index, value) => {
    const newLinks = [...links];
    newLinks[index].time = value;
    setLinks(newLinks);
  };

  const handleCreateUrl = async () => {
    const formData = new FormData();
    const token = localStorage.getItem('token');
    let userId;
    if (token) {
      const decodedToken = jwtDecode(token);
      userId = decodedToken.userId;
    }
    links.forEach((linkItem, index) => {
      formData.append(`links[${index}][link]`, linkItem.link);
      formData.append(`links[${index}][time]`, linkItem.time);
      formData.append(`userId`, userId);
      if (linkItem.file) {
        formData.append(`links[${index}][file]`, linkItem.file);
      }
    });

    try {
      const response = await axios.post('http://localhost:5000/api/upload/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          "Authorization": token
        },
      });
      alert('URLs and files created successfully');
      setPreviewUrl(response.data.previewUrl);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); // Scroll to the bottom
    } catch (error) {
      console.error('Error creating URLs:', error);
      alert('Failed to create URLs');
    }
  };

  const moveLinkUp = (index) => {
    if (index === 0) return;
    const newLinks = [...links];
    [newLinks[index], newLinks[index - 1]] = [newLinks[index - 1], newLinks[index]];
    setLinks(newLinks);
  };

  const moveLinkDown = (index) => {
    if (index === links.length - 1) return;
    const newLinks = [...links];
    [newLinks[index], newLinks[index + 1]] = [newLinks[index + 1], newLinks[index]];
    setLinks(newLinks);
  };

  const handleCopy = () => {
    console.log("Handle Copy");

    if (previewUrl) {
      navigator.clipboard.writeText(previewUrl)
        .then(() => {
          alert('URL copied to clipboard!');
        })
        .catch((err) => {
          console.error('Failed to copy URL: ', err);
        });
    }
  };

  const items = [
    {
      gif: gif1,
      text: 'Embedded Links'
    },
    {
      gif: gif2,
      text: 'Image Links'
    },
    {
      gif: gif3,
      text: 'Embedded Video Links or Files'
    }
  ];

  return (
    <div className="grid grid-cols-10 gap-6 bg-gray-100 p-6">

      {/* //Note Section */}
      <div className='col-span-14 space-y-10'
        style={{
          width: '152px', // Set width for the outermost div
          height: '400px', // Set height for the outermost div
          marginLeft: '40%',
          margin: '20px auto',
          // paddingTop: '10px',
          borderRadius: '15px',
          border: '2px solid #ccc',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          backgroundColor: 'white',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between', // Align items vertically
          position: 'relative', // Make it relative to be above the background
          zIndex: 1, // Higher z-index to appear above background
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#333', marginTop: '20px', marginBottom: '20px' }}>
          You can add
        </h2>
        <div
          style={{
            // display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            marginBottom: '20px',
            // padding: '20px'
          }}
        >
          {items.map((item, index) => (
            <div
              key={index}
              style={{
                textAlign: 'center',
                width: '150px',
                position: 'bottom',
                // ...(index !== items.length - 1 && { borderRight: '1px solid #E1E1E1' }), // Add vertical line
                // paddingRight: '10px',
              }}
            >
              <img
                src={item.gif}
                alt={`GIF ${index + 1}`}
                style={{
                  width: '35%',
                  height: 'auto',
                  marginLeft: '45px'
                }}
              />
              <p
                style={{
                  marginTop: '10px',
                  fontSize: '15px',
                  color: '#6F7C8E',
                  lineHeight: '18.9px',
                  fontWeight: '400'
                }}
              >
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-8 space-y-10">
        <div className="bg-gray-100 min-h-screen p-6 justify-items-center" style={{ fontFamily: 'Outfit' }}>
          <h2 className="font-bold mb-5 mt-4 text-center text-gray-700" style={{ fontFamily: 'Outfit', fontSize: '32px', lineHeight: '40.32px', color: '#FF9F00' }}>Create New Screen</h2>
          <p className="mb-10" style={{ color: '#6F7C8E', fontFamily: 'Outfit', fontSize: '20px', lineHeight: '25.2px' }}>Upload file and create your new screen</p>
          {links.map((linkItem, index) => (
            <div key={index} className="flex items-center w-100" style={{ width: '794px', height: '112px', position: 'relative', zIndex: 1 }}>
              <div className="mb-5 border border-gray-300 rounded-2xl bg-white " style={{ padding: '20px 23px', alignItems: 'center', display: 'flex' }}>
                <div className="flex-grow">
                  <div className="relative flex items-center" style={{ width: "495px", paddingRight: '20px' }}>
                    <button
                      type="button"
                      className="h-16 px-4 text-white rounded-l-lg flex items-center justify-center hover:bg-blue-700"
                      onClick={() => document.getElementById(`file-input-${index}`).click()}
                      style={{ height: '66px', backgroundColor: '#363736' }} // Adjust the height to match the input field
                    >
                      <FaFileArrowUp className="text-lg" style={{ paddingLeft: '6px' }} />
                      <p style={{ fontFamily: 'Outfit', paddingLeft: '6px', paddingRight: '6px' }}>Upload</p>
                    </button>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,video/*"
                      onChange={(e) => handleInputChange(index, e)}
                      id={`file-input-${index}`}
                    />
                    <input
                      type="text"
                      className="w-full p-3 text-sm border border-gray-300 border-dashed rounded-r-lg placeholder-gray-500"
                      style={{
                        height: '66px', // Set height to match the button
                        backgroundColor: '#F7F7FF',
                        paddingLeft: '12px', // Adds padding for the placeholder
                        fontFamily: 'Outfit'
                      }}

                      placeholder="Embedded Link / Image / Video URL or Upload File"
                      value={linkItem.file ? '' : linkItem.link}
                      onChange={(e) => handleInputChange(index, e)}
                    />
                  </div>
                </div>

                <div className="items-center">
                  <p style={{ fontFamily: 'Outfit', fontWeight: '500', color: '#6F7C8E', lineHeight: '17.64px', marginBottom: '7px' }}>Enter Time</p>
                  <div className='time-input-group' style={{ position: 'relative' }}>
                    <IoTimeOutline style={{ position: 'absolute', top: '13px', left: '7px', color: '#6F7C8E' }} />
                    <div style={{
                      width: '1px',
                      height: '60%',
                      backgroundColor: '#E1E1E1',
                      marginRight: '8px',
                    }}></div>
                    <input
                      type="number"
                      className="w-16 p-2 border border-gray-300 rounded-md text-center"
                      value={linkItem.time}
                      onChange={(e) => handleTimeChange(index, e.target.value)}
                      placeholder="Time"
                      style={{ width: '112px', paddingLeft: '28px', paddingRight: '35px' }}
                    />
                    <span className="time" style={{ position: 'absolute', top: '0', width: 'auto', right: '0', background: 'black', height: '100%', borderRadius: '0px 5px 5px 0px', textAlign: 'center', lineHeight: '40px', color: 'white', fontSize: '14px', paddingRight: '6px', paddingLeft: '6px' }}>Sec</span>
                  </div>
                </div>
              </div>
              <div className='mb-5 border border-gray-300 rounded-2xl bg-white' style={{ padding: '20px 23px', alignItems: 'center', marginLeft: '20px', height: '108px' }}>
                <div className="flex items-center ">
                  <button
                    onClick={addNewLink}
                    className="p-2 bg-700 text-white rounded-xl"
                    style={{ display: 'flex', width: '107px', height: '45px', fontSize: '18px', justifyContent: 'center', marginTop: '10px', backgroundColor: '#348824', marginRight: '10px' }}
                  >
                    <FiPlusCircle style={{ width: '18px', height: '18px', marginRight: '5px', marginTop: '4px' }} />
                    Add
                  </button>
                  {links.length > 1 && (
                    <>
                      <button
                        onClick={() => moveLinkUp(index)}
                        style={{ background: '#F1F1F1', width: '45px', height: '45px', border: '1px solid', borderRadius: '10px 0px 0px 10px', marginTop: '10px', borderColor: "#E1E1E1", justifyItems: 'center' }}
                        disabled={index === 0}
                      >
                        <AiOutlineArrowUp style={{}} />
                      </button>
                      <button
                        onClick={() => moveLinkDown(index)}
                        style={{ background: '#FFFFFF', width: '45px', height: '45px', border: '1px solid', borderRadius: '0px 10px 10px 0px', marginTop: '10px', borderColor: "#E1E1E1", marginRight: '10px', justifyItems: 'center' }}
                        disabled={index === links.length - 1}
                      >
                        <AiOutlineArrowDown />
                      </button>
                      <button
                        onClick={() => deleteLink(index)}
                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                        style={{ width: '45px', height: '41px', border: '1px solid', borderRadius: '10px', marginTop: '10px', marginRight: '10px', justifyItems: 'center' }}
                      >
                        <FaRegTrashAlt />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {linkItem.file && (
                <p className="text-green-500 ml-2 text-sm">
                  Selected file: {linkItem.file.name}
                </p>
              )}
            </div>
          ))}
          <div>
            <button
              className="w-full py-3 text-white font-semibold rounded-lg"
              style={{ width: '168px', height: '48px', backgroundColor: '#363736', marginTop: '20px', marginBottom: '60px', position: 'relative', zIndex: 1 }}
              onClick={handleCreateUrl}
            >
              Create URL
            </button>
          </div>
          {previewUrl && (
            <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded-lg shadow-inner relative z-10">
              <p className="text-lg font-semibold">Generated URL</p>
              <div className="flex items-center space-x-2 z-40">
                <p>{previewUrl}</p>
                <button
                  onClick={handleCopy}
                  className="px-2 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded hover:bg-blue-200"
                >
                  Copy URL
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Background image */}
      <div
        style={{
          backgroundImage: `url(${backgroundImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'absolute', // Fixed positioning for the background image
          bottom: 0,
          left: 0,
          width: '100%',
          height: '295px',
          zIndex: -1, // Ensure the background stays behind all content
        }}
      />



      {/* Placeholder element at the bottom to scroll to */}
      <div ref={bottomRef} style={{ paddingBottom: '20px' }}></div>
    </div>
  );
};

export default Home1;