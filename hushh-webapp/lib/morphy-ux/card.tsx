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
import {
  getVariantStyles,
  getVariantStylesNoHover,
} from "@/lib/morphy-ux/utils";
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
    const variantStyles = showRipple
      ? getVariantStyles(variant, effect)
      : getVariantStylesNoHover(variant, effect);

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
          "relative rounded-lg border border-solid text-card-foreground p-4 sm:p-6 transition-[border-color,box-shadow,background-color] duration-200",
          "shadow-[0_1px_3px_0_rgb(0_0_0_/_0.3),_0_1px_2px_-1px_rgb(0_0_0_/_0.2)]",
          preset === "hero" &&
            "p-0 rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.10)]",
          variant === "muted"
            ? "bg-white/60 dark:bg-background/40 border-border/30"
            : effect === "glass"
            ? ""
            : "bg-white/80 dark:bg-gray-900/40",
          effect === "fade" ? "!backdrop-blur-none" : "backdrop-blur-[6px]",
          variantStyles,
          showRipple ? "overflow-hidden" : "",
          showRipple
            ? "!border-transparent hover:!border-[var(--morphy-primary-start)]"
            : variant === "muted"
            ? ""
            : "!border-transparent",
          interactive ? "cursor-pointer" : "",
          fullHeight ? "h-full" : "",
          selected ? "border-[var(--morphy-primary-start)]" : "",
          className
        )}
        {...props}
      >
        {effect === "glass" && glassAccent !== "none" ? (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0",
              glassAccent === "soft"
                ? "bg-[radial-gradient(95%_75%_at_15%_82%,var(--morphy-glass-accent-a)_0%,transparent_70%),radial-gradient(88%_70%_at_84%_16%,var(--morphy-glass-accent-b)_0%,transparent_68%)] opacity-70"
                : "bg-[radial-gradient(95%_75%_at_15%_82%,var(--morphy-glass-accent-a)_0%,transparent_66%),radial-gradient(88%_70%_at_84%_16%,var(--morphy-glass-accent-b)_0%,transparent_64%)] opacity-95"
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

        {showRipple ? <MaterialRipple variant={variant} effect={effect} /> : null}
      </Comp>
    );
  }
);

Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof StockCardHeader>
>(({ className, ...props }, ref) => (
  <StockCardHeader ref={ref} className={cn("px-0 space-y-4 pb-2", className)} {...props} />
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
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
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
