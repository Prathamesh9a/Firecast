import React from "react";

const YouTubeLive = ({ liveUrl }) => {
  const getYouTubeEmbedUrl = (url) => {
    // Handle both regular YouTube URLs and live URLs
    const regExp = /^.*(youtu.be\/|live\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    
    // Extract video ID
    const videoId = match && match[2].length === 11 ? match[2] : null;
    
    if (!videoId) return null;
    
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
  };

  const embedUrl = getYouTubeEmbedUrl(liveUrl);

  if (!embedUrl) {
    console.error("Invalid YouTube URL:", liveUrl);
    return <p className="text-white">Invalid YouTube Live URL: {liveUrl}</p>;
  }

  return (
    <div className="w-full h-full flex justify-center items-center">
      <iframe
        src={embedUrl}
        allow="autoplay; encrypted-media"
        allowFullScreen
        className="w-screen h-screen"
        frameBorder="0"
      />
    </div>
  );
};

export default YouTubeLive;