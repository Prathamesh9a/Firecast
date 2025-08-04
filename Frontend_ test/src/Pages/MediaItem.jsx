// // src/Pages/MediaItem.jsx
// import React from 'react';
// import DocumentContent from './DocumentContent'; // Fix this import

// const MediaItem = ({ content, layout, time, isEnabled }) => {
//   return (
//     <div className={`media-item ${layout}`} style={{ display: isEnabled ? 'block' : 'none' }}>
//       {content.endsWith('.pdf') ? (
//         <DocumentContent content={content} />
//       ) : (
//         <iframe src={content} title="Media Content" width="100%" height="400px" />
//       )}
//       <p>Duration: {time}s</p>
//     </div>
//   );
// };

// export default MediaItem;




import React, { useRef, useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import DocumentContent from './DocumentContent';
import { FaVolumeMute, FaVolumeUp } from 'react-icons/fa';

const videoExtensions = [
  { ext: ".mp4", type: "video/mp4" },
  { ext: ".mov", type: "video/quicktime" },
  { ext: ".webm", type: "video/webm" }
];

const isPowerBIUrl = (url) => url && url.includes("powerbi.com");
const isYouTubeUrl = (url) => url && (url.includes("youtube.com") || url.includes("youtu.be"));

const MediaItem = ({ content, isPaused, getContentUrl, index, videoRefs }) => {
  const { ref, inView } = useInView({ triggerOnce: true });
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  // Handle video playback
  useEffect(() => {
    if (!inView || !content?.content) return;

    const isVideo = videoExtensions.some(video => 
      content.content.toLowerCase().endsWith(video.ext)
    );

    if (isVideo && videoRef.current) {
      const video = videoRef.current;
      video.muted = isMuted;

      const handleCanPlay = () => {
        setError(null);
        if (!isPaused) {
          video.play().catch(err => {
            console.error("Video playback error:", err);
            setError({
              message: "Video playback failed",
              details: err.message
            });
          });
        }
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', (e) => {
        setError({
          message: "Video failed to load",
          details: e.target.error?.message
        });
      });

      video.load();

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.pause();
      };
    }
  }, [inView, content, isPaused, isMuted]);

  // Handle background music
  useEffect(() => {
    if (!inView || !content?.backgroundMusic) return;

    const audioSrc = getContentUrl(content.backgroundMusic);
    if (!audioSrc || !audioRef.current) return;

    const audio = audioRef.current;
    audio.src = audioSrc;
    audio.loop = true;
    audio.muted = false;
    audio.volume = 0.5;

    const handleCanPlay = () => {
      if (!isPaused) {
        audio.play().catch(err => {
          console.error("Audio playback error:", err);
          // Fallback to muted playback if needed
          audio.muted = true;
          audio.play().catch(err => {
            setError({
              message: "Background music failed",
              details: err.message
            });
          });
        });
      }
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', (e) => {
      setError({
        message: "Audio failed to load",
        details: e.target.error?.message
      });
    });

    audio.load();

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.pause();
    };
  }, [inView, content, isPaused, getContentUrl]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setIsMuted(audioRef.current.muted);
    }
  };

  if (!content || !content.content) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        No content available
      </div>
    );
  }

  const contentUrl = getContentUrl(content.content);

  if (isPowerBIUrl(content.content)) {
    return (
      <iframe
        src={contentUrl}
        className="w-full h-full"
        title="Power BI Report"
        frameBorder="0"
        allowFullScreen
      />
    );
  } else if (isYouTubeUrl(content.content)) {
    return (
      <iframe
        src={contentUrl}
        className="w-full h-full"
        title="YouTube Video"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  } else if (videoExtensions.some(video => 
    content.content.toLowerCase().endsWith(video.ext))
  ) {
    return (
      <div ref={ref} className="w-full h-full relative">
        {inView ? (
          <>
            <video
              ref={videoRef}
              autoPlay={!isPaused}
              muted={isMuted}
              className="w-full h-full object-contain"
              loop
            >
              <source src={contentUrl} type={
                content.content.endsWith('.mp4') ? 'video/mp4' :
                content.content.endsWith('.mov') ? 'video/quicktime' :
                'video/webm'
              } />
            </video>
            <button
              onClick={toggleMute}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-full"
            >
              {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
            </button>
          </>
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
        {content.backgroundMusic && <audio ref={audioRef} />}
      </div>
    );
  } else if (content.content.endsWith('.pdf')) {
    return <DocumentContent content={content} isPaused={isPaused} />;
  } else {
    return (
      <div ref={ref} className="w-full h-full relative">
        {inView ? (
          <>
            <img
              src={contentUrl}
              alt="Media content"
              className="w-full h-full object-contain"
              onLoad={() => setIsLoading(false)}
              onError={() => setError("Failed to load image")}
            />
            {content.backgroundMusic && <audio ref={audioRef} />}
          </>
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
      </div>
    );
  }
};

export default MediaItem;