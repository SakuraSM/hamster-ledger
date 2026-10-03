import { EyeIcon } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import { ChartPieIcon } from "@phosphor-icons/react/dist/csr/ChartPie";
import { CreditCardIcon } from "@phosphor-icons/react/dist/csr/CreditCard";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { LinkIcon } from "@phosphor-icons/react/dist/csr/Link";
import { BookOpenTextIcon } from "@phosphor-icons/react/dist/csr/BookOpenText";
import { ShoppingCartIcon } from "@phosphor-icons/react/dist/csr/ShoppingCart";
import { ForkKnifeIcon } from "@phosphor-icons/react/dist/csr/ForkKnife";
import { CoffeeIcon } from "@phosphor-icons/react/dist/csr/Coffee";
import { TrainIcon } from "@phosphor-icons/react/dist/csr/Train";
import { BriefcaseIcon } from "@phosphor-icons/react/dist/csr/Briefcase";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { FileCsvIcon } from "@phosphor-icons/react/dist/csr/FileCsv";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { TrayIcon } from "@phosphor-icons/react/dist/csr/Tray";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { WechatLogoIcon } from "@phosphor-icons/react/dist/csr/WechatLogo";
import { BankIcon } from "@phosphor-icons/react/dist/csr/Bank";
import { WalletIcon } from "@phosphor-icons/react/dist/csr/Wallet";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { ArrowsLeftRightIcon } from "@phosphor-icons/react/dist/csr/ArrowsLeftRight";
import type { Category, Source } from "@hamster-ledger/core";

export const Icons = {
  Eye: EyeIcon,
  EyeOff: EyeSlashIcon,
  Shield: ShieldCheckIcon,
  SignOut: SignOutIcon,
  Chart: ChartPieIcon,
  House: HouseIcon,
  List: ListBulletsIcon,
  Upload: UploadSimpleIcon,
  Link: LinkIcon,
  Book: BookOpenTextIcon,
  Cart: ShoppingCartIcon,
  Food: ForkKnifeIcon,
  Coffee: CoffeeIcon,
  Train: TrainIcon,
  Briefcase: BriefcaseIcon,
  Arrow: ArrowRightIcon,
  Warning: WarningCircleIcon,
  File: FileCsvIcon,
  Check: CheckCircleIcon,
  Undo: ArrowCounterClockwiseIcon,
  Download: DownloadSimpleIcon,
  Close: XIcon,
  Caret: CaretRightIcon,
  Search: MagnifyingGlassIcon,
  Settings: SlidersHorizontalIcon,
  Empty: TrayIcon,
  Calendar: CalendarBlankIcon,
  Wechat: WechatLogoIcon,
  Bank: BankIcon,
  Wallet: WalletIcon,
  Credit: CreditCardIcon,
  Plus: PlusIcon,
  Edit: PencilSimpleIcon,
  Transfer: ArrowsLeftRightIcon,
};
interface CategoryIconProps {
  category: Category;
  merchant?: string;
}
export function CategoryIcon({
  category,
  merchant = "",
}: CategoryIconProps): React.JSX.Element {
  const iconMap: Partial<Record<Category, typeof HouseIcon>> = {
    购物: ShoppingCartIcon,
    餐饮: ForkKnifeIcon,
    居住: HouseIcon,
    交通: TrainIcon,
    日用: ShoppingCartIcon,
    工资: BriefcaseIcon,
  };
  const Icon = /咖啡|星巴克/.test(merchant)
    ? CoffeeIcon
    : (iconMap[category] ?? WalletIcon);
  return <Icon size={22} weight="duotone" aria-hidden="true" />;
}
interface SourceIconProps {
  source: Source;
}
export function SourceIcon({ source }: SourceIconProps): React.JSX.Element {
  const Icon =
    source === "微信支付"
      ? WechatLogoIcon
      : source === "支付宝"
        ? WalletIcon
        : BankIcon;
  const color =
    source === "微信支付" ? "wechat" : source === "支付宝" ? "alipay" : "bank";
  return (
    <span className={`source-icon ${color}`}>
      <Icon size={23} weight="fill" aria-hidden="true" />
    </span>
  );
}
