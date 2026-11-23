import { BankIcon } from "@phosphor-icons/react/dist/csr/Bank";
import { MoneyIcon } from "@phosphor-icons/react/dist/csr/Money";
import { WalletIcon } from "@phosphor-icons/react/dist/csr/Wallet";
import { CreditCardIcon } from "@phosphor-icons/react/dist/csr/CreditCard";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { CurrencyDollarIcon } from "@phosphor-icons/react/dist/csr/CurrencyDollar";
import { BriefcaseIcon } from "@phosphor-icons/react/dist/csr/Briefcase";
import { PiggyBankIcon } from "@phosphor-icons/react/dist/csr/PiggyBank";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { AirplaneIcon } from "@phosphor-icons/react/dist/csr/Airplane";
import { ShieldIcon } from "@phosphor-icons/react/dist/csr/Shield";
import { TagIcon } from "@phosphor-icons/react/dist/csr/Tag";
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
