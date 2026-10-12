/*
 * Static command/alias snapshot from the official pnpm 12.7.0 npm release.
 * Sources: https://registry.npmjs.org/pnpm/12.7.0 and its optional dependency
 * https://registry.npmjs.org/@pnpm/exe.linux-x64/12.7.0 (native executable).
 * Upgrade: download both pinned tarballs; verify dist.integrity; extract the
 * executable and confirm --version, then collect Commands and aliases from
 * --help. Check completion output for completion-server and the matching tag's
 * pnpm/crates/cli/src/cli_args/cli_command/commands.rs for hidden registrations,
 * plus pm_prefix.rs for the pm prefix. pnpm 12 has no help --all or pnpm.cjs.
 * Reserved edit/profile/token/xmas names are registered even though pnpm says
 * to use npm instead. Never invoke pnpm while checking documents. Update the
 * version, names, and CLI fixtures together when packageManager changes.
 */
export const PNPM_BUILTINS_VERSION = '12.7.0';
export const PNPM_BUILTINS = new Set(
  `access add adduser approve-builds audit bin bugs c cache cat-file cat-index
  change ci clean clean-install completion completion-server config create
  dedupe deploy deprecate dislink dist-tag dist-tags dlx docs doctor edit env
  exec fetch find find-hash get help home i ic ignored-builds import info init
  install install-clean install-test issues it la lane licences licenses link
  list ll ln login logout ls m multi outdated owner owners pack pack-app patch
  patch-commit patch-remove peers ping pipeline pkg pm prefix profile prune
  publish purge rb rebuild recursive remove repo restart rm root rt run
  run-script runtime s sbom se search self-update set set-script setup shim
  show ss stage star stars start stop store t tasks team test token tst un
  undeprecate uni uninstall unlink unpublish unstar up update upgrade v version
  view whoami why with xmas`.split(/\s+/),
);
