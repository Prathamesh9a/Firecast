import React from "react";

const WebpageEmbed = ({ webpageUrl }) => {
  const embedUrl = webpageUrl;

  if (!embedUrl) return <p className="text-white">Invalid webpage URL</p>;

  return (
    <div className="w-full h-full flex justify-center items-center">
      <iframe
        src={embedUrl}
        title="Webpage Embed"
        className="w-screen h-screen"
        frameBorder="0"
        allowFullScreen
      />
    </div>
  );
};

export default WebpageEmbed;