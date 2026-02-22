import { useTheme } from './theme-provider'
import { Sun, Moon, Monitor } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const cycle = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }
  return (
    <button
      onClick={cycle}
      className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      title={`Theme: ${theme}`}
    >
      {theme === 'light' && <Sun className="h-5 w-5" />}
      {theme === 'dark' && <Moon className="h-5 w-5" />}
      {theme === 'system' && <Monitor className="h-5 w-5" />}
    </button>
  )
}
