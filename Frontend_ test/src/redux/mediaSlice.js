import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  mediaItems: [],
};

const mediaSlice = createSlice({
  name: 'media',
  initialState,
  reducers: {
    setMediaItems: (state, action) => {
      state.mediaItems = action.payload;
    },
    addMediaItem: (state, action) => {
      state.mediaItems.push(action.payload);
    },
    clearMediaItems: (state) => {
      state.mediaItems = [];
    },
  },
});

export const { setMediaItems, addMediaItem, clearMediaItems } = mediaSlice.actions;

export default mediaSlice.reducer;
