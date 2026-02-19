"use client";

import { ChevronDown, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Company, UserMe } from "@/lib/api-types";
import { getCompanyDashboardPath } from "@/lib/company-routing";

type TopBarProps = {
  user: UserMe;
  companies: Company[];
  activeCompany: Company;
  onLogout: () => void;
  onNavigate: (path: string) => void;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TopBar({ user, companies, activeCompany, onLogout, onNavigate }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6 shrink-0">
      {/* Left: Company switcher */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company</span>
        <Select
          value={activeCompany.slug}
          onValueChange={(slug) => onNavigate(getCompanyDashboardPath(slug))}
        >
          <SelectTrigger className="h-8 w-48 text-sm font-medium border-border bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.slug}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Right: User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {getInitials(user.full_name || user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start leading-none">
              <span className="font-medium text-foreground text-sm">{user.full_name || user.email}</span>
              {user.full_name && (
                <span className="text-xs text-muted-foreground">{user.email}</span>
              )}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 text-sm cursor-pointer" disabled>
            <User className="h-3.5 w-3.5" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-sm text-destructive focus:text-destructive cursor-pointer"
            onClick={onLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
