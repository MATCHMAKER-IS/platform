/** アプリ共通のテーマレジストリ(標準スキン11種)。独自スキンはここに register で追加。 */
import { createThemeRegistry, builtInThemes } from "@platform/theme";

export const themeRegistry = createThemeRegistry({ themes: builtInThemes });
