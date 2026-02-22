"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { cn } from "@/lib/utils"

const Toaster = ({
  position = "top-center",
  duration = 4200,
  closeButton = true,
  richColors = false,
  visibleToasts = 4,
  toastOptions,
  ...props
}: ToasterProps) => {
  const { theme = "system" } = useTheme()

  const mergedToastOptions: ToasterProps["toastOptions"] = {
    ...toastOptions,
    className: cn("morphy-sonner-toast", toastOptions?.className),
    classNames: {
      title: "morphy-sonner-title",
      description: "morphy-sonner-description",
      actionButton: "morphy-sonner-action",
      cancelButton: "morphy-sonner-cancel",
      closeButton: "morphy-sonner-close",
      ...toastOptions?.classNames,
    },
  }

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={position}
      duration={duration}
      closeButton={closeButton}
      richColors={richColors}
      visibleToasts={visibleToasts}
      offset={{ top: 72, right: 16, left: 16, bottom: 16 }}
      mobileOffset={{ top: 84, right: 12, left: 12, bottom: 12 }}
      className="toaster group"
      toastOptions={mergedToastOptions}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
