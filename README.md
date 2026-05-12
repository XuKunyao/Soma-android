# Soma

![Expo SDK](https://img.shields.io/badge/Expo-SDK%2054-8B7CF6?style=flat-square&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Android](https://img.shields.io/badge/Android-Preview-3DDC84?style=flat-square&logo=android&logoColor=white)
![Status](https://img.shields.io/badge/Status-MVP-D97757?style=flat-square)

Soma 是一款温暖、安静、克制的喝水提醒应用。它不把饮水管理做成焦虑的打卡任务，而是用柔和的进度、轻量的记录和本地提醒，帮助用户在日常节奏里照顾自己。

当前版本聚焦 Android 预览体验，已支持今日进度、快速记录、历史统计、个性化目标估算、杯量设置和本地通知提醒。

## Product Direction

Soma 的设计目标是成为一个低刺激的日常工具：

- 温暖浅色主题，避免纯白、冷灰、霓虹色和强科技感。
- 首页只强调一件事：今天喝了多少水。
- 数据展示保持轻量，帮助回顾节律，而不是制造压力。
- 设置体验尽量清楚、安静，不把健康参数做成复杂表单。
- 动效保持克制，按钮和弹窗只提供轻柔反馈。

## Core Features

- **今日进度**：用柔和圆形进度展示当前饮水量和每日目标。
- **快速记录**：点击“喝了一杯”记录当前杯量，默认 250ml。
- **记录撤销**：今日记录支持左滑删除，对应总量会同步更新。
- **历史统计**：按日、周、月、年查看饮水汇总、趋势和目标差值。
- **目标估算**：根据体重、性别参考、活动量和饮食习惯估算每日喝水目标。
- **自定义设置**：支持每日目标、提醒间隔、预设杯量和自定义杯量。
- **本地提醒**：使用 Expo Notifications 调度喝水提醒。
- **本地存储**：饮水记录和设置保存在设备本地。

## Design System

视觉方向是温暖、轻量、留白充足，整体气质接近一本安静的生活笔记。

核心色彩位于 [`constants/theme.ts`](constants/theme.ts)：

| Token | Value | Usage |
| --- | --- | --- |
| Background | `#F5F0E8` | 页面背景 |
| Surface | `#FDFAF4` | 卡片和浮层 |
| Primary | `#D97757` | 主按钮、关键进度 |
| Text | `#1A1612` | 主文字 |
| Secondary Text | `#6B6560` | 辅助说明 |
| Border | `#E8E2D9` | 细边框和分割线 |

## Hydration Estimate

Soma 估算的是 App 中用于记录和提醒的“建议喝水目标”，不是包含食物水分在内的全天总水摄入。它只适合作为健康成年人的日常参考，不替代医生或营养师建议。

当前算法：

```text
基础喝水量 = 未指定 1600ml / 女性 1500ml / 男性 1700ml
参考体重 = 未指定 60kg / 女性 55kg / 男性 65kg
体重修正 = (当前体重 - 参考体重) × 14
饮食修正 = 清淡多蔬果 -100ml / 均衡日常 0ml / 偏咸外卖多 +200ml
活动补充 = 久坐办公 0ml / 轻度活动 200ml / 中度活动 400ml / 高强度 700ml
最终目标 = clamp(round(基础喝水量 + 体重修正 + 饮食修正 + 活动补充, 50ml), 1200ml, 3000ml)
```

算法参考《中国居民膳食指南（2022）》的日常喝水建议，并区分“喝水目标”和包含食物水分的“总水摄入”。肾脏、心脏疾病、孕期、哺乳期、特殊用药或医嘱限制饮水的人群，应按专业医疗建议调整。

## Tech Stack

- [Expo](https://expo.dev/)：开发、运行和预览 React Native 应用。
- [React Native](https://reactnative.dev/)：移动端界面框架。
- [Expo Router](https://docs.expo.dev/router/introduction/)：文件路由和 Tab 导航。
- [TypeScript](https://www.typescriptlang.org/)：类型检查。
- [AsyncStorage](https://react-native-async-storage.github.io/async-storage/)：本地记录和设置存储。
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)：本地通知提醒。
- [React Native SVG](https://github.com/software-mansion/react-native-svg)：圆形进度绘制。
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)：轻量交互动效。

## Run Locally

安装依赖：

```bash
npm install
```

启动 Expo：

```bash
npm.cmd run start
```

打开 Android 模拟器：

```bash
npm.cmd run android
```

如果需要清理 Metro 缓存：

```bash
npx.cmd expo start -c --android
```

> Expo Go 适合预览界面和基础交互。通知、启动页和应用图标等原生能力，需要 development build 或 APK 才能完整验证。

## Project Structure

```text
app/
  _layout.tsx              # 应用入口：字体、通知、全局状态
  (tabs)/
    _layout.tsx            # 底部 Tab 导航
    index.tsx              # 首页：进度、按钮、今日记录
    history.tsx            # 记录页：历史汇总和趋势
    settings.tsx           # 设置页：目标估算、杯量、提醒间隔
components/
  GreetingHeader.tsx       # 时间问候
  WaterProgress.tsx        # 圆形饮水进度
  WaterLogItem.tsx         # 单条饮水记录
constants/
  theme.ts                 # 色彩、字号、阴影和间距
contexts/
  WaterContext.tsx         # 全局饮水状态
utils/
  notifications.ts         # 本地提醒
  storage.ts               # 本地存储
```

## Roadmap

- [x] 今日饮水进度
- [x] 快速添加和删除饮水记录
- [x] 设置每日目标、杯量和提醒间隔
- [x] 个性化喝水目标估算
- [x] 本地通知提醒
- [x] 日、周、月、年历史统计
- [x] 温暖浅色视觉系统
- [ ] 自定义提醒时间段
- [ ] APK / development build 验证
- [ ] 应用图标和启动页继续打磨
