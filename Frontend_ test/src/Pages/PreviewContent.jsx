import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FaPlay,
  FaPause,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { Clock } from "lucide-react";
import YouTubeLive from "./YouTubeLive";
import WebpageEmbed from "./WebpageEmbed";
import { useInView } from "react-intersection-observer";
import * as pdfjsLib from "pdfjs-dist";

// Set the worker source to the local file in the public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

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

// Supported video extensions and their MIME types
const videoExtensions = [
  { ext: ".mp4", mime: "video/mp4" },
  { ext: ".mov", mime: "video/quicktime" },
  { ext: ".webm", mime: "video/webm" },
];

// Clock Component to isolate dateTime updates
const ClockDisplay = React.memo(() => {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
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
  );
});

const PreviewContent = ({ mediaContent = [], customTicker }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentLayout, setCurrentLayout] = useState("single");
  const [visibleItems, setVisibleItems] = useState([fallbackItem]);
  const [activeSlideshow, setActiveSlideshow] = useState(false);
  const videoRefs = useRef({}); // Persist video refs across renders
  const controlTimeoutRef = useRef(null);

  // Group mediaContent by layout to handle different layouts in sequence
  const groupedContent = useCallback(() => {
    return mediaContent.reduce((acc, item, index) => {
      const layoutKey = item?.layout || "single";
      if (!acc[layoutKey]) {
        acc[layoutKey] = [];
      }
      acc[layoutKey].push({ ...item, originalIndex: index });
      return acc;
    }, {});
  }, [mediaContent]);

  // Reset the control visibility timeout
  const resetControlTimeout = useCallback(() => {
    if (controlTimeoutRef.current) {
      clearTimeout(controlTimeoutRef.current);
    }
    setShowControls(true);
    controlTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000); // Hide controls after 5 seconds
  }, []);

  // Handle mouse movement to show controls and reset the timeout
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

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    setIsPaused((prev) => {
      const newPausedState = !prev;
      // Update all video refs based on the new paused state
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

  // Check if URL is a Power BI URL
  const isPowerBIUrl = useCallback((url) => {
    return url && url.includes("powerbi.com");
  }, []);

  // Check if URL is a YouTube Live URL
  const isYouTubeLiveUrl = useCallback((url) => {
    if (!url) return false;
    const youtubePatterns = [
      /youtube\.com\/live\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)(&|\?).*?\blive\b/,
      /youtube\.com\/channel\/[^/]+\/live/,
      /youtu\.be\/([a-zA-Z0-9_-]+)(\?.*)?\blive\b/,
    ];
    return youtubePatterns.some((pattern) => pattern.test(url));
  }, []);

  // Check if URL is a YouTube URL
  const isYouTubeUrl = useCallback((url) => {
    return (
      url &&
      (url.includes("youtube.com/watch") ||
        url.includes("youtube.com/live") ||
        url.includes("youtu.be") ||
        url.includes("youtube.com/embed") ||
        url.includes("youtube.com/v"))
    );
  }, []);

  // Get YouTube embed URL
  const getYouTubeEmbedUrl = useCallback((url) => {
    if (!url) return "";
    if (url.includes("youtu.be")) {
      const videoId = url.split("youtu.be/")[1].split(/[?&]/)[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0`;
    }
    if (url.includes("youtube.com")) {
      const videoIdMatch = url.match(/(?:v=|v\/|embed\/|watch\?v=|watch\?.+&v=)([^&?]+)/);
      if (videoIdMatch && videoIdMatch[1]) {
        return `https://www.youtube.com/embed/${videoIdMatch[1]}?autoplay=1&mute=1&controls=0`;
      }
    }
    return url;
  }, []);

  // Check if URL is a webpage URL (not an image/video/pdf/txt)
  const isWebpageUrl = useCallback((url) => {
    if (!url) return false;
    const excludedExtensions = [
      ...videoExtensions.map((video) => video.ext),
      ".pdf",
      ".txt",
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
  }, [isPowerBIUrl, isYouTubeLiveUrl]);

  // Get grid classes based on current layout
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

  // Check if any content is Power BI
  const isAnyPowerBIContent = useCallback(() => {
    return visibleItems.some((item) => item?.content && isPowerBIUrl(item.content));
  }, [visibleItems, isPowerBIUrl]);

  // PageRenderer Component
  const PageRenderer = React.memo(({ page, pageNum }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(0);

    const updateWidth = useCallback(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerWidth(rect.width);
      } else {
        setContainerWidth(window.innerWidth);
      }
    }, []);

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
      if (!canvasRef.current || !page || typeof page.render !== "function" || containerWidth <= 0) {
        return;
      }

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      const viewport = page.getViewport({ scale: 1.0 });
      const aspectRatio = viewport.width / viewport.height;

      const scale = (containerWidth * window.devicePixelRatio) / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${containerWidth / aspectRatio}px`;

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const renderContext = { canvasContext: context, viewport: scaledViewport };
      let isCancelled = false;
      const renderTask = page.render(renderContext);

      renderTask.promise.catch((error) => {
        if (!isCancelled) {
          console.error(`Error rendering page ${pageNum}:`, error);
        }
      });

      return () => {
        isCancelled = true;
        if (renderTask.cancel) renderTask.cancel();
      };
    }, [page, pageNum, containerWidth]);

    if (!page || typeof page.render !== "function") {
      return (
        <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">
          Failed to render PDF page {pageNum}
        </div>
      );
    }

    return (
      <div ref={containerRef} className="w-full h-full">
        <canvas ref={canvasRef} className="w-full h-auto max-h-full object-contain" key={`page-${pageNum}`} />
      </div>
    );
  });

  // DocumentContent Component
  const DocumentContent = React.memo(({ content, summary, isPaused, originalFormat }) => {
    const fileType = content?.split(".").pop()?.toLowerCase() || "";
    const [pages, setPages] = useState([]);
    const [textContent, setTextContent] = useState("");
    const [error, setError] = useState(null);
    const [showSummary, setShowSummary] = useState(!!summary);
    const containerRef = useRef(null);
    const { ref, inView } = useInView({ triggerOnce: false, threshold: 0.1 });

    const toggleSummary = useCallback((e) => {
      e.stopPropagation();
      setShowSummary((prev) => !prev);
    }, []);

    // Load PDF
    useEffect(() => {
      if (fileType !== "pdf" || !inView || showSummary || !content) return;

      const loadPdf = async () => {
        try {
          const pdf = await pdfjsLib.getDocument(content).promise;
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
          setError("Failed to load PDF document.");
        }
      };
      loadPdf();
    }, [fileType, content, inView, showSummary]);

    // Load .txt file
    useEffect(() => {
      if (fileType !== "txt" || !inView || !content) return;

      const loadText = async () => {
        try {
          const response = await fetch(content);
          const text = await response.text();
          setTextContent(text);
          setError(null);
        } catch (error) {
          console.error("Error loading text file:", error);
          setError("Failed to load text document.");
        }
      };
      loadText();
    }, [fileType, content, inView]);

    // Auto-scroll for PDFs
    useEffect(() => {
      if (fileType !== "pdf" || !inView || isPaused || !containerRef.current || showSummary) return;

      const container = containerRef.current;
      const scrollInterval = setInterval(() => {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight) {
          container.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          container.scrollBy({ top: 1, behavior: "auto" });
        }
      }, 50);

      return () => {
        clearInterval(scrollInterval);
      };
    }, [fileType, inView, isPaused, showSummary]);

    const cleanedSummary = summary
      ? summary.replace(/<think>[\s\S]*<\/think>/g, "").trim()
      : null;

    if (cleanedSummary && showSummary) {
      return (
        <div className="relative w-full h-full">
          <div className="w-full h-full overflow-y-auto scrollbar-hidden bg-gray-900 p-8">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-white">Document Summary</h2>
              <div className="prose prose-lg prose-invert">
                <div dangerouslySetInnerHTML={{ __html: cleanedSummary }} className="text-white" />
              </div>
            </div>
          </div>
          <button
            onClick={toggleSummary}
            className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md shadow-lg z-10"
          >
            View Full Document
          </button>
        </div>
      );
    }

    if (fileType === "pdf") {
      return (
        <div className="relative w-full h-full">
          <div
            ref={(node) => {
              containerRef.current = node;
              ref(node);
            }}
            className="w-full h-full overflow-y-auto scrollbar-hidden"
            style={{ scrollBehavior: "smooth" }}
          >
            {inView ? (
              <div className="w-full h-full flex flex-col items-center bg-gray-900">
                {error ? (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    {error}
                  </div>
                ) : pages.length > 0 ? (
                  <>
                    {pages.map((page) => (
                      <div
                        key={`page-container-${page.pageNum}`}
                        className="w-full h-full mb-4"
                      >
                        <PageRenderer page={page.page} pageNum={page.pageNum} />
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
              </div>
            )}
          </div>
          {cleanedSummary && (
            <button
              onClick={toggleSummary}
              className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md shadow-lg z-10"
            >
              View Summary
            </button>
          )}
        </div>
      );
    }

    if (fileType === "txt") {
      return (
        <div className="relative w-full h-full">
          <div
            ref={ref}
            className="w-full h-full overflow-y-auto scrollbar-hidden bg-gray-900 p-8"
            style={{ scrollBehavior: "smooth" }}
          >
            {inView ? (
              <div className="w-full h-full flex flex-col items-center">
                {error ? (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    {error}
                  </div>
                ) : textContent ? (
                  <div className="max-w-3xl mx-auto text-white whitespace-pre-wrap">
                    {textContent}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
              </div>
            )}
          </div>
          {cleanedSummary && (
            <button
              onClick={toggleSummary}
              className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md shadow-lg z-10"
            >
              View Summary
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="relative w-full h-full">
        <div
          ref={ref}
          className="w-full h-full overflow-y-auto scrollbar-hidden"
          style={{ scrollBehavior: "smooth" }}
        >
          {inView ? (
            <div className="w-full h-full flex items-center justify-center text-white bg-gray-900">
              <div className="text-center">
                <p className="text-xl font-semibold mb-2">
                  Error: Failed to display document
                </p>
                <p className="text-lg">
                  The document may not have been converted to PDF correctly.
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
            </div>
          )}
        </div>
        {cleanedSummary && (
          <button
            onClick={toggleSummary}
            className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md shadow-lg z-10"
          >
            View Summary
          </button>
        )}
      </div>
    );
  });

  // MediaItem Component
  const MediaItem = React.memo(({ content, index, isPaused }) => {
    const { ref, inView } = useInView({ triggerOnce: true });
    const videoRef = useRef(null);
    const [error, setError] = useState(null);
    const [fallbackSrc, setFallbackSrc] = useState(null);

    useEffect(() => {
      if (videoRef.current && content?.content && videoExtensions.some((video) => 
        content.content.toLowerCase().endsWith(video.ext))) {
        videoRefs.current[index] = videoRef.current;
      }
      return () => {
        if (videoRefs.current[index]) {
          delete videoRefs.current[index];
        }
      };
    }, [index, content]);

    useEffect(() => {
      if (!videoRef.current || !inView || !content?.content || 
          !videoExtensions.some((video) => content.content.toLowerCase().endsWith(video.ext))) return;

      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch((err) => {
          setError({
            message: "Failed to play video. Please check format or URL.",
            details: {
              code: err.code || "N/A",
              userAgent: navigator.userAgent,
            },
          });
        });
      }
    }, [isPaused, inView, index, content, fallbackSrc]);

    if (!content || !content.content) {
      return (
        <div className="w-full h-full flex items-center justify-center text-white bg-gray-900">
          <p>No content available for this item.</p>
        </div>
      );
    }

    if (isPowerBIUrl(content.content)) {
      return (
        <iframe
          src={content.content}
          className="w-full h-full object-contain"
          title="Embedded Power BI Report"
          frameBorder="0"
          allowFullScreen
        />
      );
    } else if (isWebpageUrl(content.content)) {
      return (
        <div className="w-full h-full overflow-hidden">
          <WebpageEmbed webpageUrl={content.content} />
        </div>
      );
    } else if (videoExtensions.some((video) => content.content.toLowerCase().endsWith(video.ext))) {
      const originalSrc = content.content;
      const isMov = content.content.toLowerCase().endsWith(".mov");
      const isWebm = content.content.toLowerCase().endsWith(".webm");
      const videoSrc = fallbackSrc || originalSrc;

      return (
        <div ref={ref} className="w-full h-full">
          {inView ? (
            error ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-white bg-gray-900 p-4 text-center">
                <p className="text-lg font-semibold">{error.message}</p>
                {error.details && (
                  <p className="text-sm text-gray-400 mt-2">
                    Error Code: {error.details.code}
                    <br />
                    Browser: {error.details.userAgent}
                  </p>
                )}
                {content.thumbnail && (
                  <img
                    src={content.thumbnail}
                    alt="Video fallback"
                    className="mt-4 max-w-full max-h-64 object-contain"
                  />
                )}
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay={!isPaused}
                loop
                muted
                className="w-full h-full object-contain"
                onError={(e) => {
                  const errorDetails = {
                    message: e.target.error?.message || "Unknown error",
                    code: e.target.error?.code || "N/A",
                    userAgent: navigator.userAgent,
                  };

                  if ((isMov || isWebm) && !fallbackSrc) {
                    const mp4Src = originalSrc.replace(/\.(mov|webm)$/i, ".mp4");
                    setFallbackSrc(mp4Src);
                  } else {
                    setError({
                      message: "Failed to play video. Please check format or URL.",
                      details: errorDetails,
                    });
                  }
                }}
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
            )
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
            </div>
          )}
        </div>
      );
    } else if (content.content.endsWith(".pdf") || content.content.endsWith(".txt")) {
      return (
        <DocumentContent
          content={content.content}
          summary={content.summary}
          isPaused={isPaused}
          originalFormat={content.originalFormat}
        />
      );
    } else if (isYouTubeUrl(content.content)) {
      return (
        <div ref={ref} className="w-full h-full">
          {inView ? (
            <div className="w-full h-full">
              <YouTubeLive
                liveUrl={getYouTubeEmbedUrl(content.content)}
                isPaused={isPaused}
                inView={inView}
                showControls={false}
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div ref={ref} className="w-full h-full">
          {inView ? (
            <img
              src={content.content}
              alt="Preview content"
              className="w-full h-full object-contain"
              loading="lazy"
              onError={(e) => {
                console.error("Image load error:", {
                  src: e.target.src,
                  content: content.content,
                });
                e.target.style.display = "none";
                e.target.parentElement.innerHTML = `
                  <div class="w-full h-full flex items-center justify-center text-white bg-gray-900">
                    <p>Preview Not Availble</p>
                  </div>
                `;
              }}
            />
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
            </div>
          )}
        </div>
      );
    }
  });

  // Go to next item
  const goNext = useCallback(() => {
    const currentItem = mediaContent[currentIndex] || fallbackItem;
    const layoutConfig =
      layoutOptions.find((option) => option.id === (currentItem.layout || "single")) ||
      layoutOptions[0];
    const itemsPerPage = layoutConfig.cols * layoutConfig.rows;
    const nextIndex = currentIndex + itemsPerPage;
    const grouped = groupedContent();

    if (nextIndex >= mediaContent.length && mediaContent.length > 0) {
      setCurrentIndex(0);
      const firstLayout = mediaContent[0]?.layout || "single";
      setCurrentLayout(firstLayout);
      updateVisibleItems(firstLayout, grouped, 0);
    } else if (mediaContent.length === 0) {
      setVisibleItems([fallbackItem]);
    } else {
      setCurrentIndex(nextIndex);
      const nextItem = mediaContent[nextIndex] || fallbackItem;
      const nextLayout = nextItem.layout || "single";
      setCurrentLayout(nextLayout);
      updateVisibleItems(nextLayout, grouped, nextIndex);
    }
    setShowControls(true);
  }, [mediaContent, currentIndex, groupedContent]);

  // Go to previous item
  const goPrev = useCallback(() => {
    const currentItem = mediaContent[currentIndex] || fallbackItem;
    const layoutConfig =
      layoutOptions.find((option) => option.id === (currentItem.layout || "single")) ||
      layoutOptions[0];
    const itemsPerPage = layoutConfig.cols * layoutConfig.rows;
    const prevIndex = Math.max(0, currentIndex - itemsPerPage);
    const grouped = groupedContent();

    setCurrentIndex(prevIndex);
    const prevItem = mediaContent[prevIndex] || fallbackItem;
    const prevLayout = prevItem.layout || "single";
    setCurrentLayout(prevLayout);
    updateVisibleItems(prevLayout, grouped, prevIndex);
    setShowControls(true);
  }, [mediaContent, currentIndex, groupedContent]);

  // Update visible items based on layout and index
  const updateVisibleItems = useCallback(
    (layout, groupedContent, index) => {
      const layoutConfig =
        layoutOptions.find((option) => option.id === layout) || layoutOptions[0];
      const itemsPerPage = layoutConfig.cols * layoutConfig.rows;
      const allItems =
        mediaContent.length > 0
          ? mediaContent.map((item, idx) => ({ ...item, originalIndex: idx }))
          : [fallbackItem];

      if (index >= allItems.length || index < 0) {
        setVisibleItems([fallbackItem]);
        return;
      }

      const currentItem = allItems[index] || fallbackItem;
      const currentLayout = currentItem.layout || "single";
      setCurrentLayout(currentLayout);

      const start = index;
      const end = Math.min(start + itemsPerPage, allItems.length);
      const itemsToDisplay = allItems.slice(start, end);
      setVisibleItems(itemsToDisplay.length > 0 ? itemsToDisplay : [fallbackItem]);
    },
    [mediaContent]
  );

  // Initialize visible items
  useEffect(() => {
    if (mediaContent.length > 0) {
      const grouped = groupedContent();
      const firstLayout = mediaContent[0].layout || "single";
      setCurrentLayout(firstLayout);
      updateVisibleItems(firstLayout, grouped, 0);
    } else {
      setVisibleItems([fallbackItem]);
    }
  }, [mediaContent, groupedContent, updateVisibleItems]);

  // Handle slideshow auto-advance
  useEffect(() => {
    if (mediaContent.length === 0 || !activeSlideshow || isPaused) {
      return;
    }

    const currentItemIndex = currentIndex % mediaContent.length;
    const currentItem = mediaContent[currentItemIndex] || fallbackItem;
    if (!currentItem || !Number.isFinite(currentItem.time) || currentItem.time <= 0) {
      return;
    }

    const currentLayout = currentItem.layout || "single";
    setCurrentLayout(currentLayout);
    const layoutConfig =
      layoutOptions.find((option) => option.id === currentLayout) || layoutOptions[0];
    const itemsPerPage = layoutConfig.cols * layoutConfig.rows;
    const delay = currentItem.time * 1000;
    const grouped = groupedContent();
    updateVisibleItems(currentLayout, grouped, currentIndex);

    const timer = setTimeout(() => {
      const nextIndex = currentIndex + itemsPerPage;
      if (nextIndex >= mediaContent.length) {
        setCurrentIndex(0);
        const firstLayout = mediaContent[0]?.layout || "single";
        setCurrentLayout(firstLayout);
        updateVisibleItems(firstLayout, grouped, 0);
      } else {
        setCurrentIndex(nextIndex);
        const nextItem = mediaContent[nextIndex] || fallbackItem;
        const nextLayout = nextItem.layout || "single";
        setCurrentLayout(nextLayout);
        updateVisibleItems(nextLayout, grouped, nextIndex);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [
    mediaContent,
    currentIndex,
    activeSlideshow,
    isPaused,
    groupedContent,
    updateVisibleItems,
  ]);

  // Start slideshow when media content changes
  useEffect(() => {
    if (mediaContent.length > 0) {
      setActiveSlideshow(true);
    } else {
      setActiveSlideshow(false);
    }
  }, [mediaContent]);

  // Fallback UI
  const renderFallbackUI = useCallback((message) => (
    <div className="w-full h-full bg-black flex flex-col items-center justify-center">
      <div className="grid grid-cols-1 w-full h-full gap-2 p-2">
        <div className="w-full h-full bg-gray-800 animate-pulse rounded"></div>
      </div>
      <p className="text-white text-2xl font-bold absolute">{}</p>
    </div>
  ), []);

  if (!mediaContent || mediaContent.length === 0) {
    return renderFallbackUI("Preview Not Availble");
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <div className={`grid ${getGridClasses()} w-full h-full gap-2 p-2`}>
        {visibleItems.map((item, index) => (
          <div
            key={index}
            className="relative w-full h-full bg-gray-900 rounded overflow-hidden"
          >
            <MediaItem
              content={item}
              index={currentIndex + index}
              isPaused={isPaused}
            />
          </div>
        ))}
      </div>

      <ClockDisplay />

      {customTicker && (
        <div className="absolute bottom-16 left-0 w-full overflow-hidden bg-black bg-opacity-70 py-3">
          <div className="news-ticker-container relative w-full">
            <div className="news-ticker">
              <span className="news-item inline-block px-6 text-white text-lg">
                {customTicker}
              </span>
            </div>
          </div>
        </div>
      )}

      {showControls &&
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

export default PreviewContent;