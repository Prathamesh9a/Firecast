import React, { useEffect, useState } from 'react';
import { FaClock, FaCalendarAlt } from 'react-icons/fa';
import { Calendar } from 'lucide-react';

const ScheduleDisplay = ({ 
  schedule, 
  countdownType, 
  timeRemaining, 
  isPriority = false 
}) => {
  const [formattedSchedule, setFormattedSchedule] = useState({});

  const formatTimeRemaining = (milliseconds) => {
    if (milliseconds <= 0) return "00:00:00";

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };
  
  useEffect(() => {
    if (schedule) {
      // Format the schedule for display
      formatScheduleForDisplay(schedule);
    }
  }, [schedule]);

  const formatScheduleForDisplay = (schedule) => {
    const formatted = {};
    
    // Format time range
    if (schedule.startTime) {
      const formattedStartTime = formatTime(schedule.startTime);
      formatted.timeRange = formattedStartTime;
      
      if (schedule.endTime) {
        const formattedEndTime = formatTime(schedule.endTime);
        formatted.timeRange += ` - ${formattedEndTime}`;
      }
    }
    
    // Format date range
    if (schedule.startDate) {
      const startDate = new Date(schedule.startDate);
      formatted.dateRange = formatDate(startDate);
      
      if (schedule.endDate) {
        const endDate = new Date(schedule.endDate);
        if (endDate.toDateString() !== startDate.toDateString()) {
          formatted.dateRange += ` - ${formatDate(endDate)}`;
        }
      }
    }
    
    // Format recurrence pattern
    formatted.recurrence = formatRecurrencePattern(schedule);
    
    // Format priority
    formatted.priority = schedule.priority || 'normal';
    
    setFormattedSchedule(formatted);
  };
  
  const formatTime = (timeString) => {
    if (!timeString) return '';
    
    // Convert 24-hour format to 12-hour format
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${displayHour}:${minutes} ${period}`;
  };
  
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const formatRecurrencePattern = (schedule) => {
    if (!schedule.frequency || schedule.frequency === 'once') {
      return 'One-time event';
    }
    
    let pattern = '';
    
    switch (schedule.frequency) {
      case 'daily':
        pattern = schedule.repeatInterval === '1' 
          ? 'Daily' 
          : `Every ${schedule.repeatInterval} days`;
        break;
        
      case 'weekly':
        if (schedule.weeklyDays && schedule.weeklyDays.length) {
          pattern = schedule.repeatInterval === '1'
            ? `Weekly on ${schedule.weeklyDays.join(', ')}`
            : `Every ${schedule.repeatInterval} weeks on ${schedule.weeklyDays.join(', ')}`;
        } else {
          pattern = schedule.repeatInterval === '1'
            ? 'Weekly'
            : `Every ${schedule.repeatInterval} weeks`;
        }
        break;
        
      case 'monthly':
        const rule = schedule.monthlyRule === 'day' ? 'by day of week' : 'by date';
        pattern = schedule.repeatInterval === '1'
          ? `Monthly ${rule}`
          : `Every ${schedule.repeatInterval} months ${rule}`;
        break;
        
      default:
        pattern = schedule.frequency;
    }
    
    if (schedule.repeatUntil) {
      const untilDate = new Date(schedule.repeatUntil);
      pattern += ` until ${formatDate(untilDate)}`;
    }
    
    return pattern;
  };
  
  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'urgent': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-300';
    }
  };

  // If no schedule is available
  if (!schedule) return null;
  
  // If this is a countdown display
  if (countdownType) {
    return (
      <div className="schedule-countdown bg-black bg-opacity-60 text-white p-3 rounded-lg backdrop-blur-md flex items-center gap-2">
        <FaClock size={20} className={countdownType === 'start' ? 'text-yellow-400' : 'text-red-400'} />
        <div>
          <p className="text-sm font-medium">
            {countdownType === 'start' ? 'Starts in:' : 'Ends in:'}
          </p>
          <p className="text-xl font-mono">{formatTimeRemaining(timeRemaining)}</p>
        </div>
      </div>
    );
  }
  
  // Regular schedule display
  return (
    <div className={`schedule-info ${isPriority ? 'animate-pulse' : ''} bg-black bg-opacity-60 backdrop-blur-md text-white p-3 rounded-lg flex items-center gap-3`}>
      <Calendar className="w-5 h-5 text-blue-400" />
      <div>
        {formattedSchedule.timeRange && (
          <p className="text-sm font-medium">{formattedSchedule.timeRange}</p>
        )}
        {formattedSchedule.dateRange && (
          <p className="text-xs text-gray-300">{formattedSchedule.dateRange}</p>
        )}
        {formattedSchedule.recurrence && formattedSchedule.recurrence !== 'One-time event' && (
          <p className="text-xs">{formattedSchedule.recurrence}</p>
        )}
        {formattedSchedule.priority && (
          <span className={`text-xs font-bold ${getPriorityColor(formattedSchedule.priority)}`}>
            {formattedSchedule.priority.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
};

export default ScheduleDisplay;