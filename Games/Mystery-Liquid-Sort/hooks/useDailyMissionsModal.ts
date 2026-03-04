import { useState } from 'react';

type UseDailyMissionsModalResult = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setIsOpen: (value: boolean) => void;
};

export const useDailyMissionsModal = (): UseDailyMissionsModalResult => {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return {
    isOpen,
    open,
    close,
    setIsOpen,
  };
};
