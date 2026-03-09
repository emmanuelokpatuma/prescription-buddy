import { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

const MedicationContext = createContext(null);

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const MedicationProvider = ({ children }) => {
  const [medications, setMedications] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMedications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/medications`);
      setMedications(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch medications:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchedule = useCallback(async (date = null) => {
    const targetDate = date || format(new Date(), 'yyyy-MM-dd');
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/schedule/${targetDate}`);
      setSchedule(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/stats`);
      setStats(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      throw error;
    }
  }, []);

  const fetchHistory = useCallback(async (limit = 50) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/medications/history?limit=${limit}`);
      setHistory(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch history:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const createMedication = async (medicationData) => {
    try {
      const response = await axios.post(`${API_URL}/medications`, medicationData);
      await fetchMedications();
      return response.data;
    } catch (error) {
      console.error('Failed to create medication:', error);
      throw error;
    }
  };

  const updateMedication = async (medicationId, medicationData) => {
    try {
      const response = await axios.put(`${API_URL}/medications/${medicationId}`, medicationData);
      await fetchMedications();
      return response.data;
    } catch (error) {
      console.error('Failed to update medication:', error);
      throw error;
    }
  };

  const deleteMedication = async (medicationId) => {
    try {
      await axios.delete(`${API_URL}/medications/${medicationId}`);
      await fetchMedications();
    } catch (error) {
      console.error('Failed to delete medication:', error);
      throw error;
    }
  };

  const logMedication = async (medicationId, scheduledTime, status, notes = '') => {
    try {
      const response = await axios.post(`${API_URL}/medications/log`, {
        medication_id: medicationId,
        scheduled_time: scheduledTime,
        status,
        notes
      });
      
      // Refresh schedule and stats
      await Promise.all([
        fetchSchedule(),
        fetchStats()
      ]);
      
      return response.data;
    } catch (error) {
      console.error('Failed to log medication:', error);
      throw error;
    }
  };

  // Voice reminder using browser's speechSynthesis
  const speakReminder = useCallback((medicationName, dosage) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        `It is time to take ${dosage} of ${medicationName}`
      );
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const value = {
    medications,
    schedule,
    stats,
    history,
    loading,
    fetchMedications,
    fetchSchedule,
    fetchStats,
    fetchHistory,
    createMedication,
    updateMedication,
    deleteMedication,
    logMedication,
    speakReminder
  };

  return (
    <MedicationContext.Provider value={value}>
      {children}
    </MedicationContext.Provider>
  );
};

export const useMedication = () => {
  const context = useContext(MedicationContext);
  if (!context) {
    throw new Error('useMedication must be used within a MedicationProvider');
  }
  return context;
};
