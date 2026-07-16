"use client";
/**
 * スキン適用の client 境界。
 *
 * ThemeRegistry は関数(register / resolve など)を持つオブジェクトなので、
 * Server Component から Client Component へ props で渡すと RSC のシリアライズを
 * 通れず、`next build` のプリレンダで落ちる:
 *
 *   Error: Functions cannot be passed directly to Client Components
 *
 * そこで境界の内側(= このファイル)でレジストリを作り、layout.tsx からは
 * <Skin> だけを使う。レジストリは server 側に一切現れない。
 * @packageDocumentation
 */
import * as React from "react";
import { createThemeRegistry, builtInThemes } from "@platform/theme";
import { AppSkin } from "@platform/ui";

/** モジュールスコープ = クライアント側で1回だけ生成される(再レンダで作り直さない)。 */
const registry = createThemeRegistry({ themes: builtInThemes });

export function Skin({ children }: { children: React.ReactNode }) {
  return <AppSkin registry={registry}>{children}</AppSkin>;
}
