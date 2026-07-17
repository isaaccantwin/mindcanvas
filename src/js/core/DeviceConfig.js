/**
 * DeviceConfig — 裝置感知的尺寸/排版設定
 * 讓心智圖在桌面、平板、手機上各有適合的節點大小與間距
 */
export class DeviceConfig {
  constructor() {
    this.type = 'desktop';
    this._update();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this._update());
    }
  }

  _update() {
    const w = window.innerWidth;
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (w < 768) this.type = 'mobile';
    else if (w < 1024 && touch) this.type = 'tablet';
    else this.type = 'desktop';
  }

  get nodeWidth() {
    return { desktop: 120, tablet: 150, mobile: 160 }[this.type];
  }

  get nodeHeight() {
    return { desktop: 40, tablet: 50, mobile: 55 }[this.type];
  }

  get fontSize() {
    return { desktop: 14, tablet: 16, mobile: 14 }[this.type];
  }

  get hGap() {
    return { desktop: 160, tablet: 180, mobile: 140 }[this.type];
  }

  get vGap() {
    return { desktop: 50, tablet: 65, mobile: 55 }[this.type];
  }

  get touchPadding() {
    return { desktop: 0, tablet: 8, mobile: 12 }[this.type];
  }
}
