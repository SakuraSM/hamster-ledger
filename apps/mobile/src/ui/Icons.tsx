import { HouseIcon as House } from "phosphor-react-native";
import { ListBulletsIcon as ListBullets } from "phosphor-react-native";
import { WalletIcon as Wallet } from "phosphor-react-native";
import { ChartPieIcon as ChartPie } from "phosphor-react-native";
import { DotsThreeIcon as DotsThree } from "phosphor-react-native";
import { ArrowLeftIcon as ArrowLeft } from "phosphor-react-native";
import { ArrowRightIcon as ArrowRight } from "phosphor-react-native";
import { CaretLeftIcon as CaretLeft } from "phosphor-react-native";
import { CaretRightIcon as CaretRight } from "phosphor-react-native";
import { CaretDownIcon as CaretDown } from "phosphor-react-native";
import { CaretUpIcon as CaretUp } from "phosphor-react-native";
import { PlusIcon as Plus } from "phosphor-react-native";
import { XIcon as X } from "phosphor-react-native";
import { CheckIcon as Check } from "phosphor-react-native";
import { MagnifyingGlassIcon as MagnifyingGlass } from "phosphor-react-native";
import { EyeIcon as Eye } from "phosphor-react-native";
import { EyeSlashIcon as EyeSlash } from "phosphor-react-native";
import { ArrowCounterClockwiseIcon as ArrowCounterClockwise } from "phosphor-react-native";
import { BookOpenIcon as BookOpen } from "phosphor-react-native";
import { BookIcon as Book } from "phosphor-react-native";
import { CalendarBlankIcon as CalendarBlank } from "phosphor-react-native";
import { ClockIcon as Clock } from "phosphor-react-native";
import { UploadSimpleIcon as UploadSimple } from "phosphor-react-native";
import { ShareNetworkIcon as ShareNetwork } from "phosphor-react-native";
import { TableIcon as Table } from "phosphor-react-native";
import { FilesIcon as Files } from "phosphor-react-native";
import { FileArrowUpIcon as FileArrowUp } from "phosphor-react-native";
import { FileArrowDownIcon as FileArrowDown } from "phosphor-react-native";
import { ArrowsLeftRightIcon as ArrowsLeftRight } from "phosphor-react-native";
import { ArrowCircleDownIcon as ArrowCircleDown } from "phosphor-react-native";
import { ReceiptIcon as Receipt } from "phosphor-react-native";
import { CreditCardIcon as CreditCard } from "phosphor-react-native";
import { SquareIcon as Square } from "phosphor-react-native";
import { CheckSquareIcon as CheckSquare } from "phosphor-react-native";
import { CircleIcon as Circle } from "phosphor-react-native";
import { RadioButtonIcon as RadioButton } from "phosphor-react-native";
import { TrashIcon as Trash } from "phosphor-react-native";
import { GearIcon as Gear } from "phosphor-react-native";
import { UserIcon as User } from "phosphor-react-native";
import { ShieldCheckIcon as ShieldCheck } from "phosphor-react-native";
import { QuestionIcon as Question } from "phosphor-react-native";
import type { Icon } from "phosphor-react-native";
const ICONS: Record<string, Icon> = {
  "home-outline": House,
  home: House,
  "format-list-bulleted": ListBullets,
  "wallet-outline": Wallet,
  "chart-pie": ChartPie,
  "dots-horizontal": DotsThree,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "chevron-left": CaretLeft,
  "chevron-right": CaretRight,
  "chevron-down": CaretDown,
  "chevron-up": CaretUp,
  "menu-down": CaretDown,
  "menu-up": CaretUp,
  plus: Plus,
  close: X,
  check: Check,
  magnify: MagnifyingGlass,
  eye: Eye,
  "eye-off": EyeSlash,
  undo: ArrowCounterClockwise,
  "book-open-variant": BookOpen,
  "book-outline": Book,
  calendar: CalendarBlank,
  "clock-outline": Clock,
  upload: UploadSimple,
  "share-variant": ShareNetwork,
  table: Table,
  "content-duplicate": Files,
  "file-upload-outline": FileArrowUp,
  "file-restore": FileArrowDown,
  "swap-horizontal": ArrowsLeftRight,
  "arrow-down-circle-outline": ArrowCircleDown,
  receipt: Receipt,
  "credit-card-outline": CreditCard,
  "checkbox-blank-outline": Square,
  "checkbox-marked": CheckSquare,
  "checkbox-intermediate": CheckSquare,
  "radiobox-blank": Circle,
  "radiobox-marked": RadioButton,
  delete: Trash,
  cog: Gear,
  "account-circle-outline": User,
  "shield-check-outline": ShieldCheck,
};
export function AppIcon({
  name,
  size,
  color,
}: {
  name: string;
  size: number;
  color?: string;
}): React.JSX.Element {
  const Component = ICONS[name] ?? Question;
  return <Component size={size} color={color} weight="regular" />;
}
export const iconSettings = { icon: AppIcon };
