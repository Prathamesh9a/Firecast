import React, { useState, useEffect } from "react";
import Header from "./Header";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import { useSettings } from "./SettingsContext";


// Default settings remain unchanged
const defaultSettings = {
  ticker: {
    speed: 500,
    height: 50,
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

// const { settings, setSettings } = useSettings();

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

const Settings = ({ onApplySettings }) => {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [urls, setUrls] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState("");
  const [urlCount, setUrlCount] = useState(0);

  const token = localStorage.getItem("token");

  // Fetch existing URLs (unchanged)
  useEffect(() => {
    const fetchExistingUrls = async () => {
      let userId;
      if (token) {
        const decodedToken = jwtDecode(token);
        userId = decodedToken.userId;
      }
      try {
        const res = await axios.post(
          `${apiBaseUrl}/api/upload/existingUrl/`,
          { userId },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: token,
            },
          }
        );
        setUrls(res.data);
        setUrlCount(res.data.length);
      } catch (error) {
        const message = error.response?.data?.message || "Failed to fetch URLs.";
        Swal.fire({
          title: "Error!",
          text: message,
          icon: "error",
          confirmButtonText: "OK",
        });
      }
    };

    fetchExistingUrls();
  }, [token]);

  // Fetch settings for selected URL (unchanged)
  useEffect(() => {
    const fetchSettings = async () => {
      if (!selectedUrl) {
        setSettings(defaultSettings);
        return;
      }

      try {
        setLoading(true);
        const response = await axios.get(`${apiBaseUrl}/api/upload/getSettings/${selectedUrl}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setSettings(response.data.settings || defaultSettings);
      } catch (err) {
        console.error("Error fetching settings:", err.response || err);
        setError(`Failed to load settings for URL (ID: ${selectedUrl}). Using default settings.`);
        setSettings(defaultSettings);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [selectedUrl, token]);

  const handleChange = (section, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedUrl) {
      Swal.fire({
        title: "Error!",
        text: "Please select a URL to apply settings to.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    try {
      await axios.post(
        `${apiBaseUrl}/api/upload/saveSettings`,
        { id: selectedUrl, settings },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (onApplySettings) {
        onApplySettings(settings);
      }
      Swal.fire({
        title: "Success!",
        text: "Settings saved successfully!",
        icon: "success",
        confirmButtonText: "OK",
      });
    } catch (err) {
      console.error("Error saving settings:", err.response || err);
      setError("Failed to save settings.");
      Swal.fire({
        title: "Error!",
        text: "Failed to save settings.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    Swal.fire({
      title: "Reset",
      text: "Settings have been reset to default.",
      icon: "info",
      confirmButtonText: "OK",
    });
  };



  return (
    <>
       <div className="fixed top-0 left-0 right-0 z-50">
    <Header />
  </div>

  <div className="pt-20 min-h-screen bg-gray-100 flex justify-center items-start py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
   <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 transition-all duration-300">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Customize Display Settings
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              {error}
            </div>
          )}

          {/* URL Selection */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Select Content URL</h3>
            {urls.length === 0 ? (
              <p className="text-gray-500 italic">No URLs found. Please upload content first.</p>
            ) : (
              <select
                value={selectedUrl}
                onChange={(e) => setSelectedUrl(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                aria-label="Select a URL"
              >
                <option value="">Choose a URL</option>
                {urls.map((url) => (
                  <option key={url.id} value={url.id}>
                    {url.url}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Ticker Settings */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              Ticker Settings
              <span
                className="ml-2 text-gray-400 cursor-help relative group"
                title="Configure the scrolling text display"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span className="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2">
                  Configure the scrolling text display
                </span>
              </span>
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Speed (milliseconds)
                </label>
                <input
                  type="range"
                  min="100"
                  max="600"
                  value={settings.ticker.speed}
                  onChange={(e) => handleChange("ticker", "speed", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50"
                  disabled={urls.length === 0}
                  aria-label="Ticker speed"
                />
                <span className="text-sm text-gray-500">{settings.ticker.speed}ms</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Height (pixels)
                </label>
                <input
                  type="range"
                  min="50"
                  max="80"
                  value={settings.ticker.height}
                  onChange={(e) => handleChange("ticker", "height", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50"
                  disabled={urls.length === 0}
                  aria-label="Ticker height"
                />
                <span className="text-sm text-gray-500">{settings.ticker.height}px</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Font Size (pixels)
                </label>
                <input
                  type="range"
                  min="14"
                  max="26"
                  value={settings.ticker.fontSize}
                  onChange={(e) => handleChange("ticker", "fontSize", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50"
                  disabled={urls.length === 0}
                  aria-label="Ticker font size"
                />
                <span className="text-sm text-gray-500">{settings.ticker.fontSize}px</span>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.ticker.visible}
                  onChange={(e) => handleChange("ticker", "visible", e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  disabled={urls.length === 0}
                  aria-label="Show ticker"
                />
                <label className="ml-2 text-sm text-gray-600">Show Ticker</label>
              </div>
            </div>
          </div>

          {/* Date & Time Settings */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              Date & Time Settings
              <span
                className="ml-2 text-gray-400 cursor-help relative group"
                title="Set the position and visibility of the date and time"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span className="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2">
                  Set the position and visibility of the date and time
                </span>
              </span>
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <select
                  value={settings.dateTime.position}
                  onChange={(e) => handleChange("dateTime", "position", e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                  disabled={urls.length === 0}
                  aria-label="Date and time position"
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.dateTime.visible}
                  onChange={(e) => handleChange("dateTime", "visible", e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  disabled={urls.length === 0}
                  aria-label="Show date and time"
                />
                <label className="ml-2 text-sm text-gray-600">Show Date & Time</label>
              </div>
            </div>
          </div>

          {/* Temperature & AQI Settings */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              Temperature & AQI Settings
              <span
                className="ml-2 text-gray-400 cursor-help relative group"
                title="Set the position and visibility of temperature and air quality index"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span className="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2">
                  Set the position and visibility of temperature and air quality index
                </span>
              </span>
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <select
                  value={settings.temperature.position}
                  onChange={(e) => handleChange("temperature", "position", e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                  disabled={urls.length === 0}
                  aria-label="Temperature and AQI position"
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.temperature.visible}
                  onChange={(e) => handleChange("temperature", "visible", e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  disabled={urls.length === 0}
                  aria-label="Show temperature and AQI"
                />
                <label className="ml-2 text-sm text-gray-600">Show Temperature & AQI</label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={urls.length === 0}
            >
              Save Settings
            </button>
            <button
              onClick={handleReset}
              className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-all duration-200"
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;