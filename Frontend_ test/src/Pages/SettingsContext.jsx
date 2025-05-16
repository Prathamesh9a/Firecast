import { createContext, useContext, useState } from "react";
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
    position: "bottom-left",
    visible: true,
  },
};

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSettings);
  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
