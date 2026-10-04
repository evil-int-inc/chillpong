import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// The app's generated bindings re-export `ExternalBlob` from
// @caffeineai/object-storage, whose dist/index.js imports `./blob` without an
// extension. That resolves under Vite but not under Node ESM, so loading
// `@/backend` in the test environment fails. Tests never exercise the storage
// client, so stub the package with a minimal shape.
vi.mock("@caffeineai/object-storage", () => ({
  ExternalBlob: class ExternalBlob {
    _blob?: Uint8Array<ArrayBuffer>;
    directURL: string;

    constructor(
      directURL = "https://example.com/blob",
      bytes?: Uint8Array<ArrayBuffer>,
    ) {
      this.directURL = directURL;
      this._blob = bytes;
    }

    static fromURL(url: string) {
      return new ExternalBlob(url);
    }

    static fromBytes(bytes: Uint8Array<ArrayBuffer>) {
      return new ExternalBlob("blob:local-preview", bytes);
    }

    getDirectURL() {
      return this.directURL;
    }

    async getBytes() {
      return this._blob ?? new Uint8Array();
    }

    withUploadProgress(onProgress: (percentage: number) => void) {
      onProgress(100);
      return this;
    }
  },
}));

// Generated components use `data-ocid` as their test id attribute.
configure({ testIdAttribute: "data-ocid" });

// RTL auto-cleanup relies on a global `afterEach`; enable it explicitly since
// vitest globals are not turned on.
afterEach(() => {
  cleanup();
});
