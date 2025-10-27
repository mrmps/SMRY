import { useEffect, useState } from "react";

const useLocalStorage = <T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] => {
  const [storedValue, setStoredValue] = useState(initialValue);

  useEffect(() => {
    // Use a timeout to avoid setting state synchronously
    const timer = setTimeout(() => {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [key]);

  const setValue = (value: T) => {
    // Save state
    setStoredValue(value);
    // Save to localStorage
    window.localStorage.setItem(key, JSON.stringify(value));
  };
  return [storedValue, setValue];
};

export default useLocalStorage;