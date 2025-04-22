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
import { FaFileArrowUp } from "react-icons/fa6";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import Header from "./Header";
import Footer from "./Footer";
import ContentScheduler from "./ContentScheduler";
import "./styles.css";
import Swal from "sweetalert2";
import { motion, AnimatePresence } from "framer-motion";
import { v4 as uuidv4 } from "uuid";

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

const layoutOptions = [
  { id: "single", name: "Single View", cols: 1, rows: 1, itemCount: 1 },
  { id: "2x1", name: "2 Items Horizontal", cols: 2, rows: 1, itemCount: 2 },
  { id: "1x2", name: "2 Items Vertical", cols: 1, rows: 2, itemCount: 2 },
  { id: "2x2", name: "4 Items Grid", cols: 2, rows: 2, itemCount: 4 },
  { id: "3x1", name: "3 Items Horizontal", cols: 3, rows: 1, itemCount: 3 },
  { id: "1x3", name: "3 Items Vertical", cols: 1, rows: 3, itemCount: 3 },
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
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState(false);
  const [currentSchedulerGroupId, setCurrentSchedulerGroupId] = useState(null);
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
        setUrls(urls.filter((url) => url.id !== id));
        fetchExistingUrls();
        setLoading(false);
      } catch (error) {
        const message =
          error.response?.data?.message || "An unexpected error occurred.";
        alert(message);
        setLoading(false);
      }
    }
  };

  const handleEdit = (url) => {
    const groups = url.url_content.reduce((acc, content, index) => {
      if (index === 0 || content.layout !== acc[acc.length - 1].layout) {
        acc.push({
          id: uuidv4(),
          layout: content.layout || "single",
          time: content.time || 60,
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
            timeWindows: [{ startTime: "", endTime: "" }],
          },
          items: [{
            id: uuidv4(), // Add unique ID for each item
            link: content.content || "",
            file: content.file || null,
            analyzeWithAI: content.analyzeWithAI || false,
          }],
        });
      } else {
        acc[acc.length - 1].items.push({
          id: uuidv4(), // Add unique ID for each item
          link: content.content || "",
          file: content.file || null,
          analyzeWithAI: content.analyzeWithAI || false,
        });
      }
      return acc;
    }, []);

    setCurrentEdit({
      ...url,
      groups: groups.length > 0 ? groups : [{
        id: uuidv4(),
        layout: "single",
        time: 60,
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
          timeWindows: [{ startTime: "", endTime: "" }],
        },
        items: [{ id: uuidv4(), link: "", file: null, analyzeWithAI: false }],
      }],
    });
    setShowCustomTicker(!!url.custom_ticker);
    setCustomTickerText(url.custom_ticker || "");
    setIsEditing(true);
  };

  const handleBack = () => {
    setIsEditing(false);
    setShowCustomTicker(false);
    setCustomTickerText("");
    setCurrentEdit(null);
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
        Swal.fire({
          title: "Oops!",
          text: "Please provide a Screen Name.",
          icon: "warning",
          confirmButtonText: "OK",
        });
        setLoading(false);
        return;
      }

      const links = currentEdit.groups.flatMap(group =>
        group.items.map(item => ({
          ...item,
          layout: group.layout,
          time: group.time,
          schedule: group.schedule,
        }))
      );

      for (const [index, linkItem] of links.entries()) {
        if (!linkItem.link && !linkItem.file) {
          Swal.fire({
            title: "Oops!",
            text: `Please fill all the details for item ${index + 1}.`,
            icon: "warning",
            confirmButtonText: "OK",
          });
          setLoading(false);
          return;
        }

        if (linkItem.file) {
          const allowedTypes = [
            "image/jpeg", "image/jpg", "image/png", "image/gif", "image/svg+xml",
            "video/mp4", "video/webm", "video/quicktime",
            "application/pdf", "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ];
          if (!allowedTypes.includes(linkItem.file.type)) {
            Swal.fire({
              title: "Oops!",
              text: `Unsupported file type: ${linkItem.file.type}. Allowed types are JPEG, PNG, GIF, SVG, MP4, WEBM, MOV, PDF, PPT, PPTX, DOC, DOCX.`,
              icon: "warning",
              confirmButtonText: "OK",
            });
            setLoading(false);
            return;
          }
          if (linkItem.file.size > 524288000) {
            Swal.fire({
              title: "Oops!",
              text: `File size exceeds the limit of 500MB: ${linkItem.file.name}. Please upload a smaller file.`,
              icon: "warning",
              confirmButtonText: "OK",
            });
            setLoading(false);
            return;
          }
        }
      }

      const formData = new FormData();
      formData.append("id", currentEdit.id);
      formData.append("Url_Name", currentEdit.Url_Name);
      formData.append("userId", userId);
      formData.append("custom_ticker", showCustomTicker ? customTickerText : "");

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

      await axios.patch(`${apiBaseUrl}/api/upload/updateUrlContent`, formData, {
        headers: {
          Authorization: token,
          "Content-Type": "multipart/form-data",
        },
      });

      setUrls(urls.map(url =>
        url.id === currentEdit.id
          ? { ...currentEdit, custom_ticker: showCustomTicker ? customTickerText : "" }
          : url
      ));
      setIsEditing(false);
      setCurrentEdit(null);
      setShowCustomTicker(false);
      setCustomTickerText("");
      setLoading(false);
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      const message = error.response?.data?.message || "An unexpected error occurred.";
      Swal.fire({
        title: "Error!",
        text: message,
        icon: "error",
        confirmButtonText: "OK",
      });
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentEdit({ ...currentEdit, [name]: value });
  };

  const addNewGroup = () => {
    setCurrentEdit({
      ...currentEdit,
      groups: [
        ...currentEdit.groups,
        {
          id: uuidv4(),
          layout: "single",
          time: 60,
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
            timeWindows: [{ startTime: "", endTime: "" }],
          },
          items: [{ id: uuidv4(), link: "", file: null, analyzeWithAI: false }],
        },
      ],
    });
  };

  const deleteGroup = (groupId) => {
    if (currentEdit.groups.length === 1) {
      Swal.fire({
        title: "Oops!",
        text: "Cannot delete the last group.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.filter(group => group.id !== groupId),
    });
  };

  const moveGroupUp = (index) => {
    if (index === 0) return;
    const newGroups = [...currentEdit.groups];
    [newGroups[index], newGroups[index - 1]] = [newGroups[index - 1], newGroups[index]];
    setCurrentEdit({ ...currentEdit, groups: newGroups });
  };

  const moveGroupDown = (index) => {
    if (index === currentEdit.groups.length - 1) return;
    const newGroups = [...currentEdit.groups];
    [newGroups[index], newGroups[index + 1]] = [newGroups[index + 1], newGroups[index]];
    setCurrentEdit({ ...currentEdit, groups: newGroups });
  };

  const moveItemUp = (groupId, itemIndex) => {
    if (itemIndex === 0) return;
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.map(group => {
        if (group.id === groupId) {
          const newItems = [...group.items];
          [newItems[itemIndex], newItems[itemIndex - 1]] = [newItems[itemIndex - 1], newItems[itemIndex]];
          return { ...group, items: newItems };
        }
        return group;
      }),
    });
  };

  const moveItemDown = (groupId, itemIndex) => {
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.map(group => {
        if (group.id === groupId && itemIndex < group.items.length - 1) {
          const newItems = [...group.items];
          [newItems[itemIndex], newItems[itemIndex + 1]] = [newItems[itemIndex + 1], newItems[itemIndex]];
          return { ...group, items: newItems };
        }
        return group;
      }),
    });
  };

  const deleteItem = (groupId, itemId) => {
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.map(group => {
        if (group.id === groupId) {
          if (group.items.length === 1) {
            Swal.fire({
              title: "Oops!",
              text: "Cannot delete the last item in a group.",
              icon: "warning",
              confirmButtonText: "OK",
            });
            return group;
          }
          const layout = layoutOptions.find(l => l.id === group.layout);
          if (group.items.length <= layout.itemCount) {
            Swal.fire({
              title: "Oops!",
              text: `Cannot delete item. The layout '${layout.name}' requires ${layout.itemCount} items.`,
              icon: "warning",
              confirmButtonText: "OK",
            });
            return group;
          }
          return {
            ...group,
            items: group.items.filter(item => item.id !== itemId),
          };
        }
        return group;
      }),
    });
  };

  const handleTimeChange = (groupId, value) => {
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.map(group =>
        group.id === groupId ? { ...group, time: parseInt(value, 10) || 60 } : group
      ),
    });
  };

  const handleFileUpload = (groupId, itemIndex, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedMimeTypes = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/svg+xml",
      "video/mp4", "video/webm", "video/quicktime",
      "application/pdf", "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const allowedExtensions = [
      "mp4", "webm", "mov", "jpeg", "jpg", "png", "gif", "svg",
      "pdf", "ppt", "pptx", "doc", "docx",
    ];
    const maxFileSize = 524288000;

    const fileExtension = file.name.split(".").pop().toLowerCase();
    const isValidMime = allowedMimeTypes.includes(file.type);
    const isValidExtension = allowedExtensions.includes(fileExtension);
    const isValidSize = file.size <= maxFileSize;

    if (!isValidMime) {
      Swal.fire({
        title: "Oops!",
        text: `Unsupported file type: ${file.type}.`,
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }
    if (!isValidExtension) {
      Swal.fire({
        title: "Oops!",
        text: `Unsupported file extension: .${fileExtension}.`,
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }
    if (!isValidSize) {
      Swal.fire({
        title: "Oops!",
        text: `File too large: ${file.name}.`,
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }

    const url = URL.createObjectURL(file);
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.map(group => {
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
              setCurrentEdit(prev => ({
                ...prev,
                groups: prev.groups.map(g =>
                  g.id === groupId ? { ...g, time: durationInSeconds } : g
                ),
              }));
            };
          }
          return { ...group, items: newItems };
        }
        return group;
      }),
    });
  };

  const handleFileDrop = (groupId, itemIndex, droppedFiles) => {
    const file = droppedFiles[0];
    if (!file) return;

    const allowedMimeTypes = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/svg+xml",
      "video/mp4", "video/webm", "video/quicktime",
      "application/pdf", "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const allowedExtensions = [
      "mp4", "webm", "mov", "jpeg", "jpg", "png", "gif", "svg",
      "pdf", "ppt", "pptx", "doc", "docx",
    ];
    const maxFileSize = 524288000;

    const fileExtension = file.name.split(".").pop().toLowerCase();
    const isValidMime = allowedMimeTypes.includes(file.type);
    const isValidExtension = allowedExtensions.includes(fileExtension);
    const isValidSize = file.size <= maxFileSize;

    if (!isValidMime) {
      Swal.fire({
        title: "Oops!",
        text: `Unsupported file type: ${file.type}.`,
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }
    if (!isValidExtension) {
      Swal.fire({
        title: "Oops!",
        text: `Unsupported file extension: .${fileExtension}.`,
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }
    if (!isValidSize) {
      Swal.fire({
        title: "Oops!",
        text: `File too large: ${file.name}.`,
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }

    const url = URL.createObjectURL(file);
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.map(group => {
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
              setCurrentEdit(prev => ({
                ...prev,
                groups: prev.groups.map(g =>
                  g.id === groupId ? { ...g, time: durationInSeconds } : g
                ),
              }));
            };
          }
          return { ...group, items: newItems };
        }
        return group;
      }),
    });
  };

  const toggleAnalyzeWithAI = (groupId, itemIndex) => {
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.map(group => {
        if (group.id === groupId) {
          const newItems = [...group.items];
          newItems[itemIndex].analyzeWithAI = !newItems[itemIndex].analyzeWithAI;
          return { ...group, items: newItems };
        }
        return group;
      }),
    });
  };

  const updateSchedule = (groupId, field, value) => {
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.map(group => {
        if (group.id === groupId) {
          if (field === "timeWindows") {
            return { ...group, schedule: { ...group.schedule, timeWindows: value } };
          } else {
            return { ...group, schedule: { ...group.schedule, [field]: value } };
          }
        }
        return group;
      }),
    });
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
      setCurrentEdit({
        ...currentEdit,
        groups: currentEdit.groups.map(group => {
          if (group.id === currentGroupId) {
            let newItems = [...group.items];
            if (newItems.length < requiredItems) {
              const newItemTemplate = {
                id: uuidv4(),
                link: "",
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
        }),
      });
      closeLayoutModal();
    }
  };

  const openSchedulerModal = (groupId) => {
    setCurrentSchedulerGroupId(groupId);
    setIsSchedulerModalOpen(true);
  };

  const closeSchedulerModal = () => {
    setIsSchedulerModalOpen(false);
    setCurrentSchedulerGroupId(null);
  };

  const handlePreview = (content) => {
    if (content) {
      const fullUrl =
        content.startsWith("http://") ||
        content.startsWith("https://") ||
        content.startsWith("blob:")
          ? content
          : `${apiBaseUrl}/${content}`;
      window.open(fullUrl, "_blank");
    } else {
      Swal.fire({
        title: "Oops!",
        text: "No content to preview",
        icon: "warning",
        confirmButtonText: "OK",
      });
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
      Swal.fire({
        title: "Error!",
        text: message,
        icon: "error",
        confirmButtonText: "OK",
      });
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
      navigate("/home");
    }
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
        Swal.fire({
          title: "Error!",
          text: error.response?.data?.message || "Failed to update status",
          icon: "error",
          confirmButtonText: "OK",
        });
      }
    }
  };

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
            <p className="mt-6 text-white text-lg">Loading, please wait...</p>
          </div>
        </div>
      )}
      <div
        style={{ fontFamily: "Outfit" }}
        className="p-6 max-w-[50%] mx-auto rounded-lg h-[calc(100vh-80px)] overflow-auto bg-[#f1f1f1] z-50"
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

            <div className="flex flex-col p-4 rounded-lg space-y-4 bg-[#f1f1f1]">
              <div className="flex items-center mb-1">
                <input
                  type="text"
                  name="Url_Name"
                  value={currentEdit?.Url_Name || ""}
                  onChange={handleInputChange}
                  placeholder="Screen Name"
                  className="border-2 p-3 rounded-md bg-white w-full text-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex flex-col justify-center items-center ml-4">
                  <span className="text-sm mb-1 text-gray-700">Custom Ticker</span>
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
              <AnimatePresence>
                {showCustomTicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full"
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

              <div className="scrollable-container w-full" style={{ maxHeight: "380px", overflowY: "auto" }}>
                <AnimatePresence>
                  {currentEdit?.groups?.map((group, groupIndex) => (
                    <motion.div
                      key={group.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="mb-5 border border-gray-300 rounded-2xl bg-white p-4"
                      style={{ width: "600px", position: "relative", zIndex: 1 }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <button
                            onClick={() => openLayoutModal(group.id)}
                            className="flex items-center justify-center p-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 mr-4"
                            style={{ height: "40px", width: "100px" }}
                          >
                            <BiLayout className="mr-1" />
                            <span className="text-sm">{getLayoutName(group.layout)}</span>
                          </button>
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={addNewGroup}
                            className="p-2 bg-green-500 text-white rounded-xl mr-2"
                            style={{
                              width: "75px",
                              height: "40px",
                              fontSize: "18px",
                              display: "flex",
                              justifyContent: "center",
                              backgroundColor: "#348824",
                            }}
                          >
                            <FiPlusCircle
                              style={{
                                width: "16px",
                                height: "16px",
                                marginRight: "5px",
                                marginTop: "4px",
                              }}
                            />
                            Add
                          </button>
                          {currentEdit.groups.length > 1 && (
                            <>
                              <button
                                onClick={() => moveGroupUp(groupIndex)}
                                style={{
                                  background: "#F1F1F1",
                                  width: "45px",
                                  height: "45px",
                                  border: "1px solid",
                                  borderRadius: "10px 0px 0px 10px",
                                  borderColor: "#E1E1E1",
                                  justifyItems: "center",
                                }}
                                disabled={groupIndex === 0}
                              >
                                <AiOutlineArrowUp />
                              </button>
                              <button
                                onClick={() => moveGroupDown(groupIndex)}
                                style={{
                                  background: "#FFFFFF",
                                  width: "45px",
                                  height: "45px",
                                  border: "1px solid",
                                  borderRadius: "0px 10px 10px 0px",
                                  borderColor: "#E1E1E1",
                                  marginRight: "10px",
                                  justifyItems: "center",
                                }}
                                disabled={groupIndex === currentEdit.groups.length - 1}
                              >
                                <AiOutlineArrowDown />
                              </button>
                              <button
                                onClick={() => deleteGroup(group.id)}
                                className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                                style={{
                                  width: "45px",
                                  height: "41px",
                                  border: "1px solid",
                                  borderRadius: "10px",
                                  marginRight: "10px",
                                  justifyItems: "center",
                                }}
                              >
                                <RiDeleteBin6Line />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col md:flex-row items-end gap-3 mb-3">
                        <div className="items-center">
                          <p
                            style={{
                              fontFamily: "Outfit",
                              fontWeight: "500",
                              color: "#6F7C8E",
                              lineHeight: "17.64px",
                              marginBottom: "7px",
                            }}
                          >
                            Enter Time
                          </p>
                          <div className="time-input-group" style={{ position: "relative" }}>
                            <IoTimeOutline
                              style={{
                                position: "absolute",
                                top: "13px",
                                left: "7px",
                                color: "#6F7C8E",
                              }}
                            />
                            <div
                              style={{
                                width: "1px",
                                height: "60%",
                                backgroundColor: "#E1E1E1",
                                marginRight: "8px",
                              }}
                            ></div>
                            <input
                              type="number"
                              className="w-16 p-2 border border-gray-300 rounded-md text-center"
                              value={group.time}
                              onChange={(e) => handleTimeChange(group.id, e.target.value)}
                              placeholder="Time"
                              required
                              style={{ width: "112px", paddingLeft: "28px", paddingRight: "35px" }}
                            />
                            <span
                              className="time"
                              style={{
                                position: "absolute",
                                top: "0",
                                width: "auto",
                                right: "0",
                                background: "black",
                                height: "100%",
                                borderRadius: "0px 5px 5px 0px",
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
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={() => openSchedulerModal(group.id)}
                            className={`p-2 rounded-lg text-sm text-center leading-tight ${
                              group.schedule?.startTime || group.schedule?.startDate
                                ? "bg-blue-100 text-blue-700 border border-blue-300"
                                : "bg-gray-200 text-gray-700"
                            }`}
                            style={{ width: "80px", height: "45px" }}
                          >
                            {group.schedule?.startTime || group.schedule?.startDate ? (
                              <>
                                Edit<br />Schedule
                              </>
                            ) : (
                              <>
                                Add<br />Schedule
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      {group.items.map((item, itemIndex) => (
                        <div
                          key={item.id}
                          className="flex items-center mb-3"
                          style={{
                            borderBottom:
                              itemIndex < group.items.length - 1 ? "1px solid #eee" : "none",
                            paddingBottom:
                              itemIndex < group.items.length - 1 ? "10px" : "0",
                          }}
                        >
                          <div className="flex-grow">
                            <div
                              className="relative flex items-center border-gray-300 rounded-md"
                              style={{ width: "440px", paddingRight: "0px" }}
                              onDragOver={(e) => {
                                e.preventDefault();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const droppedFiles = Array.from(e.dataTransfer.files);
                                handleFileDrop(group.id, itemIndex, droppedFiles);
                              }}
                            >
                              <button
                                type="button"
                                className="h-16 px-4 text-white rounded-l-lg flex items-center justify-center hover:bg-blue-700"
                                onClick={() =>
                                  document
                                    .getElementById(`file-input-${group.id}-${item.id}`)
                                    .click()
                                }
                                style={{ height: "66px", backgroundColor: "#363736" }}
                              >
                                <FaFileArrowUp className="text-lg" style={{ paddingLeft: "6px" }} />
                                <p style={{ fontFamily: "Outfit", paddingLeft: "6px", paddingRight: "6px" }}>
                                  Upload
                                </p>
                              </button>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/png,image/jpeg,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                onChange={(e) => handleFileUpload(group.id, itemIndex, e)}
                                id={`file-input-${group.id}-${item.id}`}
                              />
                              <input
                                type="text"
                                className="w-full p-3 text-sm border border-gray-300 border-dashed rounded-r-lg placeholder-gray-500"
                                style={{
                                  height: "66px",
                                  width: "70%",
                                  backgroundColor: "#F7F7FF",
                                  paddingLeft: "12px",
                                  fontFamily: "Outfit",
                                  color: item.file ? "green" : "black",
                                }}
                                placeholder="Embedded Link / Image / Video or Upload File"
                                value={item.file ? item.file.name : item.link}
                                onChange={(e) => {
                                  setCurrentEdit({
                                    ...currentEdit,
                                    groups: currentEdit.groups.map(g => {
                                      if (g.id === group.id) {
                                        const newItems = [...g.items];
                                        newItems[itemIndex].link = e.target.value;
                                        newItems[itemIndex].file = null;
                                        return { ...g, items: newItems };
                                      }
                                      return g;
                                    }),
                                  });
                                }}
                              />
                              {item.file?.type === "application/pdf" && (
                                <div className="flex justify-center mt-2">
                                  <label className="flex flex-col items-center cursor-pointer text-center">
                                    <input
                                      type="checkbox"
                                      className="sr-only peer"
                                      checked={item.analyzeWithAI}
                                      onChange={() => toggleAnalyzeWithAI(group.id, itemIndex)}
                                    />
                                    <div className="relative w-11 h-6 bg-gray-200 rounded-full peer-focus:outline-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    <span className="mt-2 text-sm font-medium text-gray-700 leading-tight">
                                      Summarize<br />with AI
                                    </span>
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                          {group.items.length > 1 && (
                            <div className="flex items-center ml-2">
                              <button
                                onClick={() => moveItemUp(group.id, itemIndex)}
                                style={{
                                  background: "#F1F1F1",
                                  width: "35px",
                                  height: "35px",
                                  border: "1px solid",
                                  borderRadius: "8px 0px 0px 8px",
                                  borderColor: "#E1E1E1",
                                  justifyItems: "center",
                                }}
                                disabled={itemIndex === 0}
                              >
                                <AiOutlineArrowUp />
                              </button>
                              <button
                                onClick={() => moveItemDown(group.id, itemIndex)}
                                style={{
                                  background: "#FFFFFF",
                                  width: "35px",
                                  height: "35px",
                                  border: "1px solid",
                                  borderRadius: "0px 8px 8px 0px",
                                  borderColor: "#E1E1E1",
                                  justifyItems: "center",
                                }}
                                disabled={itemIndex === group.items.length - 1}
                              >
                                <AiOutlineArrowDown />
                              </button>
                              <button
                                onClick={() => deleteItem(group.id, item.id)}
                                className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 ml-2"
                                style={{
                                  width: "35px",
                                  height: "35px",
                                  border: "1px solid",
                                  borderRadius: "8px",
                                  justifyItems: "center",
                                }}
                              >
                                <RiDeleteBin6Line />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
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
                      onClick={() => handlePreview(url.previewUrl)}
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
                    Swal.fire({
                      title: "Error!",
                      text: error.response?.data?.message || "Failed to update status",
                      icon: "error",
                      confirmButtonText: "OK",
                    });
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
                    currentEdit.groups.find(g => g.id === currentGroupId)?.layout === layout.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300"
                  }`}
                >
                  <div className="text-sm font-medium mb-2">{layout.name}</div>
                  {renderLayoutPreview(
                    layout.id,
                    currentEdit.groups.find(g => g.id === currentGroupId)?.layout === layout.id
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
            {currentSchedulerGroupId && (
              <ContentScheduler
                schedule={currentEdit.groups.find(g => g.id === currentSchedulerGroupId).schedule}
                onChange={(index, field, value) => updateSchedule(currentSchedulerGroupId, field, value)}
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
    </>
  );
};

export default EditUrl;