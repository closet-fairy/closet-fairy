export interface ClothesFrame {
  opacity: number;
  scale: number;
}

export interface WandFrame {
  left: number;
  top: number;
  angle: number;
}

export interface DotFrame {
  x: number;
  y: number;
  opacity: number;
  scale: number;
}

export interface ClothesWandFrame {
  // CLOTHES_NAMES와 같은 순서이다.
  clothes: ClothesFrame[];
  wand: WandFrame;
  // 점이 퍼지는 구간이 아니면 null이다.
  dots: DotFrame[] | null;
}
