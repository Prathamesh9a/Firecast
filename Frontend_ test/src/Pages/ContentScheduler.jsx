import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { BsCalendar, BsClock, BsPlus, BsTrash } from 'react-icons/bs';

const TimeWindowInput = ({ timeWindow, onChange, onRemove, showRemoveButton }) => {
  const parseTime = (timeString) => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const formatTime = (date) => {
    if (!date) return '';
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleTimeChange = (field, time) => {
    onChange({
      ...timeWindow,
      [field]: time ? formatTime(time) : ''
    });
  };

  return (
    <div className="p-3 bg-gray-50 rounded-lg relative mb-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Start Time</label>
          <div className="relative">
            <BsClock className="absolute top-3 left-3 text-gray-400" />
            <DatePicker
              selected={parseTime(timeWindow.startTime)}
              onChange={(time) => handleTimeChange('startTime', time)}
              showTimeSelect
              showTimeSelectOnly
              timeIntervals={1}
              timeCaption="Time"
              dateFormat="h:mm aa"
              className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">End Time</label>
          <div className="relative">
            <BsClock className="absolute top-3 left-3 text-gray-400" />
            <DatePicker
              selected={parseTime(timeWindow.endTime)}
              onChange={(time) => handleTimeChange('endTime', time)}
              showTimeSelect
              showTimeSelectOnly
              timeIntervals={1}
              timeCaption="Time"
              dateFormat="h:mm aa"
              className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      {showRemoveButton && (
        <button 
          type="button" 
          onClick={onRemove} 
          className="absolute -right-2 -top-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
          title="Remove time window"
        >
          <BsTrash size={14} />
        </button>
      )}
    </div>
  );
};

const ContentScheduler = ({ schedule, onChange, index }) => {
  const parseDate = (dateString) => (dateString ? new Date(dateString) : null);

  const updateSchedule = (field, value) => {
    onChange(index, field, value);
  };

  const handleFrequencyChange = (e) => {
    const frequency = e.target.value;
    const updates = { frequency };
    if (frequency === 'none') {
      updates.weeklyDays = [];
      updates.monthlyRule = '';
      updates.repeatInterval = 1;
      updates.repeatUntil = '';
    }
    Object.entries(updates).forEach(([field, value]) => updateSchedule(field, value));
  };

  const handleWeeklyDayToggle = (day) => {
    const currentDays = [...schedule.weeklyDays];
    const dayIndex = currentDays.indexOf(day);
    if (dayIndex > -1) {
      currentDays.splice(dayIndex, 1);
    } else {
      currentDays.push(day);
    }
    updateSchedule('weeklyDays', currentDays);
  };

  // Handle time windows
  const handleTimeWindowChange = (updatedTimeWindow, timeWindowIndex) => {
    const newTimeWindows = [...(schedule.timeWindows || [{ startTime: '', endTime: '' }])];
    newTimeWindows[timeWindowIndex] = updatedTimeWindow;
    updateSchedule('timeWindows', newTimeWindows);
  };

  const addTimeWindow = () => {
    const currentTimeWindows = [...(schedule.timeWindows || [{ startTime: '', endTime: '' }])];
    currentTimeWindows.push({ startTime: '', endTime: '' });
    updateSchedule('timeWindows', currentTimeWindows);
  };

  const removeTimeWindow = (timeWindowIndex) => {
    const currentTimeWindows = [...(schedule.timeWindows || [{ startTime: '', endTime: '' }])];
    currentTimeWindows.splice(timeWindowIndex, 1);
    updateSchedule('timeWindows', currentTimeWindows);
  };

  // Ensure timeWindows exists with at least one entry
  const timeWindows = schedule.timeWindows || [{ startTime: schedule.startTime || '', endTime: schedule.endTime || '' }];

  return (
    <div className="bg-white p-4 rounded-xl border shadow-sm mt-4">
      <h3 className="text-lg font-medium text-gray-700 mb-4">Content Scheduling</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Time Windows */}
        <div className="md:col-span-2">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium text-gray-600">Time Windows</h4>
            <button
              type="button"
              onClick={addTimeWindow}
              className="flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <BsPlus size={20} className="mr-1" /> Add Time Window
            </button>
          </div>
          
          <div className="space-y-2">
            {timeWindows.map((timeWindow, idx) => (
              <TimeWindowInput
                key={idx}
                timeWindow={timeWindow}
                onChange={(updatedWindow) => handleTimeWindowChange(updatedWindow, idx)}
                onRemove={() => removeTimeWindow(idx)}
                showRemoveButton={timeWindows.length > 1}
              />
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Date Range</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <div className="relative">
                <BsCalendar className="absolute top-3 left-3 text-gray-400" />
                <DatePicker
                  selected={parseDate(schedule.startDate)}
                  onChange={(date) => updateSchedule('startDate', date ? date.toISOString().split('T')[0] : '')}
                  dateFormat="yyyy-MM-dd"
                  className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholderText="Select date"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <div className="relative">
                <BsCalendar className="absolute top-3 left-3 text-gray-400" />
                <DatePicker
                  selected={parseDate(schedule.endDate)}
                  onChange={(date) => updateSchedule('endDate', date ? date.toISOString().split('T')[0] : '')}
                  minDate={parseDate(schedule.startDate)}
                  dateFormat="yyyy-MM-dd"
                  className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholderText="Select date"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recurrence */}
        <div className="p-3 bg-gray-50 rounded-lg md:col-span-2">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Recurrence</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Frequency</label>
              <select
                value={schedule.frequency}
                onChange={handleFrequencyChange}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">No Repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            {schedule.frequency !== 'none' && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Repeat Every</label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min="1"
                      value={schedule.repeatInterval}
                      onChange={(e) => updateSchedule('repeatInterval', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-gray-600">
                      {schedule.frequency === 'daily' ? 'Day(s)' : schedule.frequency === 'weekly' ? 'Week(s)' : 'Month(s)'}
                    </span>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">End Recurrence</label>
                  <div className="relative">
                    <BsCalendar className="absolute top-3 left-3 text-gray-400" />
                    <DatePicker
                      selected={parseDate(schedule.repeatUntil)}
                      onChange={(date) => updateSchedule('repeatUntil', date ? date.toISOString().split('T')[0] : '')}
                      minDate={parseDate(schedule.startDate) || new Date()}
                      dateFormat="yyyy-MM-dd"
                      className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholderText="Never (optional)"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          {schedule.frequency === 'weekly' && (
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-2">Repeat On</label>
              <div className="flex gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleWeeklyDayToggle(day)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                      schedule.weeklyDays?.includes(day)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {day.charAt(0)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {schedule.frequency === 'monthly' && (
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-2">Monthly Options</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="dayOfMonth"
                    checked={schedule.monthlyRule === 'dayOfMonth' || !schedule.monthlyRule}
                    onChange={() => updateSchedule('monthlyRule', 'dayOfMonth')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Same day each month</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="dayOfWeek"
                    checked={schedule.monthlyRule === 'dayOfWeek'}
                    onChange={() => updateSchedule('monthlyRule', 'dayOfWeek')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Same day of the week each month</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Display Mode */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Display Options</h4>
          <label className="block text-xs text-gray-500 mb-1">Display Mode</label>
          <select
            value={schedule.displayMode}
            onChange={(e) => updateSchedule('displayMode', e.target.value)}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="exclusive">Exclusive (only show this content)</option>
            <option value="mixed">Mixed (can show with other content)</option>
          </select>
        </div>

        {/* Priority */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Priority</h4>
          <label className="block text-xs text-gray-500 mb-1">Content Priority</label>
          <select
            value={schedule.priority}
            onChange={(e) => updateSchedule('priority', e.target.value)}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="high">High (takes precedence)</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default ContentScheduler;