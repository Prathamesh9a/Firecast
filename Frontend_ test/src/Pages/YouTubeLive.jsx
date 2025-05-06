import React, { useState, useEffect, useRef } from "react";

const YouTubeLive = ({ liveUrl, isPaused = false, inView = true, showControls = false }) => {
  const [embedUrl, setEmbedUrl] = useState(null);
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    // Function to extract YouTube video ID from various URL formats
    const getYouTubeVideoId = (url) => {
      // Handle standard watch URLs
      const watchRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|watch\?v=|&v=)([^#&?]*).*/;
      const watchMatch = url.match(watchRegExp);
      if (watchMatch && watchMatch[2].length === 11) {
        return watchMatch[2];
      }

      // Handle live URLs
      const liveRegExp = /^.*(youtube.com\/live\/|youtube.com\/channel\/[^\/]+\/live)([^#&?]*).*/;
      const liveMatch = url.match(liveRegExp);
      if (liveMatch && liveMatch[2]) {
        return liveMatch[2];
      }

      // Handle embed URLs
      const embedRegExp = /^.*(youtube.com\/embed\/)([^#&?]*).*/;
      const embedMatch = url.match(embedRegExp);
      if (embedMatch && embedMatch[2]) {
        return embedMatch[2];
      }

      return null;
    };

    try {
      const videoId = getYouTubeVideoId(liveUrl);

      if (!videoId) {
        setError(`Could not extract video ID from: ${liveUrl}`);
        console.error(`Invalid YouTube URL: ${liveUrl}`);
        return;
      }

      // Create embed URL with autoplay and controls settings
      const autoplay = !isPaused ? 1 : 0;
      const controls = showControls ? 1 : 0;
      setEmbedUrl(
        `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay}&mute=0&rel=0&loop=1&controls=${controls}&playlist=${videoId}`
      );
      console.log(`Set embed URL for ${liveUrl}: autoplay=${autoplay}, controls=${controls}`);
    } catch (err) {
      console.error("Error processing YouTube URL:", err);
      setError(`Error processing YouTube URL: ${err.message}`);
    }
  }, [liveUrl, isPaused, showControls]);

  // Add effect to handle play/pause state changes
  useEffect(() => {
    if (iframeRef.current && embedUrl) {
      const iframe = iframeRef.current;
      
      // To force a reload with new autoplay setting when isPaused changes
      const currentSrc = iframe.src;
      const shouldPlay = !isPaused;
      const newSrc = shouldPlay ? 
        currentSrc.replace(/autoplay=0/, 'autoplay=1') : 
        currentSrc.replace(/autoplay=1/, 'autoplay=0');
      
      if (newSrc !== currentSrc) {
        console.log(`Updating YouTube iframe: isPaused=${isPaused}`);
        iframe.src = newSrc;
      }
    }
  }, [isPaused, embedUrl]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <p className="text-white text-center p-4">{error}</p>
      </div>
    );
  }

  if (!embedUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div className="aspect-video w-full h-full mx-auto">
        <iframe
          ref={iframeRef}
          src={embedUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute top-0 left-0 w-full h-full"
          frameBorder="0"
          onLoad={() => console.log(`Loaded YouTube iframe: ${liveUrl}`)}
        />
      </div>
    </div>
  );
};

export default YouTubeLive;