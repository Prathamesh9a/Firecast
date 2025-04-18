import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaClock } from "react-icons/fa";
import { MdOutlineModeEdit } from "react-icons/md";
import { RiDeleteBin6Line, RiEyeFill } from "react-icons/ri";
import { AiOutlineUpload } from "react-icons/ai";
import { FiPlusCircle } from "react-icons/fi";
import { IoArrowBackCircleOutline } from "react-icons/io5";
import { AiOutlineArrowUp, AiOutlineArrowDown } from "react-icons/ai";
import { BiLayout } from "react-icons/bi";
import { IoTimeOutline } from "react-icons/io5";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import Header from "./Header";
import Footer from "./Footer";
import ContentScheduler from "./ContentScheduler";
import "./styles.css";
import Swal from "sweetalert2";
import { motion, AnimatePresence } from "framer-motion";

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

const layoutOptions = [
  { id: "single", name: "Single View", cols: 1, rows: 1 },
  { id: "2x1", name: "2 Items Horizontal", cols: 2, rows: 1 },
  { id: "1x2", name: "2 Items Vertical", cols: 1, rows: 2 },
  { id: "2x2", name: "4 Items Grid", cols: 2, rows: 2 },
  { id: "3x1", name: "3 Items Horizontal", cols: 3, rows: 1 },
  { id: "1x3", name: "3 Items Vertical", cols: 1, rows: 3 },
];

const EditUrl = () => {
  const [urls, setUrls] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [urlCount, setUrlCount] = useState(0);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [currentUrlId, setCurrentUrlId] = useState(null);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [currentLayoutIndex, setCurrentLayoutIndex] = useState(null);
  const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState(false);
  const [currentSchedulerIndex, setCurrentSchedulerIndex] = useState(null);
  // New states for custom ticker
  const [showCustomTicker, setShowCustomTicker] = useState(false);
  const [customTickerText, setCustomTickerText] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleDelete = async (id) => {
    const { isConfirmed } = await Swal.fire({
      title: "Are you sure?",
      text: "This Screen will be permanently deleted. This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
      customClass: {
        confirmButton: "bg-red-500 text-white border-none",
        cancelButton: "bg-gray-500 text-white",
      },
      reverseButtons: true,
    });

    if (isConfirmed) {
      setLoading(true);
      try {
        await axios.delete(`${apiBaseUrl}/api/upload/deleteUrl`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          },
          data: { id },
        });
        setLoading(false);
        setUrls(urls.filter((url) => url.id !== id));
        fetchExistingUrls();
      } catch (error) {
        const message =
          error.response?.data?.message || "An unexpected error occurred.";
        alert(message);
        setLoading(false);
      }
    }
  };

  const handleEdit = (url) => {
    setCurrentEdit({
      ...url,
      url_content: url.url_content.map((content) => ({
        ...content,
        layout: content.layout || "single",
        schedule: content.schedule || {
          startTime: "",
          endTime: "",
          startDate: "",
          endDate: "",
          frequency: "none",
          repeatInterval: 1,
          repeatUntil: "",
          weeklyDays: [],
          monthlyRule: "",
          displayMode: "exclusive",
          priority: "medium",
        },
      })),
    });
    // Initialize custom ticker states
    setShowCustomTicker(!!url.custom_ticker);
    setCustomTickerText(url.custom_ticker || "");
    setIsEditing(true);
  };

  const handleBack = () => {
    setIsEditing(false);
    setShowCustomTicker(false);
    setCustomTickerText("");
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      let userId;
      if (token) {
        const decodedToken = jwtDecode(token);
        userId = decodedToken.userId;
      }

      if (!currentEdit.Url_Name.trim()) {
        alert("Please provide a valid URL Name.");
        setLoading(false);
        return;
      }

      const updatedContent = currentEdit.url_content || [];
      if (updatedContent.length === 0) {
        alert("Please add at least one content link.");
        setLoading(false);
        return;
      }

      for (const [index, content] of updatedContent.entries()) {
        if (!content.content.trim()) {
          alert(`Please provide a valid link for content item #${index + 1}`);
          setLoading(false);
          return;
        }
        if (!content.time || isNaN(content.time) || content.time <= 0) {
          alert(`Please provide a valid time for content item #${index + 1}`);
          setLoading(false);
          return;
        }

        if (content.file) {
          const allowedMimeTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/gif",
            "image/svg+xml",
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "application/pdf",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ];
          const allowedExtensions = [
            "mp4",
            "webm",
            "quicktime",
            "jpeg",
            "jpg",
            "png",
            "gif",
            "svg",
            "pdf",
            "ppt",
            "pptx",
            "doc",
            "docx",
          ];
          const file = content.file;
          const fileExtension = file.name.split(".").pop().toLowerCase();
          const fileSizeLimit = 2147483648; // 2GB

          if (!allowedMimeTypes.includes(file.type)) {
            alert(
              `Unsupported file type: ${file.type}. Please select a valid file.`
            );
            setLoading(false);
            return;
          }
          if (!allowedExtensions.includes(fileExtension)) {
            alert(
              `Unsupported file extension: .${fileExtension}. Please select a valid file.`
            );
            setLoading(false);
            return;
          }
          if (file.size > fileSizeLimit) {
            alert(
              `File size exceeds the limit of 2GB. Please upload a smaller file.`
            );
            setLoading(false);
            return;
          }
        }
      }

      const formData = new FormData();
      formData.append("id", currentEdit.id);
      formData.append("Url_Name", currentEdit.Url_Name);
      formData.append("userId", userId);
      // Append custom ticker
      formData.append("custom_ticker", showCustomTicker ? customTickerText : "");

      updatedContent.forEach((content, idx) => {
        formData.append(`links[${idx}][link]`, content.content || "");
        formData.append(`links[${idx}][time]`, content.time || "");
        formData.append(`links[${idx}][layout]`, content.layout || "single");
        formData.append(
          `links[${idx}][schedule][startTime]`,
          content.schedule.startTime || ""
        );
        formData.append(
          `links[${idx}][schedule][endTime]`,
          content.schedule.endTime || ""
        );
        formData.append(
          `links[${idx}][schedule][startDate]`,
          content.schedule.startDate || ""
        );
        formData.append(
          `links[${idx}][schedule][endDate]`,
          content.schedule.endDate || ""
        );
        formData.append(
          `links[${idx}][schedule][frequency]`,
          content.schedule.frequency || "none"
        );
        formData.append(
          `links[${idx}][schedule][repeatInterval]`,
          content.schedule.repeatInterval || 1
        );
        formData.append(
          `links[${idx}][schedule][repeatUntil]`,
          content.schedule.repeatUntil || ""
        );
        formData.append(
          `links[${idx}][schedule][weeklyDays]`,
          JSON.stringify(content.schedule.weeklyDays || [])
        );
        formData.append(
          `links[${idx}][schedule][monthlyRule]`,
          content.schedule.monthlyRule || ""
        );
        formData.append(
          `links[${idx}][schedule][displayMode]`,
          content.schedule.displayMode || "exclusive"
        );
        formData.append(
          `links[${idx}][schedule][priority]`,
          content.schedule.priority || "medium"
        );
        if (content.file) {
          formData.append(`links[${idx}][file]`, content.file);
        }
      });

      await axios.patch(`${apiBaseUrl}/api/upload/updateUrlContent`, formData, {
        headers: {
          Authorization: token,
          "Content-Type": "multipart/form-data",
        },
      });

      setLoading(false);
      setUrls(
        urls.map((url) =>
          url.id === currentEdit.id
            ? { ...currentEdit, custom_ticker: showCustomTicker ? customTickerText : "" }
            : url
        )
      );
      setIsEditing(false);
      setCurrentEdit(null);
      setShowCustomTicker(false);
      setCustomTickerText("");
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      const message =
        error.response?.data?.message || "An unexpected error occurred.";
      alert(message);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentEdit({ ...currentEdit, [name]: value });
  };

  const handleContentChange = (idx, field, value) => {
    const updatedContent = [...currentEdit.url_content];
    if (field === "schedule") {
      updatedContent[idx].schedule = { ...updatedContent[idx].schedule, ...value };
    } else {
      updatedContent[idx][field] =
        field === "time" ? parseInt(value, 10) : value;
    }
    setCurrentEdit({ ...currentEdit, url_content: updatedContent });
  };
  

  const handleAddContent = () => {
    setCurrentEdit({
      ...currentEdit,
      url_content: [
        ...currentEdit.url_content,
        {
          content: "",
          time: 60,
          layout: "single",
          schedule: {
            startTime: "",
            endTime: "",
            startDate: "",
            endDate: "",
            frequency: "none",
            repeatInterval: 1,
            repeatUntil: "",
            weeklyDays: [],
            monthlyRule: "",
            displayMode: "exclusive",
            priority: "medium",
          },
        },
      ],
    });
  };

  const handleRemoveContent = (idx) => {
    Swal.fire({
      title: "Are you sure?",
      text: "This content will be permanently removed. This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, remove it!",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        const updatedContent = currentEdit.url_content.filter(
          (_, i) => i !== idx
        );
        setCurrentEdit({ ...currentEdit, url_content: updatedContent });
        Swal.fire(
          "Removed!",
          "The content has been removed successfully.",
          "success"
        );
      } else {
        Swal.fire("Cancelled", "The content was not removed.", "info");
      }
    });
  };

  const handleFileUpload = (idx, e) => {
    const file = e.target.files[0];
    if (file) {
      const updatedContent = [...currentEdit.url_content];
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/svg+xml",
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "application/pdf",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowedTypes.includes(file.type)) {
        alert(
          "Unsupported file type. Please upload a valid image, video, or document."
        );
        return;
      }
      const maxSize = 524288000; // 500 MB
      if (file.size > maxSize) {
        alert(
          "File size exceeds the limit of 500 MB. Please upload a smaller file."
        );
        return;
      }
      if (file.type.startsWith("video/")) {
        const videoElement = document.createElement("video");
        videoElement.src = URL.createObjectURL(file);
        videoElement.onloadedmetadata = () => {
          const duration = Math.ceil(videoElement.duration);
          const maxVideoDuration = 1200; // 20 minutes
          if (duration > maxVideoDuration) {
            alert(
              `Video exceeds the maximum duration of ${maxVideoDuration} seconds.`
            );
            return;
          }
          updatedContent[idx] = {
            ...updatedContent[idx],
            file,
            content: videoElement.src,
            time: duration || 60,
          };
          setCurrentEdit({ ...currentEdit, url_content: updatedContent });
        };
      } else {
        const fileURL = URL.createObjectURL(file);
        updatedContent[idx] = {
          ...updatedContent[idx],
          file,
          content: fileURL,
          time: 60, // Default time for non-video files
        };
        setCurrentEdit({ ...currentEdit, url_content: updatedContent });
      }
    }
  };

  const handlePreview = (content) => {
    if (content) {
      window.open(content, "_blank");
    } else {
      alert("No content to preview");
    }
  };

  const handleLinkPreview = (content) => {
    if (content) {
      window.open(content, "_blank");
    } else {
      alert("No content to preview");
    }
  };

  const WelcomeValid = async () => {
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

  const fetchExistingUrls = async () => {
    let userId;
    if (token) {
      const decodedToken = jwtDecode(token);
      userId = decodedToken.userId;
    }
    try {
      const res = await axios.post(
        `${apiBaseUrl}/api/upload/existingUrl/`,
        { userId },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          },
        }
      );
      setUrls(res.data);
      setUrlCount(res.data.length);
    } catch (error) {
      const message = error.response?.data?.message || "Failed to fetch URLs.";
      alert(message);
    }
  };

  const handleCreateUrl = () => {
    if (urlCount >= 6) {
      Swal.fire({
        title: "URL Limit Reached!",
        text: "You have reached the maximum allowed URLs. Please contact Admin or delete an existing URL to create a new one.",
        icon: "error",
        confirmButtonText: "OK",
      });
    } else {
      navigate(`/home`);
    }
  };

  const moveContentUp = (index) => {
    if (index === 0) return;
    const updatedContent = [...currentEdit.url_content];
    [updatedContent[index], updatedContent[index - 1]] = [
      updatedContent[index - 1],
      updatedContent[index],
    ];
    setCurrentEdit({ ...currentEdit, url_content: updatedContent });
  };

  const moveContentDown = (index) => {
    if (index === currentEdit.url_content.length - 1) return;
    const updatedContent = [...currentEdit.url_content];
    [updatedContent[index], updatedContent[index + 1]] = [
      updatedContent[index + 1],
      updatedContent[index],
    ];
    setCurrentEdit({ ...currentEdit, url_content: updatedContent });
  };

  const handleToggle = async (id, currentStatus) => {
    if (!currentStatus) {
      setCurrentUrlId(id);
      setShowScheduleModal(true);
    } else {
      try {
        const response = await axios.put(
          `${apiBaseUrl}/api/upload/toggleUrlStatus`,
          { id, status: false },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: token,
            },
          }
        );
        if (response.data) {
          setUrls(
            urls.map((url) =>
              url.id === id
                ? { ...url, isEnabled: response.data.isEnabled }
                : url
            )
          );
        }
      } catch (error) {
        Swal.fire(
          "Error",
          error.response?.data?.message || "Failed to update status",
          "error"
        );
      }
    }
  };

  // Layout Modal Handlers
  const openLayoutModal = (index) => {
    setCurrentLayoutIndex(index);
    setIsLayoutModalOpen(true);
  };

  const closeLayoutModal = () => {
    setIsLayoutModalOpen(false);
    setCurrentLayoutIndex(null);
  };

  const selectLayout = (layoutId) => {
    if (currentLayoutIndex !== null) {
      const updatedContent = [...currentEdit.url_content];
      updatedContent[currentLayoutIndex].layout = layoutId;
      setCurrentEdit({ ...currentEdit, url_content: updatedContent });
      closeLayoutModal();
    }
  };

  // Scheduler Modal Handlers
  const openSchedulerModal = (index) => {
    setCurrentSchedulerIndex(index);
    setIsSchedulerModalOpen(true);
  };

  const closeSchedulerModal = () => {
    setIsSchedulerModalOpen(false);
    setCurrentSchedulerIndex(null);
  };

  // Layout Preview Rendering
  const renderLayoutPreview = (layoutId, isSelected = false) => {
    const layout = layoutOptions.find((l) => l.id === layoutId);
    if (!layout) return null;
    const { cols, rows } = layout;
    return (
      <div
        className={`grid grid-cols-${cols} grid-rows-${rows} gap-1 w-full h-20 border ${
          isSelected ? "border-blue-500" : "border-gray-300"
        } rounded-md overflow-hidden`}
      >
        {Array(cols * rows)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="bg-gray-200"></div>
          ))}
      </div>
    );
  };

  const getLayoutName = (layoutId) => {
    const layout = layoutOptions.find((l) => l.id === layoutId);
    return layout ? layout.name : "Single View";
  };

  useEffect(() => {
    WelcomeValid();
    fetchExistingUrls();
  }, []);

  return (
    <>
      {loading && (
        <div
          className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-800 bg-opacity-75 z-50"
          aria-live="polite"
          role="status"
        >
          <div className="flex flex-col items-center">
            <div className="loader"></div>
            <p className="mt-6 text-loading">Loading, please wait...</p>
          </div>
        </div>
      )}
      <div
        style={{ fontFamily: "Outfit" }}
        className="p-2 max-w-[50%] mx-auto rounded-lg h-[calc(100vh-80px)] overflow-auto bg-[#f1f1f1] z-50"
      >
        {isEditing ? (
          <div>
            <div className="relative flex items-center mb-4">
              <IoArrowBackCircleOutline
                className="w-10 h-10 m-4 mt-6 absolute left-0 cursor-pointer hover:text-gray-500 hover:scale-110 transition duration-200"
                onClick={handleBack}
              />
              <h2 className="text-2xl font-bold text-[#ff9f00] mx-auto">
                Edit Screen
              </h2>
            </div>
            <p className="text-center text-gray-600 mb-4">
              Edit your Screen details
            </p>

            <div className="flex flex-col items-center p-4 rounded-lg space-x-4 bg-[#f1f1f1]">
              <div className="w-full sm:w-1/2 text-sm flex flex-col pb-4 items-center">
                <label className="text-xs text-black font-semibold">
                  Screen Name
                </label>
                <div className="flex items-center w-full">
                  <input
                    type="text"
                    name="Url_Name"
                    value={currentEdit?.Url_Name || ""}
                    onChange={handleInputChange}
                    placeholder="Enter Name"
                    className="border p-2 rounded bg-white text-sm w-full font-semibold text-center"
                  />
                  <div className="flex flex-col justify-center items-center ml-4">
                    <span className="text-sm mb-1 text-gray-700">
                      Custom Ticker
                    </span>
                    <button
                      onClick={() => setShowCustomTicker(!showCustomTicker)}
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
                        showCustomTicker ? "bg-green-500" : "bg-gray-400"
                      }`}
                      aria-label={`Toggle custom ticker ${
                        showCustomTicker ? "off" : "on"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full transform transition-transform duration-300 ${
                          showCustomTicker ? "translate-x-6" : ""
                        }`}
                      ></div>
                    </button>
                  </div>
                </div>
              </div>
              <AnimatePresence>
                {showCustomTicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full sm:w-1/2 mb-4"
                  >
                    <input
                      type="text"
                      className="border-2 p-3 rounded-md bg-white text-black font-medium text-base w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter custom ticker text"
                      value={customTickerText}
                      onChange={(e) => setCustomTickerText(e.target.value)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {currentEdit?.url_content?.map((content, idx) => (
                  <motion.div
                    key={idx}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="mb-3 border border-gray-300 rounded-2xl bg-white p-4 flex items-center z-20"
                    style={{
                      alignItems: "center",
                      marginLeft: "1vw",
                      height: "10vh",
                    }}
                  >
                    <div className="flex items-center space-x-2 flex-grow">
                      <label className="flex items-center px-3 py-2 bg-black text-white text-sm rounded cursor-pointer">
                        <AiOutlineUpload className="mr-2" />
                        Upload
                        <input
                          type="file"
                          className="hidden"
                          accept="image/png,image/jpeg,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime,video/mkv,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={(e) => handleFileUpload(idx, e)}
                        />
                      </label>
                      <input
                        type="text"
                        value={content.content}
                        onChange={(e) =>
                          handleContentChange(idx, "content", e.target.value)
                        }
                        placeholder="Content"
                        className="px-2 py-[1.25vh] border rounded-l-md text-sm bg-[#f1f1f1] w-[17vw]"
                      />
                    </div>

                    <div style={{ position: "relative", marginRight: "1vw" }}>
                      <input
                        type="number"
                        value={
                          content.time !== undefined && content.time !== null
                            ? content.time
                            : ""
                        }
                        onChange={(e) =>
                          handleContentChange(idx, "time", e.target.value || "")
                        }
                        placeholder="Time"
                        className="w-[5vw] p-2 border border-gray-300 rounded-r-xl text-center"
                        required
                        min="1"
                        step="1"
                      />
                      <span
                        className="time"
                        style={{
                          position: "absolute",
                          top: "0",
                          right: "0",
                          background: "black",
                          height: "100%",
                          borderRadius: "0px 0.3125vw 0.3125vw 0px",
                          textAlign: "center",
                          lineHeight: "40px",
                          color: "white",
                          fontSize: "14px",
                          paddingRight: "6px",
                          paddingLeft: "6px",
                        }}
                      >
                        Sec
                      </span>
                    </div>

                    <div className="mr-2">
                      <button
                        onClick={() => openLayoutModal(idx)}
                        className="flex items-center justify-center p-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                        style={{ height: "40px", width: "70px" }}
                      >
                        <BiLayout className="mr-1" />
                        <span className="text-sm">
                          {getLayoutName(content.layout).split(" ")[0]}
                        </span>
                      </button>
                    </div>

                    <div className="mr-2">
                      <button
                        onClick={() => openSchedulerModal(idx)}
                        className={`flex items-center justify-center p-2 border rounded-md hover:bg-gray-50 ${
                          content.schedule?.startTime || content.schedule?.startDate
                            ? "bg-blue-100 text-blue-700 border-blue-300"
                            : "bg-gray-200 text-gray-700 border-gray-300"
                        }`}
                        style={{ height: "40px", width: "80px" }}
                      >
                        <IoTimeOutline className="mr-1" />
                        <span className="text-sm">
                          {content.schedule?.startTime ||
                          content.schedule?.startDate
                            ? "Edit"
                            : "Add"}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        className="w-[45px] h-[45px] flex items-center justify-center rounded-xl bg-gray-200"
                        onClick={() => {
                          if (!content.content || content.content.trim() === "") {
                            alert("No content to preview");
                            return;
                          }
                          const fullUrl =
                            content.content.startsWith("http://") ||
                            content.content.startsWith("https://") ||
                            content.content.startsWith("blob:")
                              ? content.content
                              : `${apiBaseUrl}/${content.content}`;
                          handlePreview(fullUrl);
                        }}
                      >
                        <RiEyeFill />
                      </button>
                      <button
                        className="w-[45px] h-[45px] flex items-center justify-center rounded-xl bg-red-500 text-white"
                        onClick={() => handleRemoveContent(idx)}
                      >
                        <RiDeleteBin6Line />
                      </button>
                      <button
                        className="w-[45px] h-[45px] flex items-center justify-center rounded-xl bg-[#348824] text-white"
                        onClick={() => handleAddContent(idx)}
                      >
                        <FiPlusCircle />
                      </button>
                      <div className="flex">
                        <button
                          className="w-[45px] h-[45px] flex items-center justify-center bg-[#F1F1F1] border border-gray-300 rounded-l-xl"
                          onClick={() => moveContentUp(idx)}
                          disabled={idx === 0}
                        >
                          <AiOutlineArrowUp />
                        </button>
                        <button
                          className="w-[45px] h-[45px] flex items-center justify-center bg-white border border-gray-300 rounded-r-xl"
                          onClick={() => moveContentDown(idx)}
                          disabled={idx === currentEdit?.url_content?.length - 1}
                        >
                          <AiOutlineArrowDown />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex item-center justify-center">
              <button
                className="w-full py-3 text-center items-center text-white font-semibold rounded-lg"
                style={{
                  width: "168px",
                  height: "48px",
                  backgroundColor: "#363736",
                  marginTop: "20px",
                  marginBottom: "60px",
                  position: "relative",
                  zIndex: 1,
                }}
                onClick={handleUpdate}
              >
                Update Now
              </button>
            </div>
          </div>
        ) : (
          <div className="z-50">
            <h2 className="text-2xl font-bold text-center text-[#ff9f00] mb-2">
              Manage Screen
            </h2>
            <p className="text-center text-gray-600 mb-4">
              Here are all your created Screen Links
            </p>
            <div className="space-y-4 relative overflow-y-auto max-h-[360px] z-100">
              {urls.map((url, index) => (
                <div
                  key={url.id}
                  className="z-20 relative flex items-center px-3 py-1 border rounded-lg space-x-4 flex-wrap sm:flex-nowrap bg-white mb-3"
                >
                  <div className="w-8 h-8 flex items-center justify-center rounded-full text-black bg-gray-100 z-20">
                    {index + 1}
                  </div>
                  <div className="w-full sm:w-[12%]">
                    <span className="text-gray-400 text-xs">Screen Name</span>
                    <p className="font-semibold w-[30px] flex flex-wrap z-20">
                      {url.Url_Name}
                    </p>
                  </div>
                  <input
                    type="text"
                    className="flex-1 p-2 border rounded bg-gray-100 text-sm mb-2 md:mb-0 z-20"
                    value={url.previewUrl || ""}
                    readOnly
                  />
                  <div className="flex items-center space-x-2 z-20">
                    <button
                      onClick={() => handleToggle(url.id, url.isEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        url.isEnabled ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          url.isEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span
                      className={`text-sm ${
                        url.isEnabled ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {url.isEnabled ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex space-x-2 z-20">
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-black text-white"
                      onClick={() => handleLinkPreview(url.previewUrl)}
                    >
                      <RiEyeFill />
                    </button>
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-green-500 text-white"
                      onClick={() => handleEdit(url)}
                    >
                      <MdOutlineModeEdit />
                    </button>
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-red-500 text-white"
                      onClick={() => handleDelete(url.id)}
                    >
                      <RiDeleteBin6Line />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex item-center justify-center mt-1">
              <button
                className="w-full py-3 text-center items-center text-white font-semibold rounded-lg"
                style={{
                  width: "168px",
                  height: "48px",
                  backgroundColor: "#363736",
                  marginTop: "15px",
                  marginBottom: "60px",
                  position: "relative",
                  zIndex: 1,
                }}
                onClick={handleCreateUrl}
              >
                Create New Screen
              </button>
            </div>
          </div>
        )}
      </div>

      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-xl font-bold mb-4">Schedule URL Activation</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Schedule Start (optional):
                <input
                  type="datetime-local"
                  className="w-full p-2 border rounded mt-1"
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </label>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Schedule End (optional):
                <input
                  type="datetime-local"
                  className="w-full p-2 border rounded mt-1"
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-gray-500 text-white rounded"
                onClick={() => setShowScheduleModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded"
                onClick={async () => {
                  try {
                    const response = await axios.put(
                      `${apiBaseUrl}/api/upload/toggleUrlStatus`,
                      {
                        id: currentUrlId,
                        status: true,
                        scheduledAt: scheduledAt || null,
                        expiresAt: expiresAt || null,
                      },
                      {
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: token,
                        },
                      }
                    );
                    if (response.data) {
                      setUrls(
                        urls.map((url) =>
                          url.id === currentUrlId
                            ? {
                                ...url,
                                isEnabled: response.data.isEnabled,
                                scheduledAt: response.data.scheduledAt,
                                expiresAt: response.data.expiresAt,
                              }
                            : url
                        )
                      );
                    }
                    setShowScheduleModal(false);
                    setScheduledAt(null);
                    setExpiresAt(null);
                  } catch (error) {
                    Swal.fire(
                      "Error",
                      error.response?.data?.message || "Failed to update status",
                      "error"
                    );
                  }
                }}
              >
                Save Schedule
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
                  className={`p-3 border rounded-md hover:bg-gray-50 ${
                    currentEdit.url_content[currentLayoutIndex]?.layout ===
                    layout.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300"
                  }`}
                >
                  <div className="text-sm font-medium mb-2">{layout.name}</div>
                  {renderLayoutPreview(
                    layout.id,
                    currentEdit.url_content[currentLayoutIndex]?.layout ===
                      layout.id
                  )}
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

      {isSchedulerModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Content Schedule</h3>
              <button
                onClick={closeSchedulerModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {currentSchedulerIndex !== null && (
              <ContentScheduler
                schedule={currentEdit.url_content[currentSchedulerIndex].schedule}
                onChange={(field, value) =>
                  handleContentChange(currentSchedulerIndex, "schedule", value)
                }
                index={currentSchedulerIndex}
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
    </>
  );
};

export default EditUrl;