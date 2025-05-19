import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { IoArrowBackCircleOutline } from "react-icons/io5";
import { FaRegTrashAlt } from 'react-icons/fa';
import { AiOutlineArrowUp, AiOutlineArrowDown } from 'react-icons/ai';
import { IoTimeOutline } from "react-icons/io5";
import { FaFileArrowUp } from "react-icons/fa6";
import { BiLayout } from 'react-icons/bi';
import gif1 from '../assets/link.gif';
import gif2 from '../assets/image.gif';
import gif3 from '../assets/video-lecture.gif';
import backgroundImg from '../assets/backgroundImg.png';
import { FiPlusCircle } from "react-icons/fi";
import Header from './Header';
import ContentScheduler from './ContentScheduler';
import './styles.css';
import Swal from 'sweetalert2';
import 'react-toastify/dist/ReactToastify.css';
import { v4 as uuidv4 } from 'uuid';
import './home.css';

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

const layoutOptions = [
  { id: 'single', name: 'Single View', cols: 1, rows: 1, itemCount: 1 },
  { id: '2x1', name: '2 Items Horizontal', cols: 2, rows: 1, itemCount: 2 },
  { id: '1x2', name: '2 Items Vertical', cols: 1, rows: 2, itemCount: 2 },
  { id: '2x2', name: '4 Items Grid', cols: 2, rows: 2, itemCount: 4 },
  { id: '3x1', name: '3 Items Horizontal', cols: 3, rows: 1, itemCount: 3 },
  { id: '1x3', name: '3 Items Vertical', cols: 1, rows: 3, itemCount: 3 },
];

const Home1 = () => {
  const [groups, setGroups] = useState([
    {
      id: uuidv4(),
      layout: 'single',
      time: '',
      schedule: {
        startTime: '',
        endTime: '',
        startDate: '',
        endDate: '',
        frequency: 'none',
        repeatInterval: 1,
        repeatUntil: '',
        weeklyDays: [],
        monthlyRule: '',
        displayMode: 'exclusive',
        priority: 'medium',
        timeWindows: [{ startTime: '', endTime: '' }]
      },
      items: [{
        link: '',
        file: null,
        analyzeWithAI: false,
      }],
    }
  ]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [urlName, setUrlName] = useState('');
  const [customTickerText, setCustomTickerText] = useState('');
  const [showPM, setShowPM] = useState(false);
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [schedulerModal, setSchedulerModal] = useState({ open: false, groupId: null });
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState(null);

  const toggleShowPM = () => setShowPM((prev) => !prev);

  const openSchedulerModal = (groupId) => {
    setSchedulerModal({ open: true, groupId });
  };

  const closeSchedulerModal = () => {
    setSchedulerModal({ open: false, groupId: null });
  };

  const toggleAnalyzeWithAI = (groupId, itemIndex) => {
    setGroups(groups.map(group => {
      if (group.id === groupId) {
        const newItems = [...group.items];
        newItems[itemIndex].analyzeWithAI = !newItems[itemIndex].analyzeWithAI;
        return { ...group, items: newItems };
      }
      return group;
    }));
  };

  const updateSchedule = (groupId, field, value) => {
    setGroups(groups.map(group => {
      if (group.id === groupId) {
        if (field === 'timeWindows') {
          return { ...group, schedule: { ...group.schedule, timeWindows: value } };
        } else {
          return { ...group, schedule: { ...group.schedule, [field]: value } };
        }
      }
      return group;
    }));
  };

  const openPreviewModal = () => {
    setIsPreviewModalOpen(true);
  };

  const closePreviewModal = () => {
    setIsPreviewModalOpen(false);
  };

  const openModal = () => setIsModalOpen(true);

  const closeModal = () => {
    window.location.reload();
  };

  const openLayoutModal = (groupId) => {
    setCurrentGroupId(groupId);
    setIsLayoutModalOpen(true);
  };

  const closeLayoutModal = () => {
    setIsLayoutModalOpen(false);
    setCurrentGroupId(null);
  };

  const selectLayout = (layoutId) => {
    if (currentGroupId) {
      const layout = layoutOptions.find(l => l.id === layoutId);
      const requiredItems = layout.itemCount;
      setGroups(groups.map(group => {
        if (group.id === currentGroupId) {
          let newItems = [...group.items];
          if (newItems.length < requiredItems) {
            const newItemTemplate = {
              link: '',
              file: null,
              analyzeWithAI: false,
            };
            while (newItems.length < requiredItems) {
              newItems.push({ ...newItemTemplate });
            }
          } else if (newItems.length > requiredItems) {
            newItems = newItems.slice(0, requiredItems);
          }
          return { ...group, layout: layoutId, items: newItems };
        }
        return group;
      }));
      closeLayoutModal();
    }
  };

  const handleManageUrl = () => {
    navigate('/editUrl');
  };

  const WelcomeValid = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`${apiBaseUrl}/api/auth/validuser`, {
        headers: { Authorization: token },
      });
      if (res.data.status === 401) {
        navigate("/");
      }
    } catch {
      navigate("/");
    }
  };

  useEffect(() => {
    WelcomeValid();
  }, []);

  const scrollableContainerRef = useRef(null);


  // const addNewGroup = () => {
  //   setGroups([...groups, {
  //     id: uuidv4(),
  //     layout: 'single',
  //     time: '',
  //     schedule: {
  //       startTime: '',
  //       endTime: '',
  //       startDate: '',
  //       endDate: '',
  //       frequency: 'none',
  //       repeatInterval: 1,
  //       repeatUntil: '',
  //       weeklyDays: [],
  //       monthlyRule: '',
  //       displayMode: 'exclusive',
  //       priority: 'medium',
  //       timeWindows: [{ startTime: '', endTime: '' }]
  //     },
  //     items: [{
  //       link: '',
  //       file: null,
  //       analyzeWithAI: false,
  //     }],
  //   }]);
  // };


  const addNewGroup = () => {
    setGroups(prevGroups => {
      const newGroups = [...prevGroups, {
        id: uuidv4(),
        layout: 'single',
        time: '',
        schedule: {
          startTime: '',
          endTime: '',
          startDate: '',
          endDate: '',
          frequency: 'none',
          repeatInterval: 1,
          repeatUntil: '',
          weeklyDays: [],
          monthlyRule: '',
          displayMode: 'exclusive',
          priority: 'medium',
          timeWindows: [{ startTime: '', endTime: '' }]
        },
        items: [{
          link: '',
          file: null,
          analyzeWithAI: false,
        }],
      }];
      return newGroups;
    });
  };


  useEffect(() => {
    if (scrollableContainerRef.current) {
      scrollableContainerRef.current.scrollTop = scrollableContainerRef.current.scrollHeight;
    }
  }, [groups]);

  const deleteGroup = (groupId) => {
    if (groups.length === 1) {
      alert("Cannot delete the last group.");
      return;
    }
    setGroups(groups.filter(group => group.id !== groupId));
  };

  const moveGroupUp = (index) => {
    if (index === 0) return;
    const newGroups = [...groups];
    [newGroups[index], newGroups[index - 1]] = [newGroups[index - 1], newGroups[index]];
    setGroups(newGroups);
  };

  const moveGroupDown = (index) => {
    if (index === groups.length - 1) return;
    const newGroups = [...groups];
    [newGroups[index], newGroups[index + 1]] = [newGroups[index + 1], newGroups[index]];
    setGroups(newGroups);
  };

  const handleInputChange = (groupId, itemIndex, event) => {
    const selectedFiles = Array.from(event.target.files);
    const file = selectedFiles[0];
    if (!file) {
      console.log('No file selected'); // CHANGE: Added debug log
      return;
    }

    console.log('File:', { // CHANGE: Added debug log for file details
      name: file.name,
      type: file.type,
      size: file.size,
      extension: file.name.split('.').pop().toLowerCase(),
    });

    const allowedMimeTypes = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/svg+xml",
      "video/mp4", "video/x-matroska",
      "video/mpeg", // CHANGE: Added video/mpeg for broader MP4 support
      "application/pdf", "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain" // CHANGE: Added text/plain for .txt files
    ];


    const allowedExtensions = [
      "mp4", "webm", "ogg", "mov", "avi", "mkv",
      "jpeg", "jpg", "png", "gif", "svg",
      "pdf", "ppt", "pptx", "doc", "docx", "txt"
    ];
    const maxFileSize = 524288000; // 500MB

    const fileExtension = file.name.split('.').pop().toLowerCase();
    const isValidMime = allowedMimeTypes.includes(file.type);
    const isValidExtension = allowedExtensions.includes(fileExtension);
    const isValidSize = file.size <= maxFileSize;

    if (!isValidMime) {
      Swal.fire({ // CHANGE: Replaced alert with Swal for better UX
        title: 'Error',
        text: `Unsupported file type: ${file.type}`,
        icon: 'error',
        confirmButtonText: 'OK',
      });
      return;
    }
    if (!isValidExtension) {
      Swal.fire({
        title: 'Error',
        text: `Unsupported file extension: .${fileExtension}`,
        icon: 'error',
        confirmButtonText: 'OK',
      });
      return;
    }
    if (!isValidSize) {
      Swal.fire({
        title: 'Error',
        text: `File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        icon: 'error',
        confirmButtonText: 'OK',
      });
      return;
    }

    const url = URL.createObjectURL(file);
    setGroups(prevGroups => { // CHANGE: Used functional update for state
      const updatedGroups = prevGroups.map(group => {
        if (group.id === groupId) {
          const newItems = [...group.items];
          newItems[itemIndex] = {
            ...newItems[itemIndex],
            link: url,
            file: file,
          };
          if (file.type.startsWith("video/")) {
            const video = document.createElement("video");
            video.src = url;
            video.onloadedmetadata = () => {
              const durationInSeconds = Math.floor(video.duration);
              setGroups(groups =>
                groups.map(g =>
                  g.id === groupId ? { ...g, time: durationInSeconds } : g
                )
              );
            };
          }
          return { ...group, items: newItems };
        }
        return group;
      });
      console.log('Updated groups:', updatedGroups); // CHANGE: Added debug log for state
      return updatedGroups;
    });

    event.target.value = null;
  };

  const handleTimeChange = (groupId, value) => {
    setGroups(groups.map(group => {
      if (group.id === groupId) {
        return { ...group, time: value };
      }
      return group;
    }));
  };

  const handleFileDrop = (groupId, itemIndex, droppedFiles) => {
    const file = droppedFiles[0];
    if (!file) {
      console.log('No file dropped'); // CHANGE: Added debug log
      return;
    }

    console.log('Dropped file:', { // CHANGE: Added debug log for file details
      name: file.name,
      type: file.type,
      size: file.size,
      extension: file.name.split('.').pop().toLowerCase(),
    });

    const allowedMimeTypes = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/svg+xml",
      "video/mp4", "video/x-matroska",
      "video/mpeg", // CHANGE: Added video/mpeg
      "application/pdf", "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ];

    const allowedExtensions = [
      "mp4", "webm", "ogg", "mov", "avi", "mkv",
      "jpeg", "jpg", "png", "gif", "svg",
      "pdf", "ppt", "pptx", "doc", "docx", "txt"
    ];
    const maxFileSize = 524288000;

    const fileExtension = file.name.split('.').pop().toLowerCase();
    const isValidMime = allowedMimeTypes.includes(file.type);
    const isValidExtension = allowedExtensions.includes(fileExtension);
    const isValidSize = file.size <= maxFileSize;

    if (!isValidMime) {
      Swal.fire({ // CHANGE: Replaced alert with Swal
        title: 'Error',
        text: `Unsupported file type: ${file.type}`,
        icon: 'error',
        confirmButtonText: 'OK',
      });
      return;
    }
    if (!isValidExtension) {
      Swal.fire({
        title: 'Error',
        text: `Unsupported file extension: .${fileExtension}`,
        icon: 'error',
        confirmButtonText: 'OK',
      });
      return;
    }
    if (!isValidSize) {
      Swal.fire({
        title: 'Error',
        text: `File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        icon: 'error',
        confirmButtonText: 'OK',
      });
      return;
    }

    const url = URL.createObjectURL(file);
    setGroups(prevGroups => { // CHANGE: Used functional update
      const updatedGroups = prevGroups.map(group => {
        if (group.id === groupId) {
          const newItems = [...group.items];
          newItems[itemIndex] = {
            ...newItems[itemIndex],
            link: url,
            file: file,
          };
          if (file.type.startsWith("video/")) {
            const video = document.createElement("video");
            video.src = url;
            video.onloadedmetadata = () => {
              const durationInSeconds = Math.floor(video.duration);
              setGroups(groups =>
                groups.map(g =>
                  g.id === groupId ? { ...g, time: durationInSeconds } : g
                )
              );
            };
          }
          return { ...group, items: newItems };
        }
        return group;
      });
      console.log('Updated groups (drop):', updatedGroups); // CHANGE: Added debug log
      return updatedGroups;
    });
  };

  const handleCreateUrl = async () => {
    const formData = new FormData();
    const token = localStorage.getItem('token');
    let userId;
    if (token) {
      const decodedToken = jwtDecode(token);
      userId = decodedToken.userId;
    }

    if (!urlName.trim()) {
      Swal.fire({
        title: 'Oops!',
        text: 'Please provide a URL Name.',
        icon: 'warning',
        confirmButtonText: 'OK',
      });
      setTimeout(() => Swal.close(), 2500);
      return;
    }

    const links = groups.flatMap(group => group.items.map(item => ({
      ...item,
      layout: group.layout,
      time: group.time,
      schedule: group.schedule,
    })));

    for (const [index, linkItem] of links.entries()) {
      if (!linkItem.link && !linkItem.file) {
        Swal.fire({ // CHANGE: Replaced alert with Swal
          title: 'Error',
          text: `Please fill all the details for item ${index + 1}.`,
          icon: 'error',
          confirmButtonText: 'OK',
        });
        return;
      }

      if (linkItem.file) {
        const allowedTypes = [
          "image/jpeg", "image/jpg", "image/png", "image/gif", "image/svg+xml",
          "video/mp4", "video/x-msvideo",
          "video/mpeg", // CHANGE: Added video/mpeg
          "application/pdf", "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain" // CHANGE: Added text/plain for .txt files
        ];
        if (!allowedTypes.includes(linkItem.file.type)) {
          Swal.fire({ // CHANGE: Replaced alert with Swal
            title: 'Error',
            text: `Unsupported file type: ${linkItem.file.type}. Allowed types are JPEG, PNG, GIF, SVG, MP4, WEBM, OGG, MOV, AVI, MKV, MPEG, PDF, PPT, PPTX, DOC, DOCX, txt`,
            icon: 'error',
            confirmButtonText: 'OK',
          });
          return;
        }
        if (linkItem.file.size > 524288000) {
          Swal.fire({ // CHANGE: Replaced alert with Swal
            title: 'Error',
            text: `File size exceeds the limit of 500MB: ${linkItem.file.name}. Please upload a smaller file.`,
            icon: 'error',
            confirmButtonText: 'OK',
          });
          return;
        }
      }
    }

    formData.append('Url_Name', urlName);
    formData.append('custom_ticker', showPM ? customTickerText : '');
    formData.append('userId', userId);

    links.forEach((linkItem, index) => {
      formData.append(`links[${index}][link]`, linkItem.link);
      formData.append(`links[${index}][time]`, linkItem.time);
      formData.append(`links[${index}][analyzeWithAI]`, linkItem.analyzeWithAI);
      formData.append(`links[${index}][layout]`, linkItem.layout);
      formData.append(`links[${index}][schedule][startDate]`, linkItem.schedule.startDate);
      formData.append(`links[${index}][schedule][endDate]`, linkItem.schedule.endDate);
      formData.append(`links[${index}][schedule][frequency]`, linkItem.schedule.frequency);
      formData.append(`links[${index}][schedule][repeatInterval]`, linkItem.schedule.repeatInterval);
      formData.append(`links[${index}][schedule][repeatUntil]`, linkItem.schedule.repeatUntil);
      formData.append(`links[${index}][schedule][weeklyDays]`, JSON.stringify(linkItem.schedule.weeklyDays));
      formData.append(`links[${index}][schedule][monthlyRule]`, linkItem.schedule.monthlyRule);
      formData.append(`links[${index}][schedule][displayMode]`, linkItem.schedule.displayMode);
      formData.append(`links[${index}][schedule][priority]`, linkItem.schedule.priority);
      if (linkItem.schedule.timeWindows) {
        linkItem.schedule.timeWindows.forEach((tw, twIndex) => {
          formData.append(`links[${index}][schedule][timeWindows][${twIndex}][startTime]`, tw.startTime);
          formData.append(`links[${index}][schedule][timeWindows][${twIndex}][endTime]`, tw.endTime);
        });
      }
      if (linkItem.file) {
        formData.append(`links[${index}][file]`, linkItem.file);
        formData.append(`links[${index}][fileName]`, linkItem.file.name);
      }
    });

    console.log('FormData:', Array.from(formData.entries())); // CHANGE: Added debug log for FormData

    setLoading(true);

    try {
      const response = await axios.post(`${apiBaseUrl}/api/upload/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          "Authorization": token,
        },
      });
      setPreviewUrl(response.data.previewUrl);
      openModal();
      setLoading(false);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Error creating URLs:', error);
      setLoading(false);
      if (error.response?.data?.message === 'You have reached the maximum allowed URLs. Please Contact Admin Or delete an existing URL to create a new one.') {
        Swal.fire({
          title: 'Maximum URLs Reached',
          text: 'You have reached the maximum allowed URLs. Please Contact Admin Or delete an existing URL to create a new one.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'OK',
          cancelButtonText: 'Manage URL',
          reverseButtons: true,
          customClass: {
            cancelButton: 'bg-red-500 text-white border-none',
            confirmButton: 'bg-gray-500 text-white',
          },
        }).then((result) => {
          if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
            navigate('/editUrl');
          }
        });
      } else {
        Swal.fire({
          title: 'Error!',
          text: error.response?.data?.message || 'Failed to create URLs. Please try again.',
          icon: 'error',
          confirmButtonText: 'Try Again',
        });
      }
    }
  };

  const handlePreview = () => {
    if (previewUrl) {
      navigate(`/preview/5`);
    }
  };

  const handleLinkPreview = (content) => {
    if (content) {
      window.open(content, "_blank");
    } else {
      alert("No content to preview");
    }
  };

  const handleBack = () => {
    navigate(`/editUrl`);
  };

  const handleCopy = () => {
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

  const renderLayoutPreview = (layoutId, isSelected = false) => {
    const layout = layoutOptions.find(l => l.id === layoutId);
    if (!layout) return null;
    const { cols, rows } = layout;
    return (
      <div className={`grid grid-cols-${cols} grid-rows-${rows} gap-1 w-full h-20 border ${isSelected ? 'border-blue-500' : 'border-gray-300'} rounded-md overflow-hidden`}>
        {Array(cols * rows).fill(0).map((_, i) => (
          <div key={i} className="bg-gray-200"></div>
        ))}
      </div>
    );
  };

  const getLayoutName = (layoutId) => {
    const layout = layoutOptions.find(l => l.id === layoutId);
    return layout ? layout.name : 'Single View';
  };

  const items = [
    { gif: gif1, text: 'Embedded Links' },
    { gif: gif2, text: 'Image Links' },
    { gif: gif3, text: 'Embedded Video Links or Files' }
  ];

  return (
    <>
      <Header />
      <div className="grid grid-cols-10 gap-2 bg-gray-100 p-2" style={{ overflow: 'hidden', height: '90vh' }}>
        {loading && (
          <div
            className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-gray-800 bg-opacity-75 z-[9999]"
            aria-live="polite"
            role="status"
          >
            <div className="flex flex-col items-center">
              <div className="loader"></div>
              <p className="mt-6 text-white text-lg">Loading, please wait...</p>
            </div>
          </div>
        )}

        <div className='col-span-14 space-y-10'
          style={{
            width: '152px',
            height: '400px',
            marginLeft: '40%',
            margin: '20px auto',
            borderRadius: '15px',
            border: '2px solid #ccc',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
            backgroundColor: 'white',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#333', marginTop: '20px', marginBottom: '20px' }}>
            You can add
          </h2>
          <div style={{ justifyContent: 'space-around', alignItems: 'center', marginBottom: '20px' }}>
            {items.map((item, index) => (
              <div
                key={index}
                style={{ textAlign: 'center', width: '150px', position: 'bottom' }}
              >
                <img
                  src={item.gif}
                  alt={`GIF ${index + 1}`}
                  style={{ width: '35%', height: 'auto', marginLeft: '45px' }}
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

        <div className="container col-span-8 space-y-10" style={{ height: '100%', overflow: 'hidden' }}>
        <div className="bg-gray-100 p-2 justify-items-center" style={{ height: '100%', overflow: 'hidden' }}>
        <div className="flex items-center justify-start mb-2">
              <IoArrowBackCircleOutline
                className="w-8 h-8 mr-6 cursor-pointer hover:text-gray-500 hover:scale-110 transition duration-200"
                onClick={handleBack}
              />
              <h2
                className="font-bold text-gray-700 text-center"
                style={{ fontFamily: 'Outfit', fontSize: '32px', lineHeight: '40.32px', color: '#FF9F00' }}
              >
                Create New Screen
              </h2>
            </div>
            <p className="" style={{ color: '#6F7C8E', fontFamily: 'Outfit', fontSize: '20px', lineHeight: '25.2px' }}>
              Upload file and create your new screen
            </p>
            <div className='flex flex-col p-2 bg-gray-100 rounded-lg'>
              <div className='flex items-center mb-1'>
                <input
                  type="text"
                  className="border-2 p-2 rounded-md bg-white w-full text-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ height: '45px', fontFamily: 'Outfit' }}
                  placeholder="Screen Name"
                  value={urlName}
                  onChange={(e) => setUrlName(e.target.value)}
                />
                <div className="flex flex-col justify-center items-center ml-4">
                  <div className="flex flex-row">
                    <span className="text-sm text-gray-700 whitespace-nowrap mr-2">Custom Ticker</span>
                  </div>
                  <button
                    onClick={toggleShowPM}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${showPM ? "bg-green-500" : "bg-gray-400"}`}
                    aria-label={`Toggle custom ticker ${showPM ? "off" : "on"}`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full transform transition-transform duration-300 ${showPM ? "translate-x-6" : ""}`}
                    ></div>
                  </button>
                </div>
              </div>
              {showPM && (
                <input
                  type="text"
                  className="border-2 p-2 rounded-md bg-white text-black font-medium text-base mt-1 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter custom ticker text"
                  value={customTickerText}
                  onChange={(e) => setCustomTickerText(e.target.value)}
                />
              )}
            </div>

            <div ref={scrollableContainerRef} className="scrollable-container w-full" style={{ maxHeight: '230px', overflowY: 'auto', width: '700px', position: 'relative', zIndex: 1 }}>


              {groups.map((group, groupIndex) => (
                <div
                  key={group.id}
                  className="mb-2 border border-gray-300 rounded-2xl bg-white py-2 px-2 mr-2 ml-5"
                >

                  <div className="flex flex-wrap items-end justify-between mb-2 gap-4">
                    <div className="flex items-center">
                      <button
                        onClick={() => openLayoutModal(group.id)}
                        className="flex items-center justify-center p-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 mr-4"
                        style={{ height: '40px', width: '100px' }}
                      >
                        <BiLayout className="mr-1" />
                        <span className="text-sm">{getLayoutName(group.layout)}</span>
                      </button>
                    </div>




                    <div className="flex items-center">
                      <button
                        onClick={addNewGroup}
                        className="p-1 bg-green-400 text-white rounded-lg mr-2"
                        style={{ width: '68px', height: '30px', fontSize: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#348824' }}
                      >
                        <FiPlusCircle style={{ width: '16px', height: '16px', marginRight: '5px', marginBottom: '2px' }} />
                        Add
                      </button>

                      {groups.length > 1 && (
                        <>
                          <button
                            onClick={() => moveGroupUp(groupIndex)}
                            style={{ background: '#F1F1F1', width: '31px', height: '31px', border: '1px solid', borderRadius: '10px 0px 0px 10px', borderColor: "#E1E1E1", justifyItems: 'center' }}
                            disabled={groupIndex === 0}
                          >
                            <AiOutlineArrowUp />
                          </button>
                          <button
                            onClick={() => moveGroupDown(groupIndex)}
                            style={{ background: '#FFFFFF', width: '31px', height: '31px', border: '1px solid', borderRadius: '0px 10px 10px 0px', borderColor: "#E1E1E1", marginRight: '10px', justifyItems: 'center' }}
                            disabled={groupIndex === groups.length - 1}
                          >
                            <AiOutlineArrowDown />
                          </button>
                          <button
                            onClick={() => deleteGroup(group.id)}
                            className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                            style={{ width: '36px', height: '33px', border: '1px solid', borderRadius: '10px', marginRight: '10px', justifyItems: 'center' }}
                          >
                            <FaRegTrashAlt />
                          </button>
                        </>
                      )}
                    </div>


                  </div>

                  {group.items.map((item, itemIndex) => (
                    // <div
                    //   key={itemIndex}
                    //   className="flex items-center"
                    //   style={{ borderBottom: itemIndex < group.items.length - 1 ? '1px solid #eee' : 'none', paddingBottom: itemIndex < group.items.length - 1 ? '10px' : '0' }}
                    // >
                    //   <div
                    //     key={itemIndex}
                    //     className="flex items-center gap-2"
                    //     style={{
                    //       borderBottom: itemIndex < group.items.length - 1 ? '1px solid #eee' : 'none',
                    //       paddingBottom: itemIndex < group.items.length - 1 ? '10px' : '0',
                    //     }}
                    //   >
                    //     {/* 📁 Upload Area */}
                    //     <div className="flex-grow">
                    //       <div
                    //         className="relative flex items-center border-gray-300 rounded-md"
                    //         style={{ width: "440px", paddingRight: '0px' }}
                    //         onDragOver={(e) => e.preventDefault()}
                    //         onDrop={(e) => {
                    //           e.preventDefault();
                    //           const droppedFiles = Array.from(e.dataTransfer.files);
                    //           handleFileDrop(group.id, itemIndex, droppedFiles);
                    //         }}
                    //       >
                    //         <button
                    //           type="button"
                    //           className="h-8 px-4 text-white rounded-l-lg flex items-center justify-center hover:bg-blue-700"
                    //           onClick={() => document.getElementById(`file-input-${group.id}-${itemIndex}`).click()}
                    //           style={{ backgroundColor: '#2d3748' }}
                    //         >
                    //           <FaFileArrowUp className="text-lg" style={{ paddingLeft: '6px' }} />
                    //           <p style={{ fontFamily: 'Outfit', paddingLeft: '6px', paddingRight: '6px' }}>Upload</p>
                    //         </button>
                    //         <input
                    //           type="file"
                    //           className="hidden"
                    //           onChange={(e) => handleInputChange(group.id, itemIndex, e)}
                    //           id={`file-input-${group.id}-${itemIndex}`}
                    //           accept="image/png,image/jpeg,image/gif,image/svg+xml,video/mp4,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    //         />
                    //         <input
                    //           type="text"
                    //           className="w-full p-1.5 text-sm border border-gray-300 border-dashed rounded-r-lg placeholder-gray-500"
                    //           style={{
                               
                    //             width: '70%',
                    //             backgroundColor: '#F7F7FF',
                    //             paddingLeft: '12px',
                    //             fontFamily: 'Outfit',
                    //             color: item.file ? 'green' : 'black',
                    //           }}
                    //           placeholder="Embedded Link / Image / Video or Upload File"
                    //           value={item.file ? item.file.name : item.link}
                    //           onChange={(e) => {
                    //             setGroups(groups.map(g => {
                    //               if (g.id === group.id) {
                    //                 const newItems = [...g.items];
                    //                 newItems[itemIndex].link = e.target.value;
                    //                 newItems[itemIndex].file = null;
                    //                 return { ...g, items: newItems };
                    //               }
                    //               return g;
                    //             }));
                    //           }}
                    //         />
                    //       </div>
                    //     </div>

                    //     {/* ⏰ Enter Time */}
                    //     <div className="flex flex-col">
                    //       <label className="text-xs text-gray-600 font-medium mb-1">Time (sec)</label>
                    //       <div className="relative">
                    //         <IoTimeOutline style={{ position: 'absolute', top: '8px', left: '7px', color: '#6F7C8E' }} />
                    //         <input
                    //           type="number"
                    //           value={group.time}
                    //           onChange={(e) => handleTimeChange(group.id, e.target.value)}
                    //           className="w-[112px] px-2 py-1 pl-6 pr-8 border border-gray-300 rounded-md text-center"
                    //           placeholder="00"
                    //         />
                    //         <span
                    //           className="absolute right-1 top-[3px] bg-black text-white text-xs rounded px-1 py-[6px]"
                    //         >
                    //           Sec
                    //         </span>
                    //       </div>
                    //     </div>

                    //     {/* 📅 Schedule Button */}
                    //     <div className="flex flex-col">
                    //       <label className="text-xs text-gray-600 font-medium mb-1">Schedule</label>
                    //       <button
                    //         onClick={() => openSchedulerModal(group.id)}
                    //         className={`p-2 bg-rose-600 text-white rounded-lg text-sm text-center leading-tight ${group.schedule?.startTime || group.schedule?.startDate ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-200 text-gray-700'}`}
                            
                    //       >
                    //         {group.schedule?.startTime || group.schedule?.startDate ? (
                    //           <>
                    //             Edit Schedule
                    //           </>
                    //         ) : (
                    //           <>
                    //             Add Schedule
                    //           </>
                    //         )}
                    //       </button>
                    //     </div>
                    //   </div>

                    //   {item.file?.type === 'application/pdf' && (
                    //     <div className="flex justify-center mt-2 ml-10">
                    //       <label className="flex flex-col items-center cursor-pointer text-center">
                    //         <input
                    //           type="checkbox"
                    //           className="sr-only peer"
                    //           checked={item.analyzeWithAI}
                    //           onChange={() => toggleAnalyzeWithAI(group.id, itemIndex)}
                    //         />
                    //         <div className="relative w-11 h-6 bg-gray-400 rounded-full peer-focus:outline-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    //         <span className="mt-2 text-sm font-medium text-black-700 leading-tight">
                    //           Summarize<br />with AI
                    //         </span>
                    //       </label>
                    //     </div>
                    //   )}
                    // </div>
                    <div
                    key={itemIndex}
                    className="flex items-start w-full gap-4"
                    style={{
                      borderBottom: itemIndex < group.items.length - 1 ? '1px solid #eee' : 'none',
                      paddingBottom: itemIndex < group.items.length - 1 ? '10px' : '0',
                    }}
                  >
                    {/* Upload Field */}
                    <div className="flex flex-col w-[440px]">
                      <label className="text-xs text-gray-600 font-medium mb-1">Upload</label>
                      <div
                        className="relative flex items-center border border-gray-300 rounded-md overflow-hidden"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const droppedFiles = Array.from(e.dataTransfer.files);
                          handleFileDrop(group.id, itemIndex, droppedFiles);
                        }}
                      >
                        <button
                          type="button"
                          className="h-8 px-4 text-white bg-gray-800 rounded-l-lg flex items-center justify-center hover:bg-blue-700"
                          onClick={() =>
                            document.getElementById(`file-input-${group.id}-${itemIndex}`).click()
                          }
                        >
                          <FaFileArrowUp className="text-lg" />
                          <span className="ml-2 font-outfit">Upload</span>
                        </button>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleInputChange(group.id, itemIndex, e)}
                          id={`file-input-${group.id}-${itemIndex}`}
                          accept="image/png,image/jpeg,image/gif,image/svg+xml,video/mp4,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        />
                        <input
                          type="text"
                          className="w-full p-1.5 text-sm border-l border-gray-300 bg-[#F7F7FF] font-outfit text-black"
                          placeholder="Embedded Link / Image / Video or Upload File"
                          value={item.file ? item.file.name : item.link}
                          onChange={(e) => {
                            setGroups(groups.map((g) => {
                              if (g.id === group.id) {
                                const newItems = [...g.items];
                                newItems[itemIndex].link = e.target.value;
                                newItems[itemIndex].file = null;
                                return { ...g, items: newItems };
                              }
                              return g;
                            }));
                          }}
                        />
                      </div>
                    </div>
                  
                    {/* Time Field */}
                    <div className="flex flex-col w-[120px]">
                      <label className="text-xs text-gray-600 font-medium mb-1">Time (sec)</label>
                      <div className="relative">
                        <IoTimeOutline className="absolute top-2 left-2 text-gray-500" />
                        <input
                          type="number"
                          value={group.time}
                          onChange={(e) => handleTimeChange(group.id, e.target.value)}
                          className="w-full px-2 py-1 pl-7 pr-8 border border-gray-300 rounded-md text-center"
                          placeholder="00"
                        />
                        <span className="absolute right-1 top-[3px] bg-black text-white text-xs rounded px-1 py-[6px]">
                          Sec
                        </span>
                      </div>
                    </div>
                  
                    {/* Schedule Field */}
                    <div className="flex flex-col w-[140px]">
                      <label className="text-xs text-gray-600 font-medium mb-1">Schedule</label>
                      <button
                        onClick={() => openSchedulerModal(group.id)}
                        className={`p-2 bg-rose-600 text-white rounded-lg text-sm text-center leading-tight ${group.schedule?.startTime || group.schedule?.startDate ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {group.schedule?.startTime || group.schedule?.startDate
                          ? 'Edit Schedule'
                          : 'Add Schedule'}
                      </button>
                    </div>
                  </div>
                  
                  ))}
                </div>
              ))}
            </div>
            <div>
              <button
                className="w-full py-3 mt-2 text-white font-semibold rounded-lg"
                style={{ width: '168px', height: '48px', backgroundColor: '  #2d3748', marginBottom: '60px', position: 'relative', zIndex: 1 }}
                onClick={openPreviewModal}
              >
                Create Screen
              </button>
            </div>
            {isPreviewModalOpen && (
              <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 flex justify-center items-center p-4">
                <div className="bg-white p-5 rounded-lg shadow-xl w-full max-w-md relative max-h-[80vh] overflow-y-auto">
                  <button
                    onClick={closePreviewModal}
                    className="absolute top-3 right-3 text-white bg-red-500 hover:bg-red-700 text-lg w-7 h-7 flex items-center justify-center rounded-full"
                  >
                    ×
                  </button>
                  <div className="z-50">
                    <p className="text-lg font-semibold mb-3 text-center">Preview Content</p>
                    <div className="space-y-3">
                      {groups.map((group, groupIndex) => (
                        <div key={group.id} className="border p-3 rounded-md">
                          <p className="text-sm font-medium mb-2">{getLayoutName(group.layout)}</p>
                          <div className={`grid grid-cols-${layoutOptions.find(l => l.id === group.layout).cols} gap-2`}>
                            {group.items.map((item, itemIndex) => {
                              console.log('Preview item:', item); // CHANGE: Added debug log for preview items
                              return (
                                <div key={itemIndex} className="border p-2 rounded-md">
                                  {item.file ? (
                                    item.file.type.startsWith("image/") ? (
                                      <img
                                        src={URL.createObjectURL(item.file)}
                                        alt="Preview"
                                        className="w-full h-auto rounded-md"
                                      />
                                    ) : item.file.type.startsWith("video/") ? (
                                      <video
                                        src={URL.createObjectURL(item.file)}
                                        controls
                                        className="w-full h-auto rounded-md"
                                      />
                                    ) : (
                                      <p className="text-sm text-gray-700">Preview Not Availble</p>
                                    )
                                  ) : (
                                    <a
                                      href={item.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 underline text-sm"
                                    >
                                      {item.link}
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      className="w-full py-3 text-white font-semibold rounded-lg"
                      style={{ width: '168px', height: '48px', backgroundColor: '#363736', marginTop: '20px', marginBottom: '60px', position: 'relative', zIndex: 1 }}
                      onClick={handleCreateUrl}
                    >
                      Publish
                    </button>
                  </div>
                </div>
              </div>
            )}
            {isModalOpen && (
              <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 flex justify-center items-center">
                <div className="bg-white p-6 rounded-xl shadow-lg w-11/12 md:w-1/3 relative">
                  <button
                    onClick={closeModal}
                    className="absolute top-3 right-3 text-white bg-red-500 hover:bg-red-700 text-3xl w-8 h-8 flex items-center justify-center rounded-full"
                  >
                    ×
                  </button>
                  <div className="z-50">
                    <p className="text-xl font-semibold mb-3 items-center text-center">Generated URL</p>
                    <div className="flex items-center space-x-2 mb-3 border rounded-xl">
                      <p className="truncate max-w-full border p-1 rounded bg-gray-50 text-[2.2vh] w-full items-center text-center font-gray-700">{previewUrl}</p>
                    </div>
                    <div className="flex justify-center items-center space-x-4 mt-4">
                      <button
                        onClick={handleManageUrl}
                        className="px-4 py-2 text-[2.2vh] font-large text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700"
                      >
                        Manage Screen
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {schedulerModal.open && (
              <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 flex justify-center items-center p-4">
                <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Content Schedule</h3>
                    <button onClick={closeSchedulerModal} className="text-gray-500 hover:text-gray-700">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {schedulerModal.groupId && (
                    <ContentScheduler
                      schedule={groups.find(g => g.id === schedulerModal.groupId).schedule}
                      onChange={(index, field, value) => updateSchedule(schedulerModal.groupId, field, value)}
                      index={0}
                    />
                  )}
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={closeSchedulerModal}
                      className="flex items-center px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
            {isLayoutModalOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg max-w-md w-full">
                  <h2 className="text-xl font-bold mb-4">Select Layout</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {layoutOptions.map((layout) => (
                      <button
                        key={layout.id}
                        onClick={() => selectLayout(layout.id)}
                        className={`p-3 border rounded-md hover:bg-gray-50 ${groups.find(g => g.id === currentGroupId)?.layout === layout.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                      >
                        <div className="text-sm font-medium mb-2">{layout.name}</div>
                        {renderLayoutPreview(layout.id, groups.find(g => g.id === currentGroupId)?.layout === layout.id)}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={closeLayoutModal}
                    className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 w-full"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <div
            style={{
              backgroundImage: `url(${backgroundImg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'fixed',
              bottom: "-50px",
              left: 0,
              width: '100%',
              height: '295px',
              zIndex: 0,
            }}
          />
          <div ref={bottomRef} style={{ paddingBottom: '10px' }}></div>
        </div >
      </div >
    </>
  );
};

export default Home1;