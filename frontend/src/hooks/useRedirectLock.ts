import { useEffect, useState } from 'react';

const useRedirectLock = () => {
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIsRedirecting(false);
      }
    };

    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const redirect = (url: string) => {
    setIsRedirecting(true);
    window.location.assign(url);
  };

  return { isRedirecting, redirect };
};

export default useRedirectLock;
