// src/Pages/MediaItem.jsx
import React from 'react';
import DocumentContent from './DocumentContent'; // Fix this import

const MediaItem = ({ content, layout, time, isEnabled }) => {
  return (
    <div className={`media-item ${layout}`} style={{ display: isEnabled ? 'block' : 'none' }}>
      {content.endsWith('.pdf') ? (
        <DocumentContent content={content} />
      ) : (
        <iframe src={content} title="Media Content" width="100%" height="400px" />
      )}
      <p>Duration: {time}s</p>
    </div>
  );
};

export default MediaItem;