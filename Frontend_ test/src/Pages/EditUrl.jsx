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
import { FaEye } from "react-icons/fa";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import Header from "./Header";
import Footer from "./Footer";
import ContentScheduler from "./ContentScheduler";
import PreviewContent from "./PreviewContent";
import "./styles.css";
import Swal from "sweetalert2";
import { motion, AnimatePresence } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import io from "socket.io-client";
import * as pdfjsLib from "pdfjs-dist";
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
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const toggleGroupExpand = (groupId) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };
  const replacePptGroup = (groupId) => {
    Swal.fire({
      title: "Replace PPT?",
      text: "This will remove all current slides and upload a new PPT. Continue?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Replace",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.ppt,.pptx';
        fileInput.onchange = (e) => handlePptReplaceUpload(groupId, e);
        fileInput.click();
      }
    });
  };
  const handlePptReplaceUpload = (groupId, e) => {
    const file = e.target.files[0];
    if (!file || !file.name.match(/\.(ppt|pptx)$/i)) {
      Swal.fire("Invalid file. Please select a PPT/PPTX.");
      return;
    }
    setCurrentEdit(prev => ({
      ...prev,
      groups: prev.groups.map(group => {
        if (group.id === groupId) {
          return {
            ...group,
            items: [{
              id: uuidv4(),
              link: URL.createObjectURL(file),
              file,
              fileName: file.name,
              analyzeWithAI: false,
              replacePpt: true,
            }],
            isPptGroup: true,
          };
        }
        return group;
      }),
    }));
  };
  const getPreviewMediaContent = () => {
    if (!currentEdit || !currentEdit.groups) {
      console.log("No groups found in currentEdit:", currentEdit);
      return [];
    }
    const mediaContent = currentEdit.groups.flatMap((group) => {
      console.log("Processing group:", group);
      return group.items
        .filter((item) => item.link || item.file)
        .map((item) => {
          let contentUrl = "";
          if (item.file) {
            contentUrl = URL.createObjectURL(item.file);
          } else if (item.link) {
            contentUrl =
              item.link.startsWith("http://") ||
                item.link.startsWith("https://") ||
                item.link.startsWith("blob:")
                ? item.link
                : `${apiBaseUrl}/${item.link}`;
          }
          console.log("Item content URL:", contentUrl, "Item:", item);
          return {
            content: contentUrl,
            layout: group.layout || "single",
            time: parseInt(group.time, 10) || 10,
            schedule: { ...group.schedule },
            originalFormat: item.file ? item.file.type : (item.link ? null : null),
            fileName: item.fileName || (item.file ? item.file.name : null),
            analyzeWithAI: item.analyzeWithAI || false,
          };
        });
    });
    console.log("Generated mediaContent:", mediaContent);
    return mediaContent;
  };
  useEffect(() => {
    const socket = io(apiBaseUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socket.on('connect', () => {
      console.log('EditUrl connected to Socket.IO');
    });
    socket.on('update', (data) => {
      console.log('Received update data in EditUrl:', data);
      setUrls((prevUrls) =>
        prevUrls.map((url) =>
          url.id === data.id
            ? {
              ...url,
              isEnabled: data.isEnabled,
              scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
              expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            }
            : url
        )
      );
    });
    socket.on('delete', (data) => {
      console.log('Received delete data in EditUrl:', data);
      setUrls((prevUrls) => prevUrls.filter((url) => url.id !== data.id));
      Swal.fire({
        title: 'URL Deleted',
        text: `The URL ${data.url} has been deleted.`,
        icon: 'info',
        confirmButtonText: 'OK',
      });
    });
    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error in EditUrl:', error);
    });
    return () => {
      socket.disconnect();
    };
  }, [token]);
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
        Swal.fire({
          title: "Deleted!",
          text: "The Screen has been deleted.",
          icon: "success",
          confirmButtonText: "OK",
        });
      } catch (error) {
        const message =
          error.response?.data?.message || "An unexpected error occurred.";
        Swal.fire({
          title: "Error!",
          text: message,
          icon: "error",
          confirmButtonText: "OK",
        });
        setLoading(false);
      }
    }
  };
  const handleEdit = (url) => {
    // Group content by groupId
    const contentGroups = new Map();
    url.url_content.forEach((content) => {
      if (content.groupId) {
        // This is part of a PPT group
        if (!contentGroups.has(content.groupId)) {
          contentGroups.set(content.groupId, []);
        }
        contentGroups.get(content.groupId).push(content);
      } else {
        // Single item - create a unique group for it
        const singleGroupId = uuidv4();
        contentGroups.set(singleGroupId, [content]);
      }
    });
    // Convert groups to your UI format
    const groups = Array.from(contentGroups.entries()).map(([groupId, contents]) => {
      // For PPT groups, extract the base name from the first slide
      const firstContent = contents[0];
      const isPptGroup = contents.length > 1 && !!firstContent.groupId;
      // Extract PPT base name (remove -0.png, -1.png, etc.)
      let displayName = firstContent.fileName || firstContent.content.split('/').pop();
      if (isPptGroup) {
        displayName = displayName.replace(/-\d+\.png$/, '.pptx');
      }
      const schedule = {
        startDate: firstContent.schedule?.startDate || "",
        endDate: firstContent.schedule?.endDate || "",
        frequency: firstContent.schedule?.frequency || "none",
        repeatInterval: firstContent.schedule?.repeatInterval || "1",
        repeatUntil: firstContent.schedule?.repeatUntil || "",
        weeklyDays: firstContent.schedule?.weeklyDays || [],
        monthlyRule: firstContent.schedule?.monthlyRule || "",
        displayMode: firstContent.schedule?.displayMode || "mixed",
        priority: firstContent.schedule?.priority || "medium",
        timeWindows: firstContent.schedule?.timeWindows?.length > 0
          ? firstContent.schedule.timeWindows.map((tw) => ({
            startTime: tw.startTime || "",
            endTime: tw.endTime || "",
          }))
          : [{ startTime: "", endTime: "" }],
      };
      return {
        id: uuidv4(),
        layout: firstContent.layout || "single",
        time: firstContent.time || "",
        schedule,
        isPptGroup: isPptGroup,
        originalGroupId: groupId,
        displayName: displayName,
        slideCount: contents.length,
        items: contents.map((content, index) => ({
          id: uuidv4(),
          link: content.content || "",
          file: null,
          fileName: content.fileName || content.content.split('/').pop(),
          analyzeWithAI: content.analyzeWithAI || false,
          slideIndex: index,
          groupId: content.groupId,
          replacePpt: false,  // Default false
        }))
      };
    });
    setCurrentEdit({
      ...url,
      groups: groups.length > 0 ? groups : [
        {
          id: uuidv4(),
          layout: "single",
          time: "",
          schedule: {
            startDate: "",
            endDate: "",
            frequency: "none",
            repeatInterval: "1",
            repeatUntil: "",
            weeklyDays: [],
            monthlyRule: "",
            displayMode: "mixed",
            priority: "medium",
            timeWindows: [{ startTime: "", endTime: "" }],
          },
          isPptGroup: false,
          originalGroupId: null,
          items: [{ id: uuidv4(), link: "", file: null, fileName: null, analyzeWithAI: false, replacePpt: false }],
        },
      ],
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
    setIsPreviewModalOpen(false);
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
      const links = currentEdit.groups.flatMap((group) =>
        group.items.map((item) => ({
          ...item,
          layout: group.layout,
          time: group.time,
          schedule: {
            ...group.schedule,
            timeWindows: group.schedule.timeWindows?.filter(
              (tw) => tw.startTime && tw.endTime
            ) || [],
          },
          originalGroupId: group.originalGroupId || null,  // Pass for backend pruning
          replacePpt: item.replacePpt || false,  // Flag for replacement
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
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/gif",
            "image/svg+xml",
            "video/mp4",
            "application/pdf",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
          ];
          if (!allowedTypes.includes(linkItem.file.type)) {
            Swal.fire({
              title: "Oops!",
              text: `Unsupported file type: ${linkItem.file.type}. Allowed types are JPEG, PNG, GIF, SVG, MP4, WEBM, MOV, PDF, PPT, PPTX, DOC, DOCX, TXT`,
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
        formData.append(`links[${index}][schedule][startDate]`, linkItem.schedule.startDate || "");
        formData.append(`links[${index}][schedule][endDate]`, linkItem.schedule.endDate || "");
        formData.append(`links[${index}][schedule][frequency]`, linkItem.schedule.frequency || "none");
        formData.append(`links[${index}][schedule][repeatInterval]`, linkItem.schedule.repeatInterval || "1");
        formData.append(`links[${index}][schedule][repeatUntil]`, linkItem.schedule.repeatUntil || "");
        formData.append(`links[${index}][schedule][weeklyDays]`, JSON.stringify(linkItem.schedule.weeklyDays || []));
        formData.append(`links[${index}][schedule][monthlyRule]`, linkItem.schedule.monthlyRule || "");
        formData.append(`links[${index}][schedule][displayMode]`, linkItem.schedule.displayMode || "mixed");
        formData.append(`links[${index}][schedule][priority]`, linkItem.schedule.priority || "medium");
        formData.append(`links[${index}][originalGroupId]`, linkItem.originalGroupId || "");
        formData.append(`links[${index}][replacePpt]`, linkItem.replacePpt || false);
        if (linkItem.schedule.timeWindows?.length > 0) {
          linkItem.schedule.timeWindows.forEach((tw, twIndex) => {
            formData.append(`links[${index}][schedule][timeWindows][${twIndex}][startTime]`, tw.startTime);
            formData.append(`links[${index}][schedule][timeWindows][${twIndex}][endTime]`, tw.endTime);
          });
        }
        if (linkItem.file) {
          formData.append(`links[${index}][file]`, linkItem.file);
          formData.append(`links[${index}][fileName]`, linkItem.fileName || linkItem.file.name);
        }
      });
      const response = await axios.patch(`${apiBaseUrl}/api/upload/updateUrlContent`, formData, {
        headers: {
          Authorization: token,
          "Content-Type": "multipart/form-data",
        },
      });
      setUrls(urls.map((url) =>
        url.id === currentEdit.id
          ? { ...currentEdit, custom_ticker: showCustomTicker ? customTickerText : "", url_content: response.data.url_content }
          : url
      ));
      setIsEditing(false);
      setCurrentEdit(null);
      setShowCustomTicker(false);
      setCustomTickerText("");
      setIsPreviewModalOpen(false);
      setLoading(false);
      Swal.fire({
        title: "Success!",
        text: "Screen updated successfully.",
        icon: "success",
        confirmButtonText: "OK",
      });
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
          time: "",
          schedule: {
            startDate: "",
            endDate: "",
            frequency: "none",
            repeatInterval: "1",
            repeatUntil: "",
            weeklyDays: [],
            monthlyRule: "",
            displayMode: "mixed",
            priority: "medium",
            timeWindows: [{ startTime: "", endTime: "" }],
          },
          items: [{ id: uuidv4(), link: "", file: null, fileName: null, analyzeWithAI: false, replacePpt: false }],
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
      groups: currentEdit.groups.filter((group) => group.id !== groupId),
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
      groups: currentEdit.groups.map((group) => {
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
      groups: currentEdit.groups.map((group) => {
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
      groups: currentEdit.groups.map((group) => {
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
          const layout = layoutOptions.find((l) => l.id === group.layout);
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
            items: group.items.filter((item) => item.id !== itemId),
          };
        }
        return group;
      }),
    });
  };
  const handleTimeChange = (groupId, value) => {
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.map((group) =>
        group.id === groupId ? { ...group, time: parseInt(value, 10) || "" } : group
      ),
    });
  };
  const calculatePdfTime = async (file, groupId, itemIndex) => {
    try {
      const url = URL.createObjectURL(file);
      const pdf = await pdfjsLib.getDocument(url).promise;
      const numPages = pdf.numPages;
      let totalHeight = 0;
      const group = currentEdit.groups.find((g) => g.id === groupId);
      const layoutConfig = layoutOptions.find((option) => option.id === group.layout) || { cols: 1, rows: 1 };
      const cols = layoutConfig.cols;
      const rows = layoutConfig.rows;
      const containerWidth = (window.innerWidth * 0.8) / cols;
      const containerHeight = (window.innerHeight * 0.8) / rows;
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        const scale = containerWidth / viewport.width;
        const pageHeight = viewport.height * scale;
        totalHeight += pageHeight;
        if (pageNum < numPages) totalHeight += 16;
      }
      const scrollableHeight = Math.max(0, totalHeight - containerHeight);
      const scrollTime = scrollableHeight * 0.05;
      const buffer = numPages * 2;
      const time = Math.ceil(scrollTime + buffer);
      setCurrentEdit((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, time: time > 0 ? time : 10 } : g
        ),
      }));
    } catch (error) {
      console.error('Error calculating PDF time:', error);
      setCurrentEdit((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, time: 30 } : g
        ),
      }));
    }
  };
  const calculateDocTime = async (file, groupId, itemIndex) => {
    try {
      const fileSizeKB = file.size / 1024;
      const estimatedWords = Math.round(fileSizeKB * 10);
      const wordsPerSecond = 3;
      const readingTimeSeconds = Math.ceil(estimatedWords / wordsPerSecond);
      const group = currentEdit.groups.find((g) => g.id === groupId);
      const layoutConfig = layoutOptions.find((option) => option.id === group.layout) || { cols: 1, rows: 1 };
      const cols = layoutConfig.cols;
      const rows = layoutConfig.rows;
      const layoutAdjustment = 1 / (cols * rows);
      const adjustedTime = Math.max(10, Math.ceil(readingTimeSeconds * layoutAdjustment));
      setCurrentEdit((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, time: adjustedTime } : g
        ),
      }));
    } catch (error) {
      console.error('Error calculating DOC/DOCX time:', error);
      setCurrentEdit((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, time: 30 } : g
        ),
      }));
    }
  };
  const calculateTxtTime = async (file, groupId, itemIndex) => {
    try {
      const text = await file.text();
      const words = text.split(/\s+/).filter(word => word.length > 0).length;
      const wordsPerSecond = 3;
      const readingTimeSeconds = Math.ceil(words / wordsPerSecond);
      const group = currentEdit.groups.find((g) => g.id === groupId);
      const layoutConfig = layoutOptions.find((option) => option.id === group.layout) || { cols: 1, rows: 1 };
      const cols = layoutConfig.cols;
      const rows = layoutConfig.rows;
      const layoutAdjustment = 1 / (cols * rows);
      const adjustedTime = Math.max(10, Math.ceil(readingTimeSeconds * layoutAdjustment));
      setCurrentEdit((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, time: adjustedTime } : g
        ),
      }));
    } catch (error) {
      console.error('Error calculating TXT time:', error);
      setCurrentEdit((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, time: 30 } : g
        ),
      }));
    }
  };
  const handlePptUploadAsGroup = (groupId, file) => {
    if (!file.name.match(/\.(ppt|pptx)$/i)) return;

    const group = currentEdit.groups.find(g => g.id === groupId);
    if (group.layout !== "single") {
      Swal.fire({
        title: "Invalid Layout for PPT",
        text: "PPT files can only be uploaded in 'Single View' layout. Please change the layout to 'Single View' first.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    // Proceed with PPT upload
    setCurrentEdit(prev => ({
      ...prev,
      groups: prev.groups.map(group => {
        if (group.id === groupId) {
          return {
            ...group,
            items: [{
              id: uuidv4(),
              link: URL.createObjectURL(file),
              file,
              fileName: file.name,
              analyzeWithAI: false,
              replacePpt: false,
            }],
            isPptGroup: true,
            displayName: file.name,
            slideCount: 1,
          };
        }
        return group;
      }),
    }));
  };
  const handleFileUpload = (groupId, itemIndex, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/svg+xml",
      "video/mp4",
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    const allowedExtensions = [
      "mp4",
      "webm",
      "mov",
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
      "txt",
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
    const group = currentEdit.groups.find(g => g.id === groupId);
    // Allow PPT only in non-PPT groups OR via Replace button
    const isPptFile = file.type.includes('powerpoint') || ['ppt', 'pptx'].includes(fileExtension);

    if (isPptFile && group.isPptGroup) {
      // Trying to upload PPT into existing PPT group → block
      Swal.fire({
        title: "PPT Upload Not Allowed Here",
        text: "To replace the entire PPT, use the 'Replace PPT' button. Individual slides support images/videos only.",
        icon: "warning",
      });
      e.target.value = '';
      return;
    }

    if (isPptFile && !group.isPptGroup) {
      // Uploading PPT into a normal group → convert group to PPT group
      Swal.fire({
        title: "Convert PPT to image?",
        text: "Uploading a PPT will convert all items in this PPT slides into image.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, Convert",
      }).then((result) => {
        if (result.isConfirmed) {
          // Trigger PPT handling (same as Replace, but for new upload)
          handlePptUploadAsGroup(group.id, file);
        }
      });
      e.target.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.map((group) => {
        if (group.id === groupId) {
          const newItems = [...group.items];
          newItems[itemIndex] = {
            ...newItems[itemIndex],
            link: url,
            file: file,
            fileName: file.name,
            replacePpt: false,
          };
          return { ...group, items: newItems };
        }
        return group;
      }),
    });
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = url;
      video.onloadedmetadata = () => {
        const durationInSeconds = Math.floor(video.duration);
        setCurrentEdit((prev) => ({
          ...prev,
          groups: prev.groups.map((g) =>
            g.id === groupId ? { ...g, time: durationInSeconds } : g
          ),
        }));
      };
    } else if (file.type === "application/pdf") {
      calculatePdfTime(file, groupId, itemIndex);
    } else if (file.type === "application/msword" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      calculateDocTime(file, groupId, itemIndex);
    } else if (file.type === "text/plain") {
      calculateTxtTime(file, groupId, itemIndex);
    }
  };
  const handleFileDrop = (groupId, itemIndex, droppedFiles) => {
    const file = droppedFiles[0];
    if (!file) return;
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/svg+xml",
      "video/mp4",
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    const allowedExtensions = [
      "mp4",
      "webm",
      "mov",
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
      "txt",
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
    const group = currentEdit.groups.find(g => g.id === groupId);
    const isPptFile = file.type.includes('powerpoint') || ['ppt', 'pptx'].includes(fileExtension);

    if (isPptFile && group.isPptGroup) {
      Swal.fire({
        title: "PPT Upload Not Allowed Here",
        text: "To replace the entire PPT, use the 'Replace PPT' button on the group. Individual slides support images/videos only.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }
    if (isPptFile && !group.isPptGroup) {
      Swal.fire({
        title: "Convert PPT to image?",
        text: "Uploading a PPT will convert all items in this PPT slides into image.",
        showCancelButton: true,
      }).then((result) => {
        if (result.isConfirmed) {
          handlePptUploadAsGroup(group.id, file);
        }
      });
      return;
    }
    const url = URL.createObjectURL(file);
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.map((group) => {
        if (group.id === groupId) {
          const newItems = [...group.items];
          newItems[itemIndex] = {
            ...newItems[itemIndex],
            link: url,
            file: file,
            fileName: file.name,
            replacePpt: false,
          };
          return { ...group, items: newItems };
        }
        return group;
      }),
    });
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = url;
      video.onloadedmetadata = () => {
        const durationInSeconds = Math.floor(video.duration);
        setCurrentEdit((prev) => ({
          ...prev,
          groups: prev.groups.map((g) =>
            g.id === groupId ? { ...g, time: durationInSeconds } : g
          ),
        }));
      };
    } else if (file.type === "application/pdf") {
      calculatePdfTime(file, groupId, itemIndex);
    } else if (file.type === "application/msword" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      calculateDocTime(file, groupId, itemIndex);
    } else if (file.type === "text/plain") {
      calculateTxtTime(file, groupId, itemIndex);
    }
  };
  const toggleAnalyzeWithAI = (groupId, itemIndex) => {
    setCurrentEdit({
      ...currentEdit,
      groups: currentEdit.groups.map((group) => {
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
      groups: currentEdit.groups.map((group) => {
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
      const group = currentEdit.groups.find(g => g.id === currentGroupId);
      const layout = layoutOptions.find((l) => l.id === layoutId);

      // BLOCK: If group is PPT and new layout is not single
      if (group.isPptGroup && layoutId !== "single") {
        Swal.fire({
          title: "Cannot Change Layout",
          text: "PPT slide groups must remain in 'Single View' layout to preserve slide integrity.",
          icon: "warning",
          confirmButtonText: "OK",
        });
        return;
      }

      const requiredItems = layout.itemCount;
      setCurrentEdit({
        ...currentEdit,
        groups: currentEdit.groups.map((group) => {
          if (group.id === currentGroupId) {
            let newItems = [...group.items];
            if (newItems.length < requiredItems) {
              for (let i = newItems.length; i < requiredItems; i++) {
                newItems.push({
                  id: uuidv4(),
                  link: "",
                  file: null,
                  fileName: null,
                  analyzeWithAI: false,
                  replacePpt: false,
                });
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
  const openPreviewModal = () => {
    const mediaContent = getPreviewMediaContent();
    if (mediaContent.length === 0) {
      Swal.fire({
        title: "Oops!",
        text: "Please add at least one piece of content (link or file) to preview.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }
    setIsPreviewModalOpen(true);
  };
  const closePreviewModal = () => {
    setIsPreviewModalOpen(false);
  };
  const WelcomeValid = async () => {
    if (!token) {
      navigate("/");
      return;
    }
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
      try {
        const decodedToken = jwtDecode(token);
        userId = decodedToken.userId;
      } catch (error) {
        console.error("Error decoding token:", error);
        Swal.fire({
          title: "Authentication Error",
          text: "Your session may have expired or is invalid. Please log in again.",
          icon: "warning",
          confirmButtonText: "OK",
        }).then(() => {
          navigate("/");
        });
        return;
      }
    } else {
      console.warn("No authentication token found. User may not be logged in.");
      return;
    }
    try {
      const res = await axios.post(
        `${apiBaseUrl}/api/upload/existingUrl/`,
        { userId },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setUrls(res.data);
      setUrlCount(res.data.length);
    } catch (error) {
      console.error("Failed to fetch URLs:", error);
      let userMessage = "We couldn't load your URLs right now. Please try again later.";
      let iconType = "error";
      if (error.response) {
        if (error.response.status === 401 || error.response.status === 403) {
          userMessage = "It looks like your session has expired or you don't have permission. Please log in again.";
        } else if (error.response.status === 409) {
          userMessage = error.response.data?.message || "It looks like you haven't created any URLs yet. Let's get started by creating your first one!";
          iconType = "info";
          Swal.fire({
            title: "No URLs Found",
            text: userMessage,
            icon: iconType,
            confirmButtonText: "Got it!",
          });
          return;
        } else if (error.response.data && error.response.data.message) {
          userMessage = error.response.data.message;
        }
      } else if (error.request) {
        userMessage = "It seems we're having trouble connecting to the server. Please check your internet connection.";
      }
      Swal.fire({
        title: "Oops!",
        text: userMessage,
        icon: iconType,
        confirmButtonText: "OK",
      });
    }
  };
  const handleCreateUrl = () => {
    if (urlCount >= 10) {
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
          Swal.fire({
            title: "Success!",
            text: "Screen status updated.",
            icon: "success",
            confirmButtonText: "OK",
          });
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
        className={`grid grid-cols-${cols} grid-rows-${rows} gap-1 w-full h-20 border ${isSelected ? "border-blue-500" : "border-gray-300"} rounded-md overflow-hidden`}
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
        className="px-4 py-2 w-full max-w-4xl mx-auto rounded-lg h-[calc(100vh-80px)] bg-[#f1f1f1] z-50 overflow-hidden"
      >
        {isEditing ? (
          <div>
            <div className="relative flex items-center mb-1">
              <IoArrowBackCircleOutline
                className="w-10 h-10 m-4 mt-6 absolute left-0 cursor-pointer hover:text-gray-500 hover:scale-110 transition duration-200"
                onClick={handleBack}
              />
              <h2 className="text-2xl font-bold text-[#ff9f00] mx-auto">
                Edit Screen
              </h2>
            </div>
            <p className="text-center text-gray-600 mb-1">
              Edit your Screen details
            </p>
            <div className="flex flex-col px-2 rounded-lg space-y-2 bg-[#f1f1f1]">
              <div className="flex items-center">
                <input
                  type="text"
                  name="Url_Name"
                  value={currentEdit?.Url_Name || ""}
                  onChange={handleInputChange}
                  placeholder="Screen Name"
                  className="border-2 p-2 rounded-md bg-white w-full text-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex flex-col items-center ml-4">
                  <div className="flex flex-row">
                    <span className="text-sm text-gray-700 whitespace-nowrap mr-2">Custom Ticker</span>
                  </div>
                  <button
                    onClick={() => setShowCustomTicker(!showCustomTicker)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${showCustomTicker ? "bg-green-500" : "bg-gray-400"}`}
                    aria-label={`Toggle custom ticker ${showCustomTicker ? "off" : "on"}`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full transform transition-transform duration-300 ${showCustomTicker ? "translate-x-6" : ""}`}
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
                      className="border-2 p-2 rounded-md bg-white text-black font-medium text-base w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter custom ticker text"
                      value={customTickerText}
                      onChange={(e) => setCustomTickerText(e.target.value)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="" style={{ maxHeight: "250px", overflowY: "auto", zIndex: 1 }}>
                <AnimatePresence>
                  {currentEdit?.groups?.map((group, groupIndex) => (
                    <motion.div
                      key={group.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="mb-2 border border-gray-300 rounded-2xl bg-white p-2"
                      style={{ position: "relative", zIndex: 1 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <button
                            onClick={() => openLayoutModal(group.id)}
                            className="flex items-center justify-center p-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 mr-4"
                            style={{ height: "40px", width: "100px" }}
                          >
                            <BiLayout className="mr-1" />
                            <span className="text-sm">{getLayoutName(group.layout)}</span>
                          </button>
                          {/* PPT Group Indicator */}
                          {group.isPptGroup && (
                            <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 mr-4">
                              <div className="flex items-center gap-2">
                                <span className="text-blue-700 font-medium text-sm">PPT Slides</span>
                                <span className="text-blue-600 text-xs bg-blue-100 px-2 py-1 rounded-full">
                                  {group.slideCount} slides
                                </span>
                                <button
                                  onClick={() => replacePptGroup(group.id)}
                                  className="text-blue-600 text-xs hover:underline ml-2 bg-blue-200 px-2 py-1 rounded"
                                >
                                  Replace PPT
                                </button>
                                <button
                                  onClick={() => toggleGroupExpand(group.id)}
                                  className="text-blue-600 text-xs hover:underline ml-2"
                                >
                                  {expandedGroups.has(group.id) ? "Collapse ▲" : "Expand ▼"}
                                </button>
                              </div>
                              <div className="text-xs text-gray-600 mt-1 truncate max-w-xs">
                                {group.displayName}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={addNewGroup}
                            className="p-1 bg-green-500 text-white rounded-xl mr-2"
                            style={{
                              width: "70px",
                              height: "35px",
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
                                  width: "35px",
                                  height: "35px",
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
                                  width: "35px",
                                  height: "35px",
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
                                  width: "40px",
                                  height: "36px",
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
                      {/* Show group-level controls (time, schedule) - always visible */}
                      <div className="flex flex-wrap gap-4 items-end mb-3 bg-gray-50 p-3 rounded-lg">
                        <div>
                          <label className="block mb-1 text-sm text-gray-700 font-medium">
                            {group.isPptGroup ? "Time per Slide" : "Enter Time"}
                          </label>
                          <div className="relative">
                            <IoTimeOutline className="absolute top-2 left-2 text-gray-500" />
                            <input
                              type="number"
                              className="pl-8 pr-10 py-1 border rounded-md w-28 text-center focus:ring-2 focus:ring-blue-500"
                              placeholder="Time"
                              value={group.time}
                              onChange={(e) => handleTimeChange(group.id, e.target.value)}
                            />
                            <span className="absolute right-1 top-[6px] bg-black text-white text-xs px-2 py-1 rounded-md">
                              Sec
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="block mb-1 text-sm text-gray-700 font-medium">
                            Schedule
                          </label>
                          <button
                            onClick={() => openSchedulerModal(group.id)}
                            className={`px-3 py-2 rounded-md text-sm font-medium ${group.schedule?.startTime ||
                              group.schedule?.startDate ||
                              group.schedule?.timeWindows?.some(
                                (tw) => tw.startTime || tw.endTime
                              )
                              ? "bg-blue-100 text-blue-700 border border-blue-300"
                              : "bg-gray-200 text-gray-700"
                              }`}
                          >
                            {group.schedule?.startTime ||
                              group.schedule?.startDate ||
                              group.schedule?.timeWindows?.some(
                                (tw) => tw.startTime || tw.endTime
                              ) ? (
                              <>Edit Schedule</>
                            ) : (
                              <>Add Schedule</>
                            )}
                          </button>
                        </div>
                      </div>
                      {/* Show individual items only if NOT a PPT group OR if expanded */}
                      {(!group.isPptGroup || expandedGroups.has(group.id)) && (
                        <>
                          {group.items.map((item, itemIndex) => (
                            <div
                              key={item.id}
                              className="flex items-center mb-2"
                              style={{
                                borderBottom:
                                  itemIndex < group.items.length - 1 ? "1px solid #eee" : "none",
                                paddingBottom:
                                  itemIndex < group.items.length - 1 ? "10px" : "0",
                              }}
                            >
                              <div className="flex flex-wrap gap-4 items-end flex-1 w-full">
                                {/* Slide number indicator for PPT groups */}
                                {group.isPptGroup && (
                                  <div className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full text-xs font-bold mr-4">
                                    {itemIndex + 1}
                                  </div>
                                )}
                                <div
                                  className="flex items-center border border-gray-300 rounded-md bg-[#F7F7FF] overflow-hidden flex-1 min-w-0"
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const files = Array.from(e.dataTransfer.files);
                                    if (files.length > 0) {
                                      handleFileDrop(group.id, itemIndex, files);
                                    }
                                  }}
                                  onDragOver={(e) => e.preventDefault()}
                                >
                                  <button
                                    type="button"
                                    className="h-8 px-4 text-white bg-[#363736] flex items-center justify-center hover:bg-blue-700 min-w-[80px]"
                                    onClick={() =>
                                      document.getElementById(`file-input-${group.id}-${item.id}`).click()
                                    }
                                  >
                                    <FaFileArrowUp className="text-lg mr-2" />
                                    <span style={{ fontFamily: "Outfit", fontSize: "12px" }}>Upload</span>
                                  </button>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".jpg,.jpeg,.png,.gif,.svg,.mp4,.webm,.mov,.pdf,.ppt,.pptx,.doc,.docx,.txt" onChange={(e) => handleFileUpload(group.id, itemIndex, e)}
                                    id={`file-input-${group.id}-${item.id}`}
                                  />
                                  <input
                                    type="text"
                                    className="flex-1 px-3 py-2 text-sm placeholder-gray-500 bg-[#F7F7FF] text-black focus:outline-none min-w-0"
                                    value={item.file ? item.fileName || item.file.name : item.link}
                                    placeholder={group.isPptGroup ? `Slide ${itemIndex + 1} Content` : "Embedded Link or Upload"}
                                    onChange={(e) => {
                                      setCurrentEdit((prev) => ({
                                        ...prev,
                                        groups: prev.groups.map((g) => {
                                          if (g.id === group.id) {
                                            const updatedItems = [...g.items];
                                            updatedItems[itemIndex].link = e.target.value;
                                            updatedItems[itemIndex].file = null;
                                            updatedItems[itemIndex].fileName = null;
                                            return { ...g, items: updatedItems };
                                          }
                                          return g;
                                        }),
                                      }));
                                    }}
                                  />
                                </div>
                                {/* Move buttons for reordering (shown for PPT when expanded, and always for non-PPT multi-item) */}
                                {group.items.length > 1 && (
                                  <div className="flex items-center ml-2 space-x-1">
                                    <button
                                      onClick={() => moveItemUp(group.id, itemIndex)}
                                      className="p-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-600"
                                      style={{
                                        width: "32px",
                                        height: "32px",
                                      }}
                                      disabled={itemIndex === 0}
                                      title="Move Up"
                                    >
                                      <AiOutlineArrowUp size={16} />
                                    </button>
                                    <button
                                      onClick={() => moveItemDown(group.id, itemIndex)}
                                      className="p-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-600"
                                      style={{
                                        width: "32px",
                                        height: "32px",
                                      }}
                                      disabled={itemIndex === group.items.length - 1}
                                      title="Move Down"
                                    >
                                      <AiOutlineArrowDown size={16} />
                                    </button>
                                  </div>
                                )}
                                {/* Delete button only for non-PPT groups */}
                                {!group.isPptGroup && group.items.length > 1 && (
                                  <button
                                    onClick={() => deleteItem(group.id, item.id)}
                                    className="p-1 bg-red-500 text-white rounded hover:bg-red-600 ml-2"
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                    }}
                                    title="Delete Item"
                                  >
                                    <RiDeleteBin6Line size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="flex item-center justify-center space-x-4">
                <button
                  className="w-full py-3 text-center items-center text-white font-semibold rounded-lg flex justify-center"
                  style={{
                    width: "168px",
                    height: "48px",
                    backgroundColor: "#363736",
                    marginTop: "10px",
                    marginBottom: "30px",
                    position: "relative",
                    zIndex: 1,
                  }}
                  onClick={openPreviewModal}
                >
                  <FaEye className="mr-2" />
                  Preview
                </button>
                <button
                  className="w-full py-3 text-center items-center text-white font-semibold rounded-lg"
                  style={{
                    width: "168px",
                    height: "48px",
                    backgroundColor: "#363736",
                    marginTop: "10px",
                    marginBottom: "30px",
                    position: "relative",
                    zIndex: 1,
                  }}
                  onClick={handleUpdate}
                >
                  Update Now
                </button>
              </div>
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
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${url.isEnabled ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${url.isEnabled ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </button>
                    <span
                      className={`text-sm px-2 py-1 rounded-full ${url.isEnabled ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100"}`}
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
                  zIndex: "1",
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
                  onChange={(e) =>
                    setScheduledAt(new Date(e.target.value).toISOString())
                  }
                />
              </label>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Schedule End (optional):
                <input
                  type="datetime-local"
                  className="w-full p-2 border rounded mt-1"
                  onChange={(e) =>
                    setExpiresAt(new Date(e.target.value).toISOString())
                  }
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
                      Swal.fire({
                        title: "Success!",
                        text: "Screen status updated.",
                        icon: "success",
                        confirmButtonText: "OK",
                      });
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
              {layoutOptions.map((layout) => {
                const isDisabled = currentEdit.groups.isPptGroup && layout.id !== "single";
                return (
                  <button
                    key={layout.id}
                    onClick={() => !isDisabled && selectLayout(layout.id)}
                    disabled={isDisabled}
                    className={`p-3 border rounded-md hover:bg-gray-50 ${isDisabled
                        ? "opacity-50 cursor-not-allowed border-gray-300"
                        : currentEdit.groups.find((g) => g.id === currentGroupId)?.layout === layout.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300"
                      }`}
                  >
                    <div className="text-sm font-medium mb-2">
                      {layout.name}
                      {isDisabled && " (PPT: Single only)"}
                    </div>
                    {renderLayoutPreview(
                      layout.id,
                      currentEdit.groups.find((g) => g.id === currentGroupId)?.layout === layout.id
                    )}
                  </button>
                );
              })}
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
                schedule={currentEdit.groups.find((g) => g.id === currentSchedulerGroupId).schedule}
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
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-5xl h-[80vh] overflow-hidden relative">
            <div className="flex justify-between items-center p-4 bg-gray-100">
              <h3 className="text-xl font-semibold">Screen Preview</h3>
              <button
                onClick={closePreviewModal}
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
            <div className="w-full h-[calc(100%-60px)]">
              <PreviewContent
                mediaContent={getPreviewMediaContent()}
                customTicker={showCustomTicker ? customTickerText : ""}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default EditUrl;