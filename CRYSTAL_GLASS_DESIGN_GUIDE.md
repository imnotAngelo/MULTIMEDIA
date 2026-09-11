# Crystal Glass Design & Theme System
## Updated 2026-09-07

A modern, glassmorphism-based UI design with full light/dark mode support and improved typography.

---

## ✨ What's New

### 1. **Crystal Glass (Glassmorphism) Design**
- Frosted glass effect with blur and transparency
- Layered depth with shadows and gradients
- Smooth transitions between states
- Enhanced visual hierarchy

### 2. **Day/Night Mode Support**
- **Dark Mode** (default): Deep blues and purples with cyan accents
- **Light Mode**: Clean whites and blues for daytime viewing
- **Auto-save**: Theme preference persists across sessions
- **Smooth Transitions**: 300-400ms transitions when switching themes

### 3. **Improved Font Colors**
- Dark Mode: `text-sky-100` (bright, readable)
- Light Mode: `text-slate-900` (high contrast)
- Better accessibility with WCAG AA compliant colors
- Semantic color hierarchy for different text roles

---

## 🎨 Design System

### Color Palette

**Dark Mode**
- Background: `#0d0b17` (very dark purple-blue)
- Foreground: `#e0f2fe` (light cyan-blue)
- Primary: Cyan (`#67e8f9`)
- Accent: Orange (`#f97416`)
- Borders: Blue-tinted gray

**Light Mode**
- Background: `#ffffff` (white)
- Foreground: `#1e293b` (dark slate)
- Primary: Blue (`#3b82f6`)
- Accent: Indigo (`#4f46e5`)
- Borders: Light gray

### Typography

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif
```

### Glassmorphism Effects

```css
/* Base glass effect */
backdrop-filter: blur(20px);
background: linear-gradient(135deg, rgba(13, 43, 53, 0.66), rgba(5, 17, 26, 0.78));
border: 1px solid rgba(103, 232, 249, 0.22);
box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.14),
            0 18px 60px rgba(2, 10, 18, 0.42),
            0 0 24px rgba(34, 211, 238, 0.08);
```

---

## 🎮 How to Use Theme Toggle

### For Users
1. Look for the **sun/moon icon** in the top-right corner of the header
2. Click to toggle between light mode ☀️ and dark mode 🌙
3. Your preference is saved automatically

### For Developers

#### Access Theme Store
```typescript
import { useThemeStore } from '@/stores/themeStore';

function MyComponent() {
  const { theme, setTheme, toggleTheme } = useThemeStore();
  
  return (
    <>
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme}>Toggle</button>
      <button onClick={() => setTheme('light')}>Light</button>
    </>
  );
}
```

#### Check Theme in Components
```typescript
import { useThemeStore } from '@/stores/themeStore';

function ThemedComponent() {
  const theme = useThemeStore(state => state.theme);
  
  return (
    <div className={theme === 'dark' ? 'dark-styles' : 'light-styles'}>
      Content adapts to theme
    </div>
  );
}
```

#### Apply Theme Programmatically
```typescript
const { setTheme } = useThemeStore();

// Set to dark mode
setTheme('dark');

// Set to light mode
setTheme('light');

// Toggle
useThemeStore.getState().toggleTheme();
```

---

## 🎨 Applying Glass Effects

### CSS Classes

```html
<!-- Basic glass card -->
<div class="glass-card">Content</div>

<!-- Glass button -->
<button class="glass-button">Click me</button>

<!-- Glass input -->
<input class="glass-input" placeholder="Type..." />

<!-- Glass panel -->
<div class="glass-panel p-6">Panel content</div>
```

### Tailwind Classes

```html
<!-- Manual glass effect -->
<div class="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl p-6">
  Glassmorphic content
</div>

<!-- With hover effect -->
<div class="glass transition-all duration-300 hover:border-cyan-400/50">
  Hoverable glass
</div>
```

---

## 📁 Files Changed

### New Files
- `/app/src/stores/themeStore.ts` - Theme state management
- `/app/src/components/ThemeToggle.tsx` - Theme toggle button component
- `/CRYSTAL_GLASS_DESIGN_GUIDE.md` - This file

### Modified Files
- `/app/src/App.tsx` - Added theme initialization
- `/app/src/App.css` - Added glassmorphism animations
- `/app/src/index.css` - Added light/dark mode colors and glass effects
- `/app/tailwind.config.js` - Added glass utilities and animations
- `/app/src/components/layout/Header.tsx` - Added ThemeToggle button

---

## 🔄 Light/Dark Mode Colors

### Root CSS Variables

**Dark Mode** (`:root`)
```css
--background: 252 32% 7%;         /* Very dark blue */
--foreground: 210 40% 96%;        /* Light cyan */
--primary: 164 73% 55%;           /* Bright cyan */
--accent: 28 92% 63%;             /* Warm orange */
--border: 220 25% 35%;            /* Slate blue */
```

**Light Mode** (`html.light`)
```css
--background: 0 0% 100%;          /* White */
--foreground: 224 71% 4%;         /* Dark slate */
--primary: 220 90% 56%;           /* Bright blue */
--accent: 262 80% 50%;            /* Purple */
--border: 220 13% 91%;            /* Light gray */
```

### Overriding Colors

```css
html.light .custom-element {
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  border-color: hsl(var(--border));
}
```

---

## 🎬 Animations

### Available Animations

```css
animation-name            | duration | purpose
--------------------------|----------|---------------------------
particle-drift           | 34s      | Background particle movement
nebula-sweep             | 18s      | Nebula background sweep
grid-breathe             | 9s       | Grid overlay breathing
sidebar-item-in          | 520ms    | Sidebar items entrance
sidebar-subitem-in       | 360ms    | Sidebar subitems entrance
sidebar-profile-in       | 650ms    | Profile card entrance
sidebar-drawer-in        | 320ms    | Mobile drawer entrance
sidebar-backdrop-in      | 240ms    | Backdrop fade-in
```

### Using Animations

```css
.my-element {
  animation: particle-drift 34s linear infinite;
}
```

---

## ✅ Browser Support

- ✅ Chrome 95+
- ✅ Firefox 90+
- ✅ Safari 15+
- ✅ Edge 95+
- ⚠️ Requires CSS backdrop-filter support

---

## 🚀 Performance Tips

1. **Use `backdrop-blur` sparingly** - Can impact performance
2. **Hardware acceleration** - Use `transform: translateZ(0)` for GPU acceleration
3. **Will-change** - Apply to animated elements:
   ```css
   .animated {
     will-change: transform, opacity;
   }
   ```

---

## 🎯 Accessibility

- ✅ All colors meet WCAG AA standards
- ✅ Focus indicators visible in both modes
- ✅ Theme preference respects `prefers-color-scheme`
- ✅ Font sizes scale properly
- ✅ Sufficient contrast ratios

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 🐛 Troubleshooting

### Theme not persisting
- Check browser localStorage: `localStorage.getItem('theme-store')`
- Clear and reload page

### Colors not updating
- Verify `html` element has `class="light"` or `class="dark"`
- Check Tailwind `darkMode: ["class"]` in config

### Glass effect not showing
- Requires `backdrop-filter: blur()` support
- Check browser version (Chrome 95+, Firefox 88+)
- Fallback to solid background if not supported

### Performance issues
- Reduce number of glass layers on screen
- Use `backdrop-blur-md` instead of `backdrop-blur-xl`
- Check GPU usage with DevTools

---

## 📚 Resources

- [Glassmorphism Design](https://hype4.academy/articles/design/glassmorphism)
- [Tailwind Backdrop Blur](https://tailwindcss.com/docs/backdrop-blur)
- [CSS Backdrop Filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)
- [Web Accessibility](https://www.w3.org/WAI/fundamentals/)

---

## 🎨 Customization

### Changing Primary Color (Dark Mode)

In `index.css`:
```css
:root {
  --primary: 220 90% 56%;  /* Change to your color */
}
```

### Changing Background Gradient (Light Mode)

In `index.css`:
```css
html.light body {
  background: linear-gradient(145deg, #f8fafc 0%, #e0e7ff 48%, #f3e8ff 100%);
}
```

### Adjusting Glass Blur

In Tailwind:
```css
class="backdrop-blur-md"   /* Less blur */
class="backdrop-blur-xl"   /* More blur */
class="backdrop-blur-3xl"  /* Maximum blur */
```

---

## 📝 Usage Examples

### Toggle Theme Button

```tsx
import { ThemeToggle } from '@/components/ThemeToggle';

export function Header() {
  return (
    <header>
      <ThemeToggle />
    </header>
  );
}
```

### Themed Card Component

```tsx
export function Card() {
  return (
    <div className="glass-card">
      <h3 className="text-xl font-semibold">Crystal Glass Card</h3>
      <p className="text-sm text-muted-foreground">
        This card adapts to light and dark modes
      </p>
    </div>
  );
}
```

### Conditional Styling

```tsx
import { useThemeStore } from '@/stores/themeStore';

export function ThemedBanner() {
  const theme = useThemeStore(state => state.theme);
  
  return (
    <div className={theme === 'dark' ? 'bg-slate-950' : 'bg-sky-50'}>
      Content
    </div>
  );
}
```

---

## 📊 Design Tokens

```typescript
interface DesignTokens {
  colors: {
    primary: string;     // Main brand color
    accent: string;      // Secondary accent
    background: string;  // Page background
    foreground: string;  // Text color
    border: string;      // Border color
    muted: string;       // Muted elements
  };
  blur: {
    sm: 'blur(4px)';
    md: 'blur(12px)';
    lg: 'blur(20px)';
    xl: 'blur(40px)';
  };
  shadows: {
    sm: 'box-shadow: 0 1px 2px rgba(...)';
    md: 'box-shadow: 0 4px 6px rgba(...)';
    lg: 'box-shadow: 0 10px 15px rgba(...)';
  };
}
```

---

**Version**: 1.0  
**Last Updated**: 2026-09-07  
**Theme**: Crystal Glass Design

