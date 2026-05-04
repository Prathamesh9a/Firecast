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
    rssFeed: ["nbc"],
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
  weather: { data: null, timestamp: null, ttl: 15 * 60 * 1000 },
  news: { data: null, timestamp: null, ttl: 30 * 60 * 1000 },
};

const videoExtensions = [
  { ext: ".mp4", type: "video/mp4" },
  { ext: ".mov", type: "video/quicktime" },
  { ext: ".webm", type: "video/webm" },
];

// ─── WebP slide extensions produced by convertPDFToImages ─────────────────────
const isWebpSlide = (content) =>
  content && content.toLowerCase().endsWith(".webp");

// ─── Group consecutive slides that share the same groupId ─────────────────────
// Returns an array of "display units". Each unit is either:
//   { type: 'group', groupId, slides: [...items], time, layout, ... }  — for WebP slide groups
//   { type: 'single', ...item }                                         — for everything else
const buildDisplayUnits = (items) => {
  const units = [];
  let i = 0;

  while (i < items.length) {
    const item = items[i];

    if (isWebpSlide(item.content) && item.groupId) {
      // Collect all consecutive items that share this groupId
      const gid = item.groupId;
      const slides = [];
      while (i < items.length && items[i].groupId === gid && isWebpSlide(items[i].content)) {
        slides.push({ ...items[i], originalIndex: i });
        i++;
      }
      units.push({
        type: "group",
        groupId: gid,
        slides,
        // Use the time / layout of the first slide
        time: slides[0].time,
        layout: slides[0].layout || "single",
        content: slides[0].content, // Needed for layout detection
      });
    } else {
      units.push({ type: "single", ...item, originalIndex: i });
      i++;
    }
  }

  return units;
};

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

const isPowerBIUrl = (url) => url && url.includes("powerbi.com");

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

const isYouTubeUrl = (url) =>
  url &&
  (url.includes("youtube.com/watch") ||
    url.includes("youtube.com/live") ||
    url.includes("youtu.be") ||
    url.includes("youtube.com/embed") ||
    url.includes("youtube.com/v"));

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

// ─── WebpSlideGroup: renders all WebP slides of a converted document ──────────
// Vertically stacked images in a scrollable container that auto-scrolls to
// complete exactly one pass in `time` seconds, then loops.
const WebpSlideGroup = React.memo(({ slides, time, isPaused, getContentUrl }) => {
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const isActiveRef = useRef(true);

  // Start the smooth scroll loop
  const startScrollLoop = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTop = 0;

    requestAnimationFrame(() => {
      if (!isActiveRef.current) return;

      const runLoop = (lastTs) => (timestamp) => {
        if (!isActiveRef.current || !containerRef.current) return;

        const scrollable = container.scrollHeight - container.clientHeight;
        if (scrollable < 10) return; // Not enough content to scroll

        const durationMs = (time > 0 ? time : 30) * 1000;
        const pxPerMs = scrollable / durationMs;
        const elapsed = lastTs === null ? 0 : timestamp - lastTs;
        const advance = pxPerMs * elapsed;
        const current = container.scrollTop;

        if (current + advance >= scrollable - 1) {
          // Reached the bottom — pause briefly, then restart
          container.scrollTop = 0;
          setTimeout(() => {
            if (isActiveRef.current) startScrollLoop();
          }, 500);
          return;
        }

        container.scrollTop = current + advance;
        rafRef.current = requestAnimationFrame(runLoop(timestamp));
      };

      rafRef.current = requestAnimationFrame(runLoop(null));
    });
  }, [time]);

  // Wait until scrollHeight is stable before starting scroll
  useEffect(() => {
    if (isPaused) return;

    isActiveRef.current = true;
    const container = containerRef.current;
    if (!container) return;

    const CHECK_MS = 600;
    const STABLE_ROUNDS = 4;
    const MAX_WAIT_MS = 30_000;

    let lastHeight = 0;
    let stableCount = 0;
    let checkId = null;
    let maxWaitId = null;

    const tryStart = () => {
      clearInterval(checkId);
      clearTimeout(maxWaitId);
      startScrollLoop();
    };

    checkId = setInterval(() => {
      if (!isActiveRef.current || !containerRef.current) {
        clearInterval(checkId);
        return;
      }
      const h = containerRef.current.scrollHeight;
      if (h === lastHeight) {
        stableCount++;
      } else {
        stableCount = 0;
        lastHeight = h;
      }
      if (stableCount >= STABLE_ROUNDS && h > (containerRef.current.clientHeight || 0)) {
        tryStart();
      }
    }, CHECK_MS);

    maxWaitId = setTimeout(() => {
      clearInterval(checkId);
      startScrollLoop();
    }, MAX_WAIT_MS);

    return () => {
      isActiveRef.current = false;
      clearInterval(checkId);
      clearTimeout(maxWaitId);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPaused, slides, startScrollLoop]);

  // Pause / resume when isPaused changes mid-scroll
  useEffect(() => {
    if (isPaused) {
      isActiveRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } else {
      isActiveRef.current = true;
      startScrollLoop();
    }
  }, [isPaused, startScrollLoop]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto scrollbar-hidden bg-black"
      style={{ scrollBehavior: "auto" }}
    >
      {slides.map((slide, idx) => (
        <img
          key={`slide-${slide.groupId}-${idx}`}
          src={getContentUrl(slide.content)}
          alt={`Slide ${idx + 1}`}
          className="w-full h-auto block"
          loading={idx === 0 ? "eager" : "lazy"}
          draggable={false}
        />
      ))}
    </div>
  );
});

// PageRenderer Component (kept for AI-summarized PDFs that stay as .pdf)
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
      setIsReady(newWidth > 0 && page && typeof page.render === "function");
    } else {
      setContainerWidth(window.innerWidth);
      setIsReady(page && typeof page.render === "function");
    }
  }, [page]);

  useEffect(() => {
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    window.addEventListener("resize", updateWidth);
    return () => {
      if (containerRef.current) resizeObserver.unobserve(containerRef.current);
      window.removeEventListener("resize", updateWidth);
    };
  }, [updateWidth]);

  useEffect(() => {
    setIsReady(containerWidth > 0 && page && typeof page.render === "function");
  }, [page, containerWidth]);

  useEffect(() => {
    if (!isReady || !canvasRef.current || containerWidth <= 0) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let isCancelled = false;

    try {
      const viewport = page.getViewport({ scale: 1.0 });
      const aspectRatio = viewport.width / viewport.height;
      const scale = (containerWidth * 0.95 * window.devicePixelRatio) / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      canvas.style.width = `${containerWidth * 0.95}px`;
      canvas.style.height = `${(containerWidth * 0.95) / aspectRatio}px`;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const renderTask = page.render({ canvasContext: context, viewport: scaledViewport });
      renderTask.promise
        .then(() => { if (!isCancelled) console.log(`Rendered page ${pageNum}`); })
        .catch((err) => { if (!isCancelled) console.error(`Error rendering page ${pageNum}:`, err); });

      return () => {
        isCancelled = true;
        if (renderTask && typeof renderTask.cancel === "function") renderTask.cancel();
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
          key={`page-${pageNum}-${containerWidth}`}
        />
      )}
    </div>
  );
});

// DocumentContent — only used for AI-summarized PDFs (.pdf files with a summary)
const DocumentContent = React.memo(
  ({ content, summary, getContentUrl, isPaused, originalFormat, time }) => {
    const fileType = content?.split(".").pop()?.toLowerCase() || "";
    const fileUrl = content ? getContentUrl(content) : "";
    const [pages, setPages] = useState([]);
    const [error, setError] = useState(null);
    const [showSummary, setShowSummary] = useState(!!summary);
    const containerRef = useRef(null);
    const { ref, inView } = useInView({ triggerOnce: false, threshold: 0.5 });

    const toggleSummary = useCallback((e) => {
      e.stopPropagation();
      setShowSummary((prev) => !prev);
    }, []);

    // Scroll logic for PDF pages
    useEffect(() => {
      if (fileType !== "pdf" || !inView || isPaused || !containerRef.current || showSummary) return;

      const container = containerRef.current;
      let rafId = null;
      let isActive = true;

      const CHECK_MS = 800;
      const STABLE_ROUNDS = 5;
      const MAX_WAIT_MS = 40_000;
      let lastHeight = 0;
      let stableCount = 0;
      let heightCheckId = null;
      let maxWaitId = null;

      const startScrolling = () => {
        if (!isActive || !containerRef.current) return;
        container.scrollTop = 0;
        requestAnimationFrame(() => { if (isActive) runScrollLoop(); });
      };

      const runScrollLoop = () => {
        const scrollableHeight = container.scrollHeight - container.clientHeight;
        if (scrollableHeight < 50) return;
        const durationMs = (time > 0 ? time : 30) * 1000;
        const pxPerMs = scrollableHeight / durationMs;
        let lastTimestamp = null;

        const step = (timestamp) => {
          if (!isActive || !containerRef.current) return;
          if (lastTimestamp === null) lastTimestamp = timestamp;
          const elapsed = timestamp - lastTimestamp;
          lastTimestamp = timestamp;
          const max = container.scrollHeight - container.clientHeight;
          const current = container.scrollTop;
          const advance = pxPerMs * elapsed;
          if (current + advance >= max - 1) {
            container.scrollTop = 0;
            setTimeout(() => { if (isActive) runScrollLoop(); }, 600);
            return;
          }
          container.scrollTop = current + advance;
          rafId = requestAnimationFrame(step);
        };
        rafId = requestAnimationFrame(step);
      };

      heightCheckId = setInterval(() => {
        if (!isActive || !containerRef.current) { clearInterval(heightCheckId); return; }
        const h = containerRef.current.scrollHeight;
        if (h === lastHeight) { stableCount++; } else { stableCount = 0; lastHeight = h; }
        if (stableCount >= STABLE_ROUNDS && h > (containerRef.current.clientHeight || 0)) {
          clearInterval(heightCheckId);
          clearTimeout(maxWaitId);
          startScrolling();
        }
      }, CHECK_MS);

      maxWaitId = setTimeout(() => {
        if (!isActive) return;
        clearInterval(heightCheckId);
        startScrolling();
      }, MAX_WAIT_MS);

      return () => {
        isActive = false;
        if (rafId) cancelAnimationFrame(rafId);
        if (heightCheckId) clearInterval(heightCheckId);
        if (maxWaitId) clearTimeout(maxWaitId);
      };
    }, [fileType, inView, isPaused, showSummary, time, pages.length]);

    useEffect(() => {
      if (containerRef.current) containerRef.current.scrollTop = 0;
    }, [content]);

    const [isRendering, setIsRendering] = useState(false);
    const renderTimeoutRef = useRef(null);

    useEffect(() => {
      if (fileType !== "pdf" || !inView || showSummary || !fileUrl) return;
      if (isRendering) return;

      setIsRendering(true);
      const loadPdf = async () => {
        try {
          const pdf = await pdfjsLib.getDocument(fileUrl).promise;
          const pageData = [];
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            try {
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: 1.0 });
              pageData.push({ pageNum, viewport, page });
            } catch (e) { console.error(`Error loading page ${pageNum}:`, e); }
          }
          if (pageData.length === 0) { setError("No valid pages found in PDF"); }
          else { setPages(pageData); setError(null); }
        } catch (error) {
          console.error("Error loading PDF:", error);
          setError("Wait Your Content Is Loading");
        } finally {
          renderTimeoutRef.current = setTimeout(() => setIsRendering(false), 2000);
        }
      };
      loadPdf();
      return () => { if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current); };
    }, [fileType, fileUrl, inView, showSummary]);

    const cleanedSummary = summary
      ? summary.replace(/<think>[\s\S]*<\/think>/g, "").trim()
      : null;

    if (cleanedSummary && showSummary) {
      return (
        <div className="relative w-full h-screen">
          <div className="w-full h-screen overflow-y-auto scrollbar-hidden bg-gray-900 p-8">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-white">Document Summary</h2>
              <div className="prose prose-lg prose-invert">
                <div dangerouslySetInnerHTML={{ __html: cleanedSummary }} className="text-white" />
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
            ref={(node) => { containerRef.current = node; ref(node); }}
            className="w-full h-screen overflow-y-auto scrollbar-hidden"
            style={{ scrollBehavior: "auto" }}
          >
            {inView ? (
              <div className="w-full min-h-screen flex flex-col items-center bg-gray-900">
                {error ? (
                  <div className="w-full h-screen flex items-center justify-center text-white">{error}</div>
                ) : pages.length > 0 ? (
                  pages.map((page) => (
                    <div key={`page-container-${page.pageNum}`} className="w-full mb-4">
                      <PageRenderer page={page.page} pageNum={page.pageNum} />
                    </div>
                  ))
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
      <div className="w-full h-screen flex items-center justify-center text-white bg-gray-900">
        <div className="text-center">
          <p className="text-xl font-semibold mb-2">Wait Your Content Is Loading</p>
          <p className="text-lg">The document may not have been converted correctly.</p>
        </div>
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
        videoExtensions.some((video) => content.content.toLowerCase().endsWith(video.ext))
      ) {
        videoRefs.current[index] = videoRef.current;
      }
      return () => {
        if (videoRefs.current[index]) delete videoRefs.current[index];
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
        if (video.duration - video.currentTime <= 1.0 && !isPaused && !hasResetRef.current) {
          hasResetRef.current = true;
          video.pause();
          video.currentTime = 0;
          setTimeout(() => {
            if (!isPaused) {
              video.play().catch((err) => {
                console.error("Error replaying video:", err);
                setError({ message: `Failed to replay video: ${err.message}`, details: { code: err.code || "N/A", userAgent: navigator.userAgent } });
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
        videoRef.current.play()
          .then(() => { setRequiresInteraction(false); setError(null); })
          .catch((err) => {
            setError({ message: `Failed to play video: ${err.message}`, details: { code: err.code || "N/A", userAgent: navigator.userAgent } });
          });
      }
    };

    const handleError = useCallback(
      (e) => {
        const video = videoRef.current;
        const errorDetails = { message: e.target.error?.message || "Unknown video error", code: e.target.error?.code || "N/A", userAgent: navigator.userAgent, src: e.target.currentSrc };
        if (video && video.currentTime >= video.duration - 0.1) {
          try {
            const currentSrc = video.currentSrc || video.src;
            if (!currentSrc) throw new Error("No video source found to reload.");
            video.pause(); video.src = ""; video.load(); video.src = currentSrc; video.load();
            if (!isPaused) video.play().catch((err) => setError({ message: `Failed to replay video after reload: ${err.message}`, details: { code: err.code || "N/A", userAgent: navigator.userAgent } }));
          } catch (err) {
            setError({ message: `Error while reloading video: ${err.message}`, details: { userAgent: navigator.userAgent } });
          }
          return;
        }
        setIsLoading(false); setVideoReady(false);
        setError({ message: "Video failed to load", details: errorDetails });
      },
      [isPaused]
    );

    useEffect(() => {
      if (!videoRef.current || !inView || !content?.content || !videoExtensions.some((v) => content.content.toLowerCase().endsWith(v.ext))) {
        setIsLoading(false); return;
      }
      setIsLoading(true); setVideoReady(false);
      const video = videoRef.current;

      const attemptToPlayVideo = () => {
        if (!video) return;
        video.play().then(() => setIsLoading(false)).catch((err) => {
          setIsLoading(false);
          if (err.name === "NotAllowedError") { setRequiresInteraction(true); setError({ message: "Autoplay blocked: User interaction required", details: { code: "NotAllowedError", userAgent: navigator.userAgent } }); }
          else setError({ message: `Video playback failed: ${err.message}`, details: { code: err.code || "N/A", userAgent: navigator.userAgent } });
        });
      };

      const handleCanPlay = () => {
        if (!video) return;
        setVideoReady(true); setError(null);
        if (!isPaused && !requiresInteraction) attemptToPlayVideo();
        else setIsLoading(false);
      };

      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("loadeddata", handleCanPlay);
      video.addEventListener("error", handleError);
      video.addEventListener("timeupdate", handleTimeUpdate);
      const handlePlaying = () => setIsLoading(false);
      video.addEventListener("playing", handlePlaying);
      video.load();
      if (isPaused) video.pause();
      else if (videoReady && !error && !requiresInteraction) {
        video.play().catch((err) => {
          if (err.name === "NotAllowedError") { setRequiresInteraction(true); setError({ message: "Autoplay blocked: User interaction required", details: { code: "NotAllowedError", userAgent: navigator.userAgent } }); }
        });
      }

      return () => {
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("loadeddata", handleCanPlay);
        video.removeEventListener("error", handleError);
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("playing", handlePlaying);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, [isPaused, inView, index, content, fallbackSrc, requiresInteraction, handleTimeUpdate, handleError]);

    if (!content || !content.content) {
      return (
        <div className="w-full h-full flex items-center justify-center text-white bg-gray-900">
          <p>No content available for this item.</p>
        </div>
      );
    }

    const contentUrl = getContentUrl(content.content);

    // ── WebP slide: single slide shown as image (only when NOT in a group) ──
    // Groups are handled by WebpSlideGroup above — individual .webp items
    // without a groupId (or already extracted from a group) fall here.
    if (isWebpSlide(content.content)) {
      return (
        <div ref={ref} className="w-full h-full relative">
          {inView ? (
            <>
              <img
                src={contentUrl}
                alt="Slide"
                className={`w-full h-full object-contain ${isLoading ? "opacity-0" : "opacity-100"}`}
                style={{ transition: "opacity 0.3s ease" }}
                loading="eager"
                onLoad={() => setIsLoading(false)}
                onError={() => { setIsLoading(false); setError({ message: "Slide failed to load", details: { code: "N/A", userAgent: navigator.userAgent } }); }}
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-white"></div>
                </div>
              )}
              {error && !isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900 p-4 text-center">
                  <p className="text-lg font-semibold">{error.message}</p>
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

    if (isPowerBIUrl(content.content)) {
      return <iframe src={contentUrl} className="w-full h-full" title="Embedded Power BI Report" frameBorder="0" allowFullScreen />;
    } else if (isWebpageUrl(content.content)) {
      return <WebpageEmbed webpageUrl={contentUrl} />;
    } else if (videoExtensions.some((video) => content.content.toLowerCase().endsWith(video.ext))) {
      const isMov = content.content.toLowerCase().endsWith(".mov");
      const videoSrc = fallbackSrc || contentUrl;
      return (
        <div ref={ref} className="w-full h-full relative">
          {inView ? (
            <>
              <video ref={videoRef} autoPlay={!isPaused} muted className={`w-full h-full object-contain ${isLoading ? "opacity-0" : "opacity-100"}`} style={{ transition: "opacity 0.3s ease" }}>
                <source src={videoSrc} type={videoSrc.toLowerCase().endsWith(".mp4") ? "video/mp4" : isMov ? "video/quicktime" : "video/webm"} />
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
                  {error.details && <p className="text-sm text-gray-400 mt-2">Error Code: {error.details.code}<br />Browser: {error.details.userAgent}</p>}
                  {requiresInteraction && (
                    <button onClick={handleManualPlay} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md shadow-lg flex items-center gap-2">
                      <FaPlay size={20} /> Play Video
                    </button>
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
      // Only AI-summarized PDFs reach here — everything else is now WebP
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
            <YouTubeLive liveUrl={contentUrl} isPaused={isPaused} inView={inView} showControls={false} />
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
                className={`w-full h-full object-contain ${isLoading ? "opacity-0" : "opacity-100"}`}
                loading="lazy"
                style={{ transition: "opacity 0.3s ease" }}
                onLoad={() => setIsLoading(false)}
                onError={() => { setIsLoading(false); setError({ message: "Image failed to load", details: { code: "N/A", userAgent: navigator.userAgent } }); }}
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-white"></div>
                </div>
              )}
              {error && !isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900 p-4 text-center">
                  <p className="text-lg font-semibold">{error.message}</p>
                  {error.details && <p className="text-sm text-gray-400 mt-2">Error Code: {error.details.code}<br />Browser: {error.details.userAgent}</p>}
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

// ─── DisplayUnit renderer ──────────────────────────────────────────────────────
// Wraps either a WebpSlideGroup (for converted docs) or a MediaItem (everything else)
const DisplayUnitRenderer = React.memo(
  ({ unit, isPaused, setProgress, getContentUrl, isWebpageUrl, videoRefs, unitIndex }) => {
    if (unit.type === "group") {
      return (
        <WebpSlideGroup
          slides={unit.slides}
          time={unit.time}
          isPaused={isPaused}
          getContentUrl={getContentUrl}
        />
      );
    }
    return (
      <MediaItem
        content={unit}
        index={unitIndex}
        isPaused={isPaused}
        setProgress={setProgress}
        getContentUrl={getContentUrl}
        isWebpageUrl={isWebpageUrl}
        videoRefs={videoRefs}
      />
    );
  }
);

// Clock Component
const ClockDisplay = React.memo(({ position = "top-right", visible = true }) => {
  const [dateTime, setDateTime] = useState(new Date());
  const [locationName, setLocationName] = useState("Your Location");
  const [userTimeZone, setUserTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => {
    const fetchLocationTimeZone = async () => {
      try {
        const pos = await getCurrentPosition();
        const q = pos ? `${pos.latitude},${pos.longitude}` : "auto:ip";
        const res = await axios.get(`https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${q}&aqi=no`);
        const { location: wl } = res.data;
        setLocationName(`${wl.name}, ${wl.region}${pos ? "" : " (IP-based)"}`);
        setUserTimeZone(wl.tz_id);
      } catch (error) {
        console.error("Failed to fetch location from WeatherAPI:", error.message);
      }
    };
    if (weatherApiKey) fetchLocationTimeZone();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!visible) return null;

  const positionClasses = { "top-left": "top-4 left-4", "top-right": "top-4 right-4", "bottom-left": "bottom-4 left-4", "bottom-right": "bottom-4 right-4" };

  return (
    <div className={`absolute ${positionClasses[position] || "top-4 right-4"} flex items-center gap-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-xl shadow-lg backdrop-blur-lg`}>
      <Clock className="w-6 h-6 text-yellow-400" />
      <div className="text-right">
        <p className="text-sm font-medium opacity-80">
          {dateTime.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: userTimeZone }).toUpperCase()}
        </p>
        <p className="text-xl font-bold tracking-wider">
          {dateTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: userTimeZone })}
        </p>
      </div>
    </div>
  );
});

const getCurrentPosition = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
    );
  });

// ─────────────────────────────────────────────────────────────────────────────
// Preview Component
// ─────────────────────────────────────────────────────────────────────────────
const Preview = () => {
  const { url } = useParams();
  const mediaItems = useSelector((state) => state.media.mediaItems);
  const [mediaContent, setMediaContent] = useState([]);
  const [displayUnits, setDisplayUnits] = useState([]); // ← NEW: flattened display units
  const [isEnabled, setIsEnabled] = useState(false);
  const [currentUnitIndex, setCurrentUnitIndex] = useState(0); // ← index into displayUnits
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
  const [isSessionActive, setIsSessionActive] = useState(true);
  const controlTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const pollingRef = useRef(null);
  const lastFetchRef = useRef(0);

  const resetControlTimeout = useCallback(() => {
    if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current);
    setShowControls(true);
    controlTimeoutRef.current = setTimeout(() => setShowControls(false), 5000);
  }, []);

  const togglePlayPause = useCallback(() => {
    setIsPaused((prev) => {
      const newPausedState = !prev;
      Object.values(videoRefs.current).forEach((video) => {
        if (video) { if (newPausedState) video.pause(); else video.play().catch(console.error); }
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
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const formatDescription = useCallback((description) => {
    if (!description) return "";
    return description.replace(/<[^>]*>/g, "");
  }, []);

  const isTimeWindowActive = useCallback((timeWindow) => {
    if (!timeWindow || !timeWindow.startTime || !timeWindow.endTime) return true;
    const timeFormat = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeFormat.test(timeWindow.startTime) || !timeFormat.test(timeWindow.endTime)) return false;
    const now = new Date();
    const nowTime = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = timeWindow.startTime.split(":").map(Number);
    const [eh, em] = timeWindow.endTime.split(":").map(Number);
    return nowTime >= sh * 60 + sm && nowTime <= eh * 60 + em;
  }, []);

  const isScheduledNow = useCallback((schedule) => {
    if (!schedule || Object.keys(schedule).length === 0) return true;
    if (!schedule.startTime && !schedule.endTime && !schedule.startDate && !schedule.endDate && (!schedule.timeWindows || schedule.timeWindows.length === 0)) return true;
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    let isWithinDate = true;
    if (schedule.startDate) isWithinDate = today >= schedule.startDate.split("T")[0];
    if (schedule.endDate) isWithinDate = isWithinDate && today <= schedule.endDate.split("T")[0];
    if (!isWithinDate) return false;
    if (schedule.timeWindows && schedule.timeWindows.length > 0) return schedule.timeWindows.some((tw) => isTimeWindowActive(tw));
    if (schedule.startTime && schedule.endTime) {
      const nowTime = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = schedule.startTime.split(":").map(Number);
      const [eh, em] = schedule.endTime.split(":").map(Number);
      return nowTime >= sh * 60 + sm && nowTime <= eh * 60 + em;
    }
    return true;
  }, [isTimeWindowActive]);

  const groupMediaByLayout = useCallback((content) => {
    const groupedContent = {};
    (content || []).forEach((item, index) => {
      const layoutKey = item?.layout || "single";
      if (!groupedContent[layoutKey]) groupedContent[layoutKey] = [];
      groupedContent[layoutKey].push({ ...item, originalIndex: index });
    });
    return groupedContent;
  }, []);

  const getActiveContent = useCallback((content) => {
    if (!Array.isArray(content)) return [];
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const exclusiveHigh = content.filter((item) => item?.schedule && isScheduledNow(item.schedule) && item.schedule.displayMode === "exclusive" && item.schedule.priority === "high");
    if (exclusiveHigh.length > 0) return exclusiveHigh.sort((a, b) => (priorityOrder[b.schedule?.priority || "low"] || 0) - (priorityOrder[a.schedule?.priority || "low"] || 0));
    return content.filter((item) => item?.schedule && isScheduledNow(item.schedule))
      .sort((a, b) => (priorityOrder[b.schedule?.priority || "low"] || 0) - (priorityOrder[a.schedule?.priority || "low"] || 0));
  }, [isScheduledNow]);

  const getContentUrl = useCallback((content) => {
    if (!content) return "";
    const prefix = "/api/upload/preview/";
    let baseUrl;
    if (content.startsWith(prefix)) {
      baseUrl = content.slice(prefix.length);
    } else if (isYouTubeUrl(content)) {
      return getYouTubeEmbedUrl(content);
    } else {
      baseUrl = content.startsWith("http") ? content : `${apiBaseUrl}/${content}`;
    }
    if (baseUrl.includes(apiBaseUrl)) baseUrl = baseUrl.replace(/([^:]\/)\/+/g, "$1");
    const separator = baseUrl.includes("?") ? "&" : "?";
    const cacheBuster = content.endsWith(".webp") || content.endsWith(".pdf") ? "" : `v=${Date.now()}`;
    return cacheBuster ? `${baseUrl}${separator}${cacheBuster}` : `${baseUrl}${separator}`;
  }, [url]);

  const preloadMedia = useCallback((content) => {
    (content || []).slice(0, 3).forEach((item) => {
      if (item?.content) {
        const u = getContentUrl(item.content);
        const link = document.createElement("link");
        link.rel = "preload";
        link.href = u;
        link.as = videoExtensions.some((v) => item.content.toLowerCase().endsWith(v.ext)) ? "video" : item.content.endsWith(".pdf") ? "fetch" : "image";
        link.onerror = () => console.error(`Preload failed: ${u}`);
        document.head.appendChild(link);
      }
    });
  }, [getContentUrl]);

  const fetchWeather = useCallback(async (location = "Ohio") => {
    if (!weatherApiKey) return;
    const now = Date.now();
    if (cache.weather.data && cache.weather.timestamp && now - cache.weather.timestamp < cache.weather.ttl) { setWeather(cache.weather.data); return; }
    try {
      let weatherLocation = location;
      if (location === "auto" || location === "Ohio") {
        const position = await getCurrentPosition();
        weatherLocation = position ? `${position.latitude},${position.longitude}` : "auto:ip";
      }
      const res = await axios.get(`https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${weatherLocation}&aqi=no`, { timeout: 8000 });
      cache.weather.data = res.data; cache.weather.timestamp = now;
      setWeather(res.data);
    } catch (error) { console.error("Error fetching weather:", error); }
  }, []);

  const getUserLocation = useCallback(() => {
    getCurrentPosition().then((position) => {
      fetchWeather(position ? `${position.latitude},${position.longitude}` : "auto:ip");
    });
  }, [fetchWeather]);

  const rssFeedOptions = [
    { value: "cnn", label: "CNN", url: "https://rss.cnn.com/rss/edition.rss" },
    { value: "nbc", label: "NBC News", url: "https://feeds.nbcnews.com/nbcnews/public/news" },
    { value: "nytimes", label: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" },
    { value: "bbc", label: "BBC News", url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml" },
    { value: "fox", label: "Fox News", url: "https://feeds.foxnews.com/foxnews/latest" },
    { value: "ndtv", label: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-top-stories" },
    { value: "indiatoday", label: "India Today", url: "https://www.indiatoday.in/rss/1206514" },
    { value: "indiatv", label: "India TV News", url: "https://www.indiatvnews.com/rssfeed/topstory.xml" },
    { value: "zeenews", label: "Zee News", url: "https://zeenews.india.com/rss/india-national-news.xml" },
    { value: "dna", label: "DNA India", url: "https://www.dnaindia.com/feeds/india.xml" },
    { value: "moneycontrol", label: "Moneycontrol", url: "https://www.moneycontrol.com/rss/latestnews.xml" },
  ];

  const fetchNews = useCallback(async () => {
    const now = Date.now();
    if (cache.news.data && cache.news.timestamp && now - cache.news.timestamp < cache.news.ttl) { setNews(cache.news.data); return; }
    try {
      const rssFeedValue = settings?.ticker?.rssFeed;
      const rssFeedValues = Array.isArray(rssFeedValue) ? rssFeedValue : rssFeedValue ? [rssFeedValue] : ["nbc"];
      const feedUrls = rssFeedValues.map((v) => rssFeedOptions.find((o) => o.value === v)?.url).filter(Boolean);
      if (feedUrls.length === 0) feedUrls.push("https://feeds.nbcnews.com/nbcnews/public/news");

      const responses = await Promise.all(feedUrls.map((feedUrl) =>
        axios.get(`${apiBaseUrl}/api/upload/parse-rss?url=${encodeURIComponent(feedUrl)}`, { timeout: 5000 })
          .catch(() => ({ data: { items: [] } }))
      ));

      const seen = new Set();
      let articles = responses.flatMap((r) => (r.data.items || []).map((item) => ({
        title: item.title, link: item.url, pubDate: item.publishedAt, description: item.description, source: item.source,
      }))).filter(({ title, link }) => { const k = title || link; if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0)).slice(0, 20);

      if (articles.length === 0 && newsApiKey) {
        const fb = await axios.get(`https://gnews.io/api/v4/top-headlines?country=in&token=${newsApiKey}`, { timeout: 5000 });
        articles = fb.data.articles.slice(0, 8).map((a) => ({ title: a.title, link: a.url, pubDate: a.publishedAt, description: a.description, source: a.source.name }));
      }

      cache.news.data = articles; cache.news.timestamp = now;
      setNews(articles);
    } catch (error) { console.error("Error fetching news:", error); setNews([]); }
  }, [settings?.ticker?.rssFeed, newsApiKey]);

  // ── Apply new content → derive displayUnits ────────────────────────────────
  const applyContent = useCallback((activeContent) => {
    setMediaContent(activeContent);
    const units = buildDisplayUnits(activeContent);
    setDisplayUnits(units);
    if (units.length > 0) {
      setCurrentUnitIndex(0);
      setCurrentLayout(units[0].layout || "single");
    } else {
      setVisibleItems([fallbackItem]);
    }
    preloadMedia(activeContent);
  }, [preloadMedia]);

  // ── Visible items for the current display unit (layout support) ────────────
  useEffect(() => {
    if (displayUnits.length === 0) { setVisibleItems([fallbackItem]); return; }
    const idx = currentUnitIndex % displayUnits.length;
    const unit = displayUnits[idx];
    if (!unit) { setVisibleItems([fallbackItem]); return; }
    setCurrentLayout(unit.layout || "single");

    const layoutConfig = layoutOptions.find((o) => o.id === (unit.layout || "single")) || layoutOptions[0];
    const itemsPerPage = layoutConfig.cols * layoutConfig.rows;

    // For groups, show just the group unit. For singles, collect up to itemsPerPage.
    if (unit.type === "group") {
      setVisibleItems([unit]);
    } else {
      // Find contiguous single units from this index
      const singles = [];
      for (let j = idx; j < Math.min(idx + itemsPerPage, displayUnits.length); j++) {
        if (displayUnits[j].type === "single") singles.push(displayUnits[j]);
        else break;
      }
      setVisibleItems(singles.length > 0 ? singles : [fallbackItem]);
    }
  }, [displayUnits, currentUnitIndex]);

  const isWebpageUrl = useCallback((url) => {
    if (!url) return false;
    const excluded = [...videoExtensions.map((v) => v.ext), ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"];
    return (url.startsWith("http://") || url.startsWith("https://")) && !isPowerBIUrl(url) && !isYouTubeLiveUrl(url) && !excluded.some((ext) => url.toLowerCase().endsWith(ext));
  }, []);

  const getGridClasses = useCallback(() => {
    switch (currentLayout) {
      case "2x1": return "grid-cols-2 grid-rows-1";
      case "1x2": return "grid-cols-1 grid-rows-2";
      case "2x2": return "grid-cols-2 grid-rows-2";
      case "3x1": return "grid-cols-3 grid-rows-1";
      case "1x3": return "grid-cols-1 grid-rows-3";
      default: return "grid-cols-1 grid-rows-1";
    }
  }, [currentLayout]);

  const isAnyPowerBIContent = useCallback(() => visibleItems.some((item) => item?.content && isPowerBIUrl(item.content)), [visibleItems]);

  const goNext = useCallback(() => {
    if (displayUnits.length === 0) return;
    setCurrentUnitIndex((prev) => (prev + 1) % displayUnits.length);
    setShowControls(true);
    resetControlTimeout();
  }, [displayUnits, resetControlTimeout]);

  const goPrev = useCallback(() => {
    if (displayUnits.length === 0) return;
    setCurrentUnitIndex((prev) => (prev - 1 + displayUnits.length) % displayUnits.length);
    setShowControls(true);
    resetControlTimeout();
  }, [displayUnits, resetControlTimeout]);

  const fetchData = useCallback(async (source = "unknown") => {
    const now = Date.now();
    const minInterval = 60 * 1000;
    if (now - lastFetchRef.current < minInterval) { console.log(`fetchData throttled (source: ${source})`); return; }
    lastFetchRef.current = now;

    const isBackgroundFetch = source === "polling" || source.includes("socket");
    if (!isBackgroundFetch) setIsLoading(true);

    try {
      const response = await axios.post(`${apiBaseUrl}/api/upload/preview/${url}`, { timeout: 10000 });
      if (response.data) {
        const content = response.data.url_content || [];
        const activeContent = getActiveContent(content);

        const createFingerprint = (items) => items.map((item) => `${item.content}|${item.layout}|${item.time}`).join("::");
        if (createFingerprint(activeContent) === createFingerprint(mediaContent)) {
          console.log(`Content unchanged (${source}), preserving state`);
          setSettings(response.data.settings || defaultSettings);
          setCustomTicker(response.data.custom_ticker || null);
          if (!isBackgroundFetch) setIsLoading(false);
          return;
        }

        const cacheKey = `preview_${url}`;
        localStorage.setItem(cacheKey, JSON.stringify(response.data));
        setAllContent(content);
        applyContent(activeContent);
        setIsEnabled(response.data.isEnabled === true);
        setScheduledAt(response.data.scheduledAt ? new Date(response.data.scheduledAt) : null);
        setExpiresAt(response.data.expiresAt ? new Date(response.data.expiresAt) : null);
        setCustomTicker(response.data.custom_ticker || null);
        setSettings(response.data.settings || defaultSettings);
      }
    } catch (error) {
      console.error(`Error fetching preview content (source: ${source}):`, error);
    } finally {
      if (!isBackgroundFetch) setIsLoading(false);
    }
  }, [url, getActiveContent, applyContent, mediaContent]);

  const handleSocketUpdate = useCallback((data, eventType) => {
    if (!data || !data.url_content) { setVisibleItems([fallbackItem]); return; }
    const cacheKey = `preview_${url}`;
    localStorage.setItem(cacheKey, JSON.stringify(data));
    const content = data.url_content || [];
    setAllContent(content);
    const activeContent = getActiveContent(content);
    if (JSON.stringify(activeContent) === JSON.stringify(mediaContent)) { setIsLoading(false); return; }

    applyContent(activeContent);
    setIsEnabled(data.isEnabled === true);
    setScheduledAt(data.scheduledAt ? new Date(data.scheduledAt) : null);
    setExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);
    setCustomTicker(data.custom_ticker || null);
    setSettings(data.settings || defaultSettings);
    setIsLoading(false);
  }, [url, getActiveContent, applyContent, mediaContent]);

  const connectSocket = useCallback(() => {
    if (!isSessionActive) return;
    if (socketRef.current?.connected) return;
    if (socketRef.current) { socketRef.current.removeAllListeners(); socketRef.current.disconnect(); socketRef.current = null; }

    const socket = io(apiBaseUrl, {
      query: { url },
      auth: { token: localStorage.getItem("jwt_token") },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 30000,
      timeout: 30000,
      forceNew: true,
    });

    socket.on("connect", () => {
      socket.emit("join", { url, token: localStorage.getItem("jwt_token") }, (response) => {
        if (response?.error) console.error("Failed to join room:", response.error);
        else fetchData("socket-connect");
      });
    });

    socket.on("update", (data) => handleSocketUpdate(data, "update"));
    socket.on("init", (data) => handleSocketUpdate(data, "init"));
    socket.on("reconnect", () => fetchData("socket-reconnect"));
    socket.on("disconnect", (reason) => { if (reason === "io server disconnect") socket.connect(); });
    socket.on("connect_error", (err) => console.error("Socket connection error:", err.message));

    socketRef.current = socket;
  }, [url, handleSocketUpdate, fetchData, isSessionActive]);

  useEffect(() => {
    const handleMouseMove = () => resetControlTimeout();
    window.addEventListener("mousemove", handleMouseMove);
    return () => { window.removeEventListener("mousemove", handleMouseMove); if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current); };
  }, [resetControlTimeout]);

  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const loadData = async () => {
      setIsLoading(true);
      try { await Promise.all([fetchData("initial"), fetchWeather(), fetchNews()]); }
      catch (error) { console.error("Error loading data:", error); setVisibleItems([fallbackItem]); }
      finally { setIsLoading(false); }
    };

    loadData();
    connectSocket();

    return () => {
      isInitializedRef.current = false;
      if (socketRef.current) { socketRef.current.removeAllListeners(); socketRef.current.disconnect(); socketRef.current = null; }
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, []);

  useEffect(() => { getUserLocation(); }, [getUserLocation]);

  // ── Slideshow timer — advances by display unit ─────────────────────────────
  useEffect(() => {
    if (displayUnits.length === 0 || !isEnabled || isPaused) {
      setActiveSlideshow(false);
      if (displayUnits.length === 0 || !isEnabled) setVisibleItems([fallbackItem]);
      return;
    }

    setActiveSlideshow(true);
    if (displayUnits.length <= 1) return; // Single unit — no timer needed

    const idx = currentUnitIndex % displayUnits.length;
    const unit = displayUnits[idx];
    if (!unit || !Number.isFinite(unit.time) || unit.time <= 0) { setVisibleItems([fallbackItem]); return; }

    const delay = unit.time * 1000;
    const timer = setTimeout(() => {
      setCurrentUnitIndex((prev) => (prev + 1) % displayUnits.length);
    }, delay);

    return () => clearTimeout(timer);
  }, [displayUnits, currentUnitIndex, isPaused, isEnabled]);

  useEffect(() => {
    const now = new Date();
    if (scheduledAt && now < scheduledAt) {
      setIsEnabled(false); setCountdownType("start");
      const interval = setInterval(() => {
        const t = scheduledAt - new Date();
        if (t <= 0) { setIsEnabled(true); setCountdownType(null); clearInterval(interval); fetchData("schedule-start"); }
        else setTimeRemaining(t);
      }, 1000);
      return () => clearInterval(interval);
    } else if (expiresAt && now < expiresAt) {
      setIsEnabled(true); setCountdownType("end");
      const interval = setInterval(() => {
        const t = expiresAt - new Date();
        if (t <= 0) { setIsEnabled(false); setCountdownType(null); clearInterval(interval); fetchData("schedule-end"); }
        else setTimeRemaining(t);
      }, 1000);
      return () => clearInterval(interval);
    } else if (expiresAt && now >= expiresAt) {
      setIsEnabled(false); setCountdownType(null);
    }
  }, [scheduledAt, expiresAt, isEnabled, fetchData]);

  return (
    <div className="relative flex justify-center items-center w-screen h-screen bg-black overflow-hidden">
      {isLoading ? (
        renderFallbackUI("Wait, your content is loading", countdownType, timeRemaining, formatTimeRemaining)
      ) : !isEnabled ? (
        renderFallbackUI("This URL is currently inactive.", countdownType, timeRemaining, formatTimeRemaining)
      ) : displayUnits.length > 0 ? (
        <div className={`grid w-full h-screen gap-2 ${getGridClasses()}`}>
          {visibleItems.map((unit, index) => (
            <div key={unit.type === "group" ? `group-${unit.groupId}` : `unit-${currentUnitIndex + index}`} className="relative w-full h-full bg-gray-900 rounded overflow-hidden">
              <DisplayUnitRenderer
                unit={unit}
                unitIndex={currentUnitIndex + index}
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

      <ClockDisplay position={settings.dateTime.position} visible={settings.dateTime.visible} />
      <TemperatureDisplay weather={weather} position={settings.temperature.position} visible={settings.temperature.visible} />

      {(customTicker || news.length > 0) && settings.ticker.visible && (
        <div className="absolute bottom-16 left-0 w-full overflow-hidden bg-black bg-opacity-70 py-3" style={{ height: `${settings.ticker.height}px` }}>
          <div className="news-ticker-container relative w-full">
            <div
              key={`ticker-${settings.ticker.speed}-${settings.ticker.fontSize}`}
              className="news-ticker"
              style={{
                animationName: "marquee",
                animationDuration: `${customTicker ? settings.ticker.speed * 0.5 : settings.ticker.speed}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                fontSize: `${settings.ticker.fontSize}px`,
              }}
            >
              {customTicker ? (
                <span className="news-item inline-block px-6 text-white">{customTicker}</span>
              ) : (
                <>
                  {[...news, ...news].map((article, index) => (
                    <span key={`news-${index}`} className="news-item inline-block px-6 text-white">
                      <strong>{article.title}</strong> — {formatDescription(article.description)}
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showControls && isEnabled && displayUnits.length > 0 && !isAnyPowerBIContent() && (
        <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 flex gap-8 z-10">
          <button className="bg-gray-900 bg-opacity-80 text-white p-5 rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:bg-opacity-100" onClick={(e) => { e.stopPropagation(); goPrev(); }}>
            <FaChevronLeft size={25} />
          </button>
          <button className="bg-gray-900 bg-opacity-80 text-white p-5 rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:bg-opacity-100" onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}>
            {isPaused ? <FaPlay size={25} /> : <FaPause size={25} />}
          </button>
          <button className="bg-gray-900 bg-opacity-80 text-white p-5 rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:bg-opacity-100" onClick={(e) => { e.stopPropagation(); goNext(); }}>
            <FaChevronRight size={25} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Preview;