import { useEffect, useState } from "react";

// Custom event for local storage updates
const STORAGE_EVENT_NAME = 'local-storage-update';

interface StorageEventDetail<T> {
  key: string;
  value: T;
}

const useLocalStorage = <T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] => {
  const [storedValue, setStoredValue] = useState(initialValue);

  // Read initial value from localStorage
  useEffect(() => {
    // Use a timeout to avoid setting state synchronously
    const timer = setTimeout(() => {
      try {
        const item = window.localStorage.getItem(key);
        if (item) {
          setStoredValue(JSON.parse(item));
        }
      } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [key]);

  // Listen for changes from other components/tabs
  useEffect(() => {
    const handleStorageChange = (event: Event) => {
      const customEvent = event as CustomEvent<StorageEventDetail<T>>;
      if (customEvent.detail.key === key) {
        setStoredValue(customEvent.detail.value);
      }
    };

    // Listen to custom events (same window)
    window.addEventListener(STORAGE_EVENT_NAME, handleStorageChange);
    
    // Listen to storage events (other tabs)
    const handleNativeStorage = (event: StorageEvent) => {
      if (event.key === key && event.newValue) {
        setStoredValue(JSON.parse(event.newValue));
      }
    };
    window.addEventListener('storage', handleNativeStorage);

    return () => {
      window.removeEventListener(STORAGE_EVENT_NAME, handleStorageChange);
      window.removeEventListener('storage', handleNativeStorage);
    };
  }, [key]);

  const setValue = (value: T) => {
    try {
      // Save state
      setStoredValue(value);
      // Save to localStorage
      window.localStorage.setItem(key, JSON.stringify(value));
      
      // Dispatch custom event for same-window updates
      const event = new CustomEvent<StorageEventDetail<T>>(STORAGE_EVENT_NAME, {
        detail: { key, value }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };
  return [storedValue, setValue];
};

export default useLocalStorage;