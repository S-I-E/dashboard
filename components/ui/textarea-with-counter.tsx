import * as React from "react"
import { Textarea } from "./textarea"
import { cn } from "@/lib/utils"

interface Props extends React.ComponentProps<typeof Textarea> {
  minLength?: number
  maxLength?: number
  showRemaining?: boolean // if true shows remaining instead of used
}

export function TextareaWithCounter({ minLength, maxLength, showRemaining = false, className, value, defaultValue, onChange, ...props }: Props) {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState<string>(() => {
    if (isControlled) return (value as string) || ""
    if (typeof defaultValue === "string") return defaultValue
    return ""
  })

  React.useEffect(() => {
    if (isControlled) setInternalValue((value as string) || "")
  }, [value, isControlled])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isControlled) setInternalValue(e.target.value)
    if (onChange) onChange(e)
  }

  const length = internalValue.length
  const id = props.id ?? `textarea-counter-${Math.random().toString(36).slice(2, 9)}`
  const describedBy = `${id}-counter`

  // Status colors for the counter badge
  const isOver = maxLength !== undefined && length > maxLength
  const isNear = maxLength !== undefined && length >= maxLength * 0.9 && !isOver
  const isUnder = minLength !== undefined && length > 0 && length < minLength

  const colorClass = isOver || isUnder
    ? "text-destructive bg-destructive/10 border-destructive/20 shadow-xs"
    : isNear
    ? "text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400 shadow-xs"
    : "text-muted-foreground bg-muted/40 border-transparent shadow-none"

  return (
    <div className="relative w-full group">
      <Textarea
        id={id}
        value={isControlled ? value : internalValue}
        defaultValue={defaultValue as any}
        onChange={handleChange}
        minLength={minLength}
        maxLength={maxLength}
        aria-describedby={describedBy}
        className={cn("pb-10 min-h-[120px] transition-all", className)}
        {...props}
      />

      <div 
        id={describedBy}
        className={cn(
          "absolute right-3 bottom-3 text-[10px] sm:text-[11px] font-medium leading-none px-2 py-1 rounded-[6px] border transition-all duration-300 pointer-events-none backdrop-blur-md flex items-center justify-center opacity-80 group-focus-within:opacity-100",
          colorClass
        )}
      >
        {maxLength ? (
          showRemaining ? (
            <span>{Math.max(0, maxLength - length)} caracteres restantes</span>
          ) : (
            <span>{length} <span className="opacity-50">/</span> {maxLength}</span>
          )
        ) : minLength ? (
          <span>{length} {length === 1 ? 'caractere' : 'caracteres'} <span className="opacity-50">(mín. {minLength})</span></span>
        ) : (
          <span>{length} {length === 1 ? 'caractere' : 'caracteres'}</span>
        )}
      </div>
    </div>
  )
}

export default TextareaWithCounter
