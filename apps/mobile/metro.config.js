// Monorepo-aware Metro config (Expo SDK 52) with NativeWind.
//
// Two non-default things are required for a workspace setup:
//   1. Watch the repo root so changes in packages/shared trigger reloads.
//   2. Resolve modules from both the app's and the root's node_modules so the
//      hoisted workspace deps (and the @stridequest/shared symlink) are found.
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
// @stridequest/shared ships raw TypeScript source via package "exports".
config.resolver.unstable_enablePackageExports = true

module.exports = withNativeWind(config, { input: './global.css' })
