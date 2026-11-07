import { useMatches } from '@tanstack/react-router';

type StaticDataFlag = 'isFullScreen' | 'hasSplashBackground';

/*
 * 찾을 수 없는 주소에서는 이 값이 꺼져 있어야 한다.
 * `/closet/1/없는화면`처럼 주소 앞부분이 맞으면 해당 라우트의 매치가 남으므로 먼저 걸러야 한다.
 */
const useRouteStaticDataFlag = (flag: StaticDataFlag) =>
  useMatches({
    select: (matches) =>
      !matches.some(
        (match) => match._notFound === true || match.paramsError !== undefined,
      ) && matches.some((match) => match.staticData[flag] === true),
  });

export default useRouteStaticDataFlag;
