import { configureStore } from '@reduxjs/toolkit';
import mediaReducer from './mediaSlice';

const store = configureStore({
  reducer: {
    media: mediaReducer,
  },
});

export default store;
