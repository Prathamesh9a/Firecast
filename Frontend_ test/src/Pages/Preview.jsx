import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import io from "socket.io-client";
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
import * as pdfjsLib from "pdfjs-dist";
import { useSelector } from "react-redux";
import axios from "axios";
import Swal from "sweetalert2";

// Set the worker source to the local file in the public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || "";
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
  content: null,
};

// Default settings if none are provided by the backend
const defaultSettings = {
  ticker: {
    speed: 500,
    height: 48,
    fontSize: 16,
    visible: true,
  },
  dateTime: {
    position: "top-right",
    visible: true,
  },
  temperature: {
    position: "top-left",
    visible: true,
  },
};

// Cache for API responses
const cache = {
  weather: { data: null, timestamp: null, ttl: 15 * 60 * 1000 }, // 15 minutes
  news: { data: null, timestamp: null, ttl: 30 * 60 * 1000 }, // 30 minutes
};

const videoExtensions = [
  { ext: ".mp4", type: "video/mp4" },
  { ext: ".mov", type: "video/quicktime" },
  { ext: ".webm", type: "video/webm" },
];

// Temperature & AQI Component
const TemperatureDisplay = React.memo(({ weather, position, visible }) => {
  if (!visible || !weather) return null;

  const positionClasses = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  return (
    <div
      className={`absolute ${positionClasses[position] || "bottom-4 left-4"
        } bg-black bg-opacity-50 text-white p-3 rounded-lg backdrop-blur-sm flex items-center gap-2`}
    >
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
  );
});

// Fallback UI with blank screen and centered text
const renderFallbackUI = (
  message,
  countdownType,
  timeRemaining,
  formatTimeRemaining
) => (
  <div className="w-full h-full bg-black flex flex-col items-center justify-center">
    <div className="grid grid-cols-1 w-full h-full gap-2 p-2">
      <div className="w-full h-full bg-gray-800 animate-pulse rounded"></div>
    </div>
    <p className="text-white text-2xl font-bold absolute">{message}</p>
    {countdownType === "start" && (
      <div className="flex items-center gap-2 mt-4 absolute">
        <FaClock size={20} className="text-yellow-400 mb-[70%]" />
        <span className="text-xl font-mono text-white mb-[70%]">
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
  if (!url) return false;
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

const getYouTubeEmbedUrl = (url) => {
  if (!url) return "";
  if (url.includes("youtu.be")) {
    const videoId = url.split("youtu.be/")[1].split(/[?&]/)[0];
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0`;
  }
  if (url.includes("youtube.com")) {
    const videoIdMatch = url.match(
      /(?:v=|v\/|embed\/|watch\?v=|watch\?.+&v=)([^&?]+)/
    );
    if (videoIdMatch && videoIdMatch[1]) {
      return `https://www.youtube.com/embed/${videoIdMatch[1]}?autoplay=1&mute=1&controls=0`;
    }
  }
  return url;
};

// PageRenderer Component
// PageRenderer Component
const PageRenderer = React.memo(({ page, pageNum }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const updateWidth = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = rect.width;
      setContainerWidth(newWidth);
      setIsReady(newWidth > 0 && page && typeof page.render === 'function');
    } else {
      setContainerWidth(window.innerWidth);
      setIsReady(page && typeof page.render === 'function');
    }
  }, [page]);

  useEffect(() => {
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener("resize", updateWidth);

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
      window.removeEventListener("resize", updateWidth);
    };
  }, [updateWidth]);

  useEffect(() => {
    // Reset ready state when page changes
    setIsReady(containerWidth > 0 && page && typeof page.render === 'function');
  }, [page, containerWidth]);

  useEffect(() => {
    if (!isReady || !canvasRef.current || containerWidth <= 0) {
      return;
    }

    console.log(`Rendering PDF page ${pageNum} with width: ${containerWidth}`);

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    try {
      const viewport = page.getViewport({ scale: 1.0 });
      const aspectRatio = viewport.width / viewport.height;

      // Calculate scale based on container width with some padding
      const scale = (containerWidth * 0.95 * window.devicePixelRatio) / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      canvas.style.width = `${containerWidth * 0.95}px`;
      canvas.style.height = `${(containerWidth * 0.95) / aspectRatio}px`;

      // Set higher quality rendering
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport
      };

      let isCancelled = false;

      console.log(`Starting render for page ${pageNum}`);
      const renderTask = page.render(renderContext);

      renderTask.promise
        .then(() => {
          if (!isCancelled) {
            console.log(`Successfully rendered page ${pageNum}`);
          }
        })
        .catch((error) => {
          if (!isCancelled) {
            console.error(`Error rendering page ${pageNum}:`, error);
          }
        });

      return () => {
        isCancelled = true;
        if (renderTask && typeof renderTask.cancel === 'function') {
          renderTask.cancel();
        }
      };
    } catch (error) {
      console.error(`Error setting up render for page ${pageNum}:`, error);
    }
  }, [page, pageNum, containerWidth, isReady]);

  if (!page || typeof page.render !== "function") {
    return (
      <div className="w-full h-auto bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mx-auto mb-2"></div>
          <p>Loading page {pageNum}...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full flex justify-center">
      {!isReady ? (
        <div className="w-full h-64 bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto shadow-lg"
          key={`page-${pageNum}-${containerWidth}`} // Force re-render when width changes
        />
      )}
    </div>
  );
});

// DocumentContent Component
// DocumentContent Component
const DocumentContent = React.memo(
  ({ content, summary, getContentUrl, isPaused, originalFormat, time }) => {
    const fileType = content?.split(".").pop()?.toLowerCase() || "";
    const fileUrl = content ? getContentUrl(content) : "";
    const [pages, setPages] = useState([]);
    const [error, setError] = useState(null);
    const [showSummary, setShowSummary] = useState(!!summary);
    const [totalScrollHeight, setTotalScrollHeight] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);
    const containerRef = useRef(null);
    const scrollIntervalRef = useRef(null);
    const { ref, inView } = useInView({ triggerOnce: false, threshold: 0.5 });

    const toggleSummary = useCallback((e) => {
      e.stopPropagation();
      setShowSummary((prev) => !prev);
    }, []);


    const calculateScrollSpeed = useCallback((scrollableHeight, time) => {
      if (!time || time <= 0) return 2; // Default slow scroll

      // Calculate pixels per second to complete scroll in given time
      const pixelsPerSecond = scrollableHeight / time;
      // Convert to pixels per 50ms (our interval)
      const pixelsPerInterval = (pixelsPerSecond * 50) / 1000;

      return Math.max(1, pixelsPerInterval);
    }, []);

    // In DocumentContent component, update the scroll effect:
    useEffect(() => {
      if (
        fileType !== "pdf" ||
        !inView ||
        isPaused ||
        !containerRef.current ||
        showSummary
      )
        return;

      const container = containerRef.current;
      let isScrolling = true;
      let scrollInterval = null;
      let hasStarted = false;

      const startScrolling = () => {
        if (hasStarted || !isScrolling) return;
        hasStarted = true;

        const totalScrollHeight = container.scrollHeight;
        const containerHeight = container.clientHeight;
        const scrollableHeight = totalScrollHeight - containerHeight;

        if (scrollableHeight <= 50) {
          console.log("Not enough content to scroll");
          return;
        }

        const scrollSpeed = calculateScrollSpeed(scrollableHeight, time);

        console.log(
          `Starting PDF scroll: ${scrollableHeight}px over ${time}s → ${scrollSpeed}px/50ms`
        );

        scrollInterval = setInterval(() => {
          if (!isScrolling || !container) return;

          const current = container.scrollTop;
          const max = scrollableHeight;

          if (current >= max - 10) {
            container.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            container.scrollTo({
              top: Math.min(current + scrollSpeed, max),
              behavior: "auto",
            });
          }
        }, 50);
      };

      // === Observer: Wait for scrollHeight to stabilize ===
      let lastHeight = 0;
      let stableCount = 0;
      const STABLE_THRESHOLD = 3; // Wait for 3 consecutive same height
      const CHECK_INTERVAL = 500; // Check every 500ms

      const heightObserver = setInterval(() => {
        if (!containerRef.current || !isScrolling) {
          clearInterval(heightObserver);
          return;
        }

        const currentHeight = containerRef.current.scrollHeight;

        if (currentHeight === lastHeight) {
          stableCount++;
        } else {
          stableCount = 0;
          lastHeight = currentHeight;
        }

        if (stableCount >= STABLE_THRESHOLD && currentHeight > containerHeight) {
          clearInterval(heightObserver);
          console.log(`PDF fully rendered. Height stable at ${currentHeight}px`);
          startScrolling();
        }
      }, CHECK_INTERVAL);

      // Fallback: Start after max 15 seconds even if not stable
      const maxWait = setTimeout(() => {
        if (!hasStarted && containerRef.current) {
          clearInterval(heightObserver);
          console.warn("PDF render timeout. Forcing scroll start.");
          startScrolling();
        }
      }, 15000);

      return () => {
        isScrolling = false;
        hasStarted = true;
        clearInterval(scrollInterval);
        clearInterval(heightObserver);
        clearTimeout(maxWait);
      };
    }, [
      fileType,
      inView,
      isPaused,
      showSummary,
      time,
      calculateScrollSpeed,
      pages.length, // ← Add this!
    ]);

    // Update container dimensions when content changes
    useEffect(() => {
      if (containerRef.current && pages.length > 0) {
        const container = containerRef.current;
        const updateDimensions = () => {
          setTotalScrollHeight(container.scrollHeight);
          setContainerHeight(container.clientHeight);
        };

        updateDimensions();

        const resizeObserver = new ResizeObserver(updateDimensions);
        resizeObserver.observe(container);

        return () => {
          resizeObserver.unobserve(container);
        };
      }
    }, [pages]);

    // Reset scroll position when content changes
    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    }, [content]);

    // Right before the PDF loading useEffect
useEffect(() => {
  console.log('📄 PDF Effect Deps Changed:', {
    fileType,
    fileUrl,
    inView,
    showSummary,
    timestamp: new Date().toISOString()
  });
}, [fileType, fileUrl, inView, showSummary]);

// In DocumentContent component
const [isRendering, setIsRendering] = useState(false);
const renderTimeoutRef = useRef(null);

useEffect(() => {
  if (fileType !== "pdf" || !inView || showSummary || !fileUrl) return;

  // Prevent reload if already rendering
  if (isRendering) {
    console.log("⚠️ PDF already rendering, skipping reload");
    return;
  }

  setIsRendering(true);
  console.log("Loading PDF:", fileUrl);
  
  const loadPdf = async () => {
    try {
      const pdf = await pdfjsLib.getDocument(fileUrl).promise;
      console.log("PDF loaded successfully, pages:", pdf.numPages);
      
      const numPages = pdf.numPages;
      const pageData = [];
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.0 });
          pageData.push({ pageNum, viewport, page });
        } catch (pageError) {
          console.error(`Error loading page ${pageNum}:`, pageError);
        }
      }
      
      if (pageData.length === 0) {
        setError("No valid pages found in PDF");
      } else {
        setPages(pageData);
        setError(null);
      }
    } catch (error) {
      console.error("Error loading PDF:", error);
      setError("Wait Your Content Is Loading");
    } finally {
      // Mark as done after a delay to ensure rendering completes
      renderTimeoutRef.current = setTimeout(() => {
        setIsRendering(false);
      }, 2000);
    }
  };
  
  loadPdf();

  return () => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }
  };
}, [fileType, fileUrl, inView, showSummary]); // Removed isRendering from deps

    const cleanedSummary = summary
      ? summary.replace(/<think>[\s\S]*<\/think>/g, "").trim()
      : null;

    if (cleanedSummary && showSummary) {
      return (
        <div className="relative w-full h-screen">
          <div className="w-full h-screen overflow-y-auto scrollbar-hidden bg-gray-900 p-8">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-white">
                Document Summary
              </h2>
              <div className="prose prose-lg prose-invert">
                <div
                  dangerouslySetInnerHTML={{ __html: cleanedSummary }}
                  className="text-white"
                />
              </div>
            </div>
          </div>
          <button
            onClick={toggleSummary}
            className="absolute top-[13%] right-3 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md shadow-lg z-10"
          >
            View Full Document
          </button>
        </div>
      );
    }

    if (fileType === "pdf") {
      return (
        <div className="relative w-full h-screen">
          <div
            ref={(node) => {
              containerRef.current = node;
              ref(node);
            }}
            className="w-full h-screen overflow-y-auto scrollbar-hidden"
            style={{ scrollBehavior: "smooth" }}
          >
            {inView ? (
              <div className="w-full min-h-screen flex flex-col items-center bg-gray-900">
                {error ? (
                  <div className="w-full h-screen flex items-center justify-center text-white">
                    {error}
                  </div>
                ) : pages.length > 0 ? (
                  <>
                    {pages.map((page) => (
                      <div
                        key={`page-container-${page.pageNum}`}
                        className="w-full mb-4"
                      >
                        <PageRenderer page={page.page} pageNum={page.pageNum} />
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="w-full h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
              </div>
            )}
          </div>
          {cleanedSummary && (
            <button
              onClick={toggleSummary}
              className="absolute top-[13%] right-3 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md shadow-lg z-10"
            >
              View Summary
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="relative w-full h-screen">
        <div
          ref={(node) => {
            containerRef.current = node;
            ref(node);
          }}
          className="w-full h-screen overflow-y-auto scrollbar-hidden"
          style={{ scrollBehavior: "smooth" }}
        >
          {inView ? (
            <div className="w-full h-screen flex items-center justify-center text-white bg-gray-900">
              <div className="text-center">
                <p className="text-xl font-semibold mb-2">
                  Wait Your Content Is Loading
                </p>
                <p className="text-lg">
                  The document may not have been converted to PDF correctly.
                  Please contact support.
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full h-screen bg-gray-900 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
            </div>
          )}
        </div>
        {cleanedSummary && (
          <button
            onClick={toggleSummary}
            className="absolute top-[13%] right-3 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md shadow-lg z-10"
          >
            View Summary
          </button>
        )}
      </div>
    );
  }
);

// MediaItem Component
const MediaItem = React.memo(
  ({
    content,
    index,
    isPaused,
    setProgress,
    getContentUrl,
    isWebpageUrl,
    videoRefs,
  }) => {
    const { ref, inView } = useInView({ triggerOnce: true });
    const videoRef = useRef(null);
    const [error, setError] = useState(null);
    const [fallbackSrc, setFallbackSrc] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [videoReady, setVideoReady] = useState(false);
    const [requiresInteraction, setRequiresInteraction] = useState(false);
    const timeoutRef = useRef(null);
    const lastUpdateRef = useRef(0);
    const throttleInterval = 500;
    const hasResetRef = useRef(false);

    useEffect(() => {
      if (
        videoRef.current &&
        content?.content &&
        videoExtensions.some((video) =>
          content.content.toLowerCase().endsWith(video.ext)
        )
      ) {
        videoRefs.current[index] = videoRef.current;
      }
      return () => {
        if (videoRefs.current[index]) {
          delete videoRefs.current[index];
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [index, videoRefs, content]);

    const handleTimeUpdate = useCallback(
      (e) => {
        const now = Date.now();
        if (now - lastUpdateRef.current >= throttleInterval) {
          setProgress((e.target.currentTime / e.target.duration) * 100);
          lastUpdateRef.current = now;
        }

        const video = e.target;
        if (
          video.duration - video.currentTime <= 1.0 &&
          !isPaused &&
          !hasResetRef.current
        ) {
          hasResetRef.current = true;
          video.pause();
          video.currentTime = 0;
          setTimeout(() => {
            if (!isPaused) {
              video.play().catch((err) => {
                console.error(
                  "Error replaying video on pre-emptive reset:",
                  err
                );
                setError({
                  message: `Failed to replay video: ${err.message}`,
                  details: {
                    code: err.code || "N/A",
                    userAgent: navigator.userAgent,
                  },
                });
              });
            }
            hasResetRef.current = false;
          }, 200);
        }
      },
      [setProgress, isPaused]
    );

    const handleManualPlay = () => {
      if (videoRef.current) {
        videoRef.current
          .play()
          .then(() => {
            setRequiresInteraction(false);
            setError(null);
            console.log("Video started after user interaction");
          })
          .catch((err) => {
            console.error("Manual play failed:", err);
            setError({
              message: `Failed to play video: ${err.message}`,
              details: {
                code: err.code || "N/A",
                userAgent: navigator.userAgent,
              },
            });
          });
      }
    };

    const handleError = useCallback(
      (e) => {
        const video = videoRef.current;
        const errorDetails = {
          message: e.target.error?.message || "Unknown video error",
          code: e.target.error?.code || "N/A",
          userAgent: navigator.userAgent,
          src: e.target.currentSrc,
        };

        if (video && video.currentTime >= video.duration - 0.1) {
          console.warn(
            "End of video reached. Reloading video source:",
            errorDetails
          );
          try {
            const currentSrc = video.currentSrc || video.src;
            if (!currentSrc) {
              throw new Error("No video source found to reload.");
            }
            video.pause();
            video.src = "";
            video.load();
            video.src = currentSrc;
            video.load();
            if (!isPaused) {
              video.play().catch((err) => {
                console.error("Failed to autoplay after reload:", err);
                setError({
                  message: `Failed to replay video after reload: ${err.message}`,
                  details: {
                    code: err.code || "N/A",
                    userAgent: navigator.userAgent,
                  },
                });
              });
            }
          } catch (err) {
            console.error("Video reload error:", err);
            setError({
              message: `Error while reloading video: ${err.message}`,
              details: {
                userAgent: navigator.userAgent,
              },
            });
          }
          return;
        }

        console.error("Video error:", errorDetails);
        setIsLoading(false);
        setVideoReady(false);
        setError({
          message: `Video failed to load`,
          details: errorDetails,
        });
      },
      [isPaused]
    );

    useEffect(() => {
      if (
        !videoRef.current ||
        !inView ||
        !content?.content ||
        !videoExtensions.some((video) =>
          content.content.toLowerCase().endsWith(video.ext)
        )
      ) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setVideoReady(false);
      const video = videoRef.current;

      const attemptToPlayVideo = () => {
        if (!video) return;
        video
          .play()
          .then(() => {
            setIsLoading(false);
          })
          .catch((err) => {
            console.error("Playback failed:", err);
            setIsLoading(false);
            if (err.name === "NotAllowedError") {
              setRequiresInteraction(true);
              setError({
                message: "Autoplay blocked: User interaction required",
                details: {
                  code: "NotAllowedError",
                  userAgent: navigator.userAgent,
                },
              });
            } else {
              setError({
                message: `Video playback failed: ${err.message}`,
                details: {
                  code: err.code || "N/A",
                  userAgent: navigator.userAgent,
                },
              });
            }
          });
      };

      const handleCanPlay = () => {
        if (!video) return;
        console.log(`Video can play: ${video.src}`);
        setVideoReady(true);
        setError(null);
        if (!isPaused && !requiresInteraction) {
          attemptToPlayVideo();
        } else {
          setIsLoading(false);
        }
      };

      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("loadeddata", handleCanPlay);
      video.addEventListener("error", handleError);
      video.addEventListener("timeupdate", handleTimeUpdate);

      const handlePlaying = () => {
        console.log("Video is now playing");
        setIsLoading(false);
      };
      video.addEventListener("playing", handlePlaying);

      video.load();

      if (isPaused) {
        video.pause();
      } else if (videoReady && !error && !requiresInteraction) {
        video.play().catch((err) => {
          console.error("Initial playback failed:", err);
          if (err.name === "NotAllowedError") {
            setRequiresInteraction(true);
            setError({
              message: "Autoplay blocked: User interaction required",
              details: {
                code: "NotAllowedError",
                userAgent: navigator.userAgent,
              },
            });
          }
        });
      }

      return () => {
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("loadeddata", handleCanPlay);
        video.removeEventListener("error", handleError);
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("playing", handlePlaying);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [
      isPaused,
      inView,
      index,
      content,
      fallbackSrc,
      requiresInteraction,
      handleTimeUpdate,
      handleError,
    ]);

    if (!content || !content.content) {
      console.warn(`MediaItem: No content provided for index ${index}`, {
        content,
      });
      return (
        <div className="w-full h-full flex items-center justify-center text-white bg-gray-900">
          <p>No content available for this item.</p>
        </div>
      );
    }

    const contentUrl = getContentUrl(content.content);

    if (isPowerBIUrl(content.content)) {
      return (
        <iframe
          src={contentUrl}
          className="w-full h-full"
          title="Embedded Power BI Report"
          frameBorder="0"
          allowFullScreen
        />
      );
    } else if (isWebpageUrl(content.content)) {
      return <WebpageEmbed webpageUrl={contentUrl} />;
    } else if (
      videoExtensions.some((video) =>
        content.content.toLowerCase().endsWith(video.ext)
      )
    ) {
      const originalSrc = contentUrl;
      const isMov = content.content.toLowerCase().endsWith(".mov");
      const isWebm = content.content.toLowerCase().endsWith(".webm");
      const videoSrc = fallbackSrc || originalSrc;

      return (
        <div ref={ref} className="w-full h-full relative">
          {inView ? (
            <>
              <video
                ref={videoRef}
                autoPlay={!isPaused}
                muted
                className={`w-full h-full object-contain ${isLoading ? "opacity-0" : "opacity-100"
                  }`}
                style={{ transition: "opacity 0.3s ease" }}
              >
                <source
                  src={videoSrc}
                  type={
                    videoSrc.toLowerCase().endsWith(".mp4")
                      ? "video/mp4"
                      : isMov
                        ? "video/quicktime"
                        : "video/webm"
                  }
                />
                Your browser does not support the video tag.
              </video>

              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-white"></div>
                </div>
              )}

              {error && !isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900 p-4 text-center">
                  <p className="text-lg font-semibold">{error.message}</p>
                  {error.details && (
                    <p className="text-sm text-gray-400 mt-2">
                      Error Code: {error.details.code}
                      <br />
                      Browser: {error.details.userAgent}
                    </p>
                  )}
                  {requiresInteraction && (
                    <button
                      onClick={handleManualPlay}
                      className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md shadow-lg flex items-center gap-2"
                    >
                      <FaPlay size={20} />
                      Play Video
                    </button>
                  )}
                  {content.thumbnail && (
                    <img
                      src={getContentUrl(content.thumbnail)}
                      alt="Video fallback"
                      className="mt-4 max-w-full max-h-64 object-contain"
                    />
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
            </div>
          )}
        </div>
      );
    } else if (content.content.endsWith(".pdf")) {
      return (
        <DocumentContent
          content={content.content}
          summary={content.summary}
          getContentUrl={getContentUrl}
          isPaused={isPaused}
          originalFormat={content.originalFormat}
          time={content.time}
        />
      );
    } else if (isYouTubeUrl(content.content)) {
      return (
        <div ref={ref} className="w-full h-full">
          {inView ? (
            <YouTubeLive
              liveUrl={contentUrl}
              isPaused={isPaused}
              inView={inView}
              showControls={false}
            />
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div ref={ref} className="w-full h-full relative">
          {inView ? (
            <>
              <img
                src={contentUrl}
                alt="Preview content"
                className={`w-full h-full object-contain ${isLoading ? "opacity-0" : "opacity-100"
                  }`}
                loading="lazy"
                style={{ transition: "opacity 0.3s ease" }}
                onLoad={() => setIsLoading(false)}
                onError={(e) => {
                  console.error("Image load error:", {
                    src: e.target.src,
                    content: content.content,
                  });
                  setIsLoading(false);
                  setError({
                    message: "Image failed to load",
                    details: {
                      code: "N/A",
                      userAgent: navigator.userAgent,
                    },
                  });
                }}
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-white"></div>
                </div>
              )}
              {error && !isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900 p-4 text-center">
                  <p className="text-lg font-semibold">{error.message}</p>
                  {error.details && (
                    <p className="text-sm text-gray-400 mt-2">
                      Error Code: {error.details.code}
                      <br />
                      Browser: {error.details.userAgent}
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
            </div>
          )}
        </div>
      );
    }
  }
);


// Clock Component
const ClockDisplay = React.memo(
  ({ position = "top-right", visible = true }) => {
    const [dateTime, setDateTime] = useState(new Date());
    const [locationName, setLocationName] = useState("Your Location");
    const [userTimeZone, setUserTimeZone] = useState(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );

    useEffect(() => {
      const fetchLocationTimeZone = async () => {
        try {
          const position = await getCurrentPosition();
          if (position) {
            const res = await axios.get(
              `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${position.latitude},${position.longitude}&aqi=no`
            );
            const { location: weatherLocation } = res.data;
            setLocationName(
              `${weatherLocation.name}, ${weatherLocation.region}`
            );
            setUserTimeZone(weatherLocation.tz_id);
          } else {
            const res = await axios.get(
              `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=auto:ip&aqi=no`
            );
            const { location } = res.data;
            setLocationName(`${location.name}, ${location.region} (IP-based)`);
            setUserTimeZone(location.tz_id);
          }
        } catch (error) {
          console.error(
            "Failed to fetch location from WeatherAPI:",
            error.message
          );
          setLocationName("Your Location");
        }
      };

      if (weatherApiKey) {
        fetchLocationTimeZone();
      }
    }, []);

    useEffect(() => {
      const timer = setInterval(() => setDateTime(new Date()), 1000);
      return () => clearInterval(timer);
    }, []);

    if (!visible) return null;

    const positionClasses = {
      "top-left": "top-4 left-4",
      "top-right": "top-4 right-4",
      "bottom-left": "bottom-4 left-4",
      "bottom-right": "bottom-4 right-4",
    };

    return (
      <div
        className={`absolute ${positionClasses[position] || "top-4 right-4"
          } flex items-center gap-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-xl shadow-lg backdrop-blur-lg`}
      >
        <Clock className="w-6 h-6 text-yellow-400" />
        <div className="text-right">
          <p className="text-sm font-medium opacity-80">
            {dateTime
              .toLocaleDateString("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
                timeZone: userTimeZone,
              })
              .toUpperCase()}
          </p>
          <p className="text-xl font-bold tracking-wider">
            {dateTime.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: userTimeZone,
            })}
          </p>
        </div>
      </div>
    );
  }
);

// Helper function to get accurate geolocation
const getCurrentPosition = () => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser");
      resolve(null);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 300000,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Geolocation success:", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        console.warn("Geolocation error:", error.message);
        resolve(null);
      },
      options
    );
  });
};

const Preview = () => {
  const { url } = useParams();
  const mediaItems = useSelector((state) => state.media.mediaItems);
  const [mediaContent, setMediaContent] = useState([]);
  const [isEnabled, setIsEnabled] = useState(false);
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
  const [customTicker, setCustomTicker] = useState(null);
  const [allContent, setAllContent] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(defaultSettings);
  const [isSessionActive, setIsSessionActive] = useState(true); // NEW: Persistent flag to prevent reconnection after replacement
  const controlTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const pollingRef = useRef(null);
  const lastFetchRef = useRef(0);

  const resetControlTimeout = useCallback(() => {
    if (controlTimeoutRef.current) {
      clearTimeout(controlTimeoutRef.current);
    }
    setShowControls(true);
    controlTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
  }, []);

  const togglePlayPause = useCallback(() => {
    setIsPaused((prev) => {
      console.log(`Toggling slideshow to ${!prev ? "paused" : "playing"}`);
      const newPausedState = !prev;
      Object.values(videoRefs.current).forEach((video) => {
        if (video) {
          if (newPausedState) {
            video.pause();
          } else {
            video.play().catch((err) => {
              console.error("Error playing video:", err);
            });
          }
        }
      });
      return newPausedState;
    });
    resetControlTimeout();
  }, [resetControlTimeout]);

  const formatTimeRemaining = useCallback((milliseconds) => {
    if (milliseconds <= 0) return "00:00:00";
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const formatDescription = useCallback((description) => {
    if (!description) return "";
    return description.replace(/<[^>]*>/g, "");
  }, []);

  const isTimeWindowActive = useCallback((timeWindow) => {
    if (!timeWindow || !timeWindow.startTime || !timeWindow.endTime) {
      console.warn(
        "Invalid time window, treated as always active:",
        timeWindow
      );
      return true;
    }

    const timeFormat = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (
      !timeFormat.test(timeWindow.startTime) ||
      !timeFormat.test(timeWindow.endTime)
    ) {
      console.error("Malformed time format, skipping:", timeWindow);
      return false;
    }

    const now = new Date();
    const nowTime = now.getHours() * 60 + now.getMinutes();
    const startTimeParts = timeWindow.startTime.split(":");
    const endTimeParts = timeWindow.endTime.split(":");
    const startMinutes =
      parseInt(startTimeParts[0]) * 60 + parseInt(startTimeParts[1]);
    const endMinutes =
      parseInt(endTimeParts[0]) * 60 + parseInt(endTimeParts[1]);

    return nowTime >= startMinutes && nowTime <= endMinutes;
  }, []);

  const isScheduledNow = useCallback(
    (schedule) => {
      if (!schedule || Object.keys(schedule).length === 0) {
        console.log("No schedule provided, content is always active");
        return true;
      }

      if (
        !schedule.startTime &&
        !schedule.endTime &&
        !schedule.startDate &&
        !schedule.endDate &&
        (!schedule.timeWindows || schedule.timeWindows.length === 0)
      ) {
        console.log("No scheduling restrictions, content is always active");
        return true;
      }

      const now = new Date();
      const today = now.toISOString().split("T")[0];

      let isWithinDate = true;
      if (schedule.startDate) {
        const startDate = schedule.startDate.split("T")[0];
        isWithinDate = today >= startDate;
      }
      if (schedule.endDate) {
        const endDate = schedule.endDate.split("T")[0];
        isWithinDate = isWithinDate && today <= endDate;
      }

      if (!isWithinDate) {
        console.log("Content outside date range:", {
          today,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
        });
        return false;
      }

      let isWithinTimeWindow = false;
      if (schedule.timeWindows && schedule.timeWindows.length > 0) {
        isWithinTimeWindow = schedule.timeWindows.some((timeWindow) => {
          const isActive = isTimeWindowActive(timeWindow);
          return isActive;
        });
      } else if (schedule.startTime && schedule.endTime) {
        const nowTime = now.getHours() * 60 + now.getMinutes();
        const startTimeParts = schedule.startTime.split(":");
        const endTimeParts = schedule.endTime.split(":");
        const startMinutes =
          parseInt(startTimeParts[0]) * 60 + parseInt(startTimeParts[1]);
        const endMinutes =
          parseInt(endTimeParts[0]) * 60 + parseInt(endTimeParts[1]);
        isWithinTimeWindow = nowTime >= startMinutes && nowTime <= endMinutes;
        console.log("Legacy time check:", {
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          isWithinTimeWindow,
        });
      } else {
        isWithinTimeWindow = true;
      }

      return isWithinDate && isWithinTimeWindow;
    },
    [isTimeWindowActive]
  );

  const groupMediaByLayout = useCallback((content) => {
    const groupedContent = {};
    (content || []).forEach((item, index) => {
      const layoutKey = item?.layout || "single";
      if (!groupedContent[layoutKey]) {
        groupedContent[layoutKey] = [];
      }
      groupedContent[layoutKey].push({ ...item, originalIndex: index });
    });
    return groupedContent;
  }, []);

  const getActiveContent = useCallback(
    (content) => {
      if (!Array.isArray(content)) {
        console.warn("Invalid content array, returning empty:", content);
        return [];
      }

      const priorityOrder = { high: 3, medium: 2, low: 1 };

      const exclusiveHighPriorityContent = content.filter(
        (item) =>
          item?.schedule &&
          isScheduledNow(item.schedule) &&
          item.schedule.displayMode === "exclusive" &&
          item.schedule.priority === "high"
      );

      if (exclusiveHighPriorityContent.length > 0) {
        exclusiveHighPriorityContent.forEach((item) => {
          if (
            (!item.schedule.timeWindows ||
              item.schedule.timeWindows.every(
                (tw) => !tw.startTime || !tw.endTime
              )) &&
            !item.schedule.startDate &&
            !item.schedule.endDate &&
            !item.schedule.startTime &&
            !item.schedule.endTime
          ) {
            console.warn(
              "Exclusive high-priority content has no time restrictions, may override others:",
              item
            );
          }
        });
        console.log(
          "Exclusive high-priority content active:",
          exclusiveHighPriorityContent
        );
        return exclusiveHighPriorityContent.sort((a, b) => {
          const priorityA = priorityOrder[a.schedule?.priority || "low"] || 0;
          const priorityB = priorityOrder[b.schedule?.priority || "low"] || 0;
          return priorityB - priorityA;
        });
      }

      const activeContent = content.filter(
        (item) => item?.schedule && isScheduledNow(item.schedule)
      );

      return activeContent.sort((a, b) => {
        const priorityA = priorityOrder[a.schedule?.priority || "low"] || 0;
        const priorityB = priorityOrder[b.schedule?.priority || "low"] || 0;
        return priorityB - priorityA;
      });
    },
    [isScheduledNow]
  );

  // const stableCacheBuster = useMemo(() => Date.now(), []);

  const getContentUrl = useCallback(
    (content) => {
      if (!content) return "";
      
      const prefix = "/api/upload/preview/";
      let baseUrl;
  
      if (content.startsWith(prefix)) {
        baseUrl = content.slice(prefix.length);
      } else if (isYouTubeUrl(content)) {
        return getYouTubeEmbedUrl(content);
      } else {
        baseUrl = content.startsWith("http")
          ? content
          : `${apiBaseUrl}/${content}`;
      }
  
      // IMPORTANT: Normalize path (fix double slashes consistently)
      if (baseUrl.includes(apiBaseUrl)) {
        // It's a full URL with apiBaseUrl - normalize it
        baseUrl = baseUrl.replace(/([^:]\/)\/+/g, '$1'); // Remove duplicate slashes except after protocol
      }
  
      const separator = baseUrl.includes("?") ? "&" : "?";
      
      // Add cache buster only for non-PDF files or initial load
      const cacheBuster = content.endsWith('.pdf') ? '' : `v=${Date.now()}`;
      return cacheBuster ? `${baseUrl}${separator}${cacheBuster}` : `${baseUrl}${separator}`;
    },
    [url]
  );

  const preloadMedia = useCallback(
    (content) => {
      (content || []).slice(0, 3).forEach((item) => {
        if (item?.content) {
          const url = getContentUrl(item.content);
          const link = document.createElement("link");
          link.rel = "preload";
          link.href = url;
          link.as = videoExtensions.some((video) =>
            item.content.toLowerCase().endsWith(video.ext)
          )
            ? "video"
            : item.content.endsWith(".pdf")
              ? "fetch"
              : "image";
          link.onerror = () =>
            console.error(`Wait Your Content Is Loading ${url}`);
          document.head.appendChild(link);
        }
      });
    },
    [getContentUrl]
  );

  const fetchWeather = useCallback(async (location = "Ohio") => {
    if (!weatherApiKey) {
      console.error("Weather API key is missing.");
      return;
    }

    const now = Date.now();
    if (
      cache.weather.data &&
      cache.weather.timestamp &&
      now - cache.weather.timestamp < cache.weather.ttl
    ) {
      setWeather(cache.weather.data);
      return;
    }

    try {
      let weatherLocation = location;
      if (location === "auto" || location === "Ohio") {
        const position = await getCurrentPosition();
        if (position) {
          weatherLocation = `${position.latitude},${position.longitude}`;
          console.log(
            "Using accurate coordinates for weather:",
            weatherLocation
          );
        } else {
          weatherLocation = "auto:ip";
          console.log("Falling back to IP-based location for weather");
        }
      }

      const url = `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${weatherLocation}&aqi=no`;
      const response = await axios.get(url, { timeout: 8000 });
      cache.weather.data = response.data;
      cache.weather.timestamp = now;
      setWeather(response.data);
    } catch (error) {
      console.error("Error fetching weather:", error);
    }
  }, []);

  const getUserLocation = useCallback(() => {
    getCurrentPosition().then((position) => {
      if (position) {
        fetchWeather(`${position.latitude},${position.longitude}`);
      } else {
        console.log("Using IP-based location as fallback");
        fetchWeather("auto:ip");
      }
    });
  }, [fetchWeather]);

  // const fetchNews = useCallback(async () => {
  //   const now = Date.now();
  //   if (
  //     cache.news.data &&
  //     cache.news.timestamp &&
  //     now - cache.news.timestamp < cache.news.ttl
  //   ) {
  //     setNews(cache.news.data);
  //     return;
  //   }
  //   try {
  //     const feeds = [
  //       "https://rss.cnn.com/rss/edition.rss",
  //       "https://feeds.nbcnews.com/nbcnews/public/news",
  //       "https://feeds.washingtonpost.com/rss/national",
  //       "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  //       "https://feeds.reuters.com/reuters/topNews",
  //       "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
  //       "https://feeds.abcnews.go.com/abcnews/topstories",
  //       "https://feeds.foxnews.com/foxnews/latest",
  //     ];
  //     const responses = await Promise.all(
  //       feeds.map((feed) =>
  //         axios
  //           .get(
  //             `${apiBaseUrl}/api/upload/parse-rss?url=${encodeURIComponent(
  //               feed
  //             )}`,
  //             { timeout: 5000 }
  //           )
  //           .then((res) => res.data.items || [])
  //           .catch(() => [])
  //       )
  //     );
  //     const rssArticles = responses.flat().slice(0, 8);
  //     let articles = rssArticles;
  //     if (rssArticles.length === 0 && newsApiKey) {
  //       const fallbackResponse = await axios.get(
  //         `https://gnews.io/api/v4/top-headlines?country=in&token=${newsApiKey}`,
  //         { timeout: 5000 }
  //       );
  //       articles = fallbackResponse.data.articles.slice(0, 8);
  //     }
  //     cache.news.data = articles;
  //     cache.news.timestamp = now;
  //     setNews(articles);
  //   } catch (error) {
  //     console.error("Error fetching news:", error);
  //     setNews([]);
  //   }
  // }, []);

  const rssFeedOptions = [
    // 🌍 International
    { value: "cnn", label: "CNN", url: "https://rss.cnn.com/rss/edition.rss" },
    {
      value: "nbc",
      label: "NBC News",
      url: "https://feeds.nbcnews.com/nbcnews/public/news",
    },
    {
      value: "nytimes",
      label: "The New York Times",
      url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    },
    {
      value: "bbc",
      label: "BBC News",
      url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
    },
    {
      value: "fox",
      label: "Fox News",
      url: "https://feeds.foxnews.com/foxnews/latest",
    },

    // 🇮🇳 Indian Top Media
    {
      value: "ndtv",
      label: "NDTV",
      url: "https://feeds.feedburner.com/ndtvnews-top-stories",
    },
    {
      value: "indiatoday",
      label: "India Today",
      url: "https://www.indiatoday.in/rss/1206514",
    },
    {
      value: "indiatv",
      label: "India TV News",
      url: "https://www.indiatvnews.com/rssfeed/topstory.xml",
    },
    {
      value: "zeenews",
      label: "Zee News",
      url: "https://zeenews.india.com/rss/india-national-news.xml",
    },
    {
      value: "dna",
      label: "DNA India",
      url: "https://www.dnaindia.com/feeds/india.xml",
    },

    // 💼 Business & Finance
    {
      value: "moneycontrol",
      label: "Moneycontrol",
      url: "https://www.moneycontrol.com/rss/latestnews.xml",
    },
  ];

  // const fetchNews = useCallback(async () => {
  //   const now = Date.now();
  //   if (
  //     cache.news.data &&
  //     cache.news.timestamp &&
  //     now - cache.news.timestamp < cache.news.ttl
  //   ) {
  //     setNews(cache.news.data);
  //     return;
  //   }
  //   try {
  //     // Use the RSS feed from settings, fallback to CNN if not set
  //     const rssFeedValue = settings.ticker.rssFeed;
  //     const rssFeed = rssFeedOptions.find((option) => option.value === rssFeedValue);
  //     const feedUrl = rssFeed.url ;

  //     const response = await axios.get(
  //       `${apiBaseUrl}/api/upload/parse-rss?url=${encodeURIComponent(feedUrl)}`,
  //       { timeout: 5000 }
  //     );
  //     let articles = response.data.items || [];

  //     if (articles.length === 0 && newsApiKey) {
  //       const fallbackResponse = await axios.get(
  //         `https://gnews.io/api/v4/top-headlines?country=in&token=${newsApiKey}`,
  //         { timeout: 5000 }
  //       );
  //       articles = fallbackResponse.data.articles.slice(0, 8);
  //     }

  //     cache.news.data = articles;
  //     cache.news.timestamp = now;
  //     setNews(articles);
  //   } catch (error) {
  //     console.error("Error fetching news:", error);
  //     setNews([]);
  //   }
  // }, [settings.ticker.rssFeed, newsApiKey]);

  const fetchNews = useCallback(async () => {
    const now = Date.now();
    if (
      cache.news.data &&
      cache.news.timestamp &&
      now - cache.news.timestamp < cache.news.ttl
    ) {
      setNews(cache.news.data);
      return;
    }
    try {
      // Ensure rssFeed is an array
      const rssFeedValues = Array.isArray(settings.ticker.rssFeed)
        ? settings.ticker.rssFeed
        : [settings.ticker.rssFeed || "nbc"];

      const feedUrls = rssFeedValues
        .map((value) => {
          const feed = rssFeedOptions.find((option) => option.value === value);
          if (!feed) {
            console.warn(`No RSS feed found for value: ${value}`);
            return null;
          }
          return feed.url;
        })
        .filter((url) => url);

      // Log a warning if no valid URLs are found, but avoid pushing a default unless explicitly desired
      // if (feedUrls.length === 0) {
      //   console.warn("No valid RSS feed URLs found. Falling back to default.");
      //   feedUrls.push("https://feeds.feedburner.com/ndtvnews-top-stories");
      // }

      console.log("Fetching news from RSS feeds:", feedUrls);

      const responses = await Promise.all(
        feedUrls.map(async (feedUrl) => {
          try {
            return await axios.get(
              `${apiBaseUrl}/api/upload/parse-rss?url=${encodeURIComponent(
                feedUrl
              )}`,
              { timeout: 5000 }
            );
          } catch (error) {
            console.error(`Failed to fetch RSS feed ${feedUrl}:`, error.message);
            return { data: { items: [] } };
          }
        })
      );

      let articles = [];
      responses.forEach((response) => {
        if (response.data.items) {
          articles = articles.concat(
            response.data.items.map((item) => ({
              title: item.title,
              link: item.url,
              pubDate: item.publishedAt,
              description: item.description,
              source: item.source,
            }))
          );
        }
      });

      // Remove duplicates
      const seen = new Set();
      articles = articles.filter((article) => {
        const key = article.title || article.link;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Sort and limit articles
      articles = articles
        .sort((a, b) => {
          const dateA = a.pubDate ? new Date(a.pubDate) : new Date();
          const dateB = b.pubDate ? new Date(b.pubDate) : new Date();
          return dateB - dateA;
        })
        .slice(0, 20);

      // Fallback to news API if no articles are found
      if (articles.length === 0 && newsApiKey) {
        const fallbackResponse = await axios.get(
          `https://gnews.io/api/v4/top-headlines?country=in&token=${newsApiKey}`,
          { timeout: 5000 }
        );
        articles = fallbackResponse.data.articles
          .slice(0, 8)
          .map((article) => ({
            title: article.title,
            link: article.url,
            pubDate: article.publishedAt,
            description: article.description,
            source: article.source.name,
          }));
      }

      cache.news.data = articles;
      cache.news.timestamp = now;
      setNews(articles);
    } catch (error) {
      console.error("Error fetching news:", error);
      setNews([]);
    }
  }, [settings.ticker.rssFeed, newsApiKey]);

  const updateVisibleItems = useCallback(
    (layout, groupedContent, index) => {
      const layoutConfig =
        layoutOptions.find((option) => option.id === layout) ||
        layoutOptions[0];
      const itemsPerPage = layoutConfig.cols * layoutConfig.rows;
      const allItems =
        mediaContent.length > 0
          ? mediaContent.map((item, idx) => ({ ...item, originalIndex: idx }))
          : [fallbackItem];

      if (index >= allItems.length || index < 0) {
        console.warn("Index out of bounds, using fallback", {
          index,
          total: allItems.length,
        });
        setVisibleItems([fallbackItem]);
        return;
      }

      const currentItem = allItems[index] || fallbackItem;
      const currentLayout = currentItem.layout || "single";
      setCurrentLayout(currentLayout);

      if (currentLayout !== layout) {
        setCurrentLayout(currentLayout);
      }

      const start = index;
      const end = Math.min(start + itemsPerPage, allItems.length);
      const itemsToDisplay = allItems.slice(start, end);
      setVisibleItems(
        itemsToDisplay.length > 0 ? itemsToDisplay : [fallbackItem]
      );
    },
    [mediaContent]
  );

  const isWebpageUrl = useCallback((url) => {
    if (!url) return false;
    const excludedExtensions = [
      ...videoExtensions.map((video) => video.ext),
      ".pdf",
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
  }, []);

  const getGridClasses = useCallback(() => {
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
  }, [currentLayout]);

  const isAnyPowerBIContent = useCallback(() => {
    return visibleItems.some(
      (item) => item?.content && isPowerBIUrl(item.content)
    );
  }, [visibleItems]);

  const goNext = useCallback(() => {
    const currentItem = mediaContent[currentIndex] || fallbackItem;
    const layoutConfig =
      layoutOptions.find(
        (option) => option.id === (currentItem.layout || "single")
      ) || layoutOptions[0];
    const itemsPerPage = layoutConfig.cols * layoutConfig.rows;
    const nextIndex = currentIndex + itemsPerPage;
    const groupedContent = groupMediaByLayout(
      mediaContent.length > 0 ? mediaContent : [fallbackItem]
    );
    if (nextIndex >= mediaContent.length && mediaContent.length > 0) {
      setCurrentIndex(0);
      const firstLayout = mediaContent[0]?.layout || "single";
      setCurrentLayout(firstLayout);
      updateVisibleItems(firstLayout, groupedContent, 0);
    } else if (mediaContent.length === 0) {
      setVisibleItems([fallbackItem]);
    } else {
      setCurrentIndex(nextIndex);
      const nextItem = mediaContent[nextIndex] || fallbackItem;
      const nextLayout = nextItem.layout || "single";
      setCurrentLayout(nextLayout);
      updateVisibleItems(nextLayout, groupedContent, nextIndex);
    }
    setShowControls(true);
    resetControlTimeout();
  }, [
    mediaContent,
    currentIndex,
    groupMediaByLayout,
    updateVisibleItems,
    resetControlTimeout,
  ]);

  const goPrev = useCallback(() => {
    const currentItem = mediaContent[currentIndex] || fallbackItem;
    const layoutConfig =
      layoutOptions.find(
        (option) => option.id === (currentItem.layout || "single")
      ) || layoutOptions[0];
    const itemsPerPage = layoutConfig.cols * layoutConfig.rows;
    const prevIndex = Math.max(0, currentIndex - itemsPerPage);
    const groupedContent = groupMediaByLayout(
      mediaContent.length > 0 ? mediaContent : [fallbackItem]
    );
    setCurrentIndex(prevIndex);
    const prevItem = mediaContent[prevIndex] || fallbackItem;
    const prevLayout = prevItem.layout || "single";
    setCurrentLayout(prevLayout);
    updateVisibleItems(prevLayout, groupedContent, prevIndex);
    setShowControls(true);
    resetControlTimeout();
  }, [
    mediaContent,
    currentIndex,
    groupMediaByLayout,
    updateVisibleItems,
    resetControlTimeout,
  ]);

  const fetchData = useCallback(
    async (source = "unknown") => {
      const now = Date.now();
      const minInterval = 60 * 1000;
      if (now - lastFetchRef.current < minInterval) {
        console.log(`fetchData throttled (source: ${source})`);
        return;
      }
      lastFetchRef.current = now;
  
      // Don't show loading for background fetches
      const isBackgroundFetch = source === "polling" || source.includes("socket");
      if (!isBackgroundFetch) {
        setIsLoading(true);
      }
  
      try {
        const response = await axios.post(
          `${apiBaseUrl}/api/upload/preview/${url}`,
          { timeout: 10000 }
        );
        
        if (response.data) {
          const content = response.data.url_content || [];
          const activeContent = getActiveContent(content);
  
          // NEW: Create stable content fingerprint (ignore metadata changes)
          const createFingerprint = (items) => 
            items.map(item => `${item.content}|${item.layout}|${item.time}`).join('::');
          
          const newFingerprint = createFingerprint(activeContent);
          const oldFingerprint = createFingerprint(mediaContent);
  
          if (newFingerprint === oldFingerprint) {
            console.log(`📌 Content unchanged (${source}), preserving state`);
            
            // Only update settings, don't reset anything else
            setSettings(response.data.settings || defaultSettings);
            setCustomTicker(response.data.custom_ticker || null);
            
            if (!isBackgroundFetch) {
              setIsLoading(false);
            }
            return; // EXIT EARLY - Critical!
          }
  
          console.log(`🔄 Content changed (${source}), updating...`);
          
          // Rest of your existing logic...
          const cacheKey = `preview_${url}`;
          localStorage.setItem(cacheKey, JSON.stringify(response.data));
          setAllContent(content);
          setMediaContent(activeContent);
          
          if (activeContent.length > 0) {
            setCurrentIndex(0);
            const firstLayout = activeContent[0].layout || "single";
            setCurrentLayout(firstLayout);
            const groupedContent = groupMediaByLayout(activeContent);
            updateVisibleItems(firstLayout, groupedContent, 0);
            preloadMedia(activeContent);
          } else {
            setVisibleItems([fallbackItem]);
          }
          
          setIsEnabled(response.data.isEnabled === true);
          setScheduledAt(response.data.scheduledAt ? new Date(response.data.scheduledAt) : null);
          setExpiresAt(response.data.expiresAt ? new Date(response.data.expiresAt) : null);
          setCustomTicker(response.data.custom_ticker || null);
          setSettings(response.data.settings || defaultSettings);
        }
      } catch (error) {
        console.error(`Error fetching preview content (source: ${source}):`, error);
      } finally {
        if (!isBackgroundFetch) {
          setIsLoading(false);
        }
      }
    },
    [url, getActiveContent, groupMediaByLayout, preloadMedia, updateVisibleItems, mediaContent]
  );

  const handleSocketUpdate = useCallback(
    (data, eventType) => {
      if (!data || !data.url_content) {
        console.warn(`Invalid ${eventType} data received:`, data);
        setVisibleItems([fallbackItem]);
        return;
      }

      const cacheKey = `preview_${url}`;
      localStorage.setItem(cacheKey, JSON.stringify(data));
      const content = data.url_content || [];
      setAllContent(content);
      const activeContent = getActiveContent(content);
      if (JSON.stringify(activeContent) === JSON.stringify(mediaContent)) {
        console.log("No changes, skipping");
        setIsLoading(false);
        return;
      }
      
      setMediaContent(activeContent);
      const isUrlEnabled = data.isEnabled === true;
      setIsEnabled(isUrlEnabled);
      setScheduledAt(data.scheduledAt ? new Date(data.scheduledAt) : null);
      setExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);
      setCustomTicker(data.custom_ticker || null);
      setSettings(data.settings || defaultSettings);

      if (activeContent.length > 0) {
        setCurrentIndex(0);
        const firstLayout = activeContent[0].layout || "single";
        setCurrentLayout(firstLayout);
        const groupedContent = groupMediaByLayout(activeContent);
        updateVisibleItems(firstLayout, groupedContent, 0);
        preloadMedia(activeContent);
      } else {
        console.warn(`No active content for ${eventType}, using fallback`);
        setVisibleItems([fallbackItem]);
      }
      setIsLoading(false);
      console.log(`Processed ${eventType} event:`, activeContent);
    },
    [
      url,
      getActiveContent,
      groupMediaByLayout,
      updateVisibleItems,
      preloadMedia,
    ]
  );

  const connectSocket = useCallback(() => {
    if (!isSessionActive) {
      console.log("Session is inactive (replaced), skipping connection attempt");
      return;
    }
  
    // Disconnect existing socket properly
    if (socketRef.current?.connected) {
      console.log("Socket already connected, skipping");
      return; // Don't reconnect if already connected
    }
  
    if (socketRef.current) {
      console.log("Cleaning up old socket before new connection");
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  
    const socket = io(apiBaseUrl, {
      query: { url },
      auth: { token: localStorage.getItem("jwt_token") },
      reconnection: true,              // ← Enable reconnection
      reconnectionAttempts: 5,         // ← Try 5 times
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      forceNew: true,
      transports: ['websocket', 'polling'],
    });
  
    // ... rest of your socket handlers (unchanged)
    
    socketRef.current = socket;
    
    // DON'T return cleanup function
  }, [url, handleSocketUpdate, fetchData, isSessionActive]);
  
  // Helper function to reset state (unchanged)
  function resetToFallbackState() {
    setIsEnabled(false);
    setMediaContent([]);
    setVisibleItems([fallbackItem]);
    setAllContent([]);
    setScheduledAt(null);
    setExpiresAt(null);
    setCustomTicker(null);
    setSettings(defaultSettings);
    setIsLoading(false);

    // Clear local storage
    const cacheKey = `preview_${url}`;
    localStorage.removeItem(cacheKey);
    console.log(`Cleared local storage for ${cacheKey}`);
  }

  useEffect(() => {
    const handleMouseMove = () => {
      resetControlTimeout();
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (controlTimeoutRef.current) {
        clearTimeout(controlTimeoutRef.current);
      }
    };
  }, [resetControlTimeout]);

// Add this ref at the top with other refs
const isInitializedRef = useRef(false);

// Replace the initialization useEffect
useEffect(() => {
  // Only run once on mount
  if (isInitializedRef.current) return;
  isInitializedRef.current = true;

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchData("initial"), fetchWeather(), fetchNews()]);
    } catch (error) {
      console.error("Error loading data:", error);
      setVisibleItems([fallbackItem]);
    } finally {
      setIsLoading(false);
    }
  };
  
  loadData();
  connectSocket();

  // Cleanup on unmount only
  return () => {
    console.log("Component unmounting - final cleanup");
    isInitializedRef.current = false;
    
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };
}, []); // ← Empty dependency array - run once only!

  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  // Replace the slideshow useEffect in Preview component

  useEffect(() => {
    if (mediaContent.length === 0 || !isEnabled || isPaused) {
      setActiveSlideshow(false);
      if (mediaContent.length === 0 || !isEnabled) {
        setVisibleItems([fallbackItem]);
      }
      return;
    }

    setActiveSlideshow(true);
    const currentItemIndex = currentIndex % mediaContent.length;
    const currentItem = mediaContent[currentItemIndex] || fallbackItem;

    if (
      !currentItem ||
      !Number.isFinite(currentItem.time) ||
      currentItem.time <= 0
    ) {
      console.warn("Invalid current item or time, using fallback", {
        currentIndex,
        item: currentItem,
      });
      setVisibleItems([fallbackItem]);
      return;
    }

    const currentLayout = currentItem.layout || "single";
    setCurrentLayout(currentLayout);
    const layoutConfig =
      layoutOptions.find((option) => option.id === currentLayout) ||
      layoutOptions[0];
    const itemsPerPage = layoutConfig.cols * layoutConfig.rows;
    const groupedContent = groupMediaByLayout(mediaContent);
    updateVisibleItems(currentLayout, groupedContent, currentIndex);

    // NEW: Check if current item is a PDF
    const isPdfContent = currentItem.content?.endsWith('.pdf');

    // NEW: For single PDF in single layout, don't set timer to avoid restart
    if (isPdfContent && mediaContent.length === 1 && currentLayout === 'single') {
      console.log('Single PDF detected - continuous scroll mode, no slideshow timer');
      return; // Don't set any timer, let PDF scroll infinitely
    }

    const delay = currentItem.time * 1000;

    const timer = setTimeout(() => {
      const nextIndex = currentIndex + itemsPerPage;

      // NEW: If we're looping back to the same single item, don't trigger re-render
      if (nextIndex >= mediaContent.length) {
        if (mediaContent.length === 1 && currentIndex === 0) {
          console.log('Already showing single item, skipping index update');
          return; // Don't update state if we're already showing the only item
        }

        setCurrentIndex(0);
        const firstLayout = mediaContent[0]?.layout || "single";
        setCurrentLayout(firstLayout);
        updateVisibleItems(firstLayout, groupedContent, 0);
        console.log("Completed one loop, relying on Socket.IO for updates");
      } else {
        setCurrentIndex(nextIndex);
        const nextItem = mediaContent[nextIndex] || fallbackItem;
        const nextLayout = nextItem.layout || "single";
        setCurrentLayout(nextLayout);
        updateVisibleItems(nextLayout, groupedContent, nextIndex);
      }
    }, delay);

    return () => {
      console.log("Clearing slideshow timer");
      clearTimeout(timer);
    };
  }, [
    mediaContent,
    currentIndex,
    isPaused,
    isEnabled,
    groupMediaByLayout,
    updateVisibleItems,
  ]);
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
          fetchData("schedule-start");
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
          fetchData("schedule-end");
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
      console.warn("Preview disabled, using fallback");
      setVisibleItems([fallbackItem]);
    }
  }, [scheduledAt, expiresAt, isEnabled, fetchData]);



  return (
    <div className="relative flex justify-center items-center w-screen h-screen bg-black overflow-hidden">
      {isLoading ? (
        renderFallbackUI(
          "Wait, your content is loading",
          countdownType,
          timeRemaining,
          formatTimeRemaining
        )
      ) : !isEnabled ? (
        renderFallbackUI(
          "This URL is currently inactive.",
          countdownType,
          timeRemaining,
          formatTimeRemaining
        )
      ) : mediaContent.length > 0 ? (
        <div className={`grid w-full h-screen gap-2 ${getGridClasses()}`}>
          {visibleItems.map((item, index) => (
            <div
              key={index}
              className="relative w-full h-full bg-gray-900 rounded overflow-hidden"
            >
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
        renderFallbackUI(
          "This URL has no content to display. Please check the URL or content configuration.",
          countdownType,
          timeRemaining,
          formatTimeRemaining
        )
      )}

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

      <ClockDisplay
        position={settings.dateTime.position}
        visible={settings.dateTime.visible}
      />

      <TemperatureDisplay
        weather={weather}
        position={settings.temperature.position}
        visible={settings.temperature.visible}
      />

      {(customTicker || news.length > 0) && settings.ticker.visible && (
        <div
          className="absolute bottom-16 left-0 w-full overflow-hidden bg-black bg-opacity-70 py-3"
          style={{
            height: `${settings.ticker.height}px`,
          }}
        >
          <div className="news-ticker-container relative w-full">
            <div
              key={`ticker-${settings.ticker.speed}-${settings.ticker.fontSize}`}
              className="news-ticker"
              style={{
                animationName: "marquee",
                animationDuration: `${customTicker
                    ? settings.ticker.speed * 0.5
                    : settings.ticker.speed
                  }s`, // Make custom ticker 2x faster
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                fontSize: `${settings.ticker.fontSize}px`,
              }}
            >
              {customTicker ? (
                <span className="news-item inline-block px-6 text-white">
                  {customTicker}
                </span>
              ) : (
                <>
                  {news.map((article, index) => (
                    <span
                      key={`news-item-1-${index}`}
                      className="news-item inline-block px-6 text-white"
                    >
                      <strong>{article.title}</strong> -{" "}
                      {formatDescription(article.description)}
                    </span>
                  ))}
                  {news.map((article, index) => (
                    <span
                      key={`news-item-2-${index}`}
                      className="news-item inline-block px-6 text-white"
                    >
                      <strong>{article.title}</strong> -{" "}
                      {formatDescription(article.description)}
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showControls &&
        isEnabled &&
        mediaContent.length > 0 &&
        !isAnyPowerBIContent() && (
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
