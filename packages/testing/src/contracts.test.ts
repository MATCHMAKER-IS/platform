import { createCache, createMemoryCache } from "@platform/cache";
import { createStorage, createLocalStorage } from "@platform/storage";
import { runCacheContract } from "./contracts/cache.js";
import { runStorageContract } from "./contracts/storage.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

runCacheContract("memory", () => createCache(createMemoryCache()));
runStorageContract("local", () => createStorage(createLocalStorage(mkdtempSync(join(tmpdir(), "st-")))));
