import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import {
  FaPlay,
  FaPause,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
} from "react-icons/fa";
import "./preview.css";
import { Clock } from "lucide-react";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";
import { Powerpoint } from "react-pptx";
import YouTubeLive from "./YouTubeLive";
import WebpageEmbed from "./WebpageEmbed";

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
const weatherApiKey = process.env.REACT_APP_WEATHER_API_KEY;
const newsApiKey = process.env.REACT_APP_NEWS_API_KEY;

// Function to check if the URL is a Power BI URL
const isPowerBIUrl = (url) => {
  return url && url.includes("powerbi.com");
};

const isYouTubeLiveUrl = (url) => {
  const youtubePatterns = [
    /youtube\.com\/live\//,
    /youtube\.com\/watch\?v=.+(&|\?)is_live=true/,
    /youtube\.com\/channel\/.+\/live/,
    /youtu\.be\/.+(&|\?)is_live=true/,
  ];

  return youtubePatterns.some((pattern) => pattern.test(url));
};

// General YouTube URL checker
const isYouTubeUrl = (url) => {
  return url && (
    url.includes("youtube.com/watch") ||
    url.includes("youtube.com/live") ||
    url.includes("youtu.be") ||
    url.includes("youtube.com/embed") ||
    url.includes("youtube.com/v")
  );
};

// ImageCollage component (already included in your code)
const ImageCollage = ({ images, layout }) => {
  const getGridClass = () => {
    switch (layout.toLowerCase()) {
      case '2x2':
        return 'grid grid-cols-2 grid-rows-2 gap-1 w-full h-full';
      case '3x3':
        return 'grid grid-cols-3 grid-rows-3 gap-1 w-full h-full';
      case '1x2':
        return 'grid grid-cols-2 grid-rows-1 gap-1 w-full h-full';
      case '2x1':
        return 'grid grid-cols-1 grid-rows-2 gap-1 w-full h-full';
      case '1x3':
        return 'grid grid-cols-3 grid-rows-1 gap-1 w-full h-full';
      case '3x1':
        return 'grid grid-cols-1 grid-rows-3 gap-1 w-full h-full';
      case 'single':
      default:
        return 'flex justify-center items-center w-full h-full';
    }
  };

  return (
    <div className={`${getGridClass()} bg-black`}>
      {images.map((image, index) => (
        <div key={index} className="w-full h-full overflow-hidden">
          <img
            src={getContentUrl(image.content)}
            alt={`Collage ${index + 1}`}
            className="w-full h-full object-contain"
          />
        </div>
      ))}
    </div>
  );
};

const Preview = () => {
  const { url } = useParams();
  const [mediaContent, setMediaContent] = useState([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);

  // Scheduling state
  const [scheduledAt, setScheduledAt] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [countdownType, setCountdownType] = useState(null);

  // Weather and News State
  const [weather, setWeather] = useState(null);
  const [news, setNews] = useState([]);
  const [dateTime, setDateTime] = useState(new Date());
  const [file, setFile] = useState(null);
  const [mediaData, setMediaData] = useState({
    content: [],
    layout: 'single',
    isEnabled: true
  });

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

  const isScheduledNow = (schedule) => {
    if (!schedule) return true;
  
    const now = new Date();
    const nowTime = now.getHours() * 60 + now.getMinutes();
  
    const startTimeParts = schedule.startTime.split(":");
    const endTimeParts = schedule.endTime.split(":");
  
    const startMinutes = parseInt(startTimeParts[0]) * 60 + parseInt(startTimeParts[1]);
    const endMinutes = parseInt(endTimeParts[0]) * 60 + parseInt(endTimeParts[1]);
  
    const today = now.toISOString().split("T")[0];
    const startDate = schedule.startDate.split("T")[0];
    const endDate = schedule.endDate.split("T")[0];
  
    const isWithinDate =
      (!schedule.startDate || today >= startDate) &&
      (!schedule.endDate || today <= endDate);
  
    const isWithinTime = nowTime >= startMinutes && nowTime <= endMinutes;
  
    return isWithinDate && isWithinTime;
  };

  // Fetch media content
  const fetchData = async () => {
    try {
      const response = await axios.post(`${apiBaseUrl}/api/upload/preview/${url}`);
      if (response.data) {
        const content = response.data.url_content || [];
        const activeContent = content.filter((item) => isScheduledNow(item.schedule));
        
        setMediaContent({
          ...response.data,
          url_content: activeContent
        });
        
        setIsEnabled(response.data.isEnabled);
        setScheduledAt(response.data.scheduledAt ? new Date(response.data.scheduledAt) : null);
        setExpiresAt(response.data.expiresAt ? new Date(response.data.expiresAt) : null);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("Error fetching preview content:", error);
    }
  };

  // Fetch weather data
  const fetchWeather = async (location = "Mumbai") => {
    if (!weatherApiKey) {
      console.error("Weather API key is missing.");
      return;
    }

    try {
      const url = `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${location}&aqi=yes`;
      const response = await axios.get(url);
      setWeather(response.data);
    } catch (error) {
      console.error("Error fetching weather:", error);
    }
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

  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchNews = async () => {
    try {
      const feeds = [
        "https://timesofindia.indiatimes.com/rssfeeds/1898055.cms",
        "https://www.businesstoday.in/rssfeeds/30562834.rss",
        "https://economictimes.indiatimes.com/rssfeedsdefault.cms",
        "https://www.business-standard.com/rss/latest.rss",
      ];

      const responses = await Promise.all(
        feeds.map(
          (feed) =>
            axios
              .get(
                `${apiBaseUrl}/api/upload/parse-rss?url=${encodeURIComponent(
                  feed
                )}`
              )
              .then((res) => res.data.items || [])
              .catch(() => [])
        )
      );

      const rssArticles = responses.flat().slice(0, 8);

      if (rssArticles.length > 0) {
        setNews(rssArticles);
        return;
      }

      const fallbackResponse = await axios.get(
        `https://gnews.io/api/v4/top-headlines?country=in&token=${newsApiKey}`
      );
      setNews(fallbackResponse.data.articles.slice(0, 8));
    } catch (error) {
      console.error("Error fetching news:", error);
      setNews([]);
    }
  };

  useEffect(() => {
    fetchWeather();
    fetchNews();
  }, []);

  useEffect(() => {
    fetchData();
    const refreshInterval = setInterval(fetchData, 30000);
    return () => clearInterval(refreshInterval);
  }, [url]);

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
    }
    else if (expiresAt && now < expiresAt) {
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
    }
    else if (expiresAt && now >= expiresAt) {
      setIsEnabled(false);
      setCountdownType(null);
    }
  }, [scheduledAt, expiresAt]);

  useEffect(() => {
    if (mediaContent.length > 0 && !isPaused && isEnabled) {
      const delay = mediaContent[currentIndex]?.time * 1000 || 15000;

      console.log(`Current Index: ${currentIndex}, Delay: ${delay}ms`);

      const timer = setTimeout(() => {
        if (currentIndex + 1 >= mediaContent.length) {
          fetchData();
        } else {
          setCurrentIndex((prevIndex) => prevIndex + 1);
        }
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [mediaContent, currentIndex, isPaused, isEnabled]);

  useEffect(() => {
    if (videoRef.current) {
      isPaused ? videoRef.current.pause() : videoRef.current.play();
    }
  }, [isPaused]);

  const togglePlayPause = () => {
    setIsPaused((prev) => !prev);
    setShowControls(true);
    autoHideControls();
  };

  const goNext = () => {
    if (currentIndex + 1 >= mediaContent.length) {
      fetchData();
    } else {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % mediaContent.length);
    }
    setShowControls(true);
    autoHideControls();
  };

  const goPrev = () => {
    setCurrentIndex(
      (prevIndex) => (prevIndex - 1 + mediaContent.length) % mediaContent.length
    );
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

    const excludedExtensions = [
      ".mp4",
      ".pdf",
      ".ppt",
      ".pptx",
      ".doc",
      ".docx",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
    ];

    const hasExcludedExtension = excludedExtensions.some((ext) =>
      url.toLowerCase().endsWith(ext)
    );

    const isSpecialUrl = isPowerBIUrl(url) || isYouTubeLiveUrl(url);

    return (
      (url.startsWith("http://") || url.startsWith("https://")) &&
      !isSpecialUrl &&
      !hasExcludedExtension
    );
  };

  const renderDocumentContent = (content) => {
    const fileType = content.split(".").pop().toLowerCase();
    const fileUrl = encodeURIComponent(getContentUrl(content));

    if (fileType === "pdf") {
      return (
        <iframe
          src={getContentUrl(mediaContent[currentIndex].content)}
          width="100%"
          height="100%"
          frameBorder="0"
          title="PDF Viewer"
          className="document-iframe"
        />
      );
    }

    if (
      fileType === "ppt" ||
      fileType === "pptx" ||
      fileType === "doc" ||
      fileType === "docx"
    ) {
      return (
        <iframe
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(getContentUrl(mediaContent[currentIndex].content))}`}
          width="100%"
          height="100%"
          frameBorder="0"
          title={`${fileType.toUpperCase()} Viewer`}
          className="document-iframe"
        />
      );
    }

    return null;
  };

  // Modified render logic to include collage support
  const renderContent = () => {
    const currentContent = mediaContent.url_content?.[currentIndex];
    if (!currentContent) return null;

    // Check if we should display as collage
    if (mediaContent.layout && mediaContent.layout.toLowerCase() !== 'single') {
      return (
        <ImageCollage 
          images={mediaContent.url_content} 
          layout={mediaContent.layout.toLowerCase()} 
        />
      );
    }

    // Handle single content items
    if (isPowerBIUrl(currentContent.content)) {
      return (
        <iframe
          src={getContentUrl(currentContent.content)}
          className="w-screen h-screen"
          title="Embedded Power BI Report"
          frameBorder="0"
          allowFullScreen
        />
      );
    } else if (isWebpageUrl(currentContent.content)) {
      return (
        <WebpageEmbed
          webpageUrl={getContentUrl(currentContent.content)}
        />
      );
    } else if (currentContent.content.endsWith(".mp4")) {
      return (
        <video
          ref={videoRef}
          src={getContentUrl(currentContent.content)}
          autoPlay
          muted
          className="w-screen h-screen object-contain transition-all duration-700"
          onTimeUpdate={(e) =>
            setProgress((e.target.currentTime / e.target.duration) * 100)
          }
        />
      );
    } else if (
      currentContent.content.endsWith(".pdf") ||
      currentContent.content.endsWith(".pptx") ||
      currentContent.content.endsWith(".ppt") ||
      currentContent.content.endsWith(".docx") ||
      currentContent.content.endsWith(".doc")
    ) {
      return renderDocumentContent(currentContent.content);
    } else if (isYouTubeUrl(currentContent.content)) {
      return (
        <YouTubeLive
          liveUrl={getContentUrl(currentContent.content)}
          showControls={false}
        />
      );
    } else {
      return (
        <img
          src={getContentUrl(currentContent.content)}
          alt="Preview content"
          className="w-screen h-screen object-contain transition-all duration-700"
        />
      );
    }
  };

  return (
    <div
      className="relative flex justify-center items-center w-screen h-screen bg-black overflow-hidden"
      onClick={togglePlayPause}
    >
      {!isEnabled ? (
        <div className="text-center text-white">
          {countdownType === "start" ? (
            <div className="flex flex-col items-center">
              <FaClock size={60} className="mb-4 text-yellow-400" />
              <h2 className="text-3xl font-bold mb-2">
                This URL will be active in:
              </h2>
              <div className="text-5xl font-mono bg-gray-800 px-8 py-4 rounded-lg shadow-lg">
                {formatTimeRemaining(timeRemaining)}
              </div>
            </div>
          ) : (
            <p className="text-2xl font-bold">
              This URL is currently inactive.
            </p>
          )}
        </div>
      ) : mediaContent.url_content?.length > 0 ? (
        <div className="media-preview relative w-full h-full">
          {renderContent()}
        </div>
      ) : (
        <p className="text-white text-xl font-bold">
          This URL has no content to display.
        </p>
      )}

      {/* Expiry Countdown Timer */}
      {isEnabled && countdownType === "end" && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-3 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <FaClock size={20} className="text-red-400" />
            <span className="font-mono">
              {formatTimeRemaining(timeRemaining)}
            </span>
          </div>
        </div>
      )}

      {/* Weather & AQI Widget */}
      {weather && (
        <div className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white p-3 rounded-lg backdrop-blur-sm flex items-center gap-2">
          <img
            src={`https:${weather.current.condition.icon}`}
            alt="Weather Icon"
            className="w-10 h-10"
          />
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

      {/* Clock Section */}
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

      {/* News Ticker */}
      {news.length > 0 && (
        <div className="absolute bottom-16 left-0 w-full overflow-hidden bg-black bg-opacity-70 py-3">
          <div className="news-ticker-container relative w-full">
            <div className="news-ticker">
              {news.map((article, index) => (
                <span
                  key={`news-item-1-${index}`}
                  className="news-item inline-block px-6 text-white text-lg"
                >
                  <strong>{article.title}</strong> -{" "}
                  {formatDescription(article.description)}
                </span>
              ))}
              {news.map((article, index) => (
                <span
                  key={`news-item-2-${index}`}
                  className="news-item inline-block px-6 text-white text-lg"
                >
                  <strong>{article.title}</strong> -{" "}
                  {formatDescription(article.description)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      {showControls &&
        isEnabled &&
        mediaContent.url_content?.length > 0 &&
        !isPowerBIUrl(mediaContent.url_content?.[currentIndex]?.content) && (
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