"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { type IconWeight } from "@phosphor-icons/react";

import {
  Card as StockCard,
  CardContent as StockCardContent,
  CardDescription as StockCardDescription,
  CardFooter as StockCardFooter,
  CardHeader as StockCardHeader,
  CardTitle as StockCardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type MorphyCardBaseProps } from "@/lib/morphy-ux/types";
import { MaterialRipple } from "@/lib/morphy-ux/material-ripple";

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    MorphyCardBaseProps {
  asChild?: boolean;
  icon?: {
    icon: React.ComponentType<{ className?: string; weight?: IconWeight }>;
    title?: string;
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    gradient?: boolean;
  };
}

type IconPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const CARD_PRESET_SHELL_CLASSES: Record<
  NonNullable<CardProps["preset"]>,
  { shell: string; spacing: string }
> = {
  compact: {
    shell:
      "!rounded-[20px] !border-transparent !bg-[var(--app-card-surface-compact)] !shadow-[var(--app-card-shadow-standard)]",
    spacing: "p-0",
  },
  default: {
    shell:
      "!rounded-[22px] !border-transparent !bg-[var(--app-card-surface-default)] !shadow-[var(--app-card-shadow-standard)]",
    spacing: "p-4 sm:p-6",
  },
  hero: {
    shell:
      "!rounded-[28px] !border-transparent !bg-[var(--app-card-surface-hero)] !shadow-[var(--app-card-shadow-feature)]",
    spacing: "p-0",
  },
  surface: {
    shell:
      "!rounded-[24px] !border-transparent !bg-[var(--app-card-surface-surface)] !shadow-[var(--app-card-shadow-standard)]",
    spacing: "min-w-0 p-0",
  },
  "surface-feature": {
    shell:
      "!rounded-[24px] !border-transparent !bg-[var(--app-card-surface-hero)] !shadow-[var(--app-card-shadow-feature)]",
    spacing: "min-w-0 p-0",
  },
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = "none",
      effect = "glass",
      preset = "default",
      asChild = false,
      showRipple = false,
      icon,
      interactive,
      selected,
      fullHeight,
      glassAccent = "none",
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : StockCard;
    const presetConfig = CARD_PRESET_SHELL_CLASSES[preset];

    const IconComponent = icon?.icon;
    const iconPosition = icon?.position || "top-left";

    const iconAlignClasses: Record<IconPosition, string> = {
      "top-left": "justify-start mb-4",
      "top-right": "justify-end mb-4 flex-row-reverse",
      "bottom-left": "justify-start mt-4",
      "bottom-right": "justify-end mt-4 flex-row-reverse",
    };

    const getIconBoxStyle = (isGradient: boolean) => {
      if (isGradient) {
        return "bg-gradient-to-r from-[var(--morphy-primary-start)] to-[var(--morphy-primary-end)] border-transparent";
      }
      return "bg-transparent border-transparent";
    };

    const getIconColor = (isGradient: boolean) => {
      if (isGradient) {
        return "text-white dark:text-black";
      }
      return "text-[var(--morphy-primary-start)]";
    };

    const renderIconBlock = () => {
      if (!IconComponent) return null;

      const gradient = Boolean(icon?.gradient);
      return (
        <div className={cn("flex items-center gap-3 w-full", iconAlignClasses[iconPosition])}>
          <div
            className={cn(
              "h-10 w-10 rounded-lg border flex items-center justify-center transition-colors duration-200",
              getIconBoxStyle(gradient)
            )}
          >
            <IconComponent
              className={cn("h-5 w-5 transition-colors duration-200", getIconColor(gradient))}
              weight="regular"
            />
          </div>
          {icon?.title ? (
            <span className="text-sm font-semibold group-hover:underline group-hover:underline-offset-4">
              {icon.title}
            </span>
          ) : null}
        </div>
      );
    };

    return (
      <Comp
        ref={ref}
        className={cn(
          "relative !overflow-visible border border-solid border-transparent transition-[border-color,box-shadow,background-color] duration-200",
          presetConfig.shell,
          "!text-card-foreground",
          effect === "fade"
            ? "!backdrop-blur-none"
            : "backdrop-blur-[18px] backdrop-saturate-[145%]",
          presetConfig.spacing,
          interactive ? "cursor-pointer" : "",
          fullHeight ? "h-full" : "",
          selected ? "ring-1 ring-sky-500/25 dark:ring-sky-400/30" : "",
          className
        )}
        {...props}
      >
        {effect === "glass" ? (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0",
              glassAccent === "none" &&
                "bg-[linear-gradient(180deg,rgba(255,255,255,0.56)_0%,rgba(255,255,255,0.2)_16%,rgba(255,255,255,0.04)_34%,transparent_52%),linear-gradient(180deg,rgba(148,163,184,0.06)_0%,transparent_68%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_14%,transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.2)_0%,transparent_70%)]",
              glassAccent === "soft" &&
                "bg-[linear-gradient(180deg,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.24)_16%,rgba(255,255,255,0.06)_34%,transparent_54%),linear-gradient(180deg,rgba(191,219,254,0.08)_0%,transparent_70%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.04)_14%,transparent_32%),linear-gradient(180deg,rgba(30,41,59,0.24)_0%,transparent_74%)]",
              glassAccent === "balanced" &&
                "bg-[linear-gradient(180deg,rgba(255,255,255,0.66)_0%,rgba(255,255,255,0.26)_16%,rgba(255,255,255,0.07)_36%,transparent_56%),radial-gradient(88%_56%_at_18%_0%,rgba(191,219,254,0.12)_0%,transparent_58%),linear-gradient(180deg,rgba(148,163,184,0.08)_0%,transparent_72%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.05)_14%,transparent_34%),radial-gradient(88%_56%_at_18%_0%,rgba(96,165,250,0.06)_0%,transparent_58%),linear-gradient(180deg,rgba(15,23,42,0.26)_0%,transparent_74%)]"
            )}
            style={{ borderRadius: "inherit" }}
          />
        ) : null}

        <div className="relative z-[1]">
          {IconComponent &&
          (iconPosition === "top-left" || iconPosition === "top-right")
            ? renderIconBlock()
            : null}
          {children}
          {IconComponent &&
          (iconPosition === "bottom-left" || iconPosition === "bottom-right")
            ? renderIconBlock()
            : null}
        </div>

        {showRipple ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{ borderRadius: "inherit" }}
          >
            <MaterialRipple variant={variant} effect={effect} />
          </div>
        ) : null}
      </Comp>
    );
  }
);

Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof StockCardHeader>
>(({ className, ...props }, ref) => (
  <StockCardHeader ref={ref} className={cn("px-0 space-y-4 pb-2.5", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof StockCardTitle>
>(({ className, ...props }, ref) => (
  <StockCardTitle
    ref={ref}
    className={cn("text-xl leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof StockCardDescription>
>(({ className, ...props }, ref) => (
  <StockCardDescription
    ref={ref}
    className={cn("text-sm leading-6 text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof StockCardContent>
>(({ className, ...props }, ref) => (
  <StockCardContent ref={ref} className={cn("px-0 space-y-4", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof StockCardFooter>
>(({ className, ...props }, ref) => (
  <StockCardFooter
    ref={ref}
    className={cn("px-0 pt-4 border-t border-border", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
