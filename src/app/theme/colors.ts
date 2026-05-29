import {ColorScheme, Palette, darkColors, getPalette} from './palettes';

/**
 * 运行时调色板 —— 一个可变对象。
 *
 * 业务代码 `import {colors}` 拿到的始终是同一个对象引用。
 * App 启动期 (Bootstrap) 先调 `applyScheme(savedScheme)` 把这个对象的字段
 * 填成对应的调色板，再动态 import AppNavigator —— 那时所有屏幕的
 * StyleSheet.create 才被求值，会读到正确的颜色。
 */
export const colors: Palette = {...darkColors};

let currentScheme: ColorScheme = 'dark';

export function applyScheme(scheme: ColorScheme) {
  currentScheme = scheme;
  Object.assign(colors, getPalette(scheme));
}

export function getColorScheme(): ColorScheme {
  return currentScheme;
}
