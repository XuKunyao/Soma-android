/**
 * Soma 设计系统 — 温暖、安静、克制的喝水提醒体验
 *
 * 设计原则：
 * - 温暖的奶油色调，禁止冷色调
 * - 大量留白，让内容"呼吸"
 * - 克制的动效，缓慢优雅
 * - 整体气质像一本安静的学者笔记本
 */

export const Theme = {
  colors: {
    /** 页面背景 — 温暖的奶油白，绝不使用纯白 */
    background: '#F5F0E8',
    /** 卡片/Surface 背景 — 比背景稍亮的暖白 */
    surface: '#FDFAF4',
    /** 柔和填充 — 用于输入框、分段控件和弱强调区域 */
    surfaceMuted: '#EFE9DF',
    /** 轻微暖色强调 — 用于选中态背景，避免大面积强橙 */
    primarySoft: '#F8EEE7',
    /** 轻微暖色边框 */
    primaryBorder: '#F0D8CC',
    /** 品牌主色 — 温暖的珊瑚橙 */
    primary: '#D97757',
    /** 品牌色按下态 — 稍深的珊瑚色 */
    primaryPressed: '#C4633E',
    /** 主文字色 — 温暖的近黑色 */
    text: '#1A1612',
    /** 次要文字色 — 温暖的中性灰 */
    textSecondary: '#6B6560',
    /** 分割线/边框 — 极淡的暖色线条 */
    border: '#E8E2D9',
    /** 达标成功色 — 柔和的苔绿色 */
    success: '#7A9A6D',
    /** 达标成功的浅背景 */
    successSoft: '#ECF1E8',
    /** 删除操作的浅背景 */
    dangerSoft: '#F7E7DD',
    /** 进度条背景轨道色 */
    trackBackground: '#EDE8DF',
    /** 暖色遮罩 */
    backdrop: 'rgba(26, 22, 18, 0.30)',
  },
  /** 圆角半径 */
  radius: {
    button: 14,
    card: 16,
    input: 12,
    full: 9999,
  },
  /** 动画参数 — 克制、缓慢 */
  animation: {
    duration: 350,
    easing: 'ease-in-out',
  },
  /** 字号层级 */
  type: {
    pageTitle: 28,
    sectionTitle: 17,
    body: 14,
    caption: 12,
    metric: 42,
  },
  /** 阴影层级 — 尽量轻，只用于真正的浮层或卡片 */
  shadow: {
    card: {
      color: '#1A1612',
      opacity: 0.05,
      radius: 3,
      offsetY: 1,
      elevation: 1,
    },
    floating: {
      color: '#1A1612',
      opacity: 0.08,
      radius: 18,
      offsetY: 12,
      elevation: 0,
    },
  },
  /** 间距系统 — 8px 基准 */
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  /** 字体配置 */
  fonts: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
  },
};

export const Colors = {
  light: {
    text: Theme.colors.text,
    background: Theme.colors.background,
    tint: Theme.colors.primary,
    icon: Theme.colors.textSecondary,
    tabIconDefault: Theme.colors.textSecondary,
    tabIconSelected: Theme.colors.primary,
  },
  dark: {
    text: Theme.colors.text,
    background: Theme.colors.background,
    tint: Theme.colors.primary,
    icon: Theme.colors.textSecondary,
    tabIconDefault: Theme.colors.textSecondary,
    tabIconSelected: Theme.colors.primary,
  },
};
