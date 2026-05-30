import {ColorScheme, Palette, lightColors, getPalette} from './palettes';

/**
 * 运行时调色板 —— 一个可变对象。
 *
 * 业务代码 `import {colors}` 拿到的始终是同一个对象引用。
 * App 仅保留浅色模式，这里直接初始化为浅色调色板。
 * `applyScheme` 保留为兼容旧调用签名的 no-op（始终应用浅色）。
 */
export const colors: Palette = {...lightColors};

const currentScheme: ColorScheme = 'light';

export function applyScheme(_scheme: ColorScheme = 'light') {
  Object.assign(colors, getPalette('light'));
}

export function getColorScheme(): ColorScheme {
  return currentScheme;
}
