/**
 * zod スキーマから型安全なフォームを作るフック。
 * react-hook-form + @hookform/resolvers/zod を配線し、値の型をスキーマから推論する。
 * @packageDocumentation
 */
import { useForm, type UseFormProps, type UseFormReturn, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

/**
 * zod スキーマを渡すだけで、検証済み・型付きの react-hook-form を返す。
 *
 * @typeParam S zod スキーマ型
 * @param schema バリデーションスキーマ(`@platform/validation` の部品を組み合わせて作る)
 * @param options useForm のオプション(resolver 以外。defaultValues 等)
 * @returns react-hook-form の `UseFormReturn`
 *
 * @example
 * ```ts
 * const schema = z.object({ email, name: requiredString() });
 * const form = useZodForm(schema, { defaultValues: { email: "", name: "" } });
 * ```
 */
export function useZodForm<S extends z.ZodType<FieldValues>>(
  schema: S,
  options?: Omit<UseFormProps<z.output<S>>, "resolver">,
): UseFormReturn<z.output<S>> {
  return useForm<z.output<S>>({
    ...options,
    resolver: zodResolver(schema) as never,
  });
}
