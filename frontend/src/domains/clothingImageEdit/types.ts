export type Point = readonly [number, number];

// 좌상·우상·우하·좌하 순서다. BE의 perspective_param.corners와 같다.
export type Quad = readonly [Point, Point, Point, Point];

// 행 우선 3×3 행렬이다. WebGL에 넘길 때는 열 우선으로 바꿔야 한다.
export type Matrix3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface Size {
  width: number;
  height: number;
}
