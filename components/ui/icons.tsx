"use client";

/**
 * Hugeicons wrapper - centralized icon exports for the app
 * Migration from Lucide to Hugeicons
 *
 * Usage:
 * import { ChevronLeft, X, Copy } from "@/components/ui/icons";
 * <ChevronLeft className="size-5" />
 */

import { HugeiconsIcon } from "@hugeicons/react";
import {
  // Navigation arrows
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpRight01Icon,
  ArrowUpDownIcon,
  ArrowTurnBackwardIcon,

  // UI Controls
  Cancel01Icon,
  CancelCircleIcon,
  Tick01Icon,
  CheckmarkCircle01Icon,
  CheckmarkCircle02Icon,
  Add01Icon,
  MinusSignIcon,
  MoreHorizontalIcon,
  MoreVerticalIcon,
  Menu01Icon,

  // Actions
  Copy01Icon,
  Delete01Icon,
  Delete02Icon,
  Edit01Icon,
  RotateLeftIcon,
  RotateRightIcon,
  ArrowReloadHorizontalIcon,
  Search01Icon,
  SentIcon,
  Link01Icon,
  Link02Icon,
  Download01Icon,
  Upload01Icon,
  Share01Icon,
  Share02Icon,
  Share04Icon,
  UploadSquare01Icon,

  // Media/Content
  BookOpenIcon,
  BookBookmark01Icon,
  File01Icon,
  News01Icon,
  Note01Icon,
  HighlighterIcon,
  CodeIcon,

  // Communication
  Chat01Icon,
  BubbleChatIcon,

  // Status/Feedback
  Loading01Icon,
  Alert01Icon,
  InformationCircleIcon,
  FlashIcon,
  StarIcon,
  CrownIcon,
  Bug01Icon,
  Chart01Icon,

  // Theme
  Sun01Icon,
  Moon01Icon,
  Moon02Icon,
  ComputerIcon,

  // User/Account
  UserIcon,
  Login01Icon,
  Logout01Icon,
  Settings05Icon,

  // Device
  SmartPhone01Icon,
  GlobeIcon,

  // Layout
  PanelLeftOpenIcon,
  PanelLeftCloseIcon,
  SidebarLeftIcon,
  Drag01Icon,
  GridIcon,
  LayoutGridIcon,
  Menu11Icon,
  Calendar01Icon,
  CommandIcon,

  // Payment
  CreditCardIcon,

  // Social
  TwitterIcon,
  LinkedinIcon,

  // Misc
  Archive01Icon,
  Bookmark01Icon,
  Pin02Icon,
  ClockIcon,
  SquareIcon,
  CommandLineIcon,

  // Additional icons for full compatibility
  CheckListIcon,
  LanguageSkillIcon,
  AlertCircleIcon,
  Loading03Icon,

  // AI/Brand icons
  ChatGptIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { FC } from "react";

// Common icon props interface
export interface IconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean | "true" | "false";
  role?: string;
}

// Helper to create consistent icon components
function createIcon(IconComponent: typeof ArrowLeft01Icon, displayName: string): FC<IconProps> {
  const Icon: FC<IconProps> = ({ className, size, strokeWidth = 1.5, color = "currentColor" }) => {
    // Extract size from className if provided (e.g., "size-5" -> 20px)
    let computedSize = size;
    if (!computedSize && className) {
      const sizeMatch = className.match(/size-(\d+(?:\.\d+)?)/);
      if (sizeMatch) {
        computedSize = parseFloat(sizeMatch[1]) * 4; // Tailwind size-5 = 20px (5 * 4)
      }
    }

    return (
      <HugeiconsIcon
        icon={IconComponent}
        size={computedSize || 24}
        strokeWidth={strokeWidth}
        color={color}
        className={cn(className)}
      />
    );
  };
  Icon.displayName = displayName;
  return Icon;
}

// Navigation Icons (Lucide -> Hugeicons mapping)
export const ChevronLeft = createIcon(ArrowLeft01Icon, "ChevronLeft");
export const ChevronRight = createIcon(ArrowRight01Icon, "ChevronRight");
export const ChevronDown = createIcon(ArrowDown01Icon, "ChevronDown");
export const ChevronUp = createIcon(ArrowUp01Icon, "ChevronUp");
export const ChevronsUpDown = createIcon(ArrowUpDownIcon, "ChevronsUpDown");
export const ArrowLeft = createIcon(ArrowLeft01Icon, "ArrowLeft");
export const ArrowRight = createIcon(ArrowRight01Icon, "ArrowRight");
export const ArrowDown = createIcon(ArrowDown01Icon, "ArrowDown");
export const ArrowUp = createIcon(ArrowUp01Icon, "ArrowUp");
export const ArrowUpRight = createIcon(ArrowUpRight01Icon, "ArrowUpRight");

// UI Control Icons
export const X = createIcon(Cancel01Icon, "X");
export const XIcon = createIcon(Cancel01Icon, "XIcon");
export const Check = createIcon(Tick01Icon, "Check");
export const CheckIcon = createIcon(Tick01Icon, "CheckIcon");
export const CheckCircle = createIcon(CheckmarkCircle01Icon, "CheckCircle");
export const CheckCircle2 = createIcon(CheckmarkCircle02Icon, "CheckCircle2");
export const Plus = createIcon(Add01Icon, "Plus");
export const PlusIcon = createIcon(Add01Icon, "PlusIcon");
export const Minus = createIcon(MinusSignIcon, "Minus");
export const MinusIcon = createIcon(MinusSignIcon, "MinusIcon");
export const MoreHorizontal = createIcon(MoreHorizontalIcon, "MoreHorizontal");
export const MoreVertical = createIcon(MoreVerticalIcon, "MoreVertical");
export const Menu = createIcon(Menu01Icon, "Menu");
export const ChevronRightIcon = createIcon(ArrowRight01Icon, "ChevronRightIcon");
export const ChevronDownIcon = createIcon(ArrowDown01Icon, "ChevronDownIcon");
export const ChevronLeftIcon = createIcon(ArrowLeft01Icon, "ChevronLeftIcon");
export const ChevronUpIcon = createIcon(ArrowUp01Icon, "ChevronUpIcon");
export const ChevronsUpDownIcon = createIcon(ArrowUpDownIcon, "ChevronsUpDownIcon");
export { MoreHorizontal as MoreHorizontalIcon };

// Action Icons
export const Copy = createIcon(Copy01Icon, "Copy");
export const Trash = createIcon(Delete01Icon, "Trash");
export const Trash2 = createIcon(Delete02Icon, "Trash2");
export const Pencil = createIcon(Edit01Icon, "Pencil");
export const RotateCcw = createIcon(RotateLeftIcon, "RotateCcw");
export const RefreshCw = createIcon(RotateRightIcon, "RefreshCw");
export const ReloadIcon = createIcon(ArrowReloadHorizontalIcon, "ReloadIcon"); // Proper reload icon
export const Search = createIcon(Search01Icon, "Search");
export const Send = createIcon(SentIcon, "Send");
export const ExternalLink = createIcon(Link02Icon, "ExternalLink");

// Media/Content Icons
export const BookOpen = createIcon(BookOpenIcon, "BookOpen");
export const FileText = createIcon(File01Icon, "FileText");
export const Newspaper = createIcon(News01Icon, "Newspaper");
export const StickyNote = createIcon(Note01Icon, "StickyNote");
export const Highlighter = createIcon(HighlighterIcon, "Highlighter");

// Communication Icons
export const MessageSquare = createIcon(Chat01Icon, "MessageSquare");

// AI/Brand Icons
export const ChatGpt = createIcon(ChatGptIcon, "ChatGpt");

// Status/Feedback Icons
export const Loader2 = createIcon(Loading01Icon, "Loader2");
export const Loader2Icon = createIcon(Loading01Icon, "Loader2Icon");
export const AlertTriangle = createIcon(Alert01Icon, "AlertTriangle");
export const Info = createIcon(InformationCircleIcon, "Info");
export const Zap = createIcon(FlashIcon, "Zap");
export const Star = createIcon(StarIcon, "Star");
export const Crown = createIcon(CrownIcon, "Crown");

// Theme Icons
export const Sun = createIcon(Sun01Icon, "Sun");
export const Moon = createIcon(Moon02Icon, "Moon"); // Crescent moon for dark mode
export const MoonFull = createIcon(Moon01Icon, "MoonFull"); // Full moon with details
export const Laptop = createIcon(ComputerIcon, "Laptop");
export const Monitor = createIcon(ComputerIcon, "Monitor");
export const MonitorPlay = createIcon(ComputerIcon, "MonitorPlay");

// User/Account Icons
export const User = createIcon(UserIcon, "User");
export const LogIn = createIcon(Login01Icon, "LogIn");
export const LogOut = createIcon(Logout01Icon, "LogOut");
export const Settings = createIcon(Settings05Icon, "Settings");

// Device Icons
export const Smartphone = createIcon(SmartPhone01Icon, "Smartphone");
export const Globe = createIcon(GlobeIcon, "Globe");

// Layout Icons
export const PanelLeft = createIcon(SidebarLeftIcon, "PanelLeft");
export const PanelLeftOpen = createIcon(PanelLeftOpenIcon, "PanelLeftOpen");
export const PanelLeftClose = createIcon(PanelLeftCloseIcon, "PanelLeftClose");
export const GripVertical = createIcon(Drag01Icon, "GripVertical");

// Misc Icons
export const Archive = createIcon(Archive01Icon, "Archive");
export const Bookmark = createIcon(Bookmark01Icon, "Bookmark");
export const BookMarked = createIcon(BookBookmark01Icon, "BookMarked");
export const Pin = createIcon(Pin02Icon, "Pin");
export const History = createIcon(ClockIcon, "History");
export const Square = createIcon(SquareIcon, "Square");
export const Terminal = createIcon(CommandLineIcon, "Terminal");
export const XCircle = createIcon(CancelCircleIcon, "XCircle");

// Additional Action Icons
export const Download = createIcon(Download01Icon, "Download");
export const Upload = createIcon(Upload01Icon, "Upload");
export const Share = createIcon(Share01Icon, "Share");
export const Share2 = createIcon(Share04Icon, "Share2"); // Clean share icon
export const ShareNodes = createIcon(Share02Icon, "ShareNodes"); // Connected nodes style
export const ShareIos = createIcon(UploadSquare01Icon, "ShareIos"); // iOS-style box with arrow
export const Link2 = createIcon(Link01Icon, "Link2");
export const Code = createIcon(CodeIcon, "Code");
export const Bug = createIcon(Bug01Icon, "Bug");

// Additional Communication Icons
export const MessageCircle = createIcon(BubbleChatIcon, "MessageCircle");

// Layout/Grid Icons
export const Grid3X3 = createIcon(GridIcon, "Grid3X3");
export const LayoutGrid = createIcon(LayoutGridIcon, "LayoutGrid");
export const List = createIcon(Menu11Icon, "List");
export const Calendar = createIcon(Calendar01Icon, "Calendar");
export const Command = createIcon(CommandIcon, "Command");
export const CornerDownLeft = createIcon(ArrowTurnBackwardIcon, "CornerDownLeft");

// Status Icons
export const TrendingUp = createIcon(Chart01Icon, "TrendingUp");
export const Ban = createIcon(CancelCircleIcon, "Ban");

// Payment Icons
export const CreditCard = createIcon(CreditCardIcon, "CreditCard");

// Social Icons
export const Twitter = createIcon(TwitterIcon, "Twitter");
export const Linkedin = createIcon(LinkedinIcon, "Linkedin");

// Additional compatibility icons (Lucide -> Hugeicons)
export const ListChecks = createIcon(CheckListIcon, "ListChecks");
export const Languages = createIcon(LanguageSkillIcon, "Languages");
export const CircleCheck = createIcon(CheckmarkCircle01Icon, "CircleCheck");
export const CircleCheckIcon = createIcon(CheckmarkCircle01Icon, "CircleCheckIcon");
export const LoaderCircle = createIcon(Loading03Icon, "LoaderCircle");
export const LoaderCircleIcon = createIcon(Loading03Icon, "LoaderCircleIcon");
export const OctagonX = createIcon(CancelCircleIcon, "OctagonX");
export const TriangleAlert = createIcon(Alert01Icon, "TriangleAlert");
export const TriangleAlertIcon = createIcon(Alert01Icon, "TriangleAlertIcon");
export const CircleAlert = createIcon(AlertCircleIcon, "CircleAlert");
export const CircleAlertIcon = createIcon(AlertCircleIcon, "CircleAlertIcon");
export const InfoIcon = createIcon(InformationCircleIcon, "InfoIcon");

// Type export for Lucide compatibility
export type LucideIcon = FC<IconProps>;

// Also export the raw Hugeicons for advanced usage
export { HugeiconsIcon } from "@hugeicons/react";
