"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getProvinces,
  getWardsByProvince,
  type ProvinceResponse,
  type WardResponse,
} from "@/lib/api/address";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

// ── Vietnamese tone-insensitive filter ─────────────────────────────────────────

function removeVietnameseTones(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD") // decompose precomposed characters (NFC → NFD)
    .replace(/[\u0300-\u036f]/g, "") // strip all combining diacritic marks
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function viFilter(value: string, search: string): number {
  if (!search) return 1;
  return removeVietnameseTones(value).includes(removeVietnameseTones(search))
    ? 1
    : 0;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface AddressPickerProps {
  provinceCode?: number;
  wardCode?: number;
  provinceName?: string;
  wardName?: string;
  onProvinceChange: (code: number, name: string) => void;
  onWardChange: (code: number, name: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AddressPicker({
  provinceCode,
  wardCode,
  provinceName,
  wardName,
  onProvinceChange,
  onWardChange,
}: AddressPickerProps) {
  const [provinces, setProvinces] = useState<ProvinceResponse[]>([]);
  const [wards, setWards] = useState<WardResponse[]>([]);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingWards, setIsLoadingWards] = useState(false);
  const [provincePopoverOpen, setProvincePopoverOpen] = useState(false);
  const [wardPopoverOpen, setWardPopoverOpen] = useState(false);

  // Load provinces once on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoadingProvinces(true);

    getProvinces()
      .then((data) => {
        if (!cancelled) setProvinces(data);
      })
      .catch(() => {
        // silently fail – user can retry by re-mounting or refreshing
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProvinces(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Reload wards whenever the selected province changes
  useEffect(() => {
    if (!provinceCode) {
      setWards([]);
      return;
    }

    let cancelled = false;
    setIsLoadingWards(true);
    setWards([]);

    getWardsByProvince(provinceCode)
      .then((data) => {
        if (!cancelled) setWards(data);
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => {
        if (!cancelled) setIsLoadingWards(false);
      });

    return () => {
      cancelled = true;
    };
  }, [provinceCode]);

  useEffect(() => {
    if (!provinceCode && provinceName && provinces.length > 0) {
      const found = provinces.find((p) => p.name === provinceName);
      if (found) {
        onProvinceChange(found.code, found.name);
      }
    }
  }, [provinces, provinceCode, provinceName, onProvinceChange]);

  useEffect(() => {
    if (provinceCode && !wardCode && wardName && wards.length > 0) {
      const found = wards.find((w) => w.name === wardName);
      if (found) {
        onWardChange(found.code, found.name);
      }
    }
  }, [wards, provinceCode, wardCode, wardName, onWardChange]);

  // Derived display values
  const selectedProvince =
    provinces.find((p) => p.code === provinceCode) ??
    provinces.find((p) => p.name === provinceName);
  const selectedWard =
    wards.find((w) => w.code === wardCode) ??
    wards.find((w) => w.name === wardName);

  const handleProvinceSelect = (province: ProvinceResponse) => {
    onProvinceChange(province.code, province.name);
    onWardChange(0, ""); // signal parent to clear ward selection
    setProvincePopoverOpen(false);
  };

  const handleWardSelect = (ward: WardResponse) => {
    onWardChange(ward.code, ward.name);
    setWardPopoverOpen(false);
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      {/* ── Province Combobox ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Province / City
        </label>
        <Popover
          open={provincePopoverOpen}
          onOpenChange={setProvincePopoverOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={provincePopoverOpen}
              disabled={isLoadingProvinces}
              className="w-full justify-between font-normal"
            >
              {isLoadingProvinces ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading…
                </span>
              ) : selectedProvince ? (
                selectedProvince.name
              ) : (
                <span className="text-muted-foreground">Select province…</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command filter={viFilter}>
              <CommandInput placeholder="Search province…" />
              <CommandList>
                <CommandEmpty>No province found.</CommandEmpty>
                <CommandGroup>
                  {provinces.map((p) => (
                    <CommandItem
                      key={p.code}
                      value={p.name}
                      onSelect={() => handleProvinceSelect(p)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          provinceCode === p.code ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {p.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Ward Combobox ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Ward</label>
        <Popover open={wardPopoverOpen} onOpenChange={setWardPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={wardPopoverOpen}
              disabled={!provinceCode || isLoadingWards}
              className="w-full justify-between font-normal"
            >
              {isLoadingWards ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading wards…
                </span>
              ) : selectedWard ? (
                selectedWard.name
              ) : (
                <span className="text-muted-foreground">
                  {provinceCode ? "Select ward…" : "Select province first"}
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command filter={viFilter}>
              <CommandInput placeholder="Search wards…" />
              <CommandList>
                <CommandEmpty>No wards found.</CommandEmpty>
                <CommandGroup>
                  {wards.map((w) => (
                    <CommandItem
                      key={w.code}
                      value={w.name}
                      onSelect={() => handleWardSelect(w)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          wardCode === w.code ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {w.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
