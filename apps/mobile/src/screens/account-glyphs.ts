import {
  BankIcon,
  MoneyIcon,
  WalletIcon,
  CreditCardIcon,
  ChartLineUpIcon,
  CurrencyDollarIcon,
  BriefcaseIcon,
  PiggyBankIcon,
  HouseIcon,
  AirplaneIcon,
  ShieldIcon,
  TagIcon,
} from "phosphor-react-native";
import type { AccountIconKey } from "@hamster-ledger/core";
export const accountGlyphs = {
  bank: BankIcon,
  cash: MoneyIcon,
  wallet: WalletIcon,
  card: CreditCardIcon,
  invest: ChartLineUpIcon,
  currency: CurrencyDollarIcon,
  salary: BriefcaseIcon,
  savings: PiggyBankIcon,
  home: HouseIcon,
  travel: AirplaneIcon,
  reserve: ShieldIcon,
  other: TagIcon,
} satisfies Record<AccountIconKey, typeof BankIcon>;
