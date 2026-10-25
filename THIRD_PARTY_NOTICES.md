# Third-Party Notices

This inventory was generated from the current `package-lock.json` and the native build inputs on 2026-10-21. It is not a grant of rights to the EZ AI brand or product, and it does not resolve permission to redistribute third-party logos or product icons.

## JavaScript dependency tree

The lockfile contains 69 package entries: 22 Apache-2.0, 1 BSD-3-Clause, 2 ISC, 32 MIT and 12 MPL-2.0. Exact versions and integrity hashes are recorded in `package-lock.json`. Direct runtime dependencies used in the bundled frontend are React, React DOM, Lucide React and their transitive dependencies. The same lock also contains build/test tooling; not every locked package is shipped as an executable dependency.

Refer to each package's upstream license and notices using the package name/version and registry metadata in the lockfile. Before public distribution, archive the applicable full license texts and package-specific notices with the release; verify MPL source-distribution obligations for any modifications (EZ AI uses the libraries as dependencies and does not claim ownership of them).

## Native WebView2 components

The desktop package includes `Microsoft.Web.WebView2.Core.dll`, `Microsoft.Web.WebView2.Wpf.dll`, and `WebView2Loader.dll` from Microsoft.Web.WebView2 SDK 1.0.4258.31. Its cached NuGet package declares a license file and notice; `tools/Build-EzAiDesktop.ps1` now copies those into `release/WEBVIEW2-LICENSE.txt` and `release/WEBVIEW2-NOTICE.txt`. The Evergreen WebView2 browser runtime is a separate Microsoft prerequisite and is not bundled. Verify that the license and notice remain in any installer payload.

## System components

The WPF host targets .NET Framework and uses Windows-provided WPF/.NET assemblies. Windows itself supplies those components; they are not copied into the release payload.

## Marks and logos

The EZ AI shield is project artwork. The UI also contains names and icons associated with third-party AI products. Brand names may be used for compatibility identification, but permission and attribution for redistribution of each product logo/icon have not yet been documented. The MIT License does not grant rights to these names, logos or artwork. Resolve that rights review before a public release.

## Product license

EZ AI's own source code is licensed under the MIT License in [`LICENSE`](LICENSE) (Copyright (c) 2026 xAerux). That license covers EZ AI's own code only. It does not cover the third-party components listed in this file, which remain under their own licences, or the third-party names, logos, trademarks and artwork described above. The owner must confirm MIT as the final distribution licence. The EULA draft in `docs/EULA-DRAFT.md` is unapproved and not in effect.

## Locked package inventory

The following table records package versions and license identifiers from the committed lockfile. It covers build-time and transitive packages as well as code included in the frontend bundle.

| Package | Version | SPDX/license metadata |
|---|---:|---|
| `@oxc-project/types` | `0.154.0` | `MIT` |
| `@rolldown/binding-android-arm-eabi` | `1.2.14` | `MIT` |
| `@rolldown/binding-android-arm64` | `1.2.14` | `MIT` |
| `@rolldown/binding-darwin-arm64` | `1.2.14` | `MIT` |
| `@rolldown/binding-darwin-x64` | `1.2.14` | `MIT` |
| `@rolldown/binding-freebsd-x64` | `1.2.14` | `MIT` |
| `@rolldown/binding-linux-arm-gnueabihf` | `1.2.14` | `MIT` |
| `@rolldown/binding-linux-arm64-gnu` | `1.2.14` | `MIT` |
| `@rolldown/binding-linux-arm64-musl` | `1.2.14` | `MIT` |
| `@rolldown/binding-linux-ppc64-gnu` | `1.2.14` | `MIT` |
| `@rolldown/binding-linux-s390x-gnu` | `1.2.14` | `MIT` |
| `@rolldown/binding-linux-x64-gnu` | `1.2.14` | `MIT` |
| `@rolldown/binding-linux-x64-musl` | `1.2.14` | `MIT` |
| `@rolldown/binding-openharmony-arm64` | `1.2.14` | `MIT` |
| `@rolldown/binding-win32-arm64-msvc` | `1.2.14` | `MIT` |
| `@rolldown/binding-win32-x64-msvc` | `1.2.14` | `MIT` |
| `@rolldown/pluginutils` | `1.0.1` | `MIT` |
| `@types/react` | `19.3.0` | `MIT` |
| `@types/react-dom` | `19.3.0` | `MIT` |
| `@typescript/typescript-aix-ppc64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-darwin-arm64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-darwin-x64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-freebsd-arm64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-freebsd-x64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-linux-arm` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-linux-arm64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-linux-loong64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-linux-mips64el` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-linux-ppc64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-linux-riscv64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-linux-s390x` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-linux-x64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-netbsd-arm64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-netbsd-x64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-openbsd-arm64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-openbsd-x64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-sunos-x64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-win32-arm64` | `7.0.2` | `Apache-2.0` |
| `@typescript/typescript-win32-x64` | `7.0.2` | `Apache-2.0` |
| `@vitejs/plugin-react` | `6.1.2` | `MIT` |
| `csstype` | `3.2.3` | `MIT` |
| `detect-libc` | `2.1.2` | `Apache-2.0` |
| `fdir` | `6.5.0` | `MIT` |
| `fsevents` | `2.3.3` | `MIT` |
| `lightningcss` | `1.33.0` | `MPL-2.0` |
| `lightningcss-android-arm64` | `1.33.0` | `MPL-2.0` |
| `lightningcss-darwin-arm64` | `1.33.0` | `MPL-2.0` |
| `lightningcss-darwin-x64` | `1.33.0` | `MPL-2.0` |
| `lightningcss-freebsd-x64` | `1.33.0` | `MPL-2.0` |
| `lightningcss-linux-arm-gnueabihf` | `1.33.0` | `MPL-2.0` |
| `lightningcss-linux-arm64-gnu` | `1.33.0` | `MPL-2.0` |
| `lightningcss-linux-arm64-musl` | `1.33.0` | `MPL-2.0` |
| `lightningcss-linux-x64-gnu` | `1.33.0` | `MPL-2.0` |
| `lightningcss-linux-x64-musl` | `1.33.0` | `MPL-2.0` |
| `lightningcss-win32-arm64-msvc` | `1.33.0` | `MPL-2.0` |
| `lightningcss-win32-x64-msvc` | `1.33.0` | `MPL-2.0` |
| `lucide-react` | `0.468.0` | `ISC` |
| `nanoid` | `3.3.20` | `MIT` |
| `picocolors` | `1.1.1` | `ISC` |
| `picomatch` | `4.0.7` | `MIT` |
| `postcss` | `8.5.31` | `MIT` |
| `react` | `19.3.1` | `MIT` |
| `react-dom` | `19.3.1` | `MIT` |
| `rolldown` | `1.2.14` | `MIT` |
| `scheduler` | `0.28.0` | `MIT` |
| `source-map-js` | `1.2.2` | `BSD-3-Clause` |
| `tinyglobby` | `0.2.17` | `MIT` |
| `typescript` | `7.0.2` | `Apache-2.0` |
| `vite` | `8.3.4` | `MIT` |

## Installer toolchain

The local beta installer is built with NSIS 3.13 and the NSIS LZMA compressor. The installer package contains `NSIS-COPYING.txt` copied from the compiler distribution; NSIS 3.13's license identifies the included LZMA module as Common Public License 1.0, with the other NSIS materials primarily under zlib/libpng and bzip2 terms. The portable archive was retrieved from the Tauri binary-releases mirror only after SourceForge delivery routes repeatedly returned HTML, and its bytes matched SourceForge's published SHA-256 exactly (`ba63dffc4410ee89193e1cb5a41989991bd77c61068da17e3156d136b7b0b3d8`). This checksum match establishes byte identity with the SourceForge release file; it does not make the mirror an official NSIS source. The NSIS compiler itself is not included as a separate installed application.
