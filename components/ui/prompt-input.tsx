"use client"

import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

type PromptInputContextType = {
  isLoading: boolean
  value: string
  setValue: (value: string) => void
  maxHeight: number | string
  onSubmit?: () => void
  disabled?: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
  textareaRef: React.createRef<HTMLTextAreaElement>(),
})

function usePromptInput() {
  return useContext(PromptInputContext)
}

export type PromptInputProps = {
  isLoading?: boolean
  value?: string
  onValueChange?: (value: string) => void
  maxHeight?: number | string
  onSubmit?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
} & React.ComponentProps<"div">

function PromptInput({
  className,
  isLoading = false,
  maxHeight = 240,
  value,
  onValueChange,
  onSubmit,
  children,
  disabled = false,
  onClick,
  textareaRef: externalTextareaRef,
  ...props
}: PromptInputProps) {
  const [internalValue, setInternalValue] = useState(value || "")
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = externalTextareaRef || internalTextareaRef

  const handleChange = (newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
  }

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!disabled) textareaRef.current?.focus()
    onClick?.(e)
  }

  return (
    <TooltipProvider>
      <PromptInputContext.Provider
        value={{
          isLoading,
          value: value ?? internalValue,
          setValue: onValueChange ?? handleChange,
          maxHeight,
          onSubmit,
          disabled,
          textareaRef,
        }}
      >
        <div
          onClick={handleClick}
          className={cn(
            "bg-background cursor-text rounded-xl border p-2.5",
            "border-border/50 hover:border-border/70 focus-within:border-border/80",
            "shadow-[0_7px_12px_0_rgba(0,0,0,0.06)] focus-within:shadow-[0_10px_14px_0_rgba(0,0,0,0.12)]",
            "transition-[border-color,box-shadow] duration-300 ease-out",
            disabled && "cursor-not-allowed opacity-60",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </PromptInputContext.Provider>
    </TooltipProvider>
  )
}

export type PromptInputTextareaProps = {
  disableAutosize?: boolean
} & React.ComponentProps<typeof Textarea>

function PromptInputTextarea({
  className,
  onKeyDown,
  disableAutosize = false,
  ...props
}: PromptInputTextareaProps) {
  const { value, setValue, maxHeight, onSubmit, disabled, textareaRef } =
    usePromptInput()

  const adjustHeight = (el: HTMLTextAreaElement | null, isInitial = false) => {
    if (!el || disableAutosize) return

    const minHeight = 44
    
    if (isInitial) {
      el.style.overflowY = "hidden"
      el.style.height = `${minHeight}px`
      requestAnimationFrame(() => {
        if (el && textareaRef.current === el) {
          adjustHeight(el, false)
        }
      })
      return
    }
    
    el.style.overflowY = "hidden"
    el.style.height = "auto"
    const scrollHeight = el.scrollHeight
    const targetHeight = Math.max(scrollHeight, minHeight)
    
    if (typeof maxHeight === "number") {
      if (targetHeight > maxHeight) {
        el.style.height = `${maxHeight}px`
        el.style.overflowY = "auto"
      } else {
        el.style.height = `${targetHeight}px`
        el.style.overflowY = "hidden"
      }
    } else {
      el.style.height = `${targetHeight}px`
      if (targetHeight > 240) {
        el.style.overflowY = "auto"
      }
    }
  }

  const handleRef = (el: HTMLTextAreaElement | null) => {
    if (el) {
      textareaRef.current = el
      adjustHeight(el, true)
    }
  }

  useLayoutEffect(() => {
    if (!textareaRef.current || disableAutosize) return

    const el = textareaRef.current
    adjustHeight(el)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, maxHeight, disableAutosize])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight(e.target)
    setValue(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.()
    }
    onKeyDown?.(e)
  }

  return (
    <Textarea
      ref={handleRef}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={cn(
        "text-primary min-h-[44px] w-full resize-none border-none bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
        className
      )}
      rows={1}
      disabled={disabled}
      {...props}
    />
  )
}

export type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>

function PromptInputActions({
  children,
  className,
  ...props
}: PromptInputActionsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  )
}

export type PromptInputActionProps = {
  className?: string
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
} & React.ComponentProps<typeof Tooltip>

function PromptInputAction({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: PromptInputActionProps) {
  const { disabled } = usePromptInput()

  return (
    <Tooltip {...props}>
      <TooltipTrigger
        render={<span />}
        className="inline-flex"
        disabled={disabled}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
}
