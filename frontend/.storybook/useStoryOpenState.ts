import { useState } from 'react';

interface StoryOpenStateArgs {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const useStoryOpenState = (args: StoryOpenStateArgs) => {
  const [isOpen, setIsOpen] = useState(args.isOpen);
  const [prevArgsIsOpen, setPrevArgsIsOpen] = useState(args.isOpen);

  if (args.isOpen !== prevArgsIsOpen) {
    setPrevArgsIsOpen(args.isOpen);
    setIsOpen(args.isOpen);
  }

  const handleOpenChange = (nextIsOpen: boolean) => {
    args.onOpenChange(nextIsOpen);
    setIsOpen(nextIsOpen);
  };

  return { isOpen, setIsOpen, handleOpenChange };
};

export default useStoryOpenState;
