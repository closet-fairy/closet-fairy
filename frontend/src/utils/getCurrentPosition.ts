export const getCurrentPosition = (options?: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('이 브라우저에서는 위치를 확인할 수 없습니다.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
