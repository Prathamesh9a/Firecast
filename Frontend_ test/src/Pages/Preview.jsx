import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import {
  FaPlay,
  FaPause,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
} from "react-icons/fa";
import "./preview.css";
import { Clock } from "lucide-react";
import YouTubeLive from "./YouTubeLive";
import WebpageEmbed from "./WebpageEmbed";

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
const weatherApiKey = process.env.REACT_APP_WEATHER_API_KEY;
const newsApiKey = process.env.REACT_APP_NEWS_API_KEY;

// Layout options
const layoutOptions = [
  { id: "single", name: "Single View", cols: 1, rows: 1 },
  { id: "2x1", name: "2 Items Horizontal", cols: 2, rows: 1 },
  { id: "1x2", name: "2 Items Vertical", cols: 1, rows: 2 },
  { id: "2x2", name: "4 Items Grid", cols: 2, rows: 2 },
  { id: "3x1", name: "3 Items Horizontal", cols: 3, rows: 1 },
  { id: "1x3", name: "3 Items Vertical", cols: 1, rows: 3 },
];

// Fallback item to prevent blank screen
const fallbackItem = {
  layout: "single",
  time: 10,
  originalIndex: 0,
};

// Cache for API responses
const cache = {
  weather: { data: null, timestamp: null, ttl: 15 * 60 * 1000 }, // 15 minutes
  news: { data: null, timestamp: null, ttl: 30 * 60 * 1000 }, // 30 minutes
};

// Fallback UI with blank screen and centered text
const renderFallbackUI = (message, countdownType, timeRemaining, formatTimeRemaining) => (
  <div className="w-full h-full bg-black flex flex-col items-center justify-center">
    <p className="text-white text-2xl font-bold">{message}</p>
    {message === "Wait, your content is loading" && (
      <div className="mt-4 animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-white"></div>
    )}
    {countdownType === "start" && (
      <div className="flex items-center gap-2 mt-4">
        <FaClock size={20} className="text-yellow-400" />
        <span className="text-xl font-mono text-white">
          {formatTimeRemaining(timeRemaining)}
        </span>
      </div>
    )}
  </div>
);

// Function to check if the URL is a Power BI URL
const isPowerBIUrl = (url) => {
  return url && url.includes("powerbi.com");
};

const isYouTubeLiveUrl = (url) => {
  const youtubePatterns = [
    /youtube\.com\/live\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)(&|\?).*?\blive\b/,
    /youtube\.com\/channel\/[^/]+\/live/,
    /youtu\.be\/([a-zA-Z0-9_-]+)(\?.*)?\blive\b/,
  ];
  return youtubePatterns.some((pattern) => pattern.test(url));
};

const isYouTubeUrl = (url) => {
  return (
    url &&
    (url.includes("youtube.com/watch") ||
      url.includes("youtube.com/live") ||
      url.includes("youtu.be") ||
      url.includes("youtube.com/embed") ||
      url.includes("youtube.com/v"))
  );
};

// DocumentContent Component
const DocumentContent = ({ content, getContentUrl }) => {
  const fileType = content.split(".").pop().toLowerCase();
  const fileUrl = encodeURIComponent(getContentUrl(content));
  const { ref, inView } = useInView({ triggerOnce: true });

  if (fileType === "pdf") {
    return (
      <div ref={ref} className="w-full h-full">
        {inView ? (
          <iframe
            src={getContentUrl(content)}
            width="100%"
            height="100%"
            frameBorder="0"
            title="PDF Viewer"
            className="document-iframe"
          />
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
      </div>
    );
  }
  if (fileType === "ppt" || fileType === "pptx" || fileType === "doc" || fileType === "docx") {
    return (
      <div ref={ref} className="w-full h-full">
        {inView ? (
          <iframe
            src={getContentUrl(content)}
            width="100%"
            height="100%"
            frameBorder="0"
            title={`${fileType.toUpperCase()} Viewer`}
            className="document-iframe"
          />
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// MediaItem Component
const MediaItem = ({ content, index, isPaused, setProgress, getContentUrl, isWebpageUrl, videoRefs }) => {
  const { ref, inView } = useInView({ triggerOnce: true });

  useEffect(() => {
    if (videoRef.current) {
      videoRefs.current[index] = videoRef.current;
    }
  }, [index, videoRefs]);

  const videoRef = useRef(null);

  if (!content || !content.content) return null;

  if (isPowerBIUrl(content.content)) {
    return (
      <iframe
        src={getContentUrl(content.content)}
        className="w-full h-full"
        title="Embedded Power BI Report"
        frameBorder="0"
        allowFullScreen
      />
    );
  } else if (isWebpageUrl(content.content)) {
    return <WebpageEmbed webpageUrl={getContentUrl(content.content)} />;
  } else if (content.content.endsWith(".mp4")) {
    return (
      <div ref={ref} className="w-full h-full">
        {inView ? (
          <video
            ref={videoRef}
            src={getContentUrl(content.content)}
            autoPlay={!isPaused}
            muted
            className="w-full h-full object-contain"
            onTimeUpdate={(e) =>
              setProgress((e.target.currentTime / e.target.duration) * 100)
            }
          />
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
      </div>
    );
  } else if (
    content.content.endsWith(".pdf") ||
    content.content.endsWith(".pptx") ||
    content.content.endsWith(".ppt") ||
    content.content.endsWith(".docx") ||
    content.content.endsWith(".doc")
  ) {
    return <DocumentContent content={content.content} getContentUrl={getContentUrl} />;
  } else if (isYouTubeUrl(content.content)) {
    return <YouTubeLive liveUrl={getContentUrl(content.content)} showControls={false} />;
  } else {
    return (
      <div ref={ref} className="w-full h-full">
        {inView ? (
          <img
            src={getContentUrl(content.content)}
            alt="Preview content"
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
      </div>
    );
  }
};

const Preview = () => {
  const { url } = useParams();
  const [mediaContent, setMediaContent] = useState([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRefs = useRef({});
  const [currentLayout, setCurrentLayout] = useState("single");
  const [visibleItems, setVisibleItems] = useState([fallbackItem]);
  const [activeSlideshow, setActiveSlideshow] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [countdownType, setCountdownType] = useState(null);
  const [weather, setWeather] = useState(null);
  const [news, setNews] = useState([]);
  const [dateTime, setDateTime] = useState(new Date());
  const [customTicker, setCustomTicker] = useState(null);
  const [allContent, setAllContent] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Format time remaining for display
  const formatTimeRemaining = (milliseconds) => {
    if (milliseconds <= 0) return "00:00:00";
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatDescription = (description) => {
    const strippedDescription = description.replace(/<[^>]*>/g, "");
    return strippedDescription;
  };

  // Helper function to determine if a time window is active now
  const isTimeWindowActive = (timeWindow) => {
    if (!timeWindow || !timeWindow.startTime || !timeWindow.endTime) return true;

    const now = new Date();
    const nowTime = now.getHours() * 60 + now.getMinutes();

    const startTimeParts = timeWindow.startTime.split(":");
    const endTimeParts = timeWindow.endTime.split(":");

    const startMinutes = parseInt(startTimeParts[0]) * 60 + parseInt(startTimeParts[1]);
    const endMinutes = parseInt(endTimeParts[0]) * 60 + parseInt(endTimeParts[1]);

    return nowTime >= startMinutes && nowTime <= endMinutes;
  };

  // Enhanced scheduled check function with displayMode and priority handling
  const isScheduledNow = (schedule) => {
    if (!schedule) return true;

    if (
      !schedule.startTime &&
      !schedule.endTime &&
      !schedule.startDate &&
      !schedule.endDate &&
      !schedule.timeWindows
    ) {
      return true;
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    let isWithinDate = true;
    if (schedule.startDate) {
      const startDate = schedule.startDate.split("T")[0];
      isWithinDate = isWithinDate && today >= startDate;
    }
    if (schedule.endDate) {
      const endDate = schedule.endDate.split("T")[0];
      isWithinDate = isWithinDate && today <= endDate;
    }

    if (!isWithinDate) return false;

    let isWithinTimeWindow = false;

    if (schedule.timeWindows && schedule.timeWindows.length > 0) {
      isWithinTimeWindow = schedule.timeWindows.some((window) => isTimeWindowActive(window));
    } else if (schedule.startTime && schedule.endTime) {
      const nowTime = now.getHours() * 60 + now.getMinutes();
      const startTimeParts = schedule.startTime.split(":");
      const endTimeParts = schedule.endTime.split(":");
      const startMinutes = parseInt(startTimeParts[0]) * 60 + parseInt(startTimeParts[1]);
      const endMinutes = parseInt(endTimeParts[0]) * 60 + parseInt(endTimeParts[1]);
      isWithinTimeWindow = nowTime >= startMinutes && nowTime <= endMinutes;
    } else {
      isWithinTimeWindow = true;
    }

    return isWithinDate && isWithinTimeWindow;
  };

  const groupMediaByLayout = (content) => {
    const groupedContent = {};
    content.forEach((item, index) => {
      const layoutKey = item.layout || "single";
      if (!groupedContent[layoutKey]) {
        groupedContent[layoutKey] = [];
      }
      groupedContent[layoutKey].push({ ...item, originalIndex: index });
    });
    return groupedContent;
  };

  const getActiveContent = (content) => {
    const now = new Date();

    const exclusiveContent = content.filter(
      (item) => isScheduledNow(item.schedule) && item.schedule?.displayMode === "exclusive"
    );

    if (exclusiveContent.length > 0) {
      return exclusiveContent.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityA = priorityOrder[a.schedule?.priority] || 0;
        const priorityB = priorityOrder[b.schedule?.priority] || 0;
        return priorityB - priorityA;
      });
    }

    const activeContent = content.filter((item) => isScheduledNow(item.schedule));

    return activeContent.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityA = priorityOrder[a.schedule?.priority] || 0;
      const priorityB = priorityOrder[b.schedule?.priority] || 0;
      return priorityB - priorityA;
    });
  };

  const preloadMedia = (content) => {
    if (content.length > 0 && content[0].content) {
      const url = getContentUrl(content[0].content);
      const link = document.createElement("link");
      link.rel = "preload";
      link.href = url;
      link.as = content[0].content.endsWith(".mp4") ? "video" : "image";
      document.head.appendChild(link);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/api/upload/preview/${url}`);
      if (response.data) {
        const content = response.data.url_content || [];
        setAllContent(content);
        const activeContent = getActiveContent(content);
        setMediaContent(activeContent);
        if (activeContent.length > 0) {
          const firstLayout = activeContent[0].layout || "single";
          setCurrentLayout(firstLayout);
          setCurrentIndex(0);
          const groupedContent = groupMediaByLayout(activeContent);
          updateVisibleItems(firstLayout, groupedContent, 0);
          preloadMedia(activeContent);
        } else {
          setVisibleItems([fallbackItem]);
        }
        setIsEnabled(response.data.isEnabled);
        setScheduledAt(response.data.scheduledAt ? new Date(response.data.scheduledAt) : null);
        setExpiresAt(response.data.expiresAt ? new Date(response.data.expiresAt) : null);
        setCustomTicker(response.data.custom_ticker || null);
      } else {
        setVisibleItems([fallbackItem]);
      }
    } catch (error) {
      console.error("Error fetching preview content:", error);
      setVisibleItems([fallbackItem]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWeather = async (location = "Mumbai") => {
    if (!weatherApiKey) {
      console.error("Weather API key is missing.");
      return;
    }
    const now = Date.now();
    if (cache.weather.data && cache.weather.timestamp && now - cache.weather.timestamp < cache.weather.ttl) {
      setWeather(cache.weather.data);
      return;
    }
    try {
      const url = `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${location}&aqi=yes`;
      const response = await axios.get(url);
      cache.weather.data = response.data;
      cache.weather.timestamp = now;
      setWeather(response.data);
    } catch (error) {
      console.error("Error fetching weather:", error);
    }
  };

  const fetchNews = async () => {
    const now = Date.now();
    if (cache.news.data && cache.news.timestamp && now - cache.news.timestamp < cache.news.ttl) {
      setNews(cache.news.data);
      return;
    }
    try {
      const feeds = [
        "https://timesofindia.indiatimes.com/rssfeeds/1898055.cms",
        "https://www.businesstoday.in/rssfeeds/30562834.rss",
        "https://economictimes.indiatimes.com/rssfeedsdefault.cms",
        "https://www.business-standard.com/rss/latest.rss",
      ];
      const responses = await Promise.all(
        feeds.map((feed) =>
          axios
            .get(`${apiBaseUrl}/api/upload/parse-rss?url=${encodeURIComponent(feed)}`)
            .then((res) => res.data.items || [])
            .catch(() => [])
        )
      );
      const rssArticles = responses.flat().slice(0, 8);
      let articles = rssArticles;
      if (rssArticles.length === 0) {
        const fallbackResponse = await axios.get(
          `https://gnews.io/api/v4/top-headlines?country=in&token=${newsApiKey}`
        );
        articles = fallbackResponse.data.articles.slice(0, 8);
      }
      cache.news.data = articles;
      cache.weather.timestamp = now;
      setNews(articles);
    } catch (error) {
      console.error("Error fetching news:", error);
      setNews([]);
    }
  };

  const updateVisibleItems = (layout, groupedContent, index) => {
    const layoutConfig = layoutOptions.find((option) => option.id === layout) || layoutOptions[0];
    const itemsPerPage = layoutConfig.cols * layoutConfig.rows;
    const allItems = mediaContent.length > 0
      ? mediaContent.map((item, idx) => ({ ...item, originalIndex: idx }))
      : [fallbackItem];

    if (index >= allItems.length) {
      setVisibleItems([fallbackItem]);
      return;
    }

    const currentItem = allItems[index];
    const currentLayout = currentItem?.layout || "single";

    if (currentLayout !== layout) {
      setCurrentLayout(currentLayout);
    }

    const start = index;
    const end = Math.min(start + itemsPerPage, allItems.length);
    const itemsToDisplay = allItems.slice(start, end);
    setVisibleItems(itemsToDisplay.length > 0 ? itemsToDisplay : [fallbackItem]);
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetchWeather(`${latitude},${longitude}`);
        },
        (error) => {
          console.error("Error getting location:", error);
          fetchWeather("Mumbai");
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
      fetchWeather("Mumbai");
    }
  };

  // Combined data fetching
  useEffect(() => {
    const loadData = async () => {
      await fetchData();
      setTimeout(async () => {
        await Promise.all([fetchWeather(), fetchNews()]);
      }, 5000);
    };
    loadData();
    const refreshInterval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [url]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
      if (allContent.length > 0) {
        const newActiveContent = getActiveContent(allContent);
        setMediaContent(newActiveContent);
        if (JSON.stringify(newActiveContent) !== JSON.stringify(mediaContent)) {
          setCurrentIndex(0);
          if (newActiveContent.length > 0) {
            const firstLayout = newActiveContent[0].layout || "single";
            setCurrentLayout(firstLayout);
            const groupedContent = groupMediaByLayout(newActiveContent);
            updateVisibleItems(firstLayout, groupedContent, 0);
          } else {
            setVisibleItems([fallbackItem]);
          }
        }
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [allContent, mediaContent]);

  useEffect(() => {
    const now = new Date();
    if (scheduledAt && now < scheduledAt) {
      setIsEnabled(false);
      setCountdownType("start");
      const timerInterval = setInterval(() => {
        const currentTime = new Date();
        const timeUntilStart = scheduledAt - currentTime;
        if (timeUntilStart <= 0) {
          setIsEnabled(true);
          setCountdownType(null);
          clearInterval(timerInterval);
          fetchData();
        } else {
          setTimeRemaining(timeUntilStart);
        }
      }, 1000);
      return () => clearInterval(timerInterval);
    } else if (expiresAt && now < expiresAt) {
      setIsEnabled(true);
      setCountdownType("end");
      const timerInterval = setInterval(() => {
        const currentTime = new Date();
        const timeUntilExpiry = expiresAt - currentTime;
        if (timeUntilExpiry <= 0) {
          setIsEnabled(false);
          setCountdownType(null);
          clearInterval(timerInterval);
          fetchData();
        } else {
          setTimeRemaining(timeUntilExpiry);
        }
      }, 1000);
      return () => clearInterval(timerInterval);
    } else if (expiresAt && now >= expiresAt) {
      setIsEnabled(false);
      setCountdownType(null);
    }
    if (!isEnabled && visibleItems.length === 0) {
      setVisibleItems([fallbackItem]);
    }
  }, [scheduledAt, expiresAt, isEnabled]);

  useEffect(() => {
    if (mediaContent.length > 0 && isEnabled) {
      if (!isPaused) {
        setActiveSlideshow(true);
        const currentItemIndex = currentIndex % mediaContent.length;
        const currentItem = mediaContent[currentItemIndex];
        const currentLayout = currentItem?.layout || "single";
        setCurrentLayout(currentLayout);
        const layoutConfig = layoutOptions.find((option) => option.id === currentLayout) || layoutOptions[0];
        const itemsPerPage = layoutConfig.cols * layoutConfig.rows;
        const delay = currentItem?.time * 1000 || 15000;
        const groupedContent = groupMediaByLayout(mediaContent);
        updateVisibleItems(currentLayout, groupedContent, currentIndex);

        const timer = setTimeout(() => {
          const nextIndex = currentIndex + itemsPerPage;
          if (nextIndex >= mediaContent.length) {
            setCurrentIndex(0);
            const firstLayout = mediaContent[0]?.layout || "single";
            setCurrentLayout(firstLayout);
            updateVisibleItems(firstLayout, groupedContent, 0);
          } else {
            setCurrentIndex(nextIndex);
            const nextItem = mediaContent[nextIndex];
            const nextLayout = nextItem?.layout || "single";
            setCurrentLayout(nextLayout);
            updateVisibleItems(nextLayout, groupedContent, nextIndex);
          }
        }, delay);
        return () => clearTimeout(timer);
      } else {
        setActiveSlideshow(false);
      }
    } else {
      setActiveSlideshow(false);
      if (visibleItems.length === 0 || visibleItems[0] === fallbackItem) {
        setVisibleItems([fallbackItem]);
      }
    }
  }, [mediaContent, currentIndex, isPaused, isEnabled]);

  useEffect(() => {
    Object.keys(videoRefs.current).forEach((index) => {
      const video = videoRefs.current[index];
      if (video) {
        isPaused ? video.pause() : video.play();
      }
    });
  }, [isPaused]);

  const togglePlayPause = () => {
    setIsPaused((prev) => !prev);
    setShowControls(true);
    autoHideControls();
  };

  const goNext = () => {
    const currentItem = mediaContent[currentIndex] || fallbackItem;
    const layoutConfig =
      layoutOptions.find((option) => option.id === (currentItem?.layout || "single")) || layoutOptions[0];
    const itemsPerPage = layoutConfig.cols * layoutConfig.rows;
    const nextIndex = currentIndex + itemsPerPage;
    const groupedContent = groupMediaByLayout(mediaContent.length > 0 ? mediaContent : [fallbackItem]);
    if (nextIndex >= mediaContent.length && mediaContent.length > 0) {
      setCurrentIndex(0);
      const firstLayout = mediaContent[0]?.layout || "single";
      setCurrentLayout(firstLayout);
      updateVisibleItems(firstLayout, groupedContent, 0);
    } else if (mediaContent.length === 0) {
      setVisibleItems([fallbackItem]);
    } else {
      setCurrentIndex(nextIndex);
      const nextItem = mediaContent[nextIndex];
      const nextLayout = nextItem?.layout || "single";
      setCurrentLayout(nextLayout);
      updateVisibleItems(nextLayout, groupedContent, nextIndex);
    }
    setShowControls(true);
    autoHideControls();
  };

  const goPrev = () => {
    const currentItem = mediaContent[currentIndex] || fallbackItem;
    const layoutConfig =
      layoutOptions.find((option) => option.id === (currentItem?.layout || "single")) || layoutOptions[0];
    const itemsPerPage = layoutConfig.cols * layoutConfig.rows;
    const prevIndex = Math.max(0, currentIndex - itemsPerPage);
    const groupedContent = groupMediaByLayout(mediaContent.length > 0 ? mediaContent : [fallbackItem]);
    setCurrentIndex(prevIndex);
    const prevItem = mediaContent[prevIndex] || fallbackItem;
    const prevLayout = prevItem?.layout || "single";
    setCurrentLayout(prevLayout);
    updateVisibleItems(prevLayout, groupedContent, prevIndex);
    setShowControls(true);
    autoHideControls();
  };

  const autoHideControls = () => {
    setTimeout(() => setShowControls(false), 2500);
  };

  const getContentUrl = (content) => {
    const prefix = "/api/upload/preview/";
    if (content.startsWith(prefix)) {
      return content.slice(prefix.length);
    }
    return content.startsWith("http") ? content : `${apiBaseUrl}/${content}`;
  };

  const isWebpageUrl = (url) => {
    if (!url) return false;
    const excludedExtensions = [".mp4", ".pdf", ".ppt", ".pptx", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".gif"];
    const hasExcludedExtension = excludedExtensions.some((ext) => url.toLowerCase().endsWith(ext));
    const isSpecialUrl = isPowerBIUrl(url) || isYouTubeLiveUrl(url);
    return (url.startsWith("http://") || url.startsWith("https://")) && !isSpecialUrl && !hasExcludedExtension;
  };

  const getGridClasses = () => {
    switch (currentLayout) {
      case "2x1":
        return "grid-cols-2 grid-rows-1";
      case "1x2":
        return "grid-cols-1 grid-rows-2";
      case "2x2":
        return "grid-cols-2 grid-rows-2";
      case "3x1":
        return "grid-cols-3 grid-rows-1";
      case "1x3":
        return "grid-cols-1 grid-rows-3";
      case "single":
      default:
        return "grid-cols-1 grid-rows-1";
    }
  };

  const isAnyPowerBIContent = () => {
    return visibleItems.some((item) => item && isPowerBIUrl(item.content));
  };

  return (
    <div
      className="relative flex justify-center items-center w-screen h-screen bg-black overflow-hidden"
      onClick={togglePlayPause}
    >
      {isLoading ? (
        renderFallbackUI("Wait, your content is loading", countdownType, timeRemaining, formatTimeRemaining)
      ) : !isEnabled ? (
        renderFallbackUI("This URL is currently inactive.", countdownType, timeRemaining, formatTimeRemaining)
      ) : mediaContent.length > 0 ? (
        <div className={`grid ${getGridClasses()} w-full h-full gap-2 p-2`}>
          {visibleItems.map((item, index) => (
            <div key={index} className="relative w-full h-full bg-gray-900 rounded overflow-hidden">
              <MediaItem
                content={item}
                index={currentIndex + index}
                isPaused={isPaused}
                setProgress={setProgress}
                getContentUrl={getContentUrl}
                isWebpageUrl={isWebpageUrl}
                videoRefs={videoRefs}
              />
            </div>
          ))}
        </div>
      ) : (
        renderFallbackUI("This URL has no content to display.", countdownType, timeRemaining, formatTimeRemaining)
      )}

      {isEnabled && countdownType === "end" && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-3 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <FaClock size={20} className="text-red-400" />
            <span className="font-mono">{formatTimeRemaining(timeRemaining)}</span>
          </div>
        </div>
      )}

      {weather && (
        <div className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white p-3 rounded-lg backdrop-blur-sm flex items-center gap-2">
          <img src={`https:${weather.current.condition.icon}`} alt="Weather Icon" className="w-10 h-10" />
          <div>
            <h3 className="text-xl font-semibold">{weather.location.name}</h3>
            <p className="text-lg">
              {weather.current.temp_c}°C | {weather.current.condition.text}
            </p>
            {weather.current.air_quality && (
              <p className="text-sm text-gray-300">
                AQI: {Math.round(weather.current.air_quality.pm2_5)} (PM2.5) |{" "}
                {Math.round(weather.current.air_quality.pm10)} (PM10)
              </p>
            )}
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 flex items-center gap-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-xl shadow-lg backdrop-blur-lg">
        <Clock className="w-6 h-6 text-yellow-400" />
        <div className="text-right">
          <p className="text-sm font-medium opacity-80">
            {dateTime
              .toLocaleDateString("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
              .toUpperCase()}
          </p>
          <p className="text-xl font-bold tracking-wider">
            {dateTime.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </p>
        </div>
      </div>

      {(customTicker || news.length > 0) && (
        <div className="absolute bottom-16 left-0 w-full overflow-hidden bg-black bg-opacity-70 py-3">
          <div className="news-ticker-container relative w-full">
            <div className="news-ticker">
              {customTicker ? (
                <span className="news-item inline-block px-6 text-white text-lg">{customTicker}</span>
              ) : (
                <>
                  {news.map((article, index) => (
                    <span
                      key={`news-item-1-${index}`}
                      className="news-item inline-block px-6 text-white text-lg"
                    >
                      <strong>{article.title}</strong> - {formatDescription(article.description)}
                    </span>
                  ))}
                  {news.map((article, index) => (
                    <span
                      key={`news-item-2-${index}`}
                      className="news-item inline-block px-6 text-white text-lg"
                    >
                      <strong>{article.title}</strong> - {formatDescription(article.description)}
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showControls && isEnabled && mediaContent.length > 0 && !isAnyPowerBIContent() && (
        <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 flex gap-8 z-10">
          <button
            className="bg-gray-900 bg-opacity-80 text-white p-5 rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:bg-opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
          >
            <FaChevronLeft size={25} />
          </button>
          <button
            className="bg-gray-900 bg-opacity-80 text-white p-5 rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:bg-opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
          >
            {isPaused ? <FaPlay size={25} /> : <FaPause size={25} />}
          </button>
          <button
            className="bg-gray-900 bg-opacity-80 text-white p-5 rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:bg-opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
          >
            <FaChevronRight size={25} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Preview;